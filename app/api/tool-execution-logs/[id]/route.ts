import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import * as logger from '@/lib/logger';
import { authenticateApiKey } from '@/app/api/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const { id: logId } = await params;

    if (!logId) {
      return NextResponse.json(
        { error: 'Valid log ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { result, status, error_message, execution_time_ms } = body;

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (result !== undefined) {
      updateFields.push(`output = ?`);
      updateParams.push(JSON.stringify(result));
    }
    if (status !== undefined) {
      updateFields.push(`status = ?`);
      updateParams.push(status);
    }
    if (error_message !== undefined) {
      updateFields.push(`errorMessage = ?`);
      updateParams.push(error_message);
    }
    if (execution_time_ms !== undefined) {
      updateFields.push(`executionTimeMs = ?`);
      updateParams.push(execution_time_ms);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateParams.push(logId);

    const sql = `UPDATE tool_execution_logs SET ${updateFields.join(', ')} WHERE id = ?;`;

    await db.run(sql, ...updateParams);

    const updatedLog = await db.get(
      `SELECT id, mcpServerUuid, toolName, input, output, status, errorMessage, executionTimeMs, timestamp, projectId FROM tool_execution_logs WHERE id = ?;`,
      logId
    );

    if (!updatedLog) {
      return NextResponse.json(
        { error: 'Tool execution log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedLog.id,
      mcp_server_uuid: updatedLog.mcpServerUuid,
      tool_name: updatedLog.toolName,
      payload: JSON.parse(updatedLog.input),
      result: JSON.parse(updatedLog.output),
      status: updatedLog.status,
      error_message: updatedLog.errorMessage,
      execution_time_ms: updatedLog.executionTimeMs,
      created_at: new Date(updatedLog.timestamp),
    });
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to update tool execution log' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}