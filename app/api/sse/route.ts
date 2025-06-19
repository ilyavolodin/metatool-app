import { SseError } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { NextRequest, NextResponse } from 'next/server';

import * as logger from '@/lib/logger';
import { mcpProxy } from '@/lib/mcpUtils';
import { createMetaMcpTransport } from '@/lib/transports';
import { metaMcpConnections } from '@/lib/types';
import { extractApiKey } from '@/lib/utils'; // Using extractApiKey

export async function GET(req: NextRequest) {
  const routeName = '/api/sse'; // For logging context
  try {
    const apiKey = extractApiKey(req); // Use extractApiKey
    if (!apiKey) {
      logger.warn(`No Authorization Bearer token provided for GET ${routeName}`);
      return NextResponse.json(
        { error: 'Authorization Bearer token is required' },
        { status: 401 }
      );
    }

    logger.log(`New SSE connection for API key from Authorization header (GET ${routeName})`);

    let backingServerTransport;

    try {
      backingServerTransport = await createMetaMcpTransport(apiKey);
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
          // The client will POST messages to /api/message?sessionId=...
          `/api/message`,
          {
            writeHead: (_status: number, _headers: Record<string, string>) => {}, // Prefixed unused
            write: (data: string) => {
              controller.enqueue(new TextEncoder().encode(data));
            },
            end: () => {
              controller.close();
            },
            on: (event: string, listener: () => void) => {
              if (event === 'close') {
                req.signal.onabort = listener;
              }
            },
            flushHeaders: () => {},
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
