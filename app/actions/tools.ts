'use server';

import { getDb } from '@/db';
import { nanoid } from 'nanoid';
import { Tool } from '@/types/tool';

enum ToggleStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

export async function getToolsByMcpServerUuid(
  mcpServerUuid: string
): Promise<Tool[]> {
  const db = await getDb();
  try {
    const tools = await db.all(
      `SELECT id, name, description, inputSchema, outputSchema, isAvailable FROM tools WHERE mcpServerUuid = ? ORDER BY name;`,
      mcpServerUuid
    );
    return tools as Tool[];
  } finally {
    await db.close();
  }
}

export async function toggleToolStatus(
  toolId: string,
  status: ToggleStatus
): Promise<void> {
  const db = await getDb();
  try {
    await db.run(
      `UPDATE tools SET isAvailable = ? WHERE id = ?;`,
      status,
      toolId
    );
  } finally {
    await db.close();
  }
}

export async function saveToolsToDatabase(
  mcpServerUuid: string,
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, any>;
    outputSchema?: Record<string, any>;
  }>
): Promise<{ success: boolean; count: number }> {
  if (!tools || tools.length === 0) {
    return { success: true, count: 0 };
  }

  console.log(`Saving ${tools.length} tools for MCP server ${mcpServerUuid}`);

  const db = await getDb();
  let count = 0;
  try {
    for (const tool of tools) {
      // For simplicity, let's assume a REPLACE INTO for upsert behavior
      // This will insert if not exists, or replace if exists based on primary key (id)
      // However, our schema uses id as primary key, which is nanoid generated.
      // We need to upsert based on mcpServerUuid and name.
      // SQLite's UPSERT (ON CONFLICT) is available, but let's keep it simple for now:
      // Check if tool exists, if so, update. Else, insert.

      const existingTool = await db.get(
        `SELECT id FROM tools WHERE mcpServerUuid = ? AND name = ?;`,
        mcpServerUuid,
        tool.name
      );

      if (existingTool) {
        await db.run(
          `UPDATE tools SET description = ?, inputSchema = ?, outputSchema = ? WHERE id = ?;`,
          tool.description || '',
          JSON.stringify(tool.inputSchema),
          JSON.stringify(tool.outputSchema || {}),
          existingTool.id
        );
      } else {
        await db.run(
          `INSERT INTO tools (id, mcpServerUuid, name, description, inputSchema, outputSchema, isAvailable) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          nanoid(),
          mcpServerUuid,
          tool.name,
          tool.description || '',
          JSON.stringify(tool.inputSchema),
          JSON.stringify(tool.outputSchema || {}),
          ToggleStatus.ACTIVE // Default to active when inserting new tool
        );
      }
      count++;
    }
    console.log(`Saved ${count} tools for MCP server ${mcpServerUuid}`);
    return { success: true, count };
  } catch (e) {
    console.error(`Error saving tools for MCP server ${mcpServerUuid}:`, e);
    throw e;
  } finally {
    await db.close();
  }
}