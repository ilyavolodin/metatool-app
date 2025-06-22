import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { ToggleStatus } from '@/db/schema'; // Assuming ToggleStatus is used for tools
import * as logger from '@/lib/logger';
import { Tool } from '@/types/tool';

import { authenticateApiKey } from '../auth';

export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult; // Use activeProfile to verify mcp_server_uuid ownership

    const body = await request.json();
    const { tools } = body;

    if (!Array.isArray(tools) || tools.length === 0) {
      return NextResponse.json(
        { error: 'Request must include a non-empty array of tools' },
        { status: 400 }
      );
    }

    const processedTools: any[] = [];
    const errors: any[] = [];
    let successCount = 0;

    const insertStmt = db.prepare(
        'INSERT INTO tools (uuid, name, description, tool_schema, mcp_server_uuid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)' +
        'ON CONFLICT(mcp_server_uuid, name) DO UPDATE SET description = excluded.description, tool_schema = excluded.tool_schema, status = excluded.status RETURNING *'
    );

    const verifyServerStmt = db.prepare('SELECT uuid FROM mcp_servers WHERE uuid = ? AND profile_uuid = ?');

    const runTransaction = db.transaction(() => {
        for (const tool of tools) {
            const { name, description, toolSchema, mcp_server_uuid } = tool;

            if (!name || !toolSchema || !mcp_server_uuid) {
            errors.push({
                tool,
                error: 'Missing required fields: name, toolSchema, or mcp_server_uuid',
            });
            continue;
            }

            // Verify mcp_server_uuid belongs to the active profile
            const server = verifyServerStmt.get(mcp_server_uuid, activeProfile.uuid);
            if (!server) {
                errors.push({
                    tool,
                    error: `MCP Server with UUID ${mcp_server_uuid} not found or not associated with the active profile.`,
                });
                continue;
            }

            const toolUuid = nanoid();
            const createdAt = new Date().toISOString();

            try {
                const insertedTool = insertStmt.get(
                    toolUuid,
                    name,
                    description || '',
                    JSON.stringify(toolSchema),
                    mcp_server_uuid,
                    ToggleStatus.ACTIVE, // Default status
                    createdAt
                ) as Tool | undefined;

                if (insertedTool) {
                    processedTools.push({
                        ...insertedTool,
                        toolSchema: JSON.parse(insertedTool.toolSchema as unknown as string || '{}'),
                        created_at: new Date(insertedTool.created_at as unknown as string)
                    });
                    successCount++;
                } else {
                     // This case might indicate an issue if RETURNING * didn't return the row after upsert
                    errors.push({ tool, error: 'Failed to save tool to database, no row returned after operation.' });
                }
            } catch (dbError: any) {
                 errors.push({ tool, error: `Database error: ${dbError.message}` });
            }
        }
    });

    runTransaction();

    return NextResponse.json({
      results: processedTools,
      errors,
      success: successCount > 0,
      failureCount: errors.length,
      successCount: successCount,
    });
  } catch (error) {
    logger.error('Failed to process tools request:', error);
    return NextResponse.json(
      { error: 'Failed to process tools request' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = `
      SELECT t.mcp_server_uuid, t.name, t.status
      FROM tools t
      INNER JOIN mcp_servers ms ON t.mcp_server_uuid = ms.uuid
      WHERE ms.profile_uuid = ?
    `;
    const params: any[] = [activeProfile.uuid];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    query += ' ORDER BY t.name';

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    return NextResponse.json({ results });
  } catch (error) {
    logger.error('Failed to fetch tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: 500 }
    );
  }
}
