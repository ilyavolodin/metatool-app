'use server';

import { nanoid } from 'nanoid';

import { getDb } from '@/db';

async function ensureDatabaseSchema() {
  const db = await getDb();
  try {
    // Check if tables exist, create them if they don't
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
  } finally {
    await db.close();
  }
}

export async function createProject(name: string) {
  const db = await getDb();
  try {
    const projectId = nanoid();
    const profileId = nanoid();

    // Create the project
    await db.run(
      `INSERT INTO projects (id, name, activeProfileId) VALUES (?, ?, ?);`,
      projectId,
      name,
      null // Temporarily null, will update after profile creation
    );

    // Create the default profile
    await db.run(
      `INSERT INTO profiles (id, name, projectId, capabilities) VALUES (?, ?, ?, ?);`,
      profileId,
      'Default Workspace',
      projectId,
      JSON.stringify([])
    );

    // Update the project with the active profile
    await db.run(
      `UPDATE projects SET activeProfileId = ? WHERE id = ?;`,
      profileId,
      projectId
    );

    const project = await db.get(
      `SELECT id, name, activeProfileId FROM projects WHERE id = ?;`,
      projectId
    );

    return project;
  } finally {
    await db.close();
  }
}

export async function getProject(projectUuid: string) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id, name, activeProfileId FROM projects WHERE id = ? LIMIT 1;`,
      projectUuid
    );

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  } finally {
    await db.close();
  }
}

export async function getProjects() {
  // Ensure database schema exists
  await ensureDatabaseSchema();
  
  const db = await getDb();
  try {
    let projects = await db.all(
      `SELECT id, name, activeProfileId FROM projects;`
    );

    if (projects.length === 0) {
      const defaultProject = await createProject('Default Project');
      projects = [defaultProject];
    }

    return projects;
  } finally {
    await db.close();
  }
}

export async function updateProjectName(projectUuid: string, newName: string) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id FROM projects WHERE id = ? LIMIT 1;`,
      projectUuid
    );

    if (!project) {
      throw new Error('Project not found');
    }

    await db.run(
      `UPDATE projects SET name = ? WHERE id = ?;`,
      newName,
      projectUuid
    );

    const updatedProject = await db.get(
      `SELECT id, name, activeProfileId FROM projects WHERE id = ?;`,
      projectUuid
    );

    return updatedProject;
  } finally {
    await db.close();
  }
}

export async function deleteProject(projectUuid: string) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id FROM projects WHERE id = ? LIMIT 1;`,
      projectUuid
    );

    if (!project) {
      throw new Error('Project not found');
    }

    const projectCount = await db.get(
      `SELECT COUNT(*) as count FROM projects;`
    );

    if (projectCount.count === 1) {
      throw new Error('Cannot delete the last project');
    }

    await db.run(`DELETE FROM projects WHERE id = ?;`, projectUuid);

    return { success: true };
  } finally {
    await db.close();
  }
}

export async function setActiveProject(projectUuid: string) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id, name, activeProfileId FROM projects WHERE id = ? LIMIT 1;`,
      projectUuid
    );

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  } finally {
    await db.close();
  }
}

// Ensure the database schema is initialized
ensureDatabaseSchema().catch(console.error);