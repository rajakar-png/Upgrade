'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { ServerStatus } from '@/components/servers/ServerStatus';
import { BackupsTab } from '@/components/servers/BackupsTab';
import { ConsoleTab } from '@/components/servers/ConsoleTab';
import { FilesTab } from '@/components/servers/FilesTab';
import { PropertiesTab } from '@/components/servers/PropertiesTab';
import { VersionTab } from '@/components/servers/VersionTab';
import { PluginsTab } from '@/components/servers/PluginsTab';
import { SettingsTab } from '@/components/servers/SettingsTab';
import { PlayersTab } from '@/components/servers/PlayersTab';
import { EulaModal } from '@/components/servers/EulaModal';
import { cn } from '@/lib/cn';
import {
  Terminal,
  FolderOpen,
  SlidersHorizontal,
  GitBranch,
  Puzzle,
  Archive,
  Settings,
  Users,
  Copy,
} from 'lucide-react';

const TABS = [
  { key: 'console', label: 'Console', icon: Terminal },
  { key: 'files', label: 'Files', icon: FolderOpen },
  { key: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { key: 'version', label: 'Version', icon: GitBranch },
  { key: 'plugins', label: 'Plugins', icon: Puzzle },
  { key: 'backups', label: 'Backups', icon: Archive },
  { key: 'players', label: 'Players', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ServerManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [server, setServer] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>('console');
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEula, setShowEula] = useState(false);

  const serverId = Number(id);

  useEffect(() => {
    api.get(`/servers/${id}`).then((r) => {
      setServer(r.data);
      // Check EULA for Minecraft-category servers
      const cat = r.data?.category || r.data?.software || '';
      if (cat.toLowerCase().includes('minecraft') || cat === '') {
        api.get(`/servers/${id}/manage/eula`).then((e) => {
          if (!e.data.accepted) setShowEula(true);
        }).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      await api.post(`/servers/${id}/renew`);
      toast.success('Server renewed!');
      const r = await api.get(`/servers/${id}`);
      setServer(r.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/servers/${id}`);
      toast.success('Server deleted');
      router.push('/dashboard');
    } catch {
      toast.error('Delete failed');
      setDeleting(false);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-800" />;
  if (!server) return <p className="text-gray-400">Server not found.</p>;

  const plan = server.planCoin || server.planReal;

  const connectAddr = server.subdomain
    ? `${server.subdomain}.astranodes.cloud`
    : server.connectionAddress;

  const copyAddress = () => {
    if (connectAddr) {
      navigator.clipboard.writeText(connectAddr);
      toast.success('Copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <ServerStatus status={server.status} />
            {plan && (
              <span className="text-xs text-gray-500">
                {plan.ram}GB RAM · {plan.cpu}% CPU · {plan.storage}GB Disk
              </span>
            )}
            <span className="text-xs text-gray-600">
              Expires {new Date(server.expiresAt).toLocaleDateString()}
            </span>
          </div>
          {connectAddr && (
            <button
              onClick={copyAddress}
              className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 transition-colors hover:bg-white/[0.08] group"
            >
              <span className="font-mono text-sm text-[#ff7a18]">{connectAddr}</span>
              <Copy className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRenew} disabled={renewing}>
            {renewing ? 'Renewing…' : 'Renew'}
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <ConfirmModal
            open={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="Delete Server"
            message="Permanently delete this server? This cannot be undone."
            confirmLabel="Delete Server"
            confirmVariant="destructive"
            loading={deleting}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 overflow-x-auto">
        <nav className="-mb-px flex gap-1 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors whitespace-nowrap',
                tab === key
                  ? 'border-[#ff7a18] text-[#ff7a18]'
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'console' && <ConsoleTab serverId={serverId} />}
      {tab === 'files' && <FilesTab serverId={serverId} />}
      {tab === 'properties' && <PropertiesTab serverId={serverId} />}
      {tab === 'version' && <VersionTab serverId={serverId} category="minecraft" />}
      {tab === 'plugins' && <PluginsTab serverId={serverId} />}
      {tab === 'backups' && <BackupsTab serverId={serverId} />}
      {tab === 'players' && <PlayersTab serverId={serverId} />}
      {tab === 'settings' && (
        <SettingsTab serverId={serverId} server={server} onServerUpdate={setServer} />
      )}

      <EulaModal
        serverId={serverId}
        open={showEula}
        onAccepted={() => setShowEula(false)}
      />
    </div>
  );
}
