import { Cpu, HardDrive, Terminal } from 'lucide-react';

interface ContainerMetric {
  id: string;
  name: string;
  cpu: number;
  memory: {
    usage: number;
    limit: number;
  };
  state: string;
}

interface ContainerTableProps {
  containers: ContainerMetric[];
}

export default function ContainerTable({ containers }: ContainerTableProps) {
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-800 bg-opacity-50">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Terminal size={18} className="text-cyan-400" />
          Live Container Monitoring
        </h3>
      </div>
      
      {containers.length === 0 ? (
        <div className="p-8 text-center text-gray-500 italic">
          No lab containers currently running or active.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 bg-opacity-50 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-3 border-b border-gray-700">Container Name</th>
                <th className="px-6 py-3 border-b border-gray-700">State</th>
                <th className="px-6 py-3 border-b border-gray-700">CPU Usage</th>
                <th className="px-6 py-3 border-b border-gray-700">Memory Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-sm">
              {containers.map((c) => {
                const memPercent = c.memory.limit > 0 ? (c.memory.usage / c.memory.limit) * 100 : 0;
                
                return (
                  <tr key={c.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">{c.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          c.state === 'running' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 
                          c.state === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}></span>
                        <span className="capitalize text-gray-300">{c.state}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Cpu size={14} className="text-cyan-400" />
                        <span className="w-12 text-gray-200 font-mono">{c.cpu.toFixed(1)}%</span>
                        <div className="w-24 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(c.cpu, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <HardDrive size={14} className="text-purple-400" />
                        <span className="w-28 text-gray-200 font-mono">
                          {formatBytes(c.memory.usage)} / {formatBytes(c.memory.limit)}
                        </span>
                        <div className="w-24 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(memPercent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
