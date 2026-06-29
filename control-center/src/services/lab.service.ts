import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { dockerClient } from './docker.service';
import historyService from './history.service';

const execAsync = promisify(exec);

let projectDir = '/app';
if (!fs.existsSync(path.join(projectDir, 'docker-compose.yml'))) {
  // Local development fallback
  projectDir = path.resolve(__dirname, '../../');
}

export interface Lab {
  id: string;
  name: string;
  description: string;
  services: string[];
  ram: string;
  profile: string;
  requires?: string[];
}

export const LABS: Lab[] = [
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
    profile: 'full',
    requires: ['core', 'intel', 'ir', 'soar', 'monitoring', 'nsm']
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
      const statusData = await this.getLabStatusDetails(lab);
      res.json(statusData);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get lab status: ' + error.message });
    }
  }

  async getLabStatusDetails(lab: Lab) {
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

      const totalServices = lab.id === 'full' ? 18 : lab.services.length; // Approximate total w/o listing details
      
      let status = 'stopped';
      if (runningServices.length === totalServices) {
        status = 'running';
      } else if (runningServices.length > 0) {
        status = 'starting'; // partially running
      }

      return {
        id: lab.id,
        name: lab.name,
        status,
        runningServices,
        totalServices
      };
    } catch (e) {
      return {
        id: lab.id,
        name: lab.name,
        status: 'stopped',
        runningServices: [],
        totalServices: lab.services.length
      };
    }
  }

  async startLab(req: Request, res: Response) {
    const labId = req.params.lab;
    try {
      await this.startLabById(labId);
      res.json({ success: true, message: `Started ${labId}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async startLabById(labId: string): Promise<void> {
    const lab = LABS.find(l => l.id === labId);
    if (!lab) throw new Error(`Lab ${labId} not found`);

    // Check and start requirements recursively
    if (lab.requires) {
      for (const depId of lab.requires) {
        const depStatus = await this.getLabStatusById(depId);
        if (depStatus === 'stopped') {
          historyService.addEvent(depId, 'start_dependency', 'info', `Starting dependency lab: ${depId}`);
          await this.startLabById(depId);
        }
      }
    }

    historyService.addEvent(labId, 'start', 'info', `Starting lab: ${lab.name}`);
    try {
      await execAsync(`docker compose --profile ${lab.profile} up -d`, { cwd: projectDir });
      historyService.addEvent(labId, 'start', 'success', `Successfully started lab: ${lab.name}`);
    } catch (error: any) {
      historyService.addEvent(labId, 'start', 'failed', `Failed to start lab ${lab.name}: ${error.message}`);
      throw error;
    }
  }

  async stopLab(req: Request, res: Response) {
    const labId = req.params.lab;
    try {
      await this.stopLabById(labId);
      res.json({ success: true, message: `Stopped ${labId}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async stopLabById(labId: string): Promise<void> {
    const lab = LABS.find(l => l.id === labId);
    if (!lab) throw new Error(`Lab ${labId} not found`);

    historyService.addEvent(labId, 'stop', 'info', `Stopping lab: ${lab.name}`);
    try {
      await execAsync(`docker compose --profile ${lab.profile} down`, { cwd: projectDir });
      historyService.addEvent(labId, 'stop', 'success', `Successfully stopped lab: ${lab.name}`);
    } catch (error: any) {
      historyService.addEvent(labId, 'stop', 'failed', `Failed to stop lab ${lab.name}: ${error.message}`);
      throw error;
    }
  }

  async restartLab(req: Request, res: Response) {
    const labId = req.params.lab;
    try {
      await this.restartLabById(labId);
      res.json({ success: true, message: `Restarted ${labId}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async restartLabById(labId: string): Promise<void> {
    const lab = LABS.find(l => l.id === labId);
    if (!lab) throw new Error(`Lab ${labId} not found`);

    historyService.addEvent(labId, 'restart', 'info', `Restarting lab: ${lab.name}`);
    try {
      await execAsync(`docker compose --profile ${lab.profile} down`, { cwd: projectDir });
      await execAsync(`docker compose --profile ${lab.profile} up -d`, { cwd: projectDir });
      historyService.addEvent(labId, 'restart', 'success', `Successfully restarted lab: ${lab.name}`);
    } catch (error: any) {
      historyService.addEvent(labId, 'restart', 'failed', `Failed to restart lab ${lab.name}: ${error.message}`);
      throw error;
    }
  }

  async startAllLabs(): Promise<void> {
    historyService.addEvent('all', 'start_all', 'info', 'Starting all lab modules');
    try {
      await execAsync(`docker compose --profile core --profile intel --profile ir --profile soar --profile monitoring --profile nsm --profile full up -d`, { cwd: projectDir });
      historyService.addEvent('all', 'start_all', 'success', 'Successfully started all lab modules');
    } catch (error: any) {
      historyService.addEvent('all', 'start_all', 'failed', `Failed to start all lab modules: ${error.message}`);
      throw error;
    }
  }

  async stopAllLabs(): Promise<void> {
    historyService.addEvent('all', 'stop_all', 'info', 'Stopping all lab modules');
    try {
      await execAsync(`docker compose --profile core --profile intel --profile ir --profile soar --profile monitoring --profile nsm --profile full down`, { cwd: projectDir });
      historyService.addEvent('all', 'stop_all', 'success', 'Successfully stopped all lab modules');
    } catch (error: any) {
      historyService.addEvent('all', 'stop_all', 'failed', `Failed to stop all lab modules: ${error.message}`);
      throw error;
    }
  }

  async getLabStatusById(labId: string): Promise<'running' | 'stopped' | 'starting'> {
    const lab = LABS.find(l => l.id === labId);
    if (!lab) return 'stopped';
    const details = await this.getLabStatusDetails(lab);
    return details.status as any;
  }

  getLabLogsProcess(labId: string) {
    const lab = LABS.find(l => l.id === labId);
    if (!lab) throw new Error(`Lab ${labId} not found`);

    // Spawn docker compose logs -f --tail=100
    return spawn('docker', ['compose', '--profile', lab.profile, 'logs', '-f', '--tail=100'], {
      cwd: projectDir
    });
  }
}

export default new LabService();