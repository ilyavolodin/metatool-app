export interface Profile {
  id: string;
  name: string;
  projectId: string;
  capabilities: string; // Stored as JSON string
  enabled_capabilities: ProfileCapability[]; // Parsed capabilities
}

export enum ProfileCapability {
  TOOLS_MANAGEMENT = 'tools_management',
  API_KEY_MANAGEMENT = 'api_key_management',
  PROJECT_MANAGEMENT = 'project_management',
  PROFILE_MANAGEMENT = 'profile_management',
  TOOL_LOGS = 'tool_logs',
}