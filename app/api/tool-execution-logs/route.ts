import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import * as logger from '@/lib/logger';

import { authenticateApiKey } from '../auth';

enum ToolExecutionStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
}

export async function POST(request: Request) {
  const db = await getDb();
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
      const mcpServer = await db.get(
        `SELECT uuid FROM mcp_servers WHERE uuid = ? AND projectId = ? LIMIT 1;`,
        mcp_server_uuid,
        auth.activeProfile.projectId
      );

      if (!mcpServer) {
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
    const newLogId = nanoid();
    await db.run(
      `INSERT INTO tool_execution_logs (
        id, mcpServerUuid, toolName, input, output, status, errorMessage, executionTimeMs, timestamp, projectId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      newLogId,
      mcp_server_uuid || null,
      tool_name,
      JSON.stringify(payload || {}),
      JSON.stringify(result || null),
      status || ToolExecutionStatus.PENDING,
      error_message || null,
      execution_time_ms || null,
      Date.now(),
      auth.activeProfile.projectId
    );

    const insertedLog = await db.get(
      `SELECT id, mcpServerUuid, toolName, input, output, status, errorMessage, executionTimeMs, timestamp, projectId FROM tool_execution_logs WHERE id = ?;`,
      newLogId
    );

    return NextResponse.json({
      id: insertedLog.id,
      mcp_server_uuid: insertedLog.mcpServerUuid,
      tool_name: insertedLog.toolName,
      payload: JSON.parse(insertedLog.input),
      result: JSON.parse(insertedLog.output),
      status: insertedLog.status,
      error_message: insertedLog.errorMessage,
      execution_time_ms: insertedLog.executionTimeMs,
      created_at: new Date(insertedLog.timestamp),
    });
  } catch (error) {
    logger.error('POST /api/tool-execution-logs: Error caught:', error);
    return NextResponse.json(
      { error: 'Failed to create tool execution log' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}