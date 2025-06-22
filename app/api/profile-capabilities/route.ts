import { NextResponse } from 'next/server';

import { db } from '@/db';
import * as logger from '@/lib/logger';
import { Profile } from '@/types/profile'; // Assuming Profile type definition

import { authenticateApiKey } from '../auth';

export async function GET(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (authResult.error) return authResult.error;
    const { activeProfile } = authResult;

    const stmt = db.prepare('SELECT enabled_capabilities FROM profiles WHERE uuid = ?');
    const profileData = stmt.get(activeProfile.uuid) as Pick<Profile, 'enabled_capabilities'> | undefined;

    if (!profileData) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      profileCapabilities: JSON.parse(profileData.enabled_capabilities as unknown as string || '[]'),
    });
  } catch (error) {
    logger.error('Failed to fetch profile capabilities:',error);
    return NextResponse.json(
      { error: 'Failed to fetch profile capabilities' },
      { status: 500 }
    );
  }
}
