import React, { useState, useEffect } from 'react';

interface SystemStats {
  containers: { running: number; total: number };
  cpu: number;
  memory: { percent: number };
  docker: { healthy: boolean; version: string };
}

export default function StatusPanel() {
  const [stats, setStats] = useState<SystemStats>({
    containers: { running: 0, total: 0 },
    cpu: 0,
    memory: { percent: 0 },
    docker: { healthy: false, version: '' }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/docker/status')
        .then(r => r.json())
        .then(setStats)
        .catch(() => {});
    }, 5000);

    // Initial load
    fetch('/api/docker/status')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card p-4 text-center">
        <h4 className="text-sm text-gray-400 mb-1">Containers</h4>
        <p className="text-2xl font-bold text-cyan-400">{stats.containers.running}/{stats.containers.total}</p>
      </div>
      <div className="card p-4 text-center">
        <h4 className="text-sm text-gray-400 mb-1">CPU Usage</h4>
        <p className="text-2xl font-bold text-yellow-400">{stats.cpu.toFixed(1)}%</p>
      </div>
      <div className="card p-4 text-center">
        <h4 className="text-sm text-gray-400 mb-1">Memory</h4>
        <p className="text-2xl font-bold text-green-400">{stats.memory.percent.toFixed(1)}%</p>
      </div>
      <div className="card p-4 text-center">
        <h4 className="text-sm text-gray-400 mb-1">Docker</h4>
        <p className={`text-2xl font-bold ${stats.docker.healthy ? 'text-green-400' : 'text-red-400'}`}>
          {stats.docker.healthy ? 'Healthy' : 'Unhealthy'}
        </p>
        <p className="text-xs text-gray-500">{stats.docker.version}</p>
      </div>
    </section>
  );
}