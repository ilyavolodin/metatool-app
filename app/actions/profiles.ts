'use server';

import { nanoid } from 'nanoid';

import { getDb } from '@/db';

enum ProfileCapability {
  TOOLS_MANAGEMENT = 'tools_management',
  API_KEY_MANAGEMENT = 'api_key_management',
  PROJECT_MANAGEMENT = 'project_management',
  PROFILE_MANAGEMENT = 'profile_management',
  TOOL_LOGS = 'tool_logs',
}

export async function createProfile(
  projectId: string,
  name: string
) {
  const db = await getDb();
  try {
    const id = nanoid();
    const capabilities: ProfileCapability[] = [];

    await db.run(
      `INSERT INTO profiles (id, name, projectId, capabilities) VALUES (?, ?, ?, ?);`,
      id,
      name,
      projectId,
      JSON.stringify(capabilities)
    );

    const profile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ?;`,
      id
    );
    return {
      ...profile,
      capabilities: JSON.parse(profile.capabilities),
    };
  } finally {
    await db.close();
  }
}

export async function getProfile(profileId: string) {
  const db = await getDb();
  try {
    const profile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ? LIMIT 1;`,
      profileId
    );

    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      ...profile,
      capabilities: JSON.parse(profile.capabilities),
    };
  } finally {
    await db.close();
  }
}

export async function getProfiles(projectId: string) {
  const db = await getDb();
  try {
    const profiles = await db.all(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE projectId = ?;`,
      projectId
    );

    return profiles.map((profile: any) => ({
      ...profile,
      capabilities: JSON.parse(profile.capabilities),
    }));
  } finally {
    await db.close();
  }
}

export async function getProjectActiveProfile(projectId: string) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id, name, activeProfileId FROM projects WHERE id = ? LIMIT 1;`,
      projectId
    );

    if (!project) {
      throw new Error('Project not found');
    }

    let activeProfile = null;

    if (project.activeProfileId) {
      activeProfile = await db.get(
        `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ? LIMIT 1;`,
        project.activeProfileId
      );
    }

    if (activeProfile) {
      return {
        ...activeProfile,
        capabilities: JSON.parse(activeProfile.capabilities),
      };
    }

    const profiles = await db.all(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE projectId = ?;`,
      projectId
    );

    if (profiles.length > 0) {
      const firstProfile = profiles[0];
      await db.run(
        `UPDATE projects SET activeProfileId = ? WHERE id = ?;`,
        firstProfile.id,
        projectId
      );
      return {
        ...firstProfile,
        capabilities: JSON.parse(firstProfile.capabilities),
      };
    }

    const defaultProfileId = nanoid();
    const defaultCapabilities: ProfileCapability[] = [];
    await db.run(
      `INSERT INTO profiles (id, name, projectId, capabilities) VALUES (?, ?, ?, ?);`,
      defaultProfileId,
      'Default Workspace',
      projectId,
      JSON.stringify(defaultCapabilities)
    );

    await db.run(
      `UPDATE projects SET activeProfileId = ? WHERE id = ?;`,
      defaultProfileId,
      projectId
    );

    const newDefaultProfile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ?;`,
      defaultProfileId
    );

    return {
      ...newDefaultProfile,
      capabilities: JSON.parse(newDefaultProfile.capabilities),
    };
  } finally {
    await db.close();
  }
}

export async function setProfileActive(
  projectId: string,
  profileId: string
) {
  const db = await getDb();
  try {
    const project = await db.get(
      `SELECT id FROM projects WHERE id = ? LIMIT 1;`,
      projectId
    );

    if (!project) {
      throw new Error('Project not found');
    }

    await db.run(
      `UPDATE projects SET activeProfileId = ? WHERE id = ?;`,
      profileId,
      projectId
    );
  } finally {
    await db.close();
  }
}

export async function updateProfileName(profileId: string, newName: string) {
  const db = await getDb();
  try {
    const profile = await db.get(
      `SELECT id FROM profiles WHERE id = ? LIMIT 1;`,
      profileId
    );

    if (!profile) {
      throw new Error('Profile not found');
    }

    await db.run(
      `UPDATE profiles SET name = ? WHERE id = ?;`,
      newName,
      profileId
    );

    const updatedProfile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ?;`,
      profileId
    );

    return {
      ...updatedProfile,
      capabilities: JSON.parse(updatedProfile.capabilities),
    };
  } finally {
    await db.close();
  }
}

export async function deleteProfile(profileId: string) {
  const db = await getDb();
  try {
    const profile = await db.get(
      `SELECT id, projectId FROM profiles WHERE id = ? LIMIT 1;`,
      profileId
    );

    if (!profile) {
      throw new Error('Profile not found');
    }

    const profileCount = await db.get(
      `SELECT COUNT(*) as count FROM profiles WHERE projectId = ?;`,
      profile.projectId
    );

    if (profileCount.count === 1) {
      throw new Error('Cannot delete the last profile in a project.');
    }

    await db.run(`DELETE FROM profiles WHERE id = ?;`, profileId);

    return { success: true };
  } finally {
    await db.close();
  }
}

export async function setActiveProfile(profileId: string) {
  const db = await getDb();
  try {
    const profile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ? LIMIT 1;`,
      profileId
    );

    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      ...profile,
      capabilities: JSON.parse(profile.capabilities),
    };
  } finally {
    await db.close();
  }
}

export async function updateProfileCapabilities(
  profileId: string,
  capabilities: ProfileCapability[]
) {
  const db = await getDb();
  try {
    const profile = await db.get(
      `SELECT id FROM profiles WHERE id = ? LIMIT 1;`,
      profileId
    );

    if (!profile) {
      throw new Error('Profile not found');
    }

    await db.run(
      `UPDATE profiles SET capabilities = ? WHERE id = ?;`,
      JSON.stringify(capabilities),
      profileId
    );

    const updatedProfile = await db.get(
      `SELECT id, name, projectId, capabilities FROM profiles WHERE id = ?;`,
      profileId
    );

    return {
      ...updatedProfile,
      capabilities: JSON.parse(updatedProfile.capabilities),
    };
  } finally {
    await db.close();
  }
}