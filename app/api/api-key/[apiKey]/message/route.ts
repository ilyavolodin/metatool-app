import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { NextRequest, NextResponse } from 'next/server';

import * as logger from '@/lib/logger';
import { metaMcpConnections } from '@/lib/types';
// import { extractApiKey } from '@/lib/utils'; // API key is from path param

export async function POST(req: NextRequest, { params }: { params: { apiKey: string } }) {
  const apiKeyFromPath = params.apiKey;
  const routeName = `/api/api-key/${apiKeyFromPath}/message`; // For logging context
  try {
    if (!apiKeyFromPath) {
      logger.warn(`No API key provided in path for POST ${routeName}`);
      return NextResponse.json({ error: 'API key in path is required' }, { status: 400 });
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId');
    logger.log(`Received message for session ${sessionId} (API key in path: ${apiKeyFromPath}) (POST ${routeName})`);

    if (!sessionId) {
      logger.warn(`sessionId query parameter is required for POST ${routeName}`);
      return NextResponse.json({ error: 'sessionId query parameter is required' }, { status: 400 });
    }

    const connection = metaMcpConnections.get(sessionId);
    if (!connection) {
      logger.warn(`Session not found for POST ${routeName}, sessionId: ${sessionId}`);
      return NextResponse.json({ error: `Session not found, sessionId: ${sessionId}` }, { status: 404 });
    }

    if (!(connection.webAppTransport instanceof SSEServerTransport)) {
        logger.error(`Session ${sessionId} is not using an SSE transport (POST ${routeName}).`);
        return NextResponse.json({ error: 'Invalid transport type for this session.' }, { status: 400 });
    }

    const transport = connection.webAppTransport as SSEServerTransport;
    const requestBody = await req.json();

    let responseStatus = 204;
    let responseBody: any = null;
    const mockRes = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: any) => { responseBody = body; },
          send: (body?: any) => { if (body) responseBody = body; },
          end: (body?: any) => { if (body) responseBody = body; }
        };
      },
      json: (body: any) => { responseBody = body; responseStatus = responseStatus === 204 ? 200 : responseStatus; },
      send: (body?: any) => { if (body) responseBody = body; responseStatus = responseStatus === 204 ? 200 : responseStatus; },
      end: (body?: any) => { if (body) responseBody = body; }
    } as any;

    const mockReq = { body: requestBody } as any;

    await transport.handlePostMessage(mockReq, mockRes);

    if (responseBody) {
      return NextResponse.json(responseBody, { status: responseStatus });
    }
    return new NextResponse(null, { status: responseStatus });

  } catch (error) {
    logger.error(`Error in ${routeName} route:`, error);
    if (error instanceof Response) {
        return error;
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
