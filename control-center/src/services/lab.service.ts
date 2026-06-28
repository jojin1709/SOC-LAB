import { exec } from 'child_process';
import { promisify } from 'util';
import { Request, Response } from 'express';
import docker from 'dockerode';

const execAsync = promisify(exec);
const dockerClient = new docker({ socketPath: '/var/run/docker.sock' });

interface Lab {
  id: string;
  name: string;
  description: string;
  services: string[];
  ram: string;
  profile: string;
  requires?: string[];
}

const LABS: Lab[] = [
  {
    id: 'core',
    name: 'Core SOC',
    description: 'Wazuh SIEM with Elasticsearch, Kibana, and vulnerable targets',
    services: ['Wazuh Manager', 'Elasticsearch', 'Kibana', 'Wazuh Dashboard', 'DVWA', 'Juice Shop'],
    ram: '4-6 GB',
    profile: 'core'
  },
  {
    id: 'intel',
    name: 'Threat Intelligence',
    description: 'MISP for threat intelligence management',
    services: ['MISP'],
    ram: '2-4 GB',
    profile: 'intel',
    requires: ['core']
  },
  {
    id: 'ir',
    name: 'Incident Response',
    description: 'TheHive case management with Cortex analyzers',
    services: ['TheHive', 'Cortex'],
    ram: '2-4 GB',
    profile: 'ir',
    requires: ['core']
  },
  {
    id: 'soar',
    name: 'SOAR Automation',
    description: 'Shuffle Security Orchestration Automation and Response',
    services: ['Shuffle Backend', 'Shuffle Frontend', 'Shuffle Orborus'],
    ram: '1-2 GB',
    profile: 'soar'
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Grafana dashboards and Prometheus metrics',
    services: ['Grafana', 'Prometheus', 'MinIO'],
    ram: '1-2 GB',
    profile: 'monitoring'
  },
  {
    id: 'nsm',
    name: 'Network Security Monitoring',
    description: 'Suricata IDS and Zeek network monitor',
    services: ['Suricata', 'Zeek'],
    ram: '2-4 GB',
    profile: 'nsm'
  },
  {
    id: 'full',
    name: 'Full Enterprise SOC',
    description: 'All SOC services combined',
    services: ['All Services'],
    ram: '16-32 GB',
    profile: 'full'
  }
];

class LabService {
  listLabs(_req: Request, res: Response) {
    res.json(LABS);
  }

  async getLabStatus(req: Request, res: Response) {
    const labId = req.params.lab;
    const lab = LABS.find(l => l.id === labId);
    
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    try {
      const containers = await dockerClient.listContainers({
        all: true,
        filters: { label: ['com.docker.compose.project=soclab'] }
      });
      
      const runningServices = lab.services.filter(serviceName => 
        containers.some(c => c.State === 'running' && 
          c.Names.some(n => n.toLowerCase().includes(serviceName.toLowerCase().replace(' ', '-')))
        )
      );

      res.json({
        id: lab.id,
        name: lab.name,
        status: runningServices.length > 0 ? 'running' : 'stopped',
        runningServices
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get lab status' });
    }
  }

  async startLab(req: Request, res: Response) {
    const labId = req.params.lab;
    const lab = LABS.find(l => l.id === labId);
    
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    // Start required dependencies first
    if (lab.requires) {
      for (const depId of lab.requires) {
        await this.startLab({ params: { lab: depId } } as Request, {} as Response);
      }
    }

    try {
      await execAsync(`docker compose --profile ${lab.profile} up -d`, { cwd: '/app' });
      res.json({ success: true, message: `Started ${lab.name}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async stopLab(req: Request, res: Response) {
    const labId = req.params.lab;
    const lab = LABS.find(l => l.id === labId);
    
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    try {
      await execAsync(`docker compose --profile ${lab.profile} down`, { cwd: '/app' });
      res.json({ success: true, message: `Stopped ${lab.name}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async restartLab(req: Request, res: Response) {
    const labId = req.params.lab;
    const lab = LABS.find(l => l.id === labId);
    
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    try {
      await execAsync(`docker compose --profile ${lab.profile} down`, { cwd: '/app' });
      await execAsync(`docker compose --profile ${lab.profile} up -d`, { cwd: '/app' });
      res.json({ success: true, message: `Restarted ${lab.name}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLabLogs(req: Request, res: Response) {
    const labId = req.params.lab;
    const lab = LABS.find(l => l.id === labId);
    
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    try {
      const { stdout } = await execAsync(`docker compose --profile ${lab.profile} logs --tail=100`, { cwd: '/app' });
      res.json({ logs: stdout });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new LabService();