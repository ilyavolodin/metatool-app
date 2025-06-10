export const VERBOSE = process.env.VERBOSE === 'true';

export function log(...args: unknown[]) {
  console.log(...args);
}

export function warn(...args: unknown[]) {
  console.warn(...args);
}

export function error(...args: unknown[]) {
  console.error(...args);
}

