import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import * as logger from '@/lib/logger';

import { authenticateApiKey } from '../auth';

export async function GET(request: Request) {
  const db = await getDb();
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const profile = await db.get(
      `SELECT capabilities FROM profiles WHERE id = ? LIMIT 1;`,
      auth.activeProfile.id
    );

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      profileCapabilities: JSON.parse(profile.capabilities || '[]'),
    });
  } catch (error) {
    logger.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch profile capabilities' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}