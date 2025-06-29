const dbPath = process.env.DATABASE_URL || 'sqlite.db';

export const getDb = async () => {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('Database can only be accessed on the server side');
  }

  try {
    console.log('Opening database at:', dbPath);
    
    // Dynamic imports to ensure these only run on server
    const sqlite3 = (await import('sqlite3')).default;
    const { open } = await import('sqlite');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log('Database opened successfully');
    return db;
  } catch (error) {
    console.error('Error opening database:', error);
    throw error;
  }
};