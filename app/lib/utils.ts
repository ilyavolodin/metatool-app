import { type ClassValue, clsx } from "clsx";
import { NextRequest } from 'next/server';
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes with clsx.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract API key from Bearer token in Authorization header.
 */
export const extractApiKey = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
};
