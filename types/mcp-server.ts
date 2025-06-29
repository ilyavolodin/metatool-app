export interface McpServer {
  uuid: string;
  name: string;
  createdAt: Date;
  description: string | null;
  command: string | null;
  args: string[];
  env: {
    [key: string]: string;
  };
  projectId: string;
  status: number; // Use number for status (0 or 1)
  type: string;
  url: string | null;
}