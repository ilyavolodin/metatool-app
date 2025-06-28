import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

import * as schema from './schema';

const dbPath = process.env.DATABASE_URL || 'sqlite.db';

const sqliteProxy = async (sql: string, params: any[], method: string) => {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    let result;
    switch (method) {
      case 'run':
        result = await db.run(sql, params);
        break;
      case 'get':
        result = await db.get(sql, params);
        break;
      case 'all':
        result = await db.all(sql, params);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    return { rows: result };
  } catch (e) {
    console.error('Error from sqlite proxy:', e);
    throw e;
  } finally {
    await db.close();
  }
};

export const db = drizzle(sqliteProxy, { schema });
