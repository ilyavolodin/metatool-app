'use server';

import {
  OAuthClientInformation,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

import { getDb } from '@/db';

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
}) {
  const db = await getDb();
  try {
    // Check if session exists
    const existingSession = await db.get(
      `SELECT * FROM oauth_sessions WHERE mcpServerUuid = ?;`,
      mcpServerUuid
    );

    if (existingSession) {
      // Update existing session
      const fields: string[] = [];
      const params: any[] = [];

      if (clientInformation !== undefined) { fields.push(`clientInformation = ?`); params.push(JSON.stringify(clientInformation)); }
      if (tokens !== undefined) { fields.push(`tokens = ?`); params.push(JSON.stringify(tokens)); }
      if (codeVerifier !== undefined) { fields.push(`codeVerifier = ?`); params.push(codeVerifier); }
      fields.push(`updatedAt = ?`); params.push(Date.now());

      if (fields.length > 0) {
        params.push(mcpServerUuid);
        await db.run(
          `UPDATE oauth_sessions SET ${fields.join(', ')} WHERE mcpServerUuid = ?;`,
          ...params
        );
      }
    } else if (clientInformation) {
      // Create new session (require clientInformation for creation)
      await db.run(
        `INSERT INTO oauth_sessions (
          mcpServerUuid, clientInformation, tokens, codeVerifier, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?);`,
        mcpServerUuid,
        JSON.stringify(clientInformation),
        tokens ? JSON.stringify(tokens) : null,
        codeVerifier || null,
        Date.now(),
        Date.now()
      );
    }
  } finally {
    await db.close();
  }
}

export async function getOAuthSession(mcpServerUuid: string) {
  const db = await getDb();
  try {
    const session = await db.get(
      `SELECT * FROM oauth_sessions WHERE mcpServerUuid = ?;`,
      mcpServerUuid
    );

    if (session) {
      return {
        ...session,
        clientInformation: JSON.parse(session.clientInformation),
        tokens: session.tokens ? JSON.parse(session.tokens) : null,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      };
    }
    return null;
  } finally {
    await db.close();
  }
}