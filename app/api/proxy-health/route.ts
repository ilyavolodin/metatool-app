import { NextResponse } from 'next/server';

import * as logger from '@/lib/logger';

export async function GET() {
  try {
    // Assuming this is intended to check the health of the current application's /api/health endpoint
    const healthUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:12005'}/api/health`;

    const response = await fetch(healthUrl);
    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    logger.error('Proxy health check failed', error);
    return NextResponse.json(
      { error: 'Proxy health check failed' },
      { status: 500 }
    );
  }
}
