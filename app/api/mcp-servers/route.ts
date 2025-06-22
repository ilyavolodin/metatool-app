import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { McpServerStatus, McpServerType } from '@/db/schema'; // McpServerType might be needed for POST
import * as logger from '@/lib/logger';
import { McpServer } from '@/types/mcp-server';
import { OAuthSession } from '@/types/oauth';

import { authenticateApiKey } from '../auth';

export async function GET(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult;

    const query = `
      SELECT ms.*, os.tokens as oauth_tokens
      FROM mcp_servers ms
      LEFT JOIN oauth_sessions os ON ms.uuid = os.mcp_server_uuid
      WHERE ms.status = ? AND ms.profile_uuid = ?
    `;
    const stmt = db.prepare(query);
    const activeMcpServersData = stmt.all(McpServerStatus.ACTIVE, activeProfile.uuid);

    const result = activeMcpServersData.map((row: any) => {
      const server = {
        ...row,
        args: JSON.parse(row.args || '[]'),
        env: JSON.parse(row.env || '{}'),
        created_at: new Date(row.created_at),
        oauth_tokens: row.oauth_tokens ? JSON.parse(row.oauth_tokens) : null,
      };
      // Remove the raw oauth_tokens from the final server object if it's a separate field in your type
      // delete server.oauth_tokens_raw; // Example if there was a raw field
      return server as McpServer & { oauth_tokens: OAuthSession['tokens'] | null };
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to fetch active MCP servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active MCP servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult;

    const body = await request.json();
    const {
      uuid: providedUuid, // User might provide a UUID
      name,
      description,
      command,
      args,
      env,
      status,
      type, // Added type
      url,  // Added url
    } = body;

    const newUuid = providedUuid || nanoid();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(
      'INSERT INTO mcp_servers (uuid, name, description, command, args, env, status, type, url, profile_uuid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    );
    const newMcpServerRow = stmt.get(
      newUuid,
      name,
      description,
      command,
      JSON.stringify(args || []),
      JSON.stringify(env || {}),
      status || McpServerStatus.ACTIVE,
      type || McpServerType.STDIO, // Default type if not provided
      url,
      activeProfile.uuid,
      createdAt
    ) as any;

    if (!newMcpServerRow) {
        throw new Error('Failed to create MCP server in database');
    }

    const newMcpServer = {
        ...newMcpServerRow,
        args: JSON.parse(newMcpServerRow.args || '[]'),
        env: JSON.parse(newMcpServerRow.env || '{}'),
        created_at: new Date(newMcpServerRow.created_at),
    } as McpServer;


    return NextResponse.json(newMcpServer);
  } catch (error) {
    logger.error('Failed to create MCP server:', error);
    return NextResponse.json(
      { error: 'Failed to create MCP server' },
      { status: 500 }
    );
  }
}
