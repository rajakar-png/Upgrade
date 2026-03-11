'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { Settings, RefreshCw, Network, Globe, Copy } from 'lucide-react';

interface Props {
  serverId: number;
  server: any;
  onServerUpdate: (s: any) => void;
}

export function SettingsTab({ serverId, server, onServerUpdate }: Props) {
  const [name, setName] = useState(server?.name || '');
  const [renaming, setRenaming] = useState(false);
  const [showReinstall, setShowReinstall] = useState(false);
  const [reinstalling, setReinstalling] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(true);

  // Subdomain
  const [subdomain, setSubdomain] = useState('');
  const [currentSubdomain, setCurrentSubdomain] = useState<string | null>(server?.subdomain || null);
  const [settingSubdomain, setSettingSubdomain] = useState(false);

  // Auto-load network on mount
  useEffect(() => {
    api.get(`/servers/${serverId}/manage/network`).then(({ data }) => {
      setAllocations(data);
    }).catch(() => {}).finally(() => setLoadingNetwork(false));
  }, [serverId]);

  // Load current subdomain
  useEffect(() => {
    api.get(`/servers/${serverId}/manage/subdomain`).then(({ data }) => {
      setCurrentSubdomain(data.subdomain);
      if (data.subdomain) setSubdomain(data.subdomain);
    }).catch(() => {});
  }, [serverId]);

  const primaryAlloc = allocations.find((a: any) => a.isDefault) || allocations[0];
  const ipPort = primaryAlloc ? `${primaryAlloc.ipAlias || primaryAlloc.ip}:${primaryAlloc.port}` : null;
  const displayAddress = currentSubdomain ? `${currentSubdomain}.astranodes.cloud` : ipPort;

  const copyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const handleRename = async () => {
    if (!name.trim() || name.trim().length < 3) {
      toast.error('Name must be at least 3 characters');
      return;
    }
    setRenaming(true);
    try {
      await api.post(`/servers/${serverId}/manage/settings/rename`, { name: name.trim() });
      toast.success('Server renamed');
      onServerUpdate({ ...server, name: name.trim() });
    } catch {
      toast.error('Failed to rename');
    } finally {
      setRenaming(false);
    }
  };

  const handleSetSubdomain = async () => {
    if (!subdomain.trim()) return;
    setSettingSubdomain(true);
    try {
      const { data } = await api.post(`/servers/${serverId}/manage/subdomain`, {
        subdomain: subdomain.trim(),
      });
      setCurrentSubdomain(data.subdomain);
      toast.success(`Subdomain set: ${data.fullAddress}`);
      onServerUpdate({ ...server, subdomain: data.subdomain });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to set subdomain');
    } finally {
      setSettingSubdomain(false);
    }
  };

  const handleRemoveSubdomain = async () => {
    try {
      await api.delete(`/servers/${serverId}/manage/subdomain`);
      setCurrentSubdomain(null);
      setSubdomain('');
      toast.success('Subdomain removed');
      onServerUpdate({ ...server, subdomain: null });
    } catch {
      toast.error('Failed to remove subdomain');
    }
  };

  const handleReinstall = async () => {
    setReinstalling(true);
    try {
      await api.post(`/servers/${serverId}/manage/settings/reinstall`);
      toast.success('Server is reinstalling…');
      setShowReinstall(false);
    } catch {
      toast.error('Failed to reinstall');
    } finally {
      setReinstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Address */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">Connection Address</h3>
        </div>
        {loadingNetwork ? (
          <div className="h-10 animate-pulse rounded-lg bg-white/5" />
        ) : displayAddress ? (
          <div className="space-y-2">
            <button
              onClick={() => copyAddress(displayAddress)}
              className="flex items-center gap-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-3 w-full text-left transition-colors hover:bg-white/[0.08] group"
            >
              <span className="font-mono text-base text-[#ff7a18]">{displayAddress}</span>
              <Copy className="ml-auto h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
            </button>
            {currentSubdomain && ipPort && (
              <button
                onClick={() => copyAddress(ipPort)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <span>Direct IP: <span className="font-mono">{ipPort}</span></span>
                <Copy className="h-3 w-3" />
              </button>
            )}
            {!currentSubdomain && allocations.length > 1 && (
              <div className="space-y-1 pt-1">
                {allocations.filter((a) => !a.isDefault).map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => copyAddress(`${a.ipAlias || a.ip}:${a.port}`)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <span className="font-mono">{a.ipAlias || a.ip}:{a.port}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No allocations found</p>
        )}
      </div>

      {/* Custom Subdomain */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">Custom Subdomain</h3>
        </div>
        <p className="text-xs text-gray-500">
          Set a custom address like <span className="font-mono text-gray-400">yourname.astranodes.cloud</span> for players to connect with.
        </p>
        <div className="flex gap-2 items-center">
          <div className="flex flex-1 items-center rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="yourname"
              className="border-0 bg-transparent rounded-none"
              maxLength={24}
            />
            <span className="pr-3 text-sm text-gray-500 whitespace-nowrap">.astranodes.cloud</span>
          </div>
          <Button onClick={handleSetSubdomain} disabled={settingSubdomain || !subdomain.trim()}>
            {settingSubdomain ? 'Saving…' : 'Set'}
          </Button>
        </div>
        {currentSubdomain && (
          <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-2.5">
            <div>
              <p className="text-sm font-mono text-[#ff7a18]">{currentSubdomain}.astranodes.cloud</p>
              <p className="text-[10px] text-gray-500">Active subdomain</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemoveSubdomain} className="text-red-400 hover:text-red-300">
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Rename */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">Server Name</h3>
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Server name"
          />
          <Button onClick={handleRename} disabled={renaming}>
            {renaming ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Server Info */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <h3 className="font-semibold">Server Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Identifier</p>
            <p className="font-mono text-gray-300">{server?.identifier || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Panel ID</p>
            <p className="font-mono text-gray-300">{server?.pterodactylServerId || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-gray-300">{server?.createdAt ? new Date(server.createdAt).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Expires</p>
            <p className="text-gray-300">{server?.expiresAt ? new Date(server.expiresAt).toLocaleDateString() : '—'}</p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
        <h3 className="font-semibold text-red-400">Danger Zone</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="destructive" size="sm" onClick={() => setShowReinstall(true)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reinstall Server
          </Button>
        </div>
        <p className="text-xs text-gray-600">
          Reinstalling will wipe all server files and reset to a fresh install.
        </p>
      </div>

      <ConfirmModal
        open={showReinstall}
        onClose={() => setShowReinstall(false)}
        onConfirm={handleReinstall}
        title="Reinstall Server"
        message="This will DELETE ALL FILES and reinstall your server from scratch. This cannot be undone."
        confirmLabel="Reinstall"
        confirmVariant="destructive"
        loading={reinstalling}
      />
    </div>
  );
}
