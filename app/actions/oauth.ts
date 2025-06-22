'use server';

import {
  OAuthClientInformation,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { nanoid } from 'nanoid';

import { db } from '@/db';
import { OAuthSession } from '@/types/oauth'; // Assuming you have this type

export async function saveOAuthSession({
  mcpServerUuid,
  clientInformation,
  tokens,
  codeVerifier,
}: {
  mcpServerUuid: string;
  clientInformation?: OAuthClientInformation;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}): Promise<void> {
  const stmtSelect = db.prepare('SELECT * FROM oauth_sessions WHERE mcp_server_uuid = ?');
  const existingSession = stmtSelect.get(mcpServerUuid);

  if (existingSession) {
    const updates = [];
    const params = [];
    if (clientInformation) {
      updates.push('client_information = ?');
      params.push(JSON.stringify(clientInformation));
    }
    if (tokens) {
      updates.push('tokens = ?');
      params.push(JSON.stringify(tokens));
    }
    if (codeVerifier) {
      updates.push('code_verifier = ?');
      params.push(codeVerifier);
    }
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    if (updates.length > 1) { // at least updated_at will be there
      const query = `UPDATE oauth_sessions SET ${updates.join(', ')} WHERE mcp_server_uuid = ?`;
      params.push(mcpServerUuid);
      const stmtUpdate = db.prepare(query);
      stmtUpdate.run(...params);
    }
  } else if (clientInformation) {
    const uuid = nanoid();
    const created_at = new Date().toISOString();
    const updated_at = created_at;
    const stmtInsert = db.prepare(
      'INSERT INTO oauth_sessions (uuid, mcp_server_uuid, client_information, tokens, code_verifier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmtInsert.run(
      uuid,
      mcpServerUuid,
      JSON.stringify(clientInformation),
      tokens ? JSON.stringify(tokens) : null,
      codeVerifier,
      created_at,
      updated_at
    );
  }
}

export async function getOAuthSession(mcpServerUuid: string): Promise<OAuthSession | null> {
  const stmt = db.prepare('SELECT * FROM oauth_sessions WHERE mcp_server_uuid = ?');
  const session = stmt.get(mcpServerUuid) as any;
  if (session) {
    return {
      ...session,
      client_information: JSON.parse(session.client_information || '{}'),
      tokens: session.tokens ? JSON.parse(session.tokens) : null,
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at),
    } as OAuthSession;
  }
  return null;
}
