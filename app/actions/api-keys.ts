'use server';

import { customAlphabet } from 'nanoid';
import { nanoid as generateId } from 'nanoid';

import { db } from '@/db';
import { ApiKey } from '@/types/api-key';

const generateApiKey = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  64
);

export async function createApiKey(projectUuid: string, name?: string): Promise<ApiKey> {
  const newApiKey = `sk_mt_${generateApiKey(64)}`;
  const uuid = generateId();
  const created_at = new Date().toISOString();

  const stmt = db.prepare(
    'INSERT INTO api_keys (uuid, project_uuid, api_key, name, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *'
  );
  const apiKey = stmt.get(uuid, projectUuid, newApiKey, name, created_at);
  return apiKey as ApiKey;
}

export async function getFirstApiKey(projectUuid: string): Promise<ApiKey | null> {
  if (!projectUuid) {
    return null;
  }

  const stmtSelect = db.prepare('SELECT * FROM api_keys WHERE project_uuid = ? LIMIT 1');
  let apiKey = stmtSelect.get(projectUuid);

  if (!apiKey) {
    const newApiKey = `sk_mt_${generateApiKey(64)}`;
    const uuid = generateId();
    const created_at = new Date().toISOString();
    const stmtInsert = db.prepare(
      'INSERT INTO api_keys (uuid, project_uuid, api_key, created_at) VALUES (?, ?, ?, ?)'
    );
    stmtInsert.run(uuid, projectUuid, newApiKey, created_at);

    apiKey = stmtSelect.get(projectUuid);
  }

  return apiKey as ApiKey | null;
}

export async function getProjectApiKeys(projectUuid: string): Promise<ApiKey[]> {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE project_uuid = ?');
  const apiKeys = stmt.all(projectUuid);
  return apiKeys as ApiKey[];
}

export async function deleteApiKey(projectUuid: string, apiKeyUuid: string): Promise<void> {
  const stmt = db.prepare('DELETE FROM api_keys WHERE uuid = ? AND project_uuid = ?');
  stmt.run(apiKeyUuid, projectUuid);
}
