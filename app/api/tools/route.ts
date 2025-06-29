import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { authenticateApiKey } from '@/app/api/auth';
import * as logger from '@/lib/logger';

enum ToggleStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

export async function POST(request: Request) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { tools } = body;

    // Validate that tools is an array
    if (!Array.isArray(tools) || tools.length === 0) {
      return NextResponse.json(
        { error: 'Request must include a non-empty array of tools' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const tool of tools) {
      const { name, description, toolSchema, mcp_server_uuid } = tool;

      // Validate required fields for each tool
      if (!name || !toolSchema || !mcp_server_uuid) {
        errors.push({
          tool,
          error:
            'Missing required fields: name, toolSchema, or mcp_server_uuid',
        });
        continue;
      }

      try {
        // Check if tool exists
        const existingTool = await db.get(
          `SELECT id FROM tools WHERE mcpServerUuid = ? AND name = ?;`,
          mcp_server_uuid,
          name
        );

        if (existingTool) {
          // Update existing tool
          await db.run(
            `UPDATE tools SET description = ?, inputSchema = ? WHERE id = ?;`,
            description || '',
            JSON.stringify(toolSchema),
            existingTool.id
          );
          results.push({ ...tool, id: existingTool.id });
        } else {
          // Insert new tool
          const newId = nanoid();
          await db.run(
            `INSERT INTO tools (id, mcpServerUuid, name, description, inputSchema, isAvailable) VALUES (?, ?, ?, ?, ?, ?);`,
            newId,
            mcp_server_uuid,
            name,
            description || '',
            JSON.stringify(toolSchema),
            ToggleStatus.ACTIVE // Default to active
          );
          results.push({ ...tool, id: newId });
        }
      } catch (error: any) {
        logger.error(`Error processing tool ${name}:`, error);
        errors.push({
          tool,
          error: error.message || 'Database operation failed',
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      success: results.length > 0,
      failureCount: errors.length,
      successCount: results.length,
    });
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to process tools request' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}

export async function GET(request: Request) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = `SELECT t.id, t.mcpServerUuid, t.name, t.description, t.inputSchema, t.outputSchema, t.isAvailable FROM tools t INNER JOIN mcp_servers ms ON t.mcpServerUuid = ms.uuid WHERE ms.projectId = ?`;
    const params: any[] = [auth.activeProfile.projectId];

    if (status !== null) {
      query += ` AND t.isAvailable = ?`;
      params.push(status === 'active' ? ToggleStatus.ACTIVE : ToggleStatus.INACTIVE);
    }

    const results = await db.all(query, ...params);

    return NextResponse.json({
      results: results.map((tool: any) => ({
        ...tool,
        inputSchema: JSON.parse(tool.inputSchema || '{}'),
        outputSchema: JSON.parse(tool.outputSchema || '{}'),
      })),
    });
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}