'use server';

import { nanoid } from 'nanoid';

import { db } from '@/db';
import { Project } from '@/types'; // Assuming Profile and Project are in types/index.ts or similar

// Helper to map row to Project, parsing JSON fields if any (none in this schema for Project)
// and converting date strings to Date objects.
function mapRowToProject(row: any): Project {
  return {
    ...row,
    created_at: new Date(row.created_at as string),
  } as Project;
}


export async function createProject(name: string): Promise<Project> {
  const projectUuid = nanoid();
  const profileUuid = nanoid();
  const now = new Date().toISOString();

  // Use a transaction to ensure atomicity
  const runTransaction = db.transaction(() => {
    const insertProjectStmt = db.prepare(
      'INSERT INTO projects (uuid, name, created_at, active_profile_uuid) VALUES (?, ?, ?, ?) RETURNING *'
    );
    // Initially insert with active_profile_uuid as null or pointing to the new profile
    const newProject = insertProjectStmt.get(projectUuid, name, now, profileUuid);

    if (!newProject) {
      throw new Error('Failed to create project');
    }

    const insertProfileStmt = db.prepare(
      'INSERT INTO profiles (uuid, name, project_uuid, enabled_capabilities, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertProfileStmt.run(profileUuid, 'Default Workspace', projectUuid, JSON.stringify([]), now);

    return mapRowToProject(newProject);
  });

  return runTransaction();
}

export async function getProject(projectUuid: string): Promise<Project | null> {
  const stmt = db.prepare('SELECT * FROM projects WHERE uuid = ?');
  const project = stmt.get(projectUuid);

  if (!project) {
    return null;
  }
  return mapRowToProject(project);
}

export async function getProjects(): Promise<Project[]> {
  const stmt = db.prepare('SELECT * FROM projects');
  let projects = stmt.all().map(mapRowToProject);

  if (projects.length === 0) {
    const defaultProject = await createProject('Default Project');
    projects = [defaultProject];
  }

  return projects;
}

export async function updateProjectName(projectUuid: string, newName: string): Promise<Project> {
  const stmtGet = db.prepare('SELECT * FROM projects WHERE uuid = ?');
  const project = stmtGet.get(projectUuid);

  if (!project) {
    throw new Error('Project not found');
  }

  const stmtUpdate = db.prepare('UPDATE projects SET name = ? WHERE uuid = ? RETURNING *');
  const updatedProject = stmtUpdate.get(newName, projectUuid);

  if (!updatedProject) {
    // Should not happen if the get above succeeded and DB is consistent
    throw new Error('Failed to update project name');
  }
  return mapRowToProject(updatedProject);
}

export async function deleteProject(projectUuid: string): Promise<{ success: boolean }> {
  const stmtGet = db.prepare('SELECT * FROM projects WHERE uuid = ?');
  const project = stmtGet.get(projectUuid);

  if (!project) {
    throw new Error('Project not found');
  }

  const stmtProjectCount = db.prepare('SELECT COUNT(*) as count FROM projects');
  const { count } = stmtProjectCount.get() as { count: number };


  if (count === 1) {
    throw new Error('Cannot delete the last project');
  }

  // Transaction to delete project and its associated profiles
  const runDeleteTransaction = db.transaction(() => {
    const stmtDeleteProfiles = db.prepare('DELETE FROM profiles WHERE project_uuid = ?');
    stmtDeleteProfiles.run(projectUuid);

    const stmtDeleteProject = db.prepare('DELETE FROM projects WHERE uuid = ?');
    stmtDeleteProject.run(projectUuid);
  });

  runDeleteTransaction();
  return { success: true };
}

export async function setActiveProject(projectUuid: string): Promise<Project | null> {
  // This function seems to imply setting a global "active" project,
  // which isn't directly supported by the schema in a way that `setProfileActive` was.
  // For now, it will just fetch the project. Consider if its behavior needs to change.
  const stmt = db.prepare('SELECT * FROM projects WHERE uuid = ?');
  const project = stmt.get(projectUuid);

  if (!project) {
    return null;
  }
  return mapRowToProject(project);
}
