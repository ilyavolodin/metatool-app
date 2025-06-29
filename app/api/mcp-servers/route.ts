import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { authenticateApiKey } from '@/app/api/auth';
import * as logger from '@/lib/logger';

enum McpServerStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

export async function GET(request: Request) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const activeMcpServers = await db.all(
      `SELECT
        ms.uuid,
        ms.name,
        ms.description,
        ms.command,
        ms.args,
        ms.env,
        ms.url,
        ms.type,
        ms.status,
        ms.created_at,
        os.tokens AS oauth_tokens
      FROM mcp_servers ms
      LEFT JOIN oauth_sessions os ON ms.uuid = os.mcpServerUuid
      WHERE ms.status = ? AND ms.projectId = ?;`,
      McpServerStatus.ACTIVE,
      auth.activeProfile.projectId
    );

    const result = activeMcpServers.map((server: any) => ({
      ...server,
      args: JSON.parse(server.args || '[]'),
      env: JSON.parse(server.env || '{}'),
      oauth_tokens: server.oauth_tokens ? JSON.parse(server.oauth_tokens) : null,
      created_at: new Date(server.created_at),
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch active MCP servers' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}

export async function POST(request: Request) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { uuid, name, description, command, args, env, status, url, type } = body;

    await db.run(
      `INSERT INTO mcp_servers (
        uuid, name, description, command, args, env, status, url, type, projectId, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      uuid,
      name,
      description,
      command || null,
      JSON.stringify(args || []),
      JSON.stringify(env || {}),
      status || McpServerStatus.ACTIVE,
      url || null,
      type || 'stdio',
      auth.activeProfile.projectId,
      Date.now()
    );

    const newMcpServer = await db.get(
      `SELECT uuid, name, description, command, args, env, url, type, status, created_at FROM mcp_servers WHERE uuid = ?;`,
      uuid
    );

    return NextResponse.json({
      ...newMcpServer,
      args: JSON.parse(newMcpServer.args || '[]'),
      env: JSON.parse(newMcpServer.env || '{}'),
      created_at: new Date(newMcpServer.created_at),
    });
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to create MCP server' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}