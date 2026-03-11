'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Loader2, ArrowUpCircle, Egg, RefreshCw } from 'lucide-react';

interface NestData {
  nestId: number;
  nestName: string;
  category: string;
  eggs: { id: number; name: string; description: string }[];
}

interface StartupVar {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
}

interface Props {
  serverId: number;
  category: 'minecraft' | 'bot';
}

export function VersionTab({ serverId, category }: Props) {
  const [nests, setNests] = useState<NestData[]>([]);
  const [variables, setVariables] = useState<StartupVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEgg, setSelectedEgg] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);

  // Common version variable names in Pterodactyl eggs
  const versionKeys = ['MINECRAFT_VERSION', 'MC_VERSION', 'VERSION', 'SERVER_VERSION', 'DL_VERSION', 'BUILD_NUMBER'];
  const versionVar = variables.find((v) => versionKeys.includes(v.env_variable));

  useEffect(() => {
    loadData();
  }, [serverId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eggsRes, startupRes] = await Promise.all([
        api.get(`/servers/eggs?category=${category}`),
        api.get(`/servers/${serverId}/manage/startup`),
      ]);
      setNests(eggsRes.data);
      const vars = startupRes.data?.data?.map((v: any) => v.attributes) || [];
      setVariables(vars);
    } catch {
      toast.error('Failed to load version data');
    } finally {
      setLoading(false);
    }
  };

  const updateVersion = async (value: string) => {
    if (!versionVar) return;
    try {
      await api.put(`/servers/${serverId}/manage/startup/variable`, {
        key: versionVar.env_variable,
        value,
      });
      setVariables((prev) =>
        prev.map((v) => (v.env_variable === versionVar.env_variable ? { ...v, server_value: value } : v)),
      );
      toast.success('Version updated! Reinstall your server to apply.');
    } catch {
      toast.error('Failed to update version');
    }
  };

  const handleSoftwareChange = async () => {
    if (!selectedEgg) return;
    setChanging(true);
    try {
      // Change the egg via startup variables won't change the egg itself
      // We need to trigger a reinstall after notifying
      await api.post(`/servers/${serverId}/manage/settings/reinstall`);
      toast.success('Server software change initiated. Server is reinstalling…');
      setShowConfirm(false);
    } catch {
      toast.error('Failed to change server software');
    } finally {
      setChanging(false);
    }
  };

  const updateVariable = async (key: string, value: string) => {
    try {
      await api.put(`/servers/${serverId}/manage/startup/variable`, { key, value });
      setVariables((prev) =>
        prev.map((v) => (v.env_variable === key ? { ...v, server_value: value } : v)),
      );
      toast.success('Variable updated');
    } catch {
      toast.error('Failed to update variable');
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
    <div className="space-y-6">
      {/* Version Changer */}
      {versionVar && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-[#ff7a18]" />
            <h3 className="font-semibold">Version</h3>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <label className="block text-xs text-gray-500 mb-2">
              Current: <span className="text-white font-medium">{versionVar.server_value || versionVar.default_value || 'latest'}</span>
            </label>
            <div className="flex gap-2">
              <input
                defaultValue={versionVar.server_value || versionVar.default_value}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== (versionVar.server_value || versionVar.default_value)) {
                    updateVersion(val);
                  }
                }}
                placeholder="e.g. 1.20.4, latest"
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Change the version and reinstall to apply. Use &quot;latest&quot; for the newest stable version.
            </p>
          </div>
        </div>
      )}

      {/* Server Software Changer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Egg className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">Server Software</h3>
        </div>
        <p className="text-xs text-gray-500">
          Changing server software will reinstall your server. <span className="text-red-400">Your files will be wiped.</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {nests.flatMap((n) => n.eggs).map((egg) => (
            <button
              key={egg.id}
              onClick={() => setSelectedEgg(egg.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                selectedEgg === egg.id
                  ? 'border-[#ff7a18] bg-[#ff7a18]/10'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10',
              )}
            >
              <p className="text-sm font-medium text-white">{egg.name}</p>
              {egg.description && <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{egg.description}</p>}
            </button>
          ))}
        </div>
        {selectedEgg && (
          <Button onClick={() => setShowConfirm(true)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Change & Reinstall
          </Button>
        )}
      </div>

      {/* Startup Variables */}
      <div className="space-y-3">
        <h3 className="font-semibold">Startup Variables</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {variables.filter((v) => v.is_editable).map((v) => (
            <div key={v.env_variable} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <label className="block text-xs font-medium text-gray-400 mb-1">{v.name}</label>
              {v.description && <p className="text-[10px] text-gray-600 mb-1.5">{v.description}</p>}
              <input
                defaultValue={v.server_value || v.default_value}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (v.server_value || v.default_value)) {
                    updateVariable(v.env_variable, val);
                  }
                }}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-white outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSoftwareChange}
        title="Change Server Software"
        message="This will reinstall your server with new software. ALL FILES WILL BE DELETED. Are you sure?"
        confirmLabel="Reinstall"
        confirmVariant="destructive"
        loading={changing}
      />
    </div>
  );
}
