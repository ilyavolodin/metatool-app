import { NextResponse } from 'next/server';

import { db } from '@/db';
import { ApiKey } from '@/types/api-key'; // Assuming ApiKey type definition

import { getProjectActiveProfile } from '../actions/profiles';

export async function authenticateApiKey(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Authorization header with Bearer token is required' },
        { status: 401 }
      ),
    };
  }

  const apiKeyString = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix
  const stmt = db.prepare('SELECT * FROM api_keys WHERE api_key = ?');
  const apiKeyRecord = stmt.get(apiKeyString) as ApiKey | undefined;

  if (!apiKeyRecord) {
    return {
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    };
  }

  const activeProfile = await getProjectActiveProfile(
    apiKeyRecord.project_uuid
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
}
