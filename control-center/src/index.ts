import express, { Request, Response } from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import path from 'path';
import dockerService from './services/docker.service';
import labService from './services/lab.service';

const { app, getWss } = expressWs(express());

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Serve frontend for all non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`SOC-LAB Control Center running on port ${PORT}`);
});