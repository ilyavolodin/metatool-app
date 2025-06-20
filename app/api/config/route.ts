import { NextResponse } from 'next/server';

export async function GET() {
  // In a Next.js app, configuration should ideally be managed
  // through environment variables or a dedicated config file.
  // For now, we'll simulate the behavior of the original remote-hosting server.
  // const env = process.env.REMOTE_HOSTING_ENV || ''; // Removed
  // const args = process.env.REMOTE_HOSTING_ARGS || ''; // Removed

  // Mimic the original /config response
  // The original implementation used a function `handleConfig` which took
  // `req`, `res`, `env`, and `args`. Here we directly return the JSON.
  // Removed env and args from the response.
  return NextResponse.json({
    // Assuming these were static or derived values in the original handleConfig
    // If they were dynamic, this part would need adjustment.
    features: {
      streamableHttp: true,
      sse: true,
    },
    themes: [], // Assuming no themes are configured by default
  });
}
