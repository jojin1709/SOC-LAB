import { useState } from 'react';
import { Play, Square, RotateCw, FileText, Database, ShieldAlert, Cpu, Layers } from 'lucide-react';

interface Lab {
  id: string;
  name: string;
  description: string;
  services: string[];
  ram: string;
  profile: string;
  requires?: string[];
}

interface LabCardProps {
  lab: Lab;
  status: 'running' | 'stopped' | 'starting';
  runningServices: string[];
  totalServices: number;
  onViewLogs: (labId: string, labName: string) => void;
}

export default function LabCard({ lab, status, runningServices, totalServices, onViewLogs }: LabCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/labs/${lab.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error executing action: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Network error: ${e.message}`);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const getLabIcon = () => {
    switch (lab.id) {
      case 'core': return <Database className="text-cyan-400" size={18} />;
      case 'intel': return <ShieldAlert className="text-red-400" size={18} />;
      case 'ir': return <Layers className="text-purple-400" size={18} />;
      default: return <Cpu className="text-emerald-400" size={18} />;
    }
  };

  return (
    <div className={`group relative cyber-card hover:-translate-y-1.5 duration-300 ${
      status === 'running' ? 'cyber-glow-green border-green-500/25' :
      status === 'starting' ? 'cyber-glow-yellow border-yellow-500/30' : 'hover:border-cyan-500/20'
    }`}>
      {/* Background Glow Effect */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br rounded-bl-full opacity-5 transition-opacity duration-300 group-hover:opacity-15 ${
        status === 'running' ? 'from-green-500' :
        status === 'starting' ? 'from-yellow-500' : 'from-cyan-500'
      }`}></div>

      <div className="p-6">
        {/* Title & Icon */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg shadow-inner">
              {getLabIcon()}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide leading-tight">{lab.name}</h3>
              <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500">profile: {lab.profile}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800/80 shadow-inner">
            <span className="text-[10px] font-mono text-yellow-500/90 font-bold">{lab.ram}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-xs h-10 overflow-hidden mb-4 leading-relaxed">{lab.description}</p>
        
        {/* Dependencies */}
        {lab.requires && lab.requires.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
            <span className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Requires:</span>
            {lab.requires.map(req => (
              <span key={req} className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-950/40 border border-cyan-900/30 text-cyan-400 rounded-md">
                {req.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Services Run Status */}
        <div className="mb-5 bg-slate-950/40 p-3 rounded-lg border border-slate-900/80 shadow-inner">
          <div className="flex justify-between text-[11px] mb-1.5 font-medium">
            <span className="text-slate-400">Services ({runningServices.length}/{totalServices})</span>
            <span className={`font-bold uppercase tracking-wider text-[10px] ${
              status === 'running' ? 'text-green-400' :
              status === 'starting' ? 'text-yellow-400' : 'text-slate-500'
            }`}>
              {status === 'running' ? 'Active' : status === 'starting' ? 'Booting' : 'Offline'}
            </span>
          </div>
          <div className="w-full bg-slate-850 rounded-full h-1 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'running' ? 'bg-green-500 shadow-md shadow-green-500/30' :
                status === 'starting' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-700'
              }`}
              style={{ width: `${totalServices > 0 ? (runningServices.length / totalServices) * 100 : 0}%` }}
            ></div>
          </div>
          {runningServices.length > 0 && (
            <div className="mt-2 text-[10px] text-slate-500 truncate font-mono">
              Online: <span className="text-cyan-400/90">{runningServices.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Status indicator & buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => onViewLogs(lab.id, lab.name)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg border border-slate-800 transition"
            title="View Real-time Logs"
          >
            <FileText size={14} />
            Logs
          </button>

          <div className="flex gap-2 flex-1 justify-end">
            {status !== 'running' ? (
              <button 
                onClick={() => handleAction('start')}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-50 min-w-[80px] shadow-md shadow-cyan-600/10 hover:shadow-cyan-500/25"
              >
                {loading ? '...' : <><Play size={12} fill="white" /> Start</>}
              </button>
            ) : (
              <button 
                onClick={() => handleAction('stop')}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-red-950/80 hover:bg-red-900 border border-red-850/80 text-red-200 font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-50 min-w-[80px]"
              >
                {loading ? '...' : <><Square size={11} fill="currentColor" /> Stop</>}
              </button>
            )}
            
            <button 
              onClick={() => handleAction('restart')}
              disabled={loading || status === 'stopped'}
              className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 px-2.5 rounded-lg text-xs transition disabled:opacity-30"
              title="Restart lab services"
            >
              <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}