import { ProfileCapability } from '@/db/schema'; // Removed WorkspaceMode

export interface Profile {
  uuid: string;
  name: string;
  created_at: Date;
  project_uuid: string;
  enabled_capabilities: ProfileCapability[];
  // workspace_mode: WorkspaceMode; // Removed
}
