import { NextRequest, NextResponse } from 'next/server';

import { ToolExecutionLog } from '@/app/actions/tool-execution-logs'; // Use the existing type
import { db } from '@/db';
import * as logger from '@/lib/logger';

import { authenticateApiKey } from '../../auth';

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    // const { activeProfile, apiKey } = authResult; // activeProfile and apiKey might be needed for authorization

    const { id: logId } = await paramsPromise;

    if (!logId) { // Removed isNaN check as ID is now a string
      return NextResponse.json(
        { error: 'Valid log ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { result, status, error_message, execution_time_ms } = body;

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (result !== undefined) {
      updateFields.push('result = ?');
      updateValues.push(JSON.stringify(result));
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (error_message !== undefined) {
      updateFields.push('error_message = ?');
      updateValues.push(error_message);
    }
    if (execution_time_ms !== undefined) {
      updateFields.push('execution_time_ms = ?');
      updateValues.push(execution_time_ms);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateValues.push(logId); // For the WHERE clause

    const query = `UPDATE tool_execution_logs SET ${updateFields.join(', ')} WHERE id = ? RETURNING *`;
    const stmt = db.prepare(query);
    const updatedLogData = stmt.get(...updateValues) as any;

    if (!updatedLogData) {
      return NextResponse.json(
        { error: 'Tool execution log not found or update failed' },
        { status: 404 }
      );
    }

    const updatedLog: ToolExecutionLog = {
        ...updatedLogData,
        payload: JSON.parse(updatedLogData.payload || '{}'), // Assuming payload is stored as JSON string
        result: updatedLogData.result ? JSON.parse(updatedLogData.result) : null, // Assuming result is stored as JSON string
        created_at: new Date(updatedLogData.created_at),
    };


    return NextResponse.json(updatedLog);
  } catch (error) {
    logger.error('Failed to update tool execution log:', error);
    return NextResponse.json(
      { error: 'Failed to update tool execution log' },
      { status: 500 }
    );
  }
}
