import { randomUUID } from 'node:crypto';

import { SseError } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { NextRequest, NextResponse } from 'next/server';

import { mcpProxy } from '@/app/lib/mcpUtils'; // Corrected
import { createMetaMcpTransport } from '@/app/lib/transports'; // Corrected
import { metaMcpConnections } from '@/app/lib/types'; // Corrected
import { extractApiKey } from '@/app/lib/utils'; // Corrected
import * as logger from '@/lib/logger'; // Correct

// Helper to create a mock Response object for StreamableHTTPServerTransport
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
    on: (_event: string, _listener: () => void) => { // Prefixed unused
      // Could handle 'close' if needed, e.g. req.signal.onabort
    },
    flushHeaders: () => { /* Next.js handles this */ },
    getHeader: (name: string) => headers.get(name),
    setHeader: (name: string, value: string | string[]) => {
      if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      } else {
        headers.set(name, value);
      }
    },
    // Return collected headers and status for the final NextResponse
    _getResponseData: () => ({ status, headers }),
  } as any; // Cast to 'any' to satisfy Express types for the SDK
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      logger.warn('Missing or invalid Bearer token for GET /api/mcp');
      return NextResponse.json({ error: 'Missing or invalid Bearer token' }, { status: 401 });
    }
    const sessionId = req.headers.get('mcp-session-id');
    logger.log(`Received GET /api/mcp with Bearer token and sessionId ${sessionId}`);

    if (!sessionId) {
      logger.warn('mcp-session-id header is required for GET /api/mcp');
      return NextResponse.json({ error: 'mcp-session-id header is required' }, { status: 400 });
    }

    const connection = metaMcpConnections.get(sessionId);
    if (!connection || !connection.webAppTransport) {
      logger.warn(`Session not found for GET /api/mcp: ${sessionId}`);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const transport = connection.webAppTransport as StreamableHTTPServerTransport;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const mockRes = createMockResponse(writer);

    // StreamableHTTPServerTransport.handleRequest for GET will typically hold the connection
    // and write messages as they become available from the backing server.
    transport.handleRequest(req as any, mockRes); // req might need more mocking if SDK uses more fields

    const { status, headers } = mockRes._getResponseData();
    return new NextResponse(readable, { status, headers });

  } catch (error) {
    logger.error('Error in /api/mcp GET route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      logger.warn('Missing or invalid Bearer token for POST /api/mcp');
      return NextResponse.json({ error: 'Missing or invalid Bearer token' }, { status: 401 });
    }
    logger.log(`Received POST /api/mcp with Bearer token`);

    let sessionId = req.headers.get('mcp-session-id');
    logger.log(`Session ID from header: ${sessionId || 'not provided'} for POST /api/mcp`);

    const requestBody = await req.json();

    if (!sessionId) {
      logger.log('New streamable-http connection for MetaMCP (POST /api/mcp)');
      let initialBackingServerTransport;

      try {
        initialBackingServerTransport = await createMetaMcpTransport(apiKey);
      } catch (error) {
        if (error instanceof SseError && error.code === 401) {
          logger.error('Received 401 Unauthorized from MCP server:', error.message);
          return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 401 }
          );
        }
        logger.error('Error creating initial backing transport for new session:', error);
        return NextResponse.json({ error: 'Failed to initialize session' }, { status: 500 });
      }
      logger.log(`Connected initial MCP client to backing server transport with Bearer token`);

      const webAppTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: async (newSessionId) => {
          logger.log(`Streamable web app transport ${newSessionId} initialized (POST /api/mcp)`);
          sessionId = newSessionId; // Capture the generated session ID

          try {
            const sessionBackingTransport = await createMetaMcpTransport(apiKey);

            metaMcpConnections.set(newSessionId, {
              webAppTransport, // The same webAppTransport instance
              backingServerTransport: sessionBackingTransport,
            });

            if (sessionBackingTransport instanceof StdioClientTransport && sessionBackingTransport.stderr) {
              sessionBackingTransport.stderr.on('data', (chunk) => {
                webAppTransport.send({ // This `send` is to the client connected to `webAppTransport`
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
            logger.log(`Set up session-specific transport and proxy for session ${newSessionId}`);

          } catch (error) {
            logger.error(`Error creating session-specific backing transport for ${newSessionId}:`, error);
            // Important: If this fails, the client session might be in a weird state.
            // webAppTransport.send an error message to the client?
            webAppTransport.send({jsonrpc: "2.0", id: null, error: {code: -32000, message: "Failed to establish full session connection"}})
            // Clean up?
            metaMcpConnections.delete(newSessionId);
            webAppTransport.close().catch(e => logger.error("Error closing web app transport during session init failure", e));
          }
        }
      });

      await webAppTransport.start(); // Typically a no-op for StreamableHTTPServerTransport

      webAppTransport.onclose = async () => {
        const id = webAppTransport.sessionId || sessionId; // Use whichever sessionId is available
        logger.log(`Connection closed for session ${id} (POST /api/mcp)`);
        const conn = metaMcpConnections.get(id || '');
        if (conn?.backingServerTransport) {
          try {
            await conn.backingServerTransport.close();
            logger.log(`Closed backing transport for session ${id}`);
          } catch (err) {
            logger.error(`Error closing backing transport for session ${id}:`, err);
            // Removed duplicated catch block and the erroneous log line from within the first catch
          }
        }
        if (id) metaMcpConnections.delete(id);
      };

      // Proxy for the very first message using the initial backing transport
      mcpProxy({
        transportToClient: webAppTransport, // This webAppTransport instance
        transportToServer: initialBackingServerTransport, // Initial transport
      });
      if (initialBackingServerTransport instanceof StdioClientTransport && initialBackingServerTransport.stderr) {
         initialBackingServerTransport.stderr.on('data', (chunk) => {
           // This stderr is from the *initial* backing transport.
           // After session init, the session-specific backing transport's stderr is used.
           if (!webAppTransport.sessionId) { // Only send if session not yet initialized
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

      // Handle the first request which will trigger onsessioninitialized
      await webAppTransport.handleRequest(
        req as any,
        mockRes,
        requestBody
      );

      const { status, headers } = mockRes._getResponseData();
      // Ensure mcp-session-id is set from the transport's generated ID
      if (webAppTransport.sessionId && !headers.has('mcp-session-id')) {
        headers.set('mcp-session-id', webAppTransport.sessionId);
      }

      return new NextResponse(readable, { status, headers });

    } else {
      // Existing connection with session ID
      const connection = metaMcpConnections.get(sessionId);
      if (!connection || !connection.webAppTransport) {
        logger.warn(`Session not found for POST /api/mcp: ${sessionId}`);
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
    logger.error('Error in /api/mcp POST route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
