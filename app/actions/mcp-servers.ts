'use server';

import { nanoid } from 'nanoid';

import { getDb } from '@/db';
import { McpServer } from '@/types/mcp-server';

enum McpServerStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

enum McpServerType {
  STDIO = 'stdio',
  SSE = 'sse',
  STREAMABLE_HTTP = 'streamable_http',
}

export async function getMcpServers(
  projectId: string,
  status?: McpServerStatus
): Promise<McpServer[]> {
  const db = await getDb();
  try {
    if (!projectId) {
      return [];
    }

    let query = `SELECT uuid, name, description, command, args, env, url, type, status, created_at FROM mcp_servers WHERE projectId = ?`;
    const params: (string | number)[] = [projectId];

    if (status !== undefined) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC;`;

    const servers = await db.all(query, ...params);

    return servers.map((server: any) => ({
      ...server,
      args: JSON.parse(server.args || '[]'),
      env: JSON.parse(server.env || '{}'),
      created_at: new Date(server.created_at),
    })) as McpServer[];
  } finally {
    await db.close();
  }
}

export async function getMcpServerByUuid(
  projectId: string,
  uuid: string
): Promise<McpServer | undefined> {
  const db = await getDb();
  try {
    const server = await db.get(
      `SELECT uuid, name, description, command, args, env, url, type, status, created_at FROM mcp_servers WHERE uuid = ? AND projectId = ?;`,
      uuid,
      projectId
    );
    if (server) {
      return {
        ...server,
        args: JSON.parse(server.args || '[]'),
        env: JSON.parse(server.env || '{}'),
        created_at: new Date(server.created_at),
      } as McpServer;
    }
    return undefined;
  } finally {
    await db.close();
  }
}

export async function deleteMcpServerByUuid(
  projectId: string,
  uuid: string
): Promise<void> {
  console.log(`Deleting MCP server ${uuid}`);
  const db = await getDb();
  try {
    await db.run(`DELETE FROM mcp_servers WHERE uuid = ? AND projectId = ?;`, uuid, projectId);
    console.log(`Deleted MCP server ${uuid}`);
  } catch (error) {
    console.error(`Failed to delete MCP server ${uuid}:`, error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function toggleMcpServerStatus(
  projectId: string,
  uuid: string,
  newStatus: McpServerStatus
): Promise<void> {
  console.log(`Updating MCP server ${uuid} status -> ${newStatus}`);
  const db = await getDb();
  try {
    await db.run(
      `UPDATE mcp_servers SET status = ? WHERE uuid = ? AND projectId = ?;`,
      newStatus,
      uuid,
      projectId
    );
    console.log(`Updated MCP server ${uuid} status`);
  } catch (error) {
    console.error(`Failed to update status for ${uuid}:`, error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function updateMcpServer(
  projectId: string,
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
  const db = await getDb();
  try {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { fields.push(`name = ?`); params.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = ?`); params.push(data.description); }
    if (data.command !== undefined) { fields.push(`command = ?`); params.push(data.command); }
    if (data.args !== undefined) { fields.push(`args = ?`); params.push(JSON.stringify(data.args)); }
    if (data.env !== undefined) { fields.push(`env = ?`); params.push(JSON.stringify(data.env)); }
    if (data.url !== undefined) { fields.push(`url = ?`); params.push(data.url); }
    if (data.type !== undefined) { fields.push(`type = ?`); params.push(data.type); }

    if (fields.length === 0) {
      console.log("No fields to update.");
      return;
    }

    params.push(uuid, projectId);

    await db.run(
      `UPDATE mcp_servers SET ${fields.join(', ')} WHERE uuid = ? AND projectId = ?;`,
      ...params
    );
    console.log(`Updated MCP server ${uuid}`);
  } catch (error) {
    console.error(`Failed to update MCP server ${uuid}:`, error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function createMcpServer(
  projectId: string,
  data: {
    uuid?: string;
    name: string;
    description: string;
    command?: string;
    args: string[];
    env: { [key: string]: string };
    url?: string;
    type?: McpServerType;
    status?: McpServerStatus;
  }
): Promise<McpServer> {
  console.log('Creating MCP server', data.name);
  const db = await getDb();
  try {
    const newUuid = data.uuid || nanoid();
    const createdAt = Date.now();

    await db.run(
      `INSERT INTO mcp_servers (
        uuid, name, description, command, args, env, url, type, status, projectId, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      newUuid,
      data.name,
      data.description,
      data.command || null,
      JSON.stringify(data.args),
      JSON.stringify(data.env),
      data.url || null,
      data.type || McpServerType.STDIO,
      data.status || McpServerStatus.ACTIVE,
      projectId,
      createdAt
    );

    const server = await db.get(
      `SELECT uuid, name, description, command, args, env, url, type, status, created_at FROM mcp_servers WHERE uuid = ?;`,
      newUuid
    );

    if (!server) {
      throw new Error("Failed to retrieve created server.");
    }

    console.log('Created MCP server', server.uuid);
    return {
      ...server,
      args: JSON.parse(server.args || '[]'),
      env: JSON.parse(server.env || '{}'),
      created_at: new Date(server.created_at),
    } as McpServer;
  } catch (error) {
    console.error('Failed to create MCP server:', error);
    throw error;
  } finally {
    await db.close();
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
  projectId?: string | null
) {
  if (!projectId) {
    throw new Error('Current workspace not found');
  }

  const { mcpServers } = data;
  const serverEntries = Object.entries(mcpServers);
  const db = await getDb();
  let importedCount = 0;

  console.log(`Bulk importing ${serverEntries.length} MCP servers`);
  try {
    for (const [name, serverConfig] of serverEntries) {
      const newUuid = nanoid();
      const createdAt = Date.now();

      const existingServer = await db.get(
        `SELECT uuid FROM mcp_servers WHERE name = ? AND projectId = ?;`,
        name,
        projectId
      );

      if (existingServer) {
        // Update existing server
        const fields: string[] = [];
        const params: any[] = [];

        fields.push(`description = ?`); params.push(serverConfig.description || '');
        fields.push(`command = ?`); params.push(serverConfig.command || null);
        fields.push(`args = ?`); params.push(JSON.stringify(serverConfig.args || []));
        fields.push(`env = ?`); params.push(JSON.stringify(serverConfig.env || {}));
        fields.push(`url = ?`); params.push(serverConfig.url || null);
        fields.push(`type = ?`); params.push(serverConfig.type || McpServerType.STDIO);

        params.push(existingServer.uuid, projectId);

        await db.run(
          `UPDATE mcp_servers SET ${fields.join(', ')} WHERE uuid = ? AND projectId = ?;`,
          ...params
        );
        console.log(`Updated existing MCP server ${name}`);
      } else {
        // Insert new server
        await db.run(
          `INSERT INTO mcp_servers (
            uuid, name, description, command, args, env, url, type, status, projectId, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          newUuid,
          name,
          serverConfig.description || '',
          serverConfig.command || null,
          JSON.stringify(serverConfig.args || []),
          JSON.stringify(serverConfig.env || {}),
          serverConfig.url || null,
          serverConfig.type || McpServerType.STDIO,
          McpServerStatus.ACTIVE,
          projectId,
          createdAt
        );
        console.log(`Imported new MCP server ${name}`);
      }
      importedCount++;
    }

    return { success: true, count: importedCount };
  } catch (error) {
    console.error('Failed to bulk import MCP servers:', error);
    throw error;
  } finally {
    await db.close();
  }
}