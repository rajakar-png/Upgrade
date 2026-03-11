'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Backup {
  backupId: string;
  name: string;
  createdAt: string;
  completedAt: string | null;
  size: number;
  isLocked: boolean;
}

export function BackupsTab({ serverId }: { serverId: number }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Backup[]>(`/servers/${serverId}/backups`);
      setBackups(r.data);
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setCreating(true);
    try {
      await api.post(`/servers/${serverId}/backups`);
      toast.success('Backup started');
      await load();
    } catch {
      toast.error('Failed to create backup');
    } finally {
      setCreating(false);
    }
  }

  async function deleteBackup(backupId: string) {
    try {
      await api.delete(`/servers/${serverId}/backups/${backupId}`);
      toast.success('Backup deleted');
      setBackups((prev) => prev.filter((b) => b.backupId !== backupId));
    } catch {
      toast.error('Failed to delete backup');
    } finally {
      setDeleteTarget(null);
    }
  }

  async function downloadBackup(backupId: string) {
    try {
      const r = await api.get<{ url: string }>(`/servers/${serverId}/backups/${backupId}/download`);
      window.open(r.data.url, '_blank');
    } catch {
      toast.error('Failed to get download URL');
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Backups ({backups.length})</h3>
        <Button size="sm" onClick={createBackup} disabled={creating}>
          {creating ? 'Creating…' : '+ New Backup'}
        </Button>
      </div>

      {backups.length === 0 ? (
        <p className="text-sm text-gray-400">No backups yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {backups.map((b) => (
            <li key={b.backupId} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-gray-400">
                  {b.completedAt
                    ? new Date(b.completedAt).toLocaleString()
                    : 'In progress…'}
                  {b.size ? ` · ${(b.size / 1_048_576).toFixed(1)} MB` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {b.completedAt && (
                  <Button size="sm" variant="secondary" onClick={() => downloadBackup(b.backupId)}>
                    Download
                  </Button>
                )}
                {!b.isLocked && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(b.backupId)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteBackup(deleteTarget)}
        title="Delete Backup"
        message="Delete this backup? This cannot be undone."
        confirmLabel="Delete Backup"
        confirmVariant="destructive"
      />
    </div>
  );
}
