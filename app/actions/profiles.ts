'use server';

import { nanoid } from 'nanoid';

import { db } from '@/db';
import { ProfileCapability } from '@/db/schema';
import { Profile } from '@/types/profile';
import { Project } from '@/types/project';


// Helper to map row to Profile, parsing JSON fields
function mapRowToProfile(row: any): Profile {
  return {
    ...row,
    enabled_capabilities: JSON.parse(row.enabled_capabilities as string || '[]'),
    created_at: new Date(row.created_at as string),
  } as Profile;
}

export async function createProfile(
  currentProjectUuid: string,
  name: string
): Promise<Profile> {
  const capabilities: ProfileCapability[] = [];
  const uuid = nanoid();
  const created_at = new Date().toISOString();

  const stmt = db.prepare(
    'INSERT INTO profiles (uuid, name, project_uuid, enabled_capabilities, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *'
  );
  const newProfile = stmt.get(uuid, name, currentProjectUuid, JSON.stringify(capabilities), created_at);

  if (!newProfile) {
    throw new Error('Failed to create profile');
  }
  return mapRowToProfile(newProfile);
}

export async function getProfile(profileUuid: string): Promise<Profile | null> {
  const stmt = db.prepare('SELECT * FROM profiles WHERE uuid = ?');
  const profile = stmt.get(profileUuid);
  if (!profile) {
    return null;
  }
  return mapRowToProfile(profile);
}

export async function getProfiles(currentProjectUuid: string): Promise<Profile[]> {
  const stmt = db.prepare('SELECT * FROM profiles WHERE project_uuid = ?');
  const profiles = stmt.all(currentProjectUuid);
  return profiles.map(mapRowToProfile);
}

export async function getProjectActiveProfile(currentProjectUuid: string): Promise<Profile | null> {
  const projectStmt = db.prepare('SELECT * FROM projects WHERE uuid = ?');
  const project = projectStmt.get(currentProjectUuid) as Project | undefined;

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.active_profile_uuid) {
    const profileStmt = db.prepare('SELECT * FROM profiles WHERE uuid = ?');
    const activeProfile = profileStmt.get(project.active_profile_uuid);
    if (activeProfile) {
      return mapRowToProfile(activeProfile);
    }
  }

  const profilesStmt = db.prepare('SELECT * FROM profiles WHERE project_uuid = ?');
  const profiles = profilesStmt.all(currentProjectUuid).map(mapRowToProfile);

  if (profiles.length > 0) {
    const updateProjectStmt = db.prepare('UPDATE projects SET active_profile_uuid = ? WHERE uuid = ?');
    updateProjectStmt.run(profiles[0].uuid, currentProjectUuid);
    return profiles[0];
  }

  const defaultProfile = await createProfile(currentProjectUuid, 'Default Workspace');
  const updateProjectStmt = db.prepare('UPDATE projects SET active_profile_uuid = ? WHERE uuid = ?');
  updateProjectStmt.run(defaultProfile.uuid, currentProjectUuid);
  return defaultProfile;
}

export async function setProfileActive(
  projectUuid: string,
  profileUuid: string
): Promise<void> {
  const projectStmt = db.prepare('SELECT uuid FROM projects WHERE uuid = ?');
  const project = projectStmt.get(projectUuid);

  if (!project) {
    throw new Error('Project not found');
  }

  const stmt = db.prepare('UPDATE projects SET active_profile_uuid = ? WHERE uuid = ?');
  const info = stmt.run(profileUuid, projectUuid);

  if (info.changes === 0) {
    // This case should ideally not be reached if the project check above is done.
    throw new Error('Failed to update project or project not found');
  }
}

export async function updateProfileName(profileUuid: string, newName: string): Promise<Profile> {
  const stmtGet = db.prepare('SELECT * FROM profiles WHERE uuid = ?');
  const profile = stmtGet.get(profileUuid);

  if (!profile) {
    throw new Error('Profile not found');
  }

  const stmtUpdate = db.prepare('UPDATE profiles SET name = ? WHERE uuid = ? RETURNING *');
  const updatedProfile = stmtUpdate.get(newName, profileUuid);

  if (!updatedProfile) {
    throw new Error('Failed to update profile name');
  }
  return mapRowToProfile(updatedProfile);
}

export async function deleteProfile(profileUuid: string): Promise<{ success: boolean }> {
  const stmtGet = db.prepare('SELECT project_uuid FROM profiles WHERE uuid = ?');
  const profileToDelete = stmtGet.get(profileUuid) as { project_uuid: string } | undefined;

  if (!profileToDelete) {
    throw new Error('Profile not found');
  }

  const stmtProjectProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE project_uuid = ?');
  const { count } = stmtProjectProfiles.get(profileToDelete.project_uuid) as { count: number };

  if (count === 1) {
    throw new Error('Cannot delete the last profile in a project');
  }

  // Check if the profile to be deleted is the active one for any project
  const stmtCheckActive = db.prepare('SELECT uuid FROM projects WHERE active_profile_uuid = ?');
  const isActiveForProject = stmtCheckActive.get(profileUuid);

  if (isActiveForProject) {
      // Find another profile in the same project to set as active
      const stmtFindOther = db.prepare('SELECT uuid FROM profiles WHERE project_uuid = ? AND uuid != ? LIMIT 1');
      const otherProfile = stmtFindOther.get(profileToDelete.project_uuid, profileUuid) as { uuid: string } | undefined;
      if (otherProfile) {
          const stmtUpdateActive = db.prepare('UPDATE projects SET active_profile_uuid = ? WHERE uuid = ?');
          stmtUpdateActive.run(otherProfile.uuid, (isActiveForProject as {uuid: string}).uuid);
      } else {
          // This should not happen if count > 1 check is correct
          throw new Error('Cannot delete active profile without another profile to set as active.');
      }
  }


  const stmtDelete = db.prepare('DELETE FROM profiles WHERE uuid = ?');
  stmtDelete.run(profileUuid);

  return { success: true };
}

export async function setActiveProfile(profileUuid: string): Promise<Profile | null> {
  // This function seems redundant with getProfile and setProfileActive.
  // For now, it will just fetch the profile.
  // Consider if this function is still needed or if its logic should be merged.
  const stmt = db.prepare('SELECT * FROM profiles WHERE uuid = ?');
  const profile = stmt.get(profileUuid);

  if (!profile) {
    return null;
  }
  return mapRowToProfile(profile);
}

export async function updateProfileCapabilities(
  profileUuid: string,
  capabilities: ProfileCapability[]
): Promise<Profile> {
  const stmtGet = db.prepare('SELECT * FROM profiles WHERE uuid = ?');
  const profile = stmtGet.get(profileUuid);

  if (!profile) {
    throw new Error('Profile not found');
  }

  const stmtUpdate = db.prepare('UPDATE profiles SET enabled_capabilities = ? WHERE uuid = ? RETURNING *');
  const updatedProfile = stmtUpdate.get(JSON.stringify(capabilities), profileUuid);

  if (!updatedProfile) {
    throw new Error('Failed to update profile capabilities');
  }
  return mapRowToProfile(updatedProfile);
}
