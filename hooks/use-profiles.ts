import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { getProfiles, getProjectActiveProfile } from '@/app/actions/profiles';
import { Profile } from '@/types/profile';

import { useProjects } from './use-projects';

const CURRENT_PROFILE_KEY = 'metamcp-current-profile';

export function useProfiles() {
  const { currentProject } = useProjects();

  const {
    data: profiles,
    error: profilesError,
    isLoading: profilesLoading,
    mutate: mutateProfiles,
  } = useSWR(currentProject ? `${currentProject.id}/profiles` : null, () =>
    getProfiles(currentProject?.id || '')
  );

  const {
    data: activeProfile,
    isLoading: activeProfileLoading,
    error: activeProfileError,
    mutate: mutateActiveProfile,
  } = useSWR(
    currentProject?.id ? `${currentProject.id}/profiles/current` : null,
    () => getProjectActiveProfile(currentProject!.id)
  );

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Load saved profile on mount
  useEffect(() => {
    const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
    if (profiles?.length) {
      if (savedProfileId) {
        const savedProfile = profiles.find((p) => p.id === savedProfileId);
        if (savedProfile) {
          setCurrentProfile(savedProfile);
          return;
        }
      }
      // If no saved profile or saved profile not found, use active profile or first profile
      setCurrentProfile(activeProfile || profiles[0]);
    }
  }, [profiles, activeProfile]);

  // Persist profile selection
  const handleSetCurrentProfile = (profile: Profile | null) => {
    setCurrentProfile(profile);

    if (profile) {
      localStorage.setItem(CURRENT_PROFILE_KEY, profile.id);
    } else {
      localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
  };

  return {
    profiles: profiles ?? [],
    currentProfile,
    setCurrentProfile: handleSetCurrentProfile,
    activeProfile,
    isLoading: profilesLoading || activeProfileLoading,
    error: profilesError || activeProfileError,
    mutateProfiles,
    mutateActiveProfile
  };
}