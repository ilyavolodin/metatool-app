import { randomUUID } from 'node:crypto';

import { SseError } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { NextRequest, NextResponse } from 'next/server';

import { mcpProxy } from '@/app/lib/mcpUtils'; // Corrected path
import { createMetaMcpTransport } from '@/app/lib/transports'; // Corrected path
import { metaMcpConnections } from '@/app/lib/types'; // Corrected path
import * as logger from '@/lib/logger'; // This path is likely correct as lib/ is top-level
// API key is from path param

// Helper to create a mock Response object (copied from app/api/mcp/route.ts)
function createMockResponse(writer: WritableStreamDefaultWriter) {
  const headers = new Headers(); // Changed to const
  let status = 200;
  return {
    writeHead: (s: number, h: Record<string, string> = {}) => {
      status = s;
      for (const key in h) {
        headers.set(key, h[key]);
      }
    },
    write: (chunk: Uint8Array | string) => {
      writer.write(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
      return true;
    },
    end: (chunk?: Uint8Array | string) => {
      if (chunk) {
        writer.write(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
      }
      writer.close();
    },
    on: (_event: string, _listener: () => void) => {}, // Prefixed unused args
    flushHeaders: () => {},
    getHeader: (name: string) => headers.get(name),
    setHeader: (name: string, value: string | string[]) => {
      if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      } else {
        headers.set(name, value);
      }
    },
    _getResponseData: () => ({ status, headers }),
  } as any;
}

export async function GET(req: NextRequest, { params }: { params: { apiKey: string } }) {
  try {
    const apiKeyFromPath = params.apiKey;
    if (!apiKeyFromPath) {
      // This should ideally be caught by Next.js routing if param is mandatory
      logger.warn('API key missing in path for GET /api/api-key/.../mcp');
      return NextResponse.json({ error: 'API key in path is required' }, { status: 400 });
    }

    const sessionId = req.headers.get('mcp-session-id');
    logger.log(`Received GET /api/api-key/${apiKeyFromPath}/mcp with sessionId ${sessionId}`);

    if (!sessionId) {
      logger.warn(`mcp-session-id header is required for GET /api/api-key/${apiKeyFromPath}/mcp`);
      return NextResponse.json({ error: 'mcp-session-id header is required' }, { status: 400 });
    }

    const connection = metaMcpConnections.get(sessionId);
    if (!connection || !connection.webAppTransport) {
      logger.warn(`Session not found for GET /api/api-key/${apiKeyFromPath}/mcp: ${sessionId}`);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const transport = connection.webAppTransport as StreamableHTTPServerTransport;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const mockRes = createMockResponse(writer);

    transport.handleRequest(req as any, mockRes);

    const { status, headers } = mockRes._getResponseData();
    return new NextResponse(readable, { status, headers });

  } catch (error) {
    logger.error(`Error in /api-key/${params.apiKey}/mcp GET route:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { apiKey: string } }) {
  try {
    const apiKeyFromPath = params.apiKey;
    if (!apiKeyFromPath) {
      logger.warn('API key missing in path for POST /api/api-key/.../mcp');
      return NextResponse.json({ error: 'API key in path is required' }, { status: 400 });
    }

    logger.log(`Received POST /api/api-key/${apiKeyFromPath}/mcp`);

    let sessionId = req.headers.get('mcp-session-id');
    logger.log(`Session ID from header: ${sessionId || 'not provided'} for POST /api/api-key/${apiKeyFromPath}/mcp`);

    const requestBody = await req.json();

    if (!sessionId) {
      logger.log(`New streamable-http connection for API key from path: ${apiKeyFromPath}`);
      let initialBackingServerTransport;

      try {
        initialBackingServerTransport = await createMetaMcpTransport(apiKeyFromPath);
      } catch (error) {
        if (error instanceof SseError && error.code === 401) {
          logger.error(`Received 401 Unauthorized from MCP server (API key ${apiKeyFromPath} in path):`, error.message);
          return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 401 }
          );
        }
        logger.error(`Error creating initial backing transport for new session (API key ${apiKeyFromPath} in path):`, error);
        return NextResponse.json({ error: 'Failed to initialize session' }, { status: 500 });
      }
      logger.log(`Connected initial MCP client to backing server transport (API key ${apiKeyFromPath} in path)`);

      const webAppTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: async (newSessionId) => {
          logger.log(`Streamable web app transport ${newSessionId} initialized (API key ${apiKeyFromPath} in path)`);
          sessionId = newSessionId;

          try {
            const sessionBackingTransport = await createMetaMcpTransport(apiKeyFromPath);

            metaMcpConnections.set(newSessionId, {
              webAppTransport,
              backingServerTransport: sessionBackingTransport,
            });

            if (sessionBackingTransport instanceof StdioClientTransport && sessionBackingTransport.stderr) {
              sessionBackingTransport.stderr.on('data', (chunk) => {
                webAppTransport.send({
                  jsonrpc: '2.0',
                  method: 'notifications/stderr',
                  params: { content: chunk.toString() },
                });
              });
            }

            mcpProxy({
              transportToClient: webAppTransport,
              transportToServer: sessionBackingTransport,
            });
            logger.log(`Set up session-specific transport and proxy for session ${newSessionId} (API key ${apiKeyFromPath} in path)`);

          } catch (error) {
            logger.error(`Error creating session-specific backing transport for ${newSessionId} (API key ${apiKeyFromPath} in path):`, error);
            webAppTransport.send({jsonrpc: "2.0", id: null, error: {code: -32000, message: "Failed to establish full session connection"}})
            metaMcpConnections.delete(newSessionId);
            webAppTransport.close().catch(e => logger.error("Error closing web app transport during session init failure", e));
          }
        }
      });

      await webAppTransport.start();

      webAppTransport.onclose = async () => {
        const id = webAppTransport.sessionId || sessionId;
        logger.log(`Connection closed for session ${id} (API key ${apiKeyFromPath} in path)`);
        const conn = metaMcpConnections.get(id || '');
        if (conn?.backingServerTransport) {
          try {
            await conn.backingServerTransport.close();
            logger.log(`Closed backing transport for session ${id}`);
          } catch (err) {
            logger.error(`Error closing backing transport for session ${id}:`, err);
          }
        }
        if (id) metaMcpConnections.delete(id);
      };

      mcpProxy({
        transportToClient: webAppTransport,
        transportToServer: initialBackingServerTransport,
      });
      if (initialBackingServerTransport instanceof StdioClientTransport && initialBackingServerTransport.stderr) {
         initialBackingServerTransport.stderr.on('data', (chunk) => {
           if (!webAppTransport.sessionId) {
             webAppTransport.send({
                jsonrpc: '2.0',
                method: 'notifications/stderr',
                params: { content: chunk.toString() },
             });
           }
         });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const mockRes = createMockResponse(writer);

      await webAppTransport.handleRequest(req as any, mockRes, requestBody);

      const { status, headers } = mockRes._getResponseData();
      if (webAppTransport.sessionId && !headers.has('mcp-session-id')) {
        headers.set('mcp-session-id', webAppTransport.sessionId);
      }

      return new NextResponse(readable, { status, headers });

    } else {
      // Existing connection
      const connection = metaMcpConnections.get(sessionId);
      if (!connection || !connection.webAppTransport) {
        logger.warn(`Session not found for POST /api/api-key/${apiKeyFromPath}/mcp: ${sessionId}`);
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const transport = connection.webAppTransport as StreamableHTTPServerTransport;
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const mockRes = createMockResponse(writer);

      await transport.handleRequest(req as any, mockRes, requestBody);

      const { status, headers } = mockRes._getResponseData();
      return new NextResponse(readable, { status, headers });
    }
  } catch (error) {
    logger.error(`Error in /api-key/${params.apiKey}/mcp POST route:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
