import { NextResponse } from 'next/server';

import * as logger from '@/lib/logger';

export async function GET() {
  try {
    const proxyHealthUrl = `${process.env.REMOTE_HOSTING_URL || 'http://localhost:12005/host'}/health`;

    const response = await fetch(proxyHealthUrl);
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
