// import 'dotenv/config'; // No longer needed if DATABASE_URL is not used for SQLite path

import Database from 'better-sqlite3';

// Determine the database path. For testing or specific environments,
// you might use an in-memory database or a different file path.
const dbPath = process.env.DATABASE_URL || 'sqlite.db';
// For Vercel deployments, SQLite needs to be in /tmp
// const dbPath = process.env.VERCEL ? '/tmp/sqlite.db' : (process.env.DATABASE_URL || 'sqlite.db');

export const db = new Database(dbPath);

// Enable WAL mode for better performance and concurrency.
db.pragma('journal_mode = WAL');
