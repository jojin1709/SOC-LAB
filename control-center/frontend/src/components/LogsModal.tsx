import { useEffect, useRef, useState } from 'react';
import { X, Copy, Trash2, ArrowDown } from 'lucide-react';

interface LogsModalProps {
  labId: string;
  labName: string;
  onClose: () => void;
  ws: WebSocket | null;
}

export default function LogsModal({ labId, labName, onClose, ws }: LogsModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Clear logs and subscribe
    setLogs([]);
    ws.send(JSON.stringify({ type: 'subscribe-logs', labId }));

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log-data' && data.labId === labId) {
          setLogs(prev => [...prev, data.payload]);
        } else if (data.type === 'log-error' && data.labId === labId) {
          setLogs(prev => [...prev, `[ERROR] ${data.error}\n`]);
        }
      } catch (e) {
        console.error('Failed to parse WS log message:', e);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe-logs' }));
      }
    };
  }, [labId, ws]);

  // Scroll management
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    // If user scrolled up, disable autoscroll. If they are close to the bottom, re-enable.
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logs.join(''));
    alert('Logs copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl h-[80vh] bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></div>
            <h3 className="font-bold text-white text-lg">Live Logs: {labName}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition"
              title="Copy to clipboard"
            >
              <Copy size={14} />
              Copy
            </button>
            <button 
              onClick={() => setLogs([])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition"
              title="Clear console"
            >
              <Trash2 size={14} />
              Clear
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-850 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div 
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 p-6 overflow-y-auto font-mono text-xs text-gray-300 bg-black leading-relaxed whitespace-pre-wrap selection:bg-cyan-900"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 italic">
              Awaiting logs from Docker Compose...
            </div>
          ) : (
            logs.map((log, index) => (
              <span key={index}>{log}</span>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Autoscroll indicator */}
        {!autoScroll && logs.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute bottom-6 right-10 flex items-center gap-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition animate-bounce"
          >
            <ArrowDown size={14} />
            Scroll to Bottom
          </button>
        )}
      </div>
    </div>
  );
}
