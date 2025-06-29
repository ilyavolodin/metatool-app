'use server';

import { customAlphabet } from 'nanoid';

import { getDb } from '@/db';
import { ApiKey } from '@/types/api-key';

const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  64
);

export async function createApiKey(projectId: string, name?: string) {
  const db = await getDb();
  try {
    const newApiKey = `sk_mt_${nanoid(64)}`;
    const id = nanoid();

    await db.run(
      `INSERT INTO api_keys (id, key, projectId, name) VALUES (?, ?, ?, ?);`,
      id,
      newApiKey,
      projectId,
      name
    );

    const apiKey = await db.get(
      `SELECT id, key, projectId, name FROM api_keys WHERE id = ?;`,
      id
    );
    return apiKey as ApiKey;
  } finally {
    await db.close();
  }
}

export async function getFirstApiKey(projectId: string) {
  const db = await getDb();
  try {
    if (!projectId) {
      return null;
    }

    let apiKey = await db.get(
      `SELECT id, key, projectId, name FROM api_keys WHERE projectId = ? LIMIT 1;`,
      projectId
    );

    if (!apiKey) {
      const newApiKey = `sk_mt_${nanoid(64)}`;
      const id = nanoid();
      await db.run(
        `INSERT INTO api_keys (id, key, projectId) VALUES (?, ?, ?);`,
        id,
        newApiKey,
        projectId
      );

      apiKey = await db.get(
        `SELECT id, key, projectId, name FROM api_keys WHERE id = ?;`,
        id
      );
    }

    return apiKey as ApiKey;
  } finally {
    await db.close();
  }
}

export async function getProjectApiKeys(projectId: string) {
  const db = await getDb();
  try {
    const apiKeys = await db.all(
      `SELECT id, key, projectId, name FROM api_keys WHERE projectId = ?;`,
      projectId
    );
    return apiKeys as ApiKey[];
  } finally {
    await db.close();
  }
}

export async function deleteApiKey(projectId: string, apiKeyId: string) {
  const db = await getDb();
  try {
    await db.run(
      `DELETE FROM api_keys WHERE id = ? AND projectId = ?;`,
      apiKeyId,
      projectId
    );
  } finally {
    await db.close();
  }
}