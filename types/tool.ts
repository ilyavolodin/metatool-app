enum ToggleStatus {
  ACTIVE = 1,
  INACTIVE = 0,
}

export interface Tool {
  id: string;
  mcpServerUuid: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  isAvailable: ToggleStatus;
  status: ToggleStatus;
}