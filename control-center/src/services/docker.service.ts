import Docker from 'dockerode';
import { Request, Response } from 'express';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

interface SystemStats {
  containers: { running: number; total: number; paused: number; stopped: number };
  cpu: number;
  memory: { used: number; total: number; percent: number };
  docker: { healthy: boolean; version: string };
}

class DockerService {
  async getDockerStatus(_req: Request, res: Response) {
    try {
      const ping = await docker.ping();
      const info = await docker.info();
      res.json({
        healthy: ping,
        version: info.ServerVersion,
        containers: info.Containers,
        images: info.Images,
        memory: info.MemTotal
      });
    } catch (error) {
      res.status(500).json({ error: 'Docker connection failed' });
    }
  }

  async listContainers(_req: Request, res: Response) {
    try {
      const containers = await docker.listContainers({ all: true });
      const formatted = containers.map(c => ({
        id: c.Id,
        name: c.Names[0]?.replace('/', '') || 'unknown',
        image: c.Image,
        status: c.Status,
        state: c.State,
        ports: c.Ports
      }));
      res.json(formatted);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list containers' });
    }
  }

  async getStats(_req: Request, res: Response) {
    try {
      const containers = await docker.listContainers({ all: true, filters: { label: ['com.docker.compose.project=soclab'] } });
      const stats = await Promise.all(
        containers.map(async (c) => {
          const container = docker.getContainer(c.Id);
          const stream = await container.stats({ stream: false });
          return {
            name: c.Names[0]?.replace('/', ''),
            cpu: this.calculateCpu(stream),
            memory: {
              usage: stream.MemoryStats.Usage,
              limit: stream.MemoryStats.Limit
            },
            state: c.State
          };
        })
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  async getSystemStats(): Promise<SystemStats> {
    const info = await docker.info();
    const containers = await docker.listContainers({ all: true, filters: { label: ['com.docker.compose.project=soclab'] } });
    
    return {
      containers: {
        running: containers.filter(c => c.State === 'running').length,
        total: containers.length,
        paused: containers.filter(c => c.State === 'paused').length,
        stopped: containers.filter(c => c.State === 'exited').length
      },
      cpu: info.CpuStats?.Percent || 0,
      memory: {
        used: info.MemTotal - info.MemoryStats.Available,
        total: info.MemTotal,
        percent: ((info.MemTotal - info.MemoryStats.Available) / info.MemTotal * 100)
      },
      docker: {
        healthy: true,
        version: info.ServerVersion
      }
    };
  }

  private calculateCpu(stats: any): number {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    return systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
  }
}

export default new DockerService();