import express, { Request, Response } from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import dockerService from './services/docker.service';
import labService from './services/lab.service';
import websocketService from './services/websocket.service';
import historyService from './services/history.service';

const execAsync = promisify(exec);
const { app, getWss } = expressWs(express());

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Initialize WebSocket Service
websocketService.init(getWss());

// Web Socket route
app.ws('/api/ws', (ws: any) => {
  // express-ws intercepts and routes connections automatically
});

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/docker/status', dockerService.getDockerStatus.bind(dockerService));
app.get('/api/docker/containers', dockerService.listContainers.bind(dockerService));
app.get('/api/docker/stats', dockerService.getStats.bind(dockerService));

// Lab management routes
app.get('/api/labs', labService.listLabs.bind(labService));
app.get('/api/labs/:lab/status', labService.getLabStatus.bind(labService));
app.post('/api/labs/:lab/start', labService.startLab.bind(labService));
app.post('/api/labs/:lab/stop', labService.stopLab.bind(labService));
app.post('/api/labs/:lab/restart', labService.restartLab.bind(labService));

// Global controls
app.post('/api/labs-global/start-all', async (_req: Request, res: Response) => {
  try {
    await labService.startAllLabs();
    res.json({ success: true, message: 'All labs started successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labs-global/stop-all', async (_req: Request, res: Response) => {
  try {
    await labService.stopAllLabs();
    res.json({ success: true, message: 'All labs stopped successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deployment history routes
app.get('/api/history', (_req: Request, res: Response) => {
  res.json(historyService.getEvents());
});

app.delete('/api/history', (_req: Request, res: Response) => {
  historyService.clearHistory();
  res.json({ success: true });
});

// Diagnostics route
app.get('/api/diagnostics', async (_req: Request, res: Response) => {
  let wslStatus = 'Unknown';
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('wsl -l -v');
      wslStatus = stdout.trim();
    } catch (e: any) {
      wslStatus = 'WSL not available or failed: ' + e.message;
    }
  } else {
    wslStatus = 'Native Linux (No WSL)';
  }

  res.json({
    platform: process.platform,
    arch: process.arch,
    osType: os.type(),
    osRelease: os.release(),
    uptime: os.uptime(),
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    wslStatus,
    hostPathEnv: process.env.SOC_LAB_HOST_PATH || 'Not configured (using relative paths)',
    nodeVersion: process.version
  });
});

// Serve frontend for all non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`SOC-LAB Control Center running on port ${PORT}`);
});