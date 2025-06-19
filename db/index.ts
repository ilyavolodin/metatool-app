// import 'dotenv/config'; // No longer needed if DATABASE_URL is not used for SQLite path

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

// Determine the database path. For testing or specific environments,
// you might use an in-memory database or a different file path.
const dbPath = process.env.DATABASE_URL || 'sqlite.db';
// For Vercel deployments, SQLite needs to be in /tmp
// const dbPath = process.env.VERCEL ? '/tmp/sqlite.db' : (process.env.DATABASE_URL || 'sqlite.db');


const sqlite = new Database(dbPath);

// Enable WAL mode for better performance and concurrency.
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
