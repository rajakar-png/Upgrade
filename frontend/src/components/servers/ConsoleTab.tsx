'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { Play, Square, RotateCcw, Skull, Send, Trash2 } from 'lucide-react';

interface Props {
  serverId: number;
}

export function ConsoleTab({ serverId }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [serverState, setServerState] = useState('offline');
  const [stats, setStats] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval>>();
  const statsPollRef = useRef<ReturnType<typeof setInterval>>();
  const prevLinesRef = useRef<string[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/logs?size=200`);
      const logLines: string[] = data.data || [];
      // Only update if content changed (avoid unnecessary re-renders)
      const prev = prevLinesRef.current;
      if (logLines.length !== prev.length || logLines[logLines.length - 1] !== prev[prev.length - 1]) {
        prevLinesRef.current = logLines;
        setLines(logLines);
      }
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [serverId]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/resources`);
      setServerState(data.current_state || 'offline');
      setStats(data.resources || null);
    } catch {
      // silent
    }
  }, [serverId]);

  useEffect(() => {
    // Initial fetch
    fetchLogs();
    fetchStats();
    // Poll logs every 1.5s, stats every 3s
    logPollRef.current = setInterval(fetchLogs, 1500);
    statsPollRef.current = setInterval(fetchStats, 3000);
    return () => {
      clearInterval(logPollRef.current);
      clearInterval(statsPollRef.current);
    };
  }, [fetchLogs, fetchStats]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const sendCommand = async () => {
    if (!command.trim()) return;
    try {
      await api.post(`/servers/${serverId}/manage/command`, { command: command.trim() });
      setLines((prev) => [...prev, `> ${command}`]);
      setCommand('');
      // Fetch updated logs shortly after command
      setTimeout(fetchLogs, 500);
    } catch {
      toast.error('Failed to send command');
    }
  };

  const sendPower = async (action: string) => {
    try {
      await api.post(`/servers/${serverId}/manage/power`, { action });
      toast.success(`Power: ${action}`);
      setTimeout(fetchStats, 1000);
    } catch {
      toast.error(`Failed to ${action} server`);
    }
  };

  const stateColors: Record<string, string> = {
    running: 'bg-green-500',
    starting: 'bg-yellow-500',
    stopping: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };

  return (
    <div className="space-y-4">
      {/* Power controls & status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', stateColors[serverState] || 'bg-gray-500')} />
          <span className="text-sm font-medium capitalize">{serverState}</span>
        </div>

        {stats && (
          <div className="flex gap-3 text-xs text-gray-500">
            <span>CPU: {(stats.cpu_absolute || 0).toFixed(1)}%</span>
            <span>RAM: {((stats.memory_bytes || 0) / 1024 / 1024).toFixed(0)} MB</span>
            <span>Net: ↑{((stats.network_tx_bytes || 0) / 1024).toFixed(0)}KB ↓{((stats.network_rx_bytes || 0) / 1024).toFixed(0)}KB</span>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => sendPower('start')} disabled={serverState === 'running'}>
            <Play className="mr-1 h-3.5 w-3.5" /> Start
          </Button>
          <Button variant="ghost" size="sm" onClick={() => sendPower('restart')}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restart
          </Button>
          <Button variant="ghost" size="sm" onClick={() => sendPower('stop')} disabled={serverState === 'offline'}>
            <Square className="mr-1 h-3.5 w-3.5" /> Stop
          </Button>
          <Button variant="destructive" size="sm" onClick={() => sendPower('kill')} disabled={serverState === 'offline'}>
            <Skull className="mr-1 h-3.5 w-3.5" /> Kill
          </Button>
        </div>
      </div>

      {/* Console output */}
      <div className="relative">
        <div
          ref={logRef}
          className="h-[450px] overflow-y-auto rounded-xl border border-white/[0.06] bg-black p-4 font-mono text-xs leading-5 text-gray-300"
        >
          {lines.length === 0 ? (
            <p className="text-gray-600">Waiting for console output…</p>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={cn(line.startsWith('>') ? 'text-[#ff7a18]' : '')} dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }} />
            ))
          )}
        </div>
        <button
          onClick={() => { setLines([]); prevLinesRef.current = []; }}
          className="absolute right-3 top-3 rounded-lg bg-white/5 p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
          title="Clear console"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
            <p className="text-sm text-gray-400">Connecting to console…</p>
          </div>
        )}
      </div>

      {/* Command input */}
      <div className="flex gap-2">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
          placeholder="Type a command…"
          className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#ff7a18]/50"
          disabled={serverState !== 'running'}
        />
        <Button onClick={sendCommand} disabled={serverState !== 'running' || !command.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Minimal ANSI color code → HTML converter
function ansiToHtml(text: string): string {
  const map: Record<string, string> = {
    '30': '#4a4a4a', '31': '#ff5555', '32': '#50fa7b', '33': '#f1fa8c',
    '34': '#6272a4', '35': '#ff79c6', '36': '#8be9fd', '37': '#f8f8f2',
    '90': '#6272a4', '91': '#ff6e6e', '92': '#69ff94', '93': '#ffffa5',
    '94': '#d6acff', '95': '#ff92df', '96': '#a4ffff', '97': '#ffffff',
  };
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  safe = safe.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const parts = codes.split(';');
    for (const c of parts) {
      if (c === '0') return '</span>';
      if (map[c]) return `<span style="color:${map[c]}">`;
    }
    return '';
  });
  return safe;
}
