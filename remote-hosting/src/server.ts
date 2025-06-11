#!/usr/bin/env node

import { parseArgs } from 'node:util';

import cors from 'cors';
import express from 'express';

import { handleApiKeyUrlMessage,handleApiKeyUrlSse } from './routes/api-key/sse.js';
import { handleApiKeyUrlMcpGet, handleApiKeyUrlMcpPost } from './routes/api-key/streamable-http.js';
import { handleLegacyMessage, handleLegacySse } from './routes/legacy.js';
import { handleMetaMcpMessage, handleMetaMcpSse } from './routes/metamcp/sse.js';
import { handleMetaMcpGet, handleMetaMcpPost } from './routes/metamcp/streamable-http.js';
// Import route handlers
import { handleConfig, handleHealth } from './routes/util.js';

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    env: { type: 'string', default: '' },
    args: { type: 'string', default: '' },
  },
});

// Create Express app
const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Expose-Headers', 'mcp-session-id');
  next();
});

// Log incoming requests and their responses for easier debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    console.log(
      `${res.statusCode} ${req.method} ${req.originalUrl}`
    );
  });
  next();
});

// MetaMCP entrypoint
app.get('/mcp', handleMetaMcpGet);
app.post('/mcp', handleMetaMcpPost);
app.get('/sse', handleMetaMcpSse);
app.post('/message', handleMetaMcpMessage);

// MetaMCP entrypoint API key URL-based routes (for compatibility)
app.get('/api-key/:apiKey/mcp', handleApiKeyUrlMcpGet);
app.post('/api-key/:apiKey/mcp', handleApiKeyUrlMcpPost);
app.get('/api-key/:apiKey/sse', handleApiKeyUrlSse);
app.post('/api-key/:apiKey/message', handleApiKeyUrlMessage);

// Legacy UUID-based routes
app.get('/server/:uuid/sse', handleLegacySse);
app.post('/server/:uuid/message', handleLegacyMessage);

// Utility routes
app.get('/health', handleHealth);
app.get('/config', (req, res) =>
  handleConfig(req, res, values.env, values.args)
);

// Warn when a request does not match any route
app.use((req, res) => {
  console.warn('Unhandled request', req.method, req.originalUrl);
  res.status(404).end();
});

// Start the server
const PORT = process.env.PORT || 12007;
const server = app.listen(PORT);

server.on('listening', () => {
  const addr = server.address();
  console.log(`⚙️ Proxy server listening on port ${PORT}`, addr);
  console.log('Server started with options:', values);
});

server.on('close', () => {
  console.log('Proxy server closed');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.message.includes(`EADDRINUSE`)) {
    console.error(`❌  Proxy Server PORT IS IN USE at port ${PORT} ❌ `);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
