import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { NextRequest, NextResponse } from 'next/server';

import { metaMcpConnections } from '@/app/lib/types'; // Corrected
import { extractApiKey } from '@/app/lib/utils'; // Corrected
import * as logger from '@/lib/logger'; // Correct

export async function POST(req: NextRequest) {
  const routeName = '/api/message'; // For logging context
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      logger.warn(`No Authorization Bearer token provided for POST ${routeName}`);
      return NextResponse.json(
        { error: 'Authorization Bearer token is required' },
        { status: 401 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId');
    logger.log(`Received message for session ${sessionId} with Authorization header (POST ${routeName})`);

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

    // SSEServerTransport.handlePostMessage expects an Express `req` and `res`.
    // We need to adapt this. It reads the body from `req` and sends a response via `res`.
    const requestBody = await req.json(); // Get the body once

    // Mock Express res for handlePostMessage
    // It typically sends a 204 No Content or an error.
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

    // Mock Express req for handlePostMessage
    const mockReq = {
      body: requestBody,
      // Add other properties if SSEServerTransport needs them from req
    } as any;

    await transport.handlePostMessage(mockReq, mockRes);

    if (responseBody) {
      return NextResponse.json(responseBody, { status: responseStatus });
    }
    return new NextResponse(null, { status: responseStatus });

  } catch (error) {
    logger.error(`Error in ${routeName} route:`, error);
    // Check if error is a Response object (e.g. from NextResponse.json)
    if (error instanceof Response) {
        return error;
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
