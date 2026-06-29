import Docker from 'dockerode';
import { Request, Response } from 'express';
import os from 'os';

const isWin = process.platform === 'win32';
export const dockerClient = new Docker(
  isWin ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' }
);

interface SystemStats {
  containers: { running: number; total: number; paused: number; stopped: number };
  cpu: number;
  memory: { used: number; total: number; percent: number };
  docker: { healthy: boolean; version: string };
}

let lastCpuInfo = getCpuInfo();

function getCpuInfo() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

function calculateCpuUsage(): number {
  const current = getCpuInfo();
  const idleDiff = current.idle - lastCpuInfo.idle;
  const totalDiff = current.total - lastCpuInfo.total;
  lastCpuInfo = current;
  return totalDiff > 0 ? (1 - (idleDiff / totalDiff)) * 100 : 0;
}

class DockerService {
  public client = dockerClient;

  async getDockerStatus(req: Request, res: Response) {
    try {
      const stats = await this.getSystemStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Docker connection failed' });
    }
  }

  async listContainers(_req: Request, res: Response) {
    try {
      const containers = await this.client.listContainers({ all: true });
      const formatted = containers.map(c => ({
        id: c.Id,
        name: c.Names[0]?.replace('/', '') || 'unknown',
        image: c.Image,
        status: c.Status,
        state: c.State,
        ports: c.Ports
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list containers: ' + error.message });
    }
  }

  async getStats(_req: Request, res: Response) {
    try {
      const stats = await this.getContainerStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get stats: ' + error.message });
    }
  }

  async getContainerStats() {
    try {
      const containers = await this.client.listContainers({
        all: true,
        filters: { label: ['com.docker.compose.project=soclab'] }
      });

      return await Promise.all(
        containers.map(async (c) => {
          try {
            const container = this.client.getContainer(c.Id);
            const stream = await container.stats({ stream: false });
            return {
              id: c.Id,
              name: c.Names[0]?.replace('/', '') || 'unknown',
              cpu: this.calculateCpu(stream),
              memory: {
                usage: stream.memory_stats?.usage || 0,
                limit: stream.memory_stats?.limit || 0
              },
              state: c.State
            };
          } catch (e) {
            return {
              id: c.Id,
              name: c.Names[0]?.replace('/', '') || 'unknown',
              cpu: 0,
              memory: { usage: 0, limit: 0 },
              state: c.State
            };
          }
        })
      );
    } catch (error) {
      return [];
    }
  }

  async getSystemStats(): Promise<SystemStats> {
    let dockerHealthy = false;
    let dockerVersion = 'Offline';
    let containersCount = { running: 0, total: 0, paused: 0, stopped: 0 };

    try {
      await this.client.ping();
      dockerHealthy = true;
      const info = await this.client.info();
      dockerVersion = info.ServerVersion || 'Unknown';
      
      const containers = await this.client.listContainers({
        all: true,
        filters: { label: ['com.docker.compose.project=soclab'] }
      });
      
      containersCount = {
        running: containers.filter(c => c.State === 'running').length,
        total: containers.length,
        paused: containers.filter(c => c.State === 'paused').length,
        stopped: containers.filter(c => c.State === 'exited').length
      };
    } catch (error) {
      // Docker daemon is unreachable or stopped
      dockerHealthy = false;
      dockerVersion = 'Offline';
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;

    return {
      containers: containersCount,
      cpu: calculateCpuUsage(),
      memory: {
        used: usedMem,
        total: totalMem,
        percent: memPercent
      },
      docker: {
        healthy: dockerHealthy,
        version: dockerVersion
      }
    };
  }

  private calculateCpu(stats: any): number {
    if (!stats || !stats.cpu_stats || !stats.precpu_stats) return 0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    return systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
  }
}

export default new DockerService();