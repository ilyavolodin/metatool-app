'use server';

import { getDb } from '@/db';
import { nanoid } from 'nanoid';

enum ToolExecutionStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
}

export type ToolExecutionLog = {
  id: number;
  mcpServerUuid: string | null;
  toolName: string;
  payload: Record<string, any>;
  result: any;
  status: ToolExecutionStatus;
  errorMessage: string | null;
  executionTimeMs: string | null;
  createdAt: Date;
  mcpServerName?: string;
};

type GetToolExecutionLogsOptions = {
  limit?: number;
  offset?: number;
  mcpServerUuids?: string[];
  toolNames?: string[];
  statuses?: ToolExecutionStatus[];
  currentProfileUuid: string;
};

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
  const db = await getDb();
  try {
    if (!currentProfileUuid) {
      return { logs: [], total: 0 };
    }

    const whereConditions: string[] = [];
    const params: any[] = [];

    // Filter by MCP servers that belong to the current profile
    const allowedMcpServers = await db.all(
      `SELECT uuid FROM mcp_servers WHERE projectId = ?;`,
      currentProfileUuid
    );
    const allowedMcpServerUuids = allowedMcpServers.map((server) => server.uuid);

    if (allowedMcpServerUuids.length > 0) {
      whereConditions.push(`mcpServerUuid IN (${allowedMcpServerUuids.map(() => '?').join(',')})`);
      params.push(...allowedMcpServerUuids);
    } else {
      // If no allowed servers, no logs can be fetched
      return { logs: [], total: 0 };
    }

    // Apply additional filters if provided
    if (mcpServerUuids && mcpServerUuids.length > 0) {
      whereConditions.push(`mcpServerUuid IN (${mcpServerUuids.map(() => '?').join(',')})`);
      params.push(...mcpServerUuids);
    }

    if (toolNames && toolNames.length > 0) {
      whereConditions.push(`toolName IN (${toolNames.map(() => '?').join(',')})`);
      params.push(...toolNames);
    }

    if (statuses && statuses.length > 0) {
      whereConditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const totalResult = await db.get(`SELECT COUNT(*) as count FROM tool_execution_logs ${whereClause};`, ...params);
    const count = totalResult ? totalResult.count : 0;

    // Get logs with joined MCP server names
    const logs = await db.all(
      `SELECT
        tel.id,
        tel.mcpServerUuid,
        tel.toolName,
        tel.input AS payload,
        tel.output AS result,
        tel.status,
        tel.errorMessage,
        tel.executionTimeMs,
        tel.timestamp AS createdAt,
        ms.name AS mcpServerName
      FROM tool_execution_logs tel
      LEFT JOIN mcp_servers ms ON tel.mcpServerUuid = ms.uuid
      ${whereClause}
      ORDER BY tel.timestamp DESC
      LIMIT ? OFFSET ?;`,
      ...params,
      limit,
      offset
    );

    return {
      logs: logs.map((log: any) => ({
        id: log.id,
        mcpServerUuid: log.mcpServerUuid,
        toolName: log.toolName,
        payload: JSON.parse(log.payload || '{}'),
        result: JSON.parse(log.result || '{}'),
        status: log.status,
        errorMessage: log.errorMessage,
        executionTimeMs: log.executionTimeMs,
        createdAt: new Date(log.createdAt),
        mcpServerName: log.mcpServerName || 'Unknown Server',
      })) as ToolExecutionLog[],
      total: count,
    };
  } finally {
    await db.close();
  }
}

export async function getToolNames(
  currentProfileUuid: string
): Promise<string[]> {
  const db = await getDb();
  try {
    if (!currentProfileUuid) {
      return [];
    }

    const allowedMcpServers = await db.all(
      `SELECT uuid FROM mcp_servers WHERE projectId = ?;`,
      currentProfileUuid
    );
    const allowedMcpServerUuids = allowedMcpServers.map((server) => server.uuid);

    if (allowedMcpServerUuids.length === 0) {
      return [];
    }

    const toolNames = await db.all(
      `SELECT DISTINCT toolName FROM tool_execution_logs WHERE mcpServerUuid IN (${allowedMcpServerUuids.map(() => '?').join(',')}) ORDER BY toolName;`,
      ...allowedMcpServerUuids
    );

    return toolNames.map((row: any) => row.toolName);
  } finally {
    await db.close();
  }
}

export async function saveToolExecutionLog(
  log: Omit<ToolExecutionLog, 'id' | 'createdAt' | 'mcpServerName'> & { projectId: string }
): Promise<void> {
  const db = await getDb();
  try {
    await db.run(
      `INSERT INTO tool_execution_logs (
        id, mcpServerUuid, toolName, input, output, status, errorMessage, executionTimeMs, timestamp, projectId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      nanoid(),
      log.mcpServerUuid,
      log.toolName,
      JSON.stringify(log.payload),
      JSON.stringify(log.result),
      log.status,
      log.errorMessage,
      log.executionTimeMs,
      Date.now(),
      log.projectId
    );
  } finally {
    await db.close();
  }
}