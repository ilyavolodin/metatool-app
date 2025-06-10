import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

function onClientError(error: Error) {
  console.error("Error from inspector client:", error);
}

function onServerError(error: Error) {
  console.error("Error from MCP server:", error);
}

export default function mcpProxy({
  transportToClient,
  transportToServer,
}: {
  transportToClient: Transport;
  transportToServer: Transport;
}) {
  let transportToClientClosed = false;
  let transportToServerClosed = false;

  function logMessage(direction: string, message: any) {
    if (message && typeof message === 'object' && 'method' in message) {
      const method = String((message as any).method).toLowerCase();
      if (method.includes('tool')) {
        console.log(
          `[${direction}] ${method} id=${(message as any).id ?? 'n/a'}`
        );
      }
    }
  }

  transportToClient.onmessage = (message) => {
    logMessage('client->server', message);
    transportToServer.send(message).catch(onServerError);
  };

  transportToServer.onmessage = (message) => {
    logMessage('server->client', message);
    transportToClient.send(message).catch(onClientError);
  };

  transportToClient.onclose = () => {
    console.log('Client transport closed');
    if (transportToServerClosed) {
      return;
    }

    transportToClientClosed = true;
    transportToServer.close().catch(onServerError);
  };

  transportToServer.onclose = () => {
    console.log('Server transport closed');
    if (transportToClientClosed) {
      return;
    }
    transportToServerClosed = true;
    transportToClient.close().catch(onClientError);
  };

  transportToClient.onerror = onClientError;
  transportToServer.onerror = onServerError;
}
