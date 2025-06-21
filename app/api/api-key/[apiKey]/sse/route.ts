import { SseError } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { NextRequest, NextResponse } from 'next/server';

import { mcpProxy } from '@/app/lib/mcpUtils'; // Corrected path
import { createMetaMcpTransport } from '@/app/lib/transports'; // Corrected path
import { metaMcpConnections } from '@/app/lib/types'; // Corrected path
import * as logger from '@/lib/logger'; // Correct
// Note: extractApiKey from utils.ts gets it from header, here we get it from path param.

interface ApiKeyRouteContext { // Added interface
  params: {
    apiKey: string;
  };
}

export async function GET(req: NextRequest, context: ApiKeyRouteContext) { // Changed signature
  const { params } = context; // Access params
  const apiKeyFromPath = params.apiKey;
  const routeName = `/api/api-key/${apiKeyFromPath}/sse`;
  try {
    if (!apiKeyFromPath) {
      logger.warn(`No API key provided in path for GET ${routeName}`);
      return NextResponse.json(
        { error: 'API key in path is required' },
        { status: 400 }
      );
    }

    logger.log(`New SSE connection for API key from path: ${apiKeyFromPath} (GET ${routeName})`);

    let backingServerTransport;

    try {
      backingServerTransport = await createMetaMcpTransport(apiKeyFromPath);
    } catch (error) {
      if (error instanceof SseError && error.code === 401) {
        logger.error(`Received 401 Unauthorized from MCP server (GET ${routeName}):`, error.message);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : String(error) },
          { status: 401 }
        );
      }
      logger.error(`Error creating backing transport (GET ${routeName}):`, error);
      return NextResponse.json(
        { error: 'Failed to connect to backing server' },
        { status: 500 }
      );
    }

    logger.log(`Connected MCP client to backing server transport for API key (GET ${routeName})`);

    const stream = new ReadableStream({
      async start(controller) {
        const webAppTransport = new SSEServerTransport(
          // The client will POST messages to /api/api-key/[apiKey]/message?sessionId=...
          `/api/api-key/${apiKey}/message`,
          {
            writeHead: (_status: number, _headers: Record<string, string>) => { // Prefixed unused
              // controller.enqueue(new TextEncoder().encode(`HTTP/1.1 ${status}\r\n`));
              // for (const [key, value] of Object.entries(headers)) {
              //   controller.enqueue(new TextEncoder().encode(`${key}: ${value}\r\n`));
              // }
              // controller.enqueue(new TextEncoder().encode('\r\n'));
              // Headers are set on the main NextResponse
            },
            write: (data: string) => {
              controller.enqueue(new TextEncoder().encode(data));
            },
            end: () => {
              controller.close();
            },
            on: (event: string, listener: () => void) => {
              if (event === 'close') {
                req.signal.onabort = listener; // Experimental: tie stream close to request abort
              }
            },
            flushHeaders: () => {}, // no-op
          } as any
        );

        await webAppTransport.start();

        if (backingServerTransport instanceof StdioClientTransport && backingServerTransport.stderr) {
          backingServerTransport.stderr.on('data', (chunk) => {
            webAppTransport.send({
              jsonrpc: '2.0',
              method: 'notifications/stderr',
              params: { content: chunk.toString() },
            });
          });
        }

        metaMcpConnections.set(webAppTransport.sessionId, {
          webAppTransport,
          backingServerTransport,
        });

        mcpProxy({
          transportToClient: webAppTransport,
          transportToServer: backingServerTransport,
        });

        req.signal.onabort = () => {
          logger.log(`SSE connection aborted by client for session ${webAppTransport.sessionId} (GET ${routeName})`);
          metaMcpConnections.delete(webAppTransport.sessionId);
          try {
            webAppTransport.close();
            backingServerTransport.close();
          } catch (e) {
            logger.error(`Error during transport close on abort (GET ${routeName}):`, e);
          }
          controller.close();
        };

        logger.log(`Set up MCP proxy for session ${webAppTransport.sessionId} (GET ${routeName})`);
      },
      cancel(reason) {
        logger.log(`SSE stream cancelled (GET ${routeName}):`, reason);
        // This might be called if the client closes the connection.
        // Ensure resources are cleaned up. The onabort above should handle it.
      }
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error(`Error in ${routeName} route:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
