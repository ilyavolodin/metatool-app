import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { ToolExecutionLog } from '@/app/actions/tool-execution-logs'; // Use the existing type
import { db } from '@/db';
import { ToolExecutionStatus } from '@/db/schema';
import * as logger from '@/lib/logger';

import { authenticateApiKey } from '../auth';

export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult;

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

    if (!tool_name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    if (mcp_server_uuid) {
      const serverStmt = db.prepare('SELECT uuid FROM mcp_servers WHERE uuid = ? AND profile_uuid = ?');
      const mcpServer = serverStmt.get(mcp_server_uuid, activeProfile.uuid);
      if (!mcpServer) {
        return NextResponse.json(
          { error: 'MCP server not found or does not belong to your profile' },
          { status: 404 }
        );
      }
    }

    const logUuid = nanoid();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(
      'INSERT INTO tool_execution_logs (id, mcp_server_uuid, tool_name, payload, result, status, error_message, execution_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    );
    const newLogData = stmt.get(
      logUuid,
      mcp_server_uuid || null,
      tool_name,
      JSON.stringify(payload || {}),
      result ? JSON.stringify(result) : null,
      status || ToolExecutionStatus.PENDING,
      error_message || null,
      execution_time_ms || null,
      createdAt
    ) as any;

    if(!newLogData) {
        throw new Error('Failed to insert tool execution log');
    }

    const newToolExecutionLog: ToolExecutionLog = {
        ...newLogData,
        payload: JSON.parse(newLogData.payload || '{}'),
        result: newLogData.result ? JSON.parse(newLogData.result) : null,
        created_at: new Date(newLogData.created_at),
    };

    return NextResponse.json(newToolExecutionLog);
  } catch (error) {
    logger.error('Failed to create tool execution log:', error);
    return NextResponse.json(
      { error: 'Failed to create tool execution log' },
      { status: 500 }
    );
  }
}
