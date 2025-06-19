// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'; // Unused
import { getDefaultEnvironment,StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'; // Unused
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
// import express from 'express'; // Removed express dependency
// import { NextRequest } from 'next/server'; // Unused
import { parse as shellParseArgs } from 'shell-quote';
import { findActualExecutable } from 'spawn-rx';

// Headers that should be passed through to the SSE server
export const SSE_HEADERS_PASSTHROUGH = ['authorization'];

// Headers that should be passed through to the StreamableHTTP server
export const STREAMABLE_HTTP_HEADERS_PASSTHROUGH = [
  'authorization',
  'mcp-session-id',
  'last-event-id',
];

// Default environment variables
export const defaultEnvironment = {
  ...getDefaultEnvironment(),
  ...(process.env.MCP_ENV_VARS ? JSON.parse(process.env.MCP_ENV_VARS) : {}),
};

// Create a MetaMCP transport
export const createMetaMcpTransport = async (apiKey: string): Promise<Transport> => {
  console.log(`Creating MetaMCP transport for API key ${apiKey}`);

  const command = 'npx';
  // Ensure @metamcp/mcp-server-metamcp is installed or accessible globally if -y is removed
  const origArgs = shellParseArgs(
    '--yes @metamcp/mcp-server-metamcp@latest --stderr pipe' // Added --yes for npx
  ) as string[];
  const env = {
    ...process.env,
    ...defaultEnvironment,
    METAMCP_API_KEY: apiKey,
    METAMCP_API_BASE_URL:
      process.env.METAMCP_API_BASE_URL ||
      (process.env.USE_DOCKER_HOST === 'true'
        ? 'http://host.docker.internal:12005' // Port should be the Next.js app's port
        : 'http://localhost:12005'), // Port should be the Next.js app's port
    USE_DOCKER_HOST: process.env.USE_DOCKER_HOST,
  };

  const { cmd, args } = findActualExecutable(command, origArgs);

  console.log(`Stdio transport: command=${cmd}, args=${args}`);

  const transport = new StdioClientTransport({
    command: cmd,
    args,
    env,
    stderr: 'pipe',
  });

  console.log(`Starting MetaMCP server process: ${cmd} ${args.join(' ')}`);
  try {
    await transport.start();
    console.log(`MetaMCP server started: ${cmd} ${args.join(' ')}`);
    transport.onclose = () => {
      console.log(`MetaMCP server process exited: ${cmd}`);
    };
    transport.onerror = (err) => {
      console.error('MetaMCP transport error:', err);
    };
  } catch (error) {
    console.error(
      `Failed to start MetaMCP server process: ${cmd} ${args.join(' ')}`,
      error
    );
    throw error;
  }

  if (transport.stderr) {
    transport.stderr.on('data', (chunk: Buffer) => {
      console.error(`[Sub MCP] ${chunk.toString().trim()}`);
    });

    transport.stderr.on('error', (error: Error) => {
      console.error(`[Sub MCP] Stderr error:`, error);
    });
  }

  console.log(`Spawned MetaMCP transport for API key ${apiKey}`);
  return transport;
};
