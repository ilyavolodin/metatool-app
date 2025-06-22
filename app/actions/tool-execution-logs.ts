'use server';

import { db } from '@/db';
import { ToolExecutionStatus } from '@/db/schema';

export type ToolExecutionLog = {
  id: string;
  mcp_server_uuid: string | null;
  tool_name: string;
  payload: Record<string, any>;
  result: any;
  status: ToolExecutionStatus;
  error_message: string | null;
  execution_time_ms: string | null;
  created_at: Date;
  mcp_server_name?: string;
};

type GetToolExecutionLogsOptions = {
  limit?: number;
  offset?: number;
  mcpServerUuids?: string[];
  toolNames?: string[];
  statuses?: ToolExecutionStatus[];
  currentProfileUuid: string;
};

// Helper to map row to ToolExecutionLog, parsing JSON fields
function mapRowToLog(row: any): ToolExecutionLog {
  return {
    ...row,
    payload: JSON.parse(row.payload as string || '{}'),
    result: row.result ? JSON.parse(row.result as string) : null,
    created_at: new Date(row.created_at as string),
    mcp_server_name: row.mcp_server_name || 'Unknown Server',
  } as ToolExecutionLog;
}


export async function getToolExecutionLogs({
  limit = 50,
  offset = 0,
  mcpServerUuids,
  toolNames,
  statuses,
  currentProfileUuid,
}: GetToolExecutionLogsOptions): Promise<{
  logs: ToolExecutionLog[];
  total: number;
}> {
  if (!currentProfileUuid) {
    return { logs: [], total: 0 };
  }

  const params: any[] = [];
  const whereClauses: string[] = [];

  // Get MCP server UUIDs allowed for the current profile
  const allowedMcpServersStmt = db.prepare('SELECT uuid FROM mcp_servers WHERE profile_uuid = ?');
  const allowedMcpServers = allowedMcpServersStmt.all(currentProfileUuid).map((s: any) => s.uuid);

  if (allowedMcpServers.length === 0) {
    return { logs: [], total: 0 }; // No servers for this profile, so no logs
  }

  // Filter by allowed MCP server UUIDs
  if (mcpServerUuids && mcpServerUuids.length > 0) {
    // Intersect provided mcpServerUuids with allowed ones
    const filteredUuids = mcpServerUuids.filter(uuid => allowedMcpServers.includes(uuid));
    if (filteredUuids.length > 0) {
        whereClauses.push(`tel.mcp_server_uuid IN (${filteredUuids.map(() => '?').join(',')})`);
        params.push(...filteredUuids);
    } else {
        // If the intersection is empty, no logs will match
        return { logs: [], total: 0};
    }
  } else {
    // If no specific mcpServerUuids are provided, use all allowed ones for the profile
    whereClauses.push(`tel.mcp_server_uuid IN (${allowedMcpServers.map(() => '?').join(',')})`);
    params.push(...allowedMcpServers);
  }


  if (toolNames && toolNames.length > 0) {
    whereClauses.push(`tel.tool_name IN (${toolNames.map(() => '?').join(',')})`);
    params.push(...toolNames);
  }

  if (statuses && statuses.length > 0) {
    whereClauses.push(`tel.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as count FROM tool_execution_logs tel ${whereSql}`;
  const countStmt = db.prepare(countQuery);
  const { count } = countStmt.get(...params) as { count: number };

  const logsQuery = `
    SELECT tel.*, ms.name as mcp_server_name
    FROM tool_execution_logs tel
    LEFT JOIN mcp_servers ms ON tel.mcp_server_uuid = ms.uuid
    ${whereSql}
    ORDER BY tel.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const logsStmt = db.prepare(logsQuery);
  const logsData = logsStmt.all(...params, limit, offset);

  return {
    logs: logsData.map(mapRowToLog),
    total: count,
  };
}

export async function getToolNames(
  currentProfileUuid: string
): Promise<string[]> {
  if (!currentProfileUuid) {
    return [];
  }

  const allowedMcpServersStmt = db.prepare('SELECT uuid FROM mcp_servers WHERE profile_uuid = ?');
  const allowedMcpServers = allowedMcpServersStmt.all(currentProfileUuid).map((s: any) => s.uuid);

  if (allowedMcpServers.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT tool_name
    FROM tool_execution_logs
    WHERE mcp_server_uuid IN (${allowedMcpServers.map(() => '?').join(',')})
    ORDER BY tool_name
  `;
  const stmt = db.prepare(query);
  const result = stmt.all(...allowedMcpServers);

  return result.map((r: any) => r.tool_name);
}
