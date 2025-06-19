import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Map to store connections by UUID (for legacy endpoints)
export interface Connection {
  webAppTransport: SSEServerTransport;
  backingServerTransport: Transport;
}

// Map to store connections by API key for MetaMCP
export interface MetaMcpConnection {
  webAppTransport: Transport;
  backingServerTransport?: Transport;
}

// Export empty maps to be filled by the application
// IMPORTANT: In a serverless environment, these maps will not persist across requests.
// This may be an issue for some of the logic if it expects connections to be long-lived
// and accessible by subsequent requests via these maps.
// For a stateful server deployment, this is fine.
export const connections = new Map<string, Connection>();
export const metaMcpConnections = new Map<string, MetaMcpConnection>();
