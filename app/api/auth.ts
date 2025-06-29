import { NextResponse } from 'next/server';

import { getDb } from '@/db';

import { getProjectActiveProfile } from '../actions/profiles';

export async function authenticateApiKey(request: Request) {
  const db = await getDb();
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        error: NextResponse.json(
          { error: 'Authorization header with Bearer token is required' },
          { status: 401 }
        ),
      };
    }

    const apiKey = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix
    const apiKeyRecord = await db.get(
      `SELECT id, key, projectId, name FROM api_keys WHERE key = ? LIMIT 1;`,
      apiKey
    );

    if (!apiKeyRecord) {
      return {
        error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }

    const activeProfile = await getProjectActiveProfile(
      apiKeyRecord.projectId
    );
    if (!activeProfile) {
      return {
        error: NextResponse.json(
          { error: 'No active profile found for this API key' },
          { status: 401 }
        ),
      };
    }

    return {
      success: true,
      apiKey: apiKeyRecord,
      activeProfile,
    };
  } finally {
    await db.close();
  }
}