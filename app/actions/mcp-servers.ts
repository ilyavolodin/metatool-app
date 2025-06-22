'use server';

import { nanoid } from 'nanoid';

import { db } from '@/db';
import { McpServerStatus, McpServerType } from '@/db/schema';
import { McpServer } from '@/types/mcp-server';

export async function getMcpServers(
  profileUuid: string,
  status?: McpServerStatus
): Promise<McpServer[]> {
  if (!profileUuid) {
    return [];
  }

  let query = 'SELECT * FROM mcp_servers WHERE profile_uuid = ?';
  const params: any[] = [profileUuid];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else {
    query += ` AND (status = '${McpServerStatus.ACTIVE}' OR status = '${McpServerStatus.INACTIVE}')`;
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const servers = stmt.all(...params);
  return servers.map(server => {
    const s = server as any;
    return {
      ...s,
      args: JSON.parse(s.args || '[]'),
      env: JSON.parse(s.env || '{}'),
      created_at: new Date(s.created_at),
    } as McpServer;
  });
}

export async function getMcpServerByUuid(
  profileUuid: string,
  uuid: string
): Promise<McpServer | undefined> {
  const stmt = db.prepare('SELECT * FROM mcp_servers WHERE uuid = ? AND profile_uuid = ?');
  const server = stmt.get(uuid, profileUuid) as any;
  if (server) {
    return {
      ...server,
      args: JSON.parse(server.args || '[]'),
      env: JSON.parse(server.env || '{}'),
      created_at: new Date(server.created_at),
    } as McpServer;
  }
  return undefined;
}

export async function deleteMcpServerByUuid(
  profileUuid: string,
  uuid: string
): Promise<void> {
  console.log(`Deleting MCP server ${uuid}`);
  try {
    const stmt = db.prepare('DELETE FROM mcp_servers WHERE uuid = ? AND profile_uuid = ?');
    stmt.run(uuid, profileUuid);
    console.log(`Deleted MCP server ${uuid}`);
  } catch (error) {
    console.error(`Failed to delete MCP server ${uuid}:`, error);
    throw error;
  }
}

export async function toggleMcpServerStatus(
  profileUuid: string,
  uuid: string,
  newStatus: McpServerStatus
): Promise<void> {
  console.log(`Updating MCP server ${uuid} status -> ${newStatus}`);
  try {
    const stmt = db.prepare('UPDATE mcp_servers SET status = ? WHERE uuid = ? AND profile_uuid = ?');
    stmt.run(newStatus, uuid, profileUuid);
    console.log(`Updated MCP server ${uuid} status`);
  } catch (error) {
    console.error(`Failed to update status for ${uuid}:`, error);
    throw error;
  }
}

export async function updateMcpServer(
  profileUuid: string,
  uuid: string,
  data: {
    name?: string;
    description?: string;
    command?: string;
    args?: string[];
    env?: { [key: string]: string };
    url?: string;
    type?: McpServerType;
  }
): Promise<void> {
  console.log(`Updating MCP server ${uuid}`);
  try {
    const fields = [];
    const params = [];
    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    if (data.command !== undefined) {
      fields.push('command = ?');
      params.push(data.command);
    }
    if (data.args !== undefined) {
      fields.push('args = ?');
      params.push(JSON.stringify(data.args));
    }
    if (data.env !== undefined) {
      fields.push('env = ?');
      params.push(JSON.stringify(data.env));
    }
    if (data.url !== undefined) {
      fields.push('url = ?');
      params.push(data.url);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }

    if (fields.length === 0) {
      return;
    }

    const query = `UPDATE mcp_servers SET ${fields.join(', ')} WHERE uuid = ? AND profile_uuid = ?`;
    params.push(uuid, profileUuid);

    const stmt = db.prepare(query);
    stmt.run(...params);
    console.log(`Updated MCP server ${uuid}`);
  } catch (error) {
    console.error(`Failed to update MCP server ${uuid}:`, error);
    throw error;
  }
}

export async function createMcpServer(
  profileUuid: string,
  data: {
    uuid?: string;
    name: string;
    description: string;
    command?: string;
    args: string[];
    env: { [key: string]: string };
    url?: string;
    type?: McpServerType;
  }
): Promise<McpServer> {
  console.log('Creating MCP server', data.name);
  try {
    const serverUuid = data.uuid || nanoid();
    const created_at = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO mcp_servers (uuid, name, description, type, command, args, env, url, created_at, profile_uuid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    );
    const serverRow = stmt.get(
      serverUuid,
      data.name,
      data.description,
      data.type || McpServerType.STDIO,
      data.command,
      JSON.stringify(data.args),
      JSON.stringify(data.env),
      data.url,
      created_at,
      profileUuid,
      McpServerStatus.ACTIVE
    ) as any;

    console.log('Created MCP server', serverRow.uuid);
    return {
      ...serverRow,
      args: JSON.parse(serverRow.args || '[]'),
      env: JSON.parse(serverRow.env || '{}'),
      created_at: new Date(serverRow.created_at),
    } as McpServer;
  } catch (error) {
    console.error('Failed to create MCP server:', error);
    throw error;
  }
}

export async function bulkImportMcpServers(
  data: {
    mcpServers: {
      [name: string]: {
        command?: string;
        args?: string[];
        env?: { [key: string]: string };
        description?: string;
        url?: string;
        type?: McpServerType;
      };
    };
  },
  profileUuid?: string | null
): Promise<{ success: boolean; count: number }> {
  if (!profileUuid) {
    throw new Error('Current workspace not found');
  }

  const { mcpServers } = data;
  const serverEntries = Object.entries(mcpServers);

  console.log(`Bulk importing ${serverEntries.length} MCP servers`);
  const stmt = db.prepare(
    'INSERT INTO mcp_servers (uuid, name, description, type, command, args, env, url, created_at, profile_uuid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const importMany = db.transaction((entries) => {
    for (const [name, serverConfig] of entries) {
      const serverUuid = nanoid();
      const created_at = new Date().toISOString();
      stmt.run(
        serverUuid,
        name,
        serverConfig.description || '',
        serverConfig.type || McpServerType.STDIO,
        serverConfig.command || null,
        JSON.stringify(serverConfig.args || []),
        JSON.stringify(serverConfig.env || {}),
        serverConfig.url || null,
        created_at,
        profileUuid,
        McpServerStatus.ACTIVE
      );
      console.log(`Imported MCP server ${name}`);
    }
    return entries.length;
  });

  try {
    const count = importMany(serverEntries);
    return { success: true, count };
  } catch (error) {
    console.error(`Failed to import MCP servers:`, error);
    throw error; // Re-throw to allow SWR to catch it or for further handling
  }
}
