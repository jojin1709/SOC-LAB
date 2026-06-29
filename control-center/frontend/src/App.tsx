import { useState, useEffect } from 'react';
import { 
  Shield, Play, Square, Activity, 
  History, Settings, ExternalLink, Trash2, 
  Server, Globe, Info, AlertTriangle
} from 'lucide-react';
import LabCard from './components/LabCard';
import StatusPanel from './components/StatusPanel';
import ContainerTable from './components/ContainerTable';
import LogsModal from './components/LogsModal';

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
    description: 'All SOC services combined (Requires powerful machine)',
    services: ['All Services'],
    ram: '16-32 GB',
    profile: 'full',
    requires: ['core', 'intel', 'ir', 'soar', 'monitoring', 'nsm']
  }
];

interface SystemStats {
  containers: { running: number; total: number; paused: number; stopped: number };
  cpu: number;
  memory: { used: number; total: number; percent: number };
  docker: { healthy: boolean; version: string };
}

interface ContainerMetric {
  id: string;
  name: string;
  cpu: number;
  memory: { usage: number; limit: number };
  state: string;
}

interface LabStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'starting';
  runningServices: string[];
  totalServices: number;
}

interface HistoryEvent {
  id: string;
  timestamp: string;
  labId: string;
  action: string;
  status: 'success' | 'failed' | 'info';
  message: string;
}

interface Diagnostics {
  platform: string;
  arch: string;
  osType: string;
  osRelease: string;
  uptime: number;
  cpuCores: number;
  cpuModel: string;
  totalMemory: number;
  freeMemory: number;
  wslStatus: string;
  hostPathEnv: string;
  nodeVersion: string;
}

const SERVICES_LINKS = [
  { name: 'Wazuh Dashboard', url: 'https://localhost:4431', containerPattern: 'wazuh-dashboard' },
  { name: 'Kibana', url: 'http://localhost:5601', containerPattern: 'kibana' },
  { name: 'TheHive', url: 'http://localhost:9000', containerPattern: 'thehive' },
  { name: 'Cortex', url: 'http://localhost:9001', containerPattern: 'cortex' },
  { name: 'MISP Core', url: 'https://localhost:8443', containerPattern: 'misp-core' },
  { name: 'Shuffle UI', url: 'http://localhost:3001', containerPattern: 'shuffle-frontend' },
  { name: 'Grafana', url: 'http://localhost:3000', containerPattern: 'grafana' },
  { name: 'MinIO Console', url: 'http://localhost:9003', containerPattern: 'minio' },
  { name: 'DVWA Target', url: 'http://localhost:8080', containerPattern: 'dvwa' },
  { name: 'Juice Shop Target', url: 'http://localhost:3002', containerPattern: 'juice-shop' },
  { name: 'Docs Site', url: 'http://localhost:8090', containerPattern: 'docs' }
];

