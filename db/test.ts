import { getDb } from './index';

export async function testDbConnection() {
  try {
    console.log('Testing database connection...');
    const db = await getDb();
    console.log('Database connected successfully');
    
    // Test a simple query
    const result = await db.get("SELECT sqlite_version() as version");
    console.log('SQLite version:', result.version);
    
    await db.close();
    console.log('Database connection closed');
    return true;
  } catch (error) {
    console.error('Database test failed:', error);
    return false;
  }
}
