import React, { useState, useEffect } from 'react';

interface Lab {
  id: string;
  name: string;
  description: string;
  services: string[];
  ram: string;
  profile: string;
}

interface LabCardProps {
  lab: Lab;
}

export default function LabCard({ lab }: LabCardProps) {
  const [status, setStatus] = useState<'running' | 'stopped' | 'starting'>('stopped');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/labs/${lab.id}/status`, { signal: abortController.signal })
      .then(r => r.json())
      .then(data => setStatus(data.status || 'stopped'))
      .catch(() => setStatus('stopped'));
    return () => abortController.abort();
  }, [lab.id]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoading(true);
    try {
      await fetch(`/api/labs/${lab.id}/${action}`, { method: 'POST' });
      setStatus(action === 'stop' ? 'stopped' : 'starting');
      setTimeout(() => setStatus(action === 'stop' ? 'stopped' : 'running'), 3000);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold text-white mb-2">{lab.name}</h3>
      <p className="text-gray-400 text-sm mb-3">{lab.description}</p>
      
      <div className="mb-3">
        <span className="text-xs text-gray-500">Services: </span>
        <span className="text-xs text-cyan-400">{lab.services.join(', ')}</span>
      </div>
      
      <div className="mb-4">
        <span className="text-xs text-gray-500">RAM: </span>
        <span className="text-xs text-yellow-400">{lab.ram}</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2 h-2 rounded-full ${
          status === 'running' ? 'bg-green-500' : 
          status === 'starting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
        }`}></span>
        <span className="text-sm capitalize">{status}</span>
      </div>

      <div className="flex gap-2">
        {status !== 'running' ? (
          <button 
            onClick={() => handleAction('start')}
            disabled={loading}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded text-sm disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start'}
          </button>
        ) : (
          <button 
            onClick={() => handleAction('stop')}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded text-sm disabled:opacity-50"
          >
            {loading ? 'Stopping...' : 'Stop'}
          </button>
        )}
        <button 
          onClick={() => handleAction('restart')}
          disabled={loading}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-sm disabled:opacity-50"
        >
          Restart
        </button>
      </div>
    </div>
  );
}