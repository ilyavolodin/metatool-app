import { nanoid } from 'nanoid';

import { getDb } from '@/db';

export async function isDatabaseInitialized() {
  try {
    const db = await getDb();
    try {
      // Check if the projects table exists
      const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='projects';");
      if (!tableExists) {
        return false;
      }
      // Check if there's any data in the projects table
      const result = await db.get("SELECT COUNT(*) as count FROM projects;");
      return result && result.count > 0;
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return false;
    } finally {
      await db.close();
    }
  } catch (connectionError) {
    console.error('Database connection error:', connectionError);
    return false;
  }
}

export async function initializeDatabase(projectName: string) {
  let db;
  try {
    db = await getDb();
    console.log('Database connection established');
    
    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        activeProfileId TEXT
      );
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        projectId TEXT NOT NULL,
        capabilities TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY NOT NULL,
        key TEXT UNIQUE NOT NULL,
        projectId TEXT NOT NULL,
        name TEXT,
        api_key TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS mcp_servers (
        uuid TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        command TEXT,
        args TEXT,
        env TEXT,
        url TEXT,
        type TEXT DEFAULT 'stdio',
        status INTEGER DEFAULT 1,
        projectId TEXT NOT NULL,
        created_at INTEGER,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY NOT NULL,
        mcpServerUuid TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        inputSchema TEXT,
        outputSchema TEXT,
        isAvailable INTEGER DEFAULT 1,
        FOREIGN KEY (mcpServerUuid) REFERENCES mcp_servers(uuid) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tool_execution_logs (
        id TEXT PRIMARY KEY NOT NULL,
        toolName TEXT NOT NULL,
        input TEXT,
        output TEXT,
        timestamp INTEGER NOT NULL,
        projectId TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    console.log('Tables created successfully');

    // Create a default project
    const projectId = nanoid();
    await db.run("INSERT INTO projects (id, name) VALUES (?, ?);", projectId, projectName);
    console.log('Project created with ID:', projectId);

    // Create a default profile and link it to the project
    const profileId = nanoid();
    await db.run("INSERT INTO profiles (id, name, projectId, capabilities) VALUES (?, ?, ?, ?);", profileId, "Default Profile", projectId, "[]");
    console.log('Profile created with ID:', profileId);

    // Update the project with the active profile
    await db.run("UPDATE projects SET activeProfileId = ? WHERE id = ?;", profileId, projectId);
    console.log('Project updated with active profile');

    return { id: projectId, name: projectName, activeProfileId: profileId };
  } catch (e) {
    console.error("Error initializing database:", e);
    throw e;
  } finally {
    if (db) {
      await db.close();
    }
  }
}