function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [stats, setStats] = useState<SystemStats>({
    containers: { running: 0, total: 0, paused: 0, stopped: 0 },
    cpu: 0,
    memory: { used: 0, total: 0, percent: 0 },
    docker: { healthy: false, version: '' }
  });
  const [containers, setContainers] = useState<ContainerMetric[]>([]);
  const [labStatuses, setLabStatuses] = useState<LabStatus[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'diagnostics'>('dashboard');
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; name: string } | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Initialize WebSocket and reconnect logic
  useEffect(() => {
    let active = true;
    let socket: WebSocket;

    function connect() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? 'localhost:8088' : window.location.host;
      const url = `${wsProtocol}//${host}/api/ws`;
      
      socket = new WebSocket(url);
      
      socket.onopen = () => {
        if (active) setWs(socket);
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stats-update') {
            setStats(message.payload.stats);
            setContainers(message.payload.containers);
            setLabStatuses(message.payload.labStatuses);
            setHistory(message.payload.history);
          }
        } catch (e) {
          console.error(e);
        }
      };

      socket.onclose = () => {
        if (active) {
          setWs(null);
          setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (socket) socket.close();
    };
  }, []);

  // Fetch diagnostics
  useEffect(() => {
    if (activeTab === 'diagnostics') {
      fetch('/api/diagnostics')
        .then(r => r.json())
        .then(setDiagnostics)
        .catch(console.error);
    }
  }, [activeTab]);

  const handleGlobalAction = async (action: 'start-all' | 'stop-all') => {
    if (!confirm(`Are you sure you want to ${action === 'start-all' ? 'deploy all labs (high CPU/RAM usage)' : 'shutdown all active labs'}?`)) {
      return;
    }
    setGlobalLoading(true);
    try {
      await fetch(`/api/labs-global/${action}`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setGlobalLoading(false), 3000);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all deployment history logs?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to resolve lab card data from socket statuses
  const getLabStatusDetails = (labId: string) => {
    const defaultStatus = { status: 'stopped' as const, runningServices: [], totalServices: 0 };
    return labStatuses.find(s => s.id === labId) || defaultStatus;
  };

  // Count active labs (status 'running' or 'starting')
  const activeLabsCount = labStatuses.filter(s => s.status === 'running' || s.status === 'starting').length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans scanlines">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 bg-opacity-70 backdrop-blur-lg border-r border-slate-800/80 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-900 bg-opacity-40">
            <div className="p-1.5 bg-cyan-950/60 border border-cyan-800/40 rounded-lg shadow-inner">
              <Shield className="text-cyan-400" size={20} />
            </div>
            <span className="font-black text-white uppercase tracking-widest text-sm bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
              SOC-LAB CONTROL
            </span>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800/40 shadow-md shadow-cyan-950/20 pl-5 border-l-4 border-l-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-transparent hover:pl-5'
              }`}
            >
              <Activity size={16} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                activeTab === 'history'
                  ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800/40 shadow-md shadow-cyan-950/20 pl-5 border-l-4 border-l-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-transparent hover:pl-5'
              }`}
            >
              <History size={16} />
              Deployment History
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                activeTab === 'diagnostics'
                  ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800/40 shadow-md shadow-cyan-950/20 pl-5 border-l-4 border-l-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-transparent hover:pl-5'
              }`}
            >
              <Settings size={16} />
              System Diagnostics
            </button>
          </nav>
        </div>

        {/* WebSocket Connection Status */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-900 bg-opacity-40">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Agent Socket</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <span className={`w-2 h-2 rounded-full ${ws ? 'bg-green-500 shadow-md shadow-green-500/50 animate-pulse' : 'bg-red-500'}`}></span>
              {ws ? 'CONNECTED' : 'RECONNECTING'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-slate-900 bg-opacity-40 backdrop-blur-md border-b border-slate-800/80 flex justify-between items-center px-8 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Security Operations Center Dashboard'}
              {activeTab === 'history' && 'Deployment Logs & Activity History'}
              {activeTab === 'diagnostics' && 'System Diagnostics & Configuration'}
            </h2>
          </div>

          {/* Global Controls */}
          {activeTab === 'dashboard' && (
            <div className="flex gap-3">
              <button
                onClick={() => handleGlobalAction('start-all')}
                disabled={globalLoading || !stats.docker.healthy}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white py-1.5 px-4 rounded-lg text-xs font-bold transition-all duration-200 shadow-lg shadow-cyan-600/10 hover:shadow-cyan-500/25 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Play size={12} fill="currentColor" />
                Deploy All Labs
              </button>
              <button
                onClick={() => handleGlobalAction('stop-all')}
                disabled={globalLoading || !stats.docker.healthy}
                className="flex items-center gap-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/85 py-1.5 px-4 rounded-lg text-xs font-bold transition-all duration-200 shadow-lg shadow-red-950/20 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Square size={12} fill="currentColor" />
                Shutdown All Labs
              </button>
            </div>
          )}
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto space-y-8 bg-slate-950">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Warnings if Docker Offline */}
              {!stats.docker.healthy && (
                <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-900/40 text-red-200 rounded-xl text-sm">
                  <AlertTriangle className="shrink-0 text-red-400" size={20} />
                  <div>
                    <span className="font-bold">Docker daemon is offline!</span> Please make sure Docker Desktop is started and WSL integration is active. Control Center cannot execute container states.
                  </div>
                </div>
              )}

              {/* Status metrics panel */}
              <StatusPanel stats={stats} activeLabsCount={activeLabsCount} />

              {/* Active Lab Modules Grid */}
              <section>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-5">
                  <h3 className="text-sm uppercase tracking-widest font-black text-cyan-400 flex items-center gap-2">
                    <Globe size={16} />
                    Lab Modules Management
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Interactive Orchestrator</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {LABS.map((lab) => {
                    const statusDetails = getLabStatusDetails(lab.id);
                    return (
                      <LabCard
                        key={lab.id}
                        lab={lab}
                        status={statusDetails.status}
                        runningServices={statusDetails.runningServices}
                        totalServices={statusDetails.totalServices}
                        onViewLogs={(id, name) => setSelectedLogs({ id, name })}
                      />
                    );
                  })}
                </div>
              </section>

              {/* Services URL Router Dashboard */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Containers list */}
                <div className="lg:col-span-2">
                  <ContainerTable containers={containers} />
                </div>

                {/* Port links router panel */}
                <div>
                  <div className="cyber-card h-full">
                    <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900 bg-opacity-40 flex items-center gap-2">
                      <Globe size={16} className="text-cyan-400" />
                      <h3 className="text-sm uppercase tracking-wider font-black text-white">Active Service URLs</h3>
                    </div>
                    
                    <div className="p-4 space-y-2 h-[350px] overflow-y-auto font-mono text-xs">
                      {SERVICES_LINKS.map((s) => {
                        const isRunning = containers.some(c => 
                          c.state === 'running' && 
                          c.name.toLowerCase().includes(s.containerPattern)
                        );
                        
                        return (
                          <div 
                            key={s.name} 
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 ${
                              isRunning 
                                ? 'bg-cyan-950/15 border-cyan-850/40 hover:bg-cyan-950/25 text-cyan-300 shadow-sm shadow-cyan-950/20' 
                                : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                            }`}
                          >
                            <span className="font-bold">{s.name}</span>
                            {isRunning ? (
                              <a 
                                href={s.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1 hover:underline text-cyan-400 font-bold hover:text-cyan-300"
                              >
                                {s.url.replace('http://', '').replace('https://', '')}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-[9px] uppercase font-bold text-slate-600 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/60">
                                Offline
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="cyber-card p-6">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
                <h3 className="text-sm uppercase tracking-widest font-black text-white flex items-center gap-2">
                  <History className="text-cyan-400" size={18} />
                  Orchestrator Deployment Log
                </h3>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 text-xs bg-red-950/60 border border-red-900/60 text-red-300 hover:bg-red-900 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                    Clear History Logs
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="p-12 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                  No lab deployment activities recorded yet.
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[60vh] space-y-3 font-mono text-xs pr-2">
                  {history.map((event) => {
                    const timeStr = new Date(event.timestamp).toLocaleTimeString();
                    const dateStr = new Date(event.timestamp).toLocaleDateString();
                    
                    return (
                      <div 
                        key={event.id}
                        className={`p-3.5 border rounded-lg flex items-start justify-between gap-4 transition ${
                          event.status === 'success' ? 'bg-green-950/10 border-green-900/30 text-green-300' :
                          event.status === 'failed' ? 'bg-red-950/10 border-red-900/30 text-red-300' :
                          'bg-cyan-950/10 border-cyan-900/30 text-cyan-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                              {event.action}
                            </span>
                            <span className="text-slate-400 font-bold text-[10px]">{event.labId.toUpperCase()}</span>
                          </div>
                          <p className="text-slate-200 mt-1">{event.message}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 text-right leading-relaxed">
                          {timeStr}<br />{dateStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Host Hardware Metrics */}
              <div className="cyber-card p-6 space-y-4">
                <h3 className="text-sm uppercase tracking-wider font-black text-white border-b border-slate-800/80 pb-3 flex items-center gap-2">
                  <Info size={16} className="text-cyan-400" />
                  Host Hardware Specs
                </h3>
                {diagnostics ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Operating System:</span>
                      <span className="text-slate-300 font-bold">{diagnostics.osType} ({diagnostics.platform})</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">OS Release/Kernel:</span>
                      <span className="text-slate-300">{diagnostics.osRelease}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">CPU Architecture:</span>
                      <span className="text-slate-300">{diagnostics.arch}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">CPU Cores:</span>
                      <span className="text-slate-300">{diagnostics.cpuCores} vCPUs</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">CPU Model:</span>
                      <span className="text-slate-300 max-w-[220px] truncate" title={diagnostics.cpuModel}>{diagnostics.cpuModel}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Total System Memory:</span>
                      <span className="text-slate-300">{(diagnostics.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Free System Memory:</span>
                      <span className="text-slate-300">{(diagnostics.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between pb-1.5">
                      <span className="text-slate-500">NodeJS Process:</span>
                      <span className="text-slate-300">{diagnostics.nodeVersion}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic text-sm">Querying system hardware metrics...</div>
                )}
              </div>

              {/* Host WSL2 Environment Status */}
              <div className="cyber-card p-6 space-y-4">
                <h3 className="text-sm uppercase tracking-wider font-black text-white border-b border-slate-800/80 pb-3 flex items-center gap-2">
                  <Server size={16} className="text-cyan-400" />
                  WSL2 & Path Configuration
                </h3>
                {diagnostics ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block mb-1.5">WSL Environment Status:</span>
                      <pre className="p-3.5 bg-black bg-opacity-40 border border-slate-900 rounded-lg text-[10px] text-slate-300 overflow-x-auto whitespace-pre">
                        {diagnostics.wslStatus}
                      </pre>
                    </div>
                    <div className="border-t border-slate-900 pt-3">
                      <span className="text-slate-500 block mb-1.5">Project Host Directory Path:</span>
                      <pre className="p-3 bg-black bg-opacity-40 border border-slate-900 rounded-lg text-cyan-400 break-all select-all">
                        {diagnostics.hostPathEnv}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic text-sm">Querying active settings...</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Logs Modal */}
      {selectedLogs && (
        <LogsModal
          labId={selectedLogs.id}
          labName={selectedLogs.name}
          ws={ws}
          onClose={() => setSelectedLogs(null)}
        />
      )}
    </div>
  );
}

export default App;