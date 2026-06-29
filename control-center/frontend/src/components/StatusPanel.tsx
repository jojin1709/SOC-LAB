import { Cpu, HardDrive, Server, Layers } from 'lucide-react';

interface SystemStats {
  containers: { running: number; total: number; paused: number; stopped: number };
  cpu: number;
  memory: { used: number; total: number; percent: number };
  docker: { healthy: boolean; version: string };
}

interface StatusPanelProps {
  stats: SystemStats;
  activeLabsCount: number;
}

export default function StatusPanel({ stats, activeLabsCount }: StatusPanelProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {/* Active Labs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Active Labs</h4>
            <p className="text-3xl font-extrabold text-white">{activeLabsCount} <span className="text-sm font-normal text-gray-500">/ 7</span></p>
          </div>
          <div className="p-2.5 bg-gray-900 bg-opacity-65 rounded-lg border border-gray-750">
            <Layers className="text-cyan-400" size={20} />
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${(activeLabsCount / 7) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* CPU Usage */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Host CPU</h4>
            <p className="text-3xl font-extrabold text-white font-mono">{stats.cpu.toFixed(1)}<span className="text-sm font-normal text-gray-500">%</span></p>
          </div>
          <div className="p-2.5 bg-gray-900 bg-opacity-65 rounded-lg border border-gray-750">
            <Cpu className="text-yellow-400" size={20} />
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-yellow-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(stats.cpu, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Host Memory</h4>
            <p className="text-xl font-extrabold text-white font-mono mt-2 truncate">
              {formatBytes(stats.memory.used)} / <span className="text-sm text-gray-400">{formatBytes(stats.memory.total)}</span>
            </p>
          </div>
          <div className="p-2.5 bg-gray-900 bg-opacity-65 rounded-lg border border-gray-750">
            <HardDrive className="text-purple-400" size={20} />
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-purple-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(stats.memory.percent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Docker Engine */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Docker Engine</h4>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${
                stats.docker.healthy ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500'
              }`}></span>
              <p className="text-lg font-bold text-white leading-none">
                {stats.docker.healthy ? 'Online' : 'Offline'}
              </p>
            </div>
            <p className="text-[10px] font-mono text-gray-500 mt-2">V: {stats.docker.version}</p>
          </div>
          <div className="p-2.5 bg-gray-900 bg-opacity-65 rounded-lg border border-gray-750">
            <Server className={stats.docker.healthy ? 'text-green-400' : 'text-red-400'} size={20} />
          </div>
        </div>
      </div>
    </section>
  );
}