import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment,StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import express from 'express';
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

// Create a transport based on the request query parameters
export const createTransport = async (req: express.Request): Promise<Transport> => {
  const query = req.query;
  console.log('Query parameters:', query);

  const transportType = query.transportType as string;
  console.log(`Creating transport of type ${transportType}`);

  if (transportType === 'stdio') {
    const command = query.command as string;
    const origArgs = shellParseArgs(query.args as string) as string[];
    const queryEnv = query.env ? JSON.parse(query.env as string) : {};
    const env = { ...process.env, ...defaultEnvironment, ...queryEnv };

    const { cmd, args } = findActualExecutable(command, origArgs);

    console.log(`Stdio transport: command=${cmd}, args=${args}`);

    const transport = new StdioClientTransport({
      command: cmd,
      args,
      env,
      stderr: 'pipe',
    });

    console.log(`Starting MCP server process: ${cmd} ${args.join(' ')}`);
    try {
      await transport.start();
      console.log(`MCP server started: ${cmd} ${args.join(' ')}`);
      transport.onclose = () => {
        console.log(`MCP server process exited: ${cmd}`);
      };
      transport.onerror = (err) => {
        console.error('MCP server transport error:', err);
      };
    } catch (error) {
      console.error(
        `Failed to start MCP server process: ${cmd} ${args.join(' ')}`,
        error
      );
      throw error;
    }

    if (transport.stderr) {
      transport.stderr.on('data', (chunk: Buffer) => {
        console.error(`[${cmd}] ${chunk.toString().trim()}`);
      });

      transport.stderr.on('error', (error: Error) => {
        console.error(`[${cmd}] stderr error:`, error);
      });
    }

    console.log('Spawned stdio transport');
    return transport;
  } else if (transportType === 'sse') {
    console.log('WARNING: The SSE transport is deprecated and has been replaced by streamable-http');
    
    const url = query.url as string;
    const headers: HeadersInit = {
      Accept: 'text/event-stream',
    };

    for (const key of SSE_HEADERS_PASSTHROUGH) {
      if (req.headers[key] === undefined) {
        continue;
      }

      const value = req.headers[key];
      headers[key] = Array.isArray(value) ? value[value.length - 1] : value;
    }

    // Replace localhost with host.docker.internal if using Docker
    let sseUrl = url;
    if (process.env.USE_DOCKER_HOST === 'true' && url.includes('localhost')) {
      sseUrl = url.replace(/localhost|127\.0\.0\.1/g, 'host.docker.internal');
      console.log(`Modified SSE URL: ${url} -> ${sseUrl}`);
    }

    console.log(
      `SSE transport: url=${sseUrl}, headers=${Object.keys(headers)}`
    );

    const transport = new SSEClientTransport(new URL(sseUrl), {
      eventSourceInit: {
        fetch: (url, init) => fetch(url, { ...init, headers }),
      },
      requestInit: {
        headers,
      },
    });
    await transport.start();

    console.log('Connected to SSE transport');
    transport.onclose = () => console.log('SSE transport closed');
    transport.onerror = (err) => console.error('SSE transport error:', err);
    return transport;
  } else if (transportType === 'streamable_http') {
    const url = query.url as string;
    const headers: HeadersInit = {
      Accept: 'text/event-stream, application/json',
    };

    for (const key of STREAMABLE_HTTP_HEADERS_PASSTHROUGH) {
      if (req.headers[key] === undefined) {
        continue;
      }

      const value = req.headers[key];
      headers[key] = Array.isArray(value) ? value[value.length - 1] : value;
    }

    // Replace localhost with host.docker.internal if using Docker
    let httpUrl = url;
    if (process.env.USE_DOCKER_HOST === 'true' && url.includes('localhost')) {
      httpUrl = url.replace(/localhost|127\.0\.0\.1/g, 'host.docker.internal');
      console.log(`Modified HTTP URL: ${url} -> ${httpUrl}`);
    }

    console.log(
      `Streamable HTTP transport: url=${httpUrl}, headers=${Object.keys(headers)}`
    );

    const transport = new StreamableHTTPClientTransport(
      new URL(httpUrl),
      {
        requestInit: {
          headers,
        },
      },
    );
    await transport.start();
    console.log('Connected to Streamable HTTP transport');
    transport.onclose = () => console.log('HTTP transport closed');
    transport.onerror = (err) => console.error('HTTP transport error:', err);
    return transport;
  } else {
    console.error(`Invalid transport type: ${transportType}`);
    throw new Error('Invalid transport type specified');
  }
};

// Create a MetaMCP transport
export const createMetaMcpTransport = async (apiKey: string): Promise<Transport> => {
  console.log(`Creating MetaMCP transport for API key ${apiKey}`);

  const command = 'npx';
  const origArgs = shellParseArgs(
    '-y @metamcp/mcp-server-metamcp@latest --stderr pipe'
  ) as string[];
  const env = {
    ...process.env,
    ...defaultEnvironment,
    METAMCP_API_KEY: apiKey,
    METAMCP_API_BASE_URL:
      process.env.METAMCP_API_BASE_URL ||
      (process.env.USE_DOCKER_HOST === 'true'
        ? 'http://host.docker.internal:12005'
        : 'http://localhost:12005'),
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