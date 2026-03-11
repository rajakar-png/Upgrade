'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { Save, Loader2, Settings } from 'lucide-react';

interface Props {
  serverId: number;
}

interface Prop {
  key: string;
  value: string;
  comment?: string;
}

const KNOWN_PROPS: Record<string, { label: string; type: 'text' | 'number' | 'boolean' | 'select'; options?: string[] }> = {
  'server-port': { label: 'Server Port', type: 'number' },
  'gamemode': { label: 'Gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
  'difficulty': { label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
  'max-players': { label: 'Max Players', type: 'number' },
  'motd': { label: 'MOTD', type: 'text' },
  'pvp': { label: 'PvP', type: 'boolean' },
  'allow-flight': { label: 'Allow Flight', type: 'boolean' },
  'spawn-protection': { label: 'Spawn Protection', type: 'number' },
  'view-distance': { label: 'View Distance', type: 'number' },
  'simulation-distance': { label: 'Simulation Distance', type: 'number' },
  'online-mode': { label: 'Online Mode', type: 'boolean' },
  'white-list': { label: 'Whitelist', type: 'boolean' },
  'enable-command-block': { label: 'Command Blocks', type: 'boolean' },
  'spawn-monsters': { label: 'Spawn Monsters', type: 'boolean' },
  'spawn-animals': { label: 'Spawn Animals', type: 'boolean' },
  'spawn-npcs': { label: 'Spawn NPCs', type: 'boolean' },
  'generate-structures': { label: 'Generate Structures', type: 'boolean' },
  'level-name': { label: 'World Name', type: 'text' },
  'level-seed': { label: 'World Seed', type: 'text' },
  'level-type': { label: 'World Type', type: 'text' },
  'hardcore': { label: 'Hardcore', type: 'boolean' },
  'force-gamemode': { label: 'Force Gamemode', type: 'boolean' },
  'allow-nether': { label: 'Allow Nether', type: 'boolean' },
  'announce-player-achievements': { label: 'Announce Achievements', type: 'boolean' },
  'player-idle-timeout': { label: 'Idle Timeout (min)', type: 'number' },
  'max-world-size': { label: 'Max World Size', type: 'number' },
  'entity-broadcast-range-percentage': { label: 'Entity Broadcast Range %', type: 'number' },
};

export function PropertiesTab({ serverId }: Props) {
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    loadProps();
  }, [serverId]);

  const loadProps = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/files/contents`, { params: { file: '/server.properties' } });
      const text = typeof data.content === 'string' ? data.content : '';
      setRawContent(text);
      const parsed: Prop[] = [];
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        parsed.push({ key: trimmed.slice(0, eqIdx), value: trimmed.slice(eqIdx + 1) });
      }
      setProps(parsed);
    } catch {
      toast.error('Could not load server.properties — file may not exist yet');
    } finally {
      setLoading(false);
    }
  };

  const updateProp = (key: string, value: string) => {
    setProps((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  };

  const save = async () => {
    setSaving(true);
    try {
      let content: string;
      if (showRaw) {
        content = rawContent;
      } else {
        // Rebuild from parsed props, preserving comments from raw
        const lines = rawContent.split('\n');
        const propMap = new Map(props.map((p) => [p.key, p.value]));
        content = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) return line;
          const key = trimmed.slice(0, eqIdx);
          if (propMap.has(key)) return `${key}=${propMap.get(key)}`;
          return line;
        }).join('\n');
      }
      await api.post(`/servers/${serverId}/manage/files/write`, { file: '/server.properties', content });
      setRawContent(content);
      toast.success('Properties saved! Restart your server to apply changes.');
    } catch {
      toast.error('Failed to save properties');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">Server Properties</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'Visual Editor' : 'Raw Editor'}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="mr-1 h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {showRaw ? (
        <textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          className="h-[500px] w-full resize-none rounded-xl border border-white/[0.06] bg-black p-4 font-mono text-xs leading-5 text-gray-300 outline-none focus:border-[#ff7a18]/30"
          spellCheck={false}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {props.map((p) => {
            const meta = KNOWN_PROPS[p.key];
            const label = meta?.label || p.key;
            const type = meta?.type || 'text';

            return (
              <div key={p.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                {type === 'boolean' ? (
                  <button
                    onClick={() => updateProp(p.key, p.value === 'true' ? 'false' : 'true')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      p.value === 'true'
                        ? 'bg-[#ff7a18]/20 text-[#ff7a18]'
                        : 'bg-white/[0.05] text-gray-500'
                    }`}
                  >
                    {p.value === 'true' ? 'Enabled' : 'Disabled'}
                  </button>
                ) : type === 'select' && meta?.options ? (
                  <select
                    value={p.value}
                    onChange={(e) => updateProp(p.key, e.target.value)}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-white outline-none"
                  >
                    {meta.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={type === 'number' ? 'number' : 'text'}
                    value={p.value}
                    onChange={(e) => updateProp(p.key, e.target.value)}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-white outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
