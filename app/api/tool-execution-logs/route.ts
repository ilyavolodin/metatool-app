import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import {
  mcpServersTable,
  toolExecutionLogsTable,
  ToolExecutionStatus,
} from '@/db/schema';
import * as logger from '@/lib/logger';

import { authenticateApiKey } from '../auth';

export async function POST(request: Request) {
  try {
    logger.log('POST /api/tool-execution-logs: Starting request processing.');
    const auth = await authenticateApiKey(request);
    if (auth.error) {
      logger.warn('POST /api/tool-execution-logs: Authentication failed.');
      return auth.error;
    }
    logger.log('POST /api/tool-execution-logs: Authentication successful.');

    logger.log('POST /api/tool-execution-logs: Parsing request body.');
    const body = await request.json();
    const {
      mcp_server_uuid,
      tool_name,
      payload,
      result,
      status,
      error_message,
      execution_time_ms,
    } = body;
    logger.log('POST /api/tool-execution-logs: Request body parsed.');

    // Validate required fields
    if (!tool_name) {
      logger.warn('POST /api/tool-execution-logs: Tool name is required.');
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    // If mcp_server_uuid is provided, verify it belongs to the authenticated user's active profile
    if (mcp_server_uuid) {
      logger.log(`POST /api/tool-execution-logs: Verifying mcp_server_uuid: ${mcp_server_uuid}`);
      const mcpServer = await db
        .select()
        .from(mcpServersTable)
        .where(
          and(
            eq(mcpServersTable.uuid, mcp_server_uuid),
            eq(mcpServersTable.profile_uuid, auth.activeProfile.uuid)
          )
        )
        .limit(1);

      if (mcpServer.length === 0) {
        logger.warn('POST /api/tool-execution-logs: MCP server not found or does not belong to profile.');
        return NextResponse.json(
          { error: 'MCP server not found or does not belong to your profile' },
          { status: 404 }
        );
      }
      logger.log('POST /api/tool-execution-logs: MCP server verified.');
    }

    logger.log('POST /api/tool-execution-logs: Inserting new tool execution log.');
    // Create new tool execution log entry
    const newToolExecutionLog = await db
      .insert(toolExecutionLogsTable)
      .values({
        mcp_server_uuid: mcp_server_uuid || null,
        tool_name,
        payload: payload || {},
        result: result || null,
        status: status || ToolExecutionStatus.PENDING,
        error_message: error_message || null,
        execution_time_ms: execution_time_ms || null,
      })
      .returning();
    logger.log('POST /api/tool-execution-logs: Tool execution log inserted.');

    return NextResponse.json(newToolExecutionLog[0]);
  } catch (error) {
    logger.error('POST /api/tool-execution-logs: Error caught:', error);
    return NextResponse.json(
      { error: 'Failed to create tool execution log' },
      { status: 500 }
    );
  }
}
