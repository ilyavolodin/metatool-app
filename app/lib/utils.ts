import { NextRequest } from 'next/server';

/**
 * Extract API key from Bearer token in Authorization header
 */
export const extractApiKey = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
};
