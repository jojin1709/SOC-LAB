import { WebSocket } from 'ws';
import dockerService from './docker.service';
import labService, { LABS } from './lab.service';
import historyService from './history.service';

interface LogSubscription {
  ws: WebSocket;
  labId: string;
  process: any;
}

class WebSocketService {
  private clients: Set<WebSocket> = new Set();
  private logSubscriptions: Map<WebSocket, LogSubscription> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;

  init(wss: any) {
    wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`WS client connected. Total clients: ${this.clients.size}`);

      // Send initial data immediately
      this.sendInitialStats(ws);

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message);
          this.handleMessage(ws, parsed);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.clearLogSubscription(ws);
        console.log(`WS client disconnected. Total clients: ${this.clients.size}`);
        
        if (this.clients.size === 0 && this.broadcastInterval) {
          clearInterval(this.broadcastInterval);
          this.broadcastInterval = null;
        }
      });

      // Start periodic broadcasts if not already running
      if (!this.broadcastInterval) {
        this.broadcastInterval = setInterval(() => this.broadcastStats(), 2000);
      }
    });
  }

  private async sendInitialStats(ws: WebSocket) {
    try {
      const stats = await dockerService.getSystemStats();
      const containers = await dockerService.getContainerStats();
      const labStatuses = await Promise.all(
        LABS.map(async (lab) => await labService.getLabStatusDetails(lab))
      );
      const history = historyService.getEvents();

      ws.send(JSON.stringify({
        type: 'stats-update',
        payload: { stats, containers, labStatuses, history }
      }));
    } catch (e) {
      console.error('Error sending initial stats:', e);
    }
  }

  private async broadcastStats() {
    if (this.clients.size === 0) return;
    try {
      const stats = await dockerService.getSystemStats();
      const containers = await dockerService.getContainerStats();
      const labStatuses = await Promise.all(
        LABS.map(async (lab) => await labService.getLabStatusDetails(lab))
      );
      const history = historyService.getEvents();

      const data = JSON.stringify({
        type: 'stats-update',
        payload: { stats, containers, labStatuses, history }
      });

      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    } catch (e) {
      console.error('Error in stats broadcast:', e);
    }
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'subscribe-logs':
        this.setupLogSubscription(ws, message.labId);
        break;
      case 'unsubscribe-logs':
        this.clearLogSubscription(ws);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private setupLogSubscription(ws: WebSocket, labId: string) {
    // Clear any existing subscription first
    this.clearLogSubscription(ws);

    try {
      console.log(`Setting up log subscription for lab: ${labId}`);
      const process = labService.getLabLogsProcess(labId);

      const sub: LogSubscription = { ws, labId, process };
      this.logSubscriptions.set(ws, sub);

      process.stdout.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'log-data',
            labId,
            payload: chunk.toString('utf-8')
          }));
        }
      });

      process.stderr.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'log-data',
            labId,
            payload: chunk.toString('utf-8')
          }));
        }
      });

      process.on('close', () => {
        if (this.logSubscriptions.get(ws)?.process === process) {
          this.logSubscriptions.delete(ws);
        }
      });

    } catch (e: any) {
      console.error(`Failed to setup log subscription for ${labId}:`, e);
      ws.send(JSON.stringify({
        type: 'log-error',
        labId,
        error: e.message
      }));
    }
  }

  private clearLogSubscription(ws: WebSocket) {
    const sub = this.logSubscriptions.get(ws);
    if (sub) {
      console.log(`Clearing log subscription for lab: ${sub.labId}`);
      try {
        sub.process.kill();
      } catch (e) {
        // process might already be dead
      }
      this.logSubscriptions.delete(ws);
    }
  }
}

export default new WebSocketService();
