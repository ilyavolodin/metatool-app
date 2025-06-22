'use server';

import { nanoid } from 'nanoid';

import { db } from '@/db';
import { ToggleStatus } from '@/db/schema';
import { Tool } from '@/types/tool';

// Helper to map row to Tool, parsing JSON fields
function mapRowToTool(row: any): Tool {
  return {
    ...row,
    toolSchema: JSON.parse(row.toolSchema as string || '{}'),
    created_at: new Date(row.created_at as string),
  } as Tool;
}

export async function getToolsByMcpServerUuid(
  mcpServerUuid: string
): Promise<Tool[]> {
  const stmt = db.prepare('SELECT * FROM tools WHERE mcp_server_uuid = ? ORDER BY name');
  const tools = stmt.all(mcpServerUuid);
  return tools.map(mapRowToTool);
}

export async function toggleToolStatus(
  toolUuid: string,
  status: ToggleStatus
): Promise<void> {
  const stmt = db.prepare('UPDATE tools SET status = ? WHERE uuid = ?');
  stmt.run(status, toolUuid);
}

export async function saveToolsToDatabase(
  mcpServerUuid: string,
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, any>;
  }>
): Promise<{ success: boolean; count: number }> {
  if (!tools || tools.length === 0) {
    return { success: true, count: 0 };
  }

  console.log(`Saving ${tools.length} tools for MCP server ${mcpServerUuid}`);

  const insertStmt = db.prepare(
    'INSERT INTO tools (uuid, name, description, tool_schema, mcp_server_uuid, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)' +
    'ON CONFLICT(mcp_server_uuid, name) DO UPDATE SET description = excluded.description, tool_schema = excluded.tool_schema, status = excluded.status' +
    ' RETURNING uuid' // Add RETURNING to count affected rows accurately for upsert
  );

  let successfulOperations = 0;

  const saveMany = db.transaction((toolsToProcess) => {
    for (const tool of toolsToProcess) {
      const uuid = nanoid(); // Generate UUID for new entries
      const createdAt = new Date().toISOString();
      const toolSchema = JSON.stringify({
        type: 'object' as const,
        ...tool.inputSchema,
      });

      try {
        const result = insertStmt.get( // Use .get() for RETURNING
          uuid,
          tool.name,
          tool.description || '',
          toolSchema,
          mcpServerUuid,
          ToggleStatus.ACTIVE, // Default status
          createdAt
        );
        if (result) { // Check if a row was returned (inserted or updated)
            successfulOperations++;
        }
      } catch (error) {
        console.error(`Error saving tool ${tool.name}:`, error);
        // Decide if one error should stop the whole batch or just be logged
      }
    }
  });

  saveMany(tools);

  console.log(`Saved ${successfulOperations} tools for MCP server ${mcpServerUuid}`);
  return { success: true, count: successfulOperations };
}
