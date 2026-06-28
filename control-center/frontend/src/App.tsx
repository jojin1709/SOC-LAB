import React, { useState, useEffect } from 'react';
import LabCard from './components/LabCard';
import StatusPanel from './components/StatusPanel';

interface Lab {
  id: string;
  name: string;
  description: string;
  services: string[];
  ram: string;
  profile: string;
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
    profile: 'intel'
  },
  {
    id: 'ir',
    name: 'Incident Response',
    description: 'TheHive case management with Cortex analyzers',
    services: ['TheHive', 'Cortex'],
    ram: '2-4 GB',
    profile: 'ir'
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

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">SOC-LAB Control Center</h1>
            <p className="text-gray-400">Web-based Security Operations Center Management</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <StatusPanel />
        
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-cyan-300">Lab Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LABS.map(lab => (
              <LabCard key={lab.id} lab={lab} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;