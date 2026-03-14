'use client';

import { useEffect, useMemo, useState } from 'react';
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

const FALLBACK_MC_VERSIONS = [
  '1.21.4',
  '1.21.3',
  '1.21.1',
  '1.20.6',
  '1.20.4',
  '1.20.2',
  '1.20.1',
  '1.19.4',
  '1.18.2',
  '1.16.5',
];

export function VersionTab({ serverId, category }: Props) {
  const [nests, setNests] = useState<NestData[]>([]);
  const [variables, setVariables] = useState<StartupVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEgg, setSelectedEgg] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [availableVersions, setAvailableVersions] = useState<string[]>(FALLBACK_MC_VERSIONS);
  const [customVersion, setCustomVersion] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);

  const getErrorMessage = (err: any, fallback: string) => {
    const msg = err?.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) return msg.map((m) => String(m)).join(', ');
    if (msg && typeof msg === 'object') {
      if (typeof msg.message === 'string' && msg.message.trim()) return msg.message;
      if (typeof msg.error === 'string' && msg.error.trim()) return msg.error;
    }
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
    return fallback;
  };

  // Prefer semantic Minecraft version keys; BUILD_NUMBER is handled separately.
  const versionKeys = ['MINECRAFT_VERSION', 'MC_VERSION', 'VERSION', 'SERVER_VERSION', 'DL_VERSION'];
  const versionVar = variables.find((v) => versionKeys.includes(v.env_variable));
  const buildNumberVar = variables.find((v) => v.env_variable === 'BUILD_NUMBER');
  const currentVersion = versionVar?.server_value || versionVar?.default_value || 'latest';

  const dropdownVersions = useMemo(
    () => Array.from(new Set([selectedVersion, currentVersion, ...availableVersions, 'latest'].filter(Boolean))),
    [selectedVersion, currentVersion, availableVersions],
  );

  useEffect(() => {
    loadData();
  }, [serverId]);

  useEffect(() => {
    const loadVersionCatalog = async () => {
      if (category !== 'minecraft') return;
      try {
        const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const releases = (data?.versions || [])
          .filter((v: any) => v?.type === 'release' && typeof v?.id === 'string')
          .map((v: any) => v.id);
        if (releases.length > 0) {
          setAvailableVersions(releases);
        }
      } catch {
        // Keep fallback list when remote catalog is unavailable.
      }
    };

    loadVersionCatalog();
  }, [category]);

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

      const preferred = vars.find((v: any) => versionKeys.includes(v.env_variable));
      const buildOnly = vars.find((v: any) => v.env_variable === 'BUILD_NUMBER');
      if (preferred) {
        const resolved = preferred.server_value || preferred.default_value || 'latest';
        setSelectedVersion(resolved);
        setCustomVersion(resolved);
      } else if (buildOnly) {
        setSelectedVersion('latest');
        setCustomVersion('latest');
      }
    } catch {
      toast.error('Failed to load version data');
    } finally {
      setLoading(false);
    }
  };

  const updateVersion = async (value: string) => {
    if (savingVersion) return;

    if (!versionVar && !buildNumberVar) {
      toast.error('No version variable found for this server egg');
      return;
    }

    const next = value.trim();
    if (!next) {
      toast.error('Version cannot be empty');
      return;
    }

    const targetVar = versionVar || buildNumberVar;
    if (!targetVar) {
      toast.error('No editable version variable found for this server egg');
      return;
    }

    try {
      setSavingVersion(true);
      await api.put(`/servers/${serverId}/manage/startup/variable`, {
        key: targetVar.env_variable,
        value: next,
      });

      // Version changes must reinstall so the server files are recreated for the selected version.
      await api.post(`/servers/${serverId}/manage/settings/reinstall`);

      setVariables((prev) => prev.map((v) => {
        if (v.env_variable === targetVar.env_variable) {
          return { ...v, server_value: next };
        }
        return v;
      }));

      setSelectedVersion(next);
      setCustomVersion(next);
      toast.success('Version updated and reinstall started. Existing server files will be replaced.');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update version'));
    } finally {
      setSavingVersion(false);
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
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update variable'));
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
      {(versionVar || buildNumberVar) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-[#ff7a18]" />
            <h3 className="font-semibold">Version</h3>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <label className="block text-xs text-gray-500 mb-2">
              Current: <span className="text-white font-medium">{versionVar?.server_value || versionVar?.default_value || 'latest'}</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedVersion}
                onChange={(e) => {
                  setSelectedVersion(e.target.value);
                  setCustomVersion(e.target.value);
                }}
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
                disabled={savingVersion}
              >
                {dropdownVersions.map((v) => (
                  <option key={v} value={v} className="bg-white text-black">{v}</option>
                ))}
              </select>
              <Button
                onClick={() => updateVersion(selectedVersion)}
                disabled={savingVersion || !selectedVersion || selectedVersion === (versionVar?.server_value || versionVar?.default_value || 'latest')}
              >
                {savingVersion ? 'Applying…' : 'Apply'}
              </Button>
            </div>
            {versionVar && (
              <div className="mt-2 flex gap-2">
              <input
                value={customVersion}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomVersion(val);
                  setSelectedVersion(val);
                }}
                placeholder="e.g. 1.20.4, latest"
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
                disabled={savingVersion}
              />
              </div>
            )}
            <p className="mt-2 text-xs text-gray-600">
              Applying a version automatically reinstalls the server, wipes files, and re-runs installation for that version.
            </p>
            {buildNumberVar && versionVar && (
              <p className="mt-1 text-xs text-gray-600">
                This egg exposes both version and BUILD_NUMBER. Only the version field is changed here.
              </p>
            )}
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
