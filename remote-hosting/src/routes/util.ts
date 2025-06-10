import express from 'express';

import { defaultEnvironment } from '../transports.js';
import { connections, metaMcpConnections } from '../types.js';

// Handler for /health endpoint
export const handleHealth = (req: express.Request, res: express.Response) => {
  // Log details about the incoming health check request for debugging
  console.log('Health check', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const memory = process.memoryUsage();
  const address = req.socket.localAddress
    ? `${req.socket.localAddress}:${req.socket.localPort}`
    : undefined;

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    pid: process.pid,
    node: process.version,
    address,
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
    },
    connections: Array.from(connections.keys()),
    metaMcpConnections: Array.from(metaMcpConnections.keys()),
  });
};

// Handler for /config endpoint
export const handleConfig = (req: express.Request, res: express.Response, env: string, args: string) => {
  try {
    res.json({
      defaultEnvironment,
      defaultCommand: env,
      defaultArgs: args,
    });
  } catch (error) {
    console.error('Error in /config route:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}; 