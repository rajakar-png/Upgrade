'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { Users, RefreshCw, Shield, ShieldOff, Ban, LogOut } from 'lucide-react';

interface Props {
  serverId: number;
}

interface Player {
  name: string;
}

export function PlayersTab({ serverId }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; player: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlayers = useCallback(async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/players`);
      setPlayers(data.players || []);
      setMaxPlayers(data.maxPlayers || 0);
    } catch {
      // silently fail on poll
    }
  }, [serverId]);

  useEffect(() => {
    setLoading(true);
    fetchPlayers().finally(() => setLoading(false));
    // poll every 10s
    pollRef.current = setInterval(fetchPlayers, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPlayers]);

  const runAction = async (type: string, player: string) => {
    setActionLoading(`${type}-${player}`);
    try {
      await api.post(`/servers/${serverId}/manage/players/${type}`, { player });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} executed on ${player}`);
      if (type === 'kick' || type === 'ban') {
        setPlayers((prev) => prev.filter((p) => p.name !== player));
      }
    } catch {
      toast.error(`Failed to ${type} ${player}`);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleAction = (type: string, player: string) => {
    if (type === 'ban' || type === 'kick') {
      setConfirmAction({ type, player });
    } else {
      runAction(type, player);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#ff7a18]" />
          <h3 className="font-semibold">
            Online Players
            <span className="ml-2 text-sm text-gray-400">
              {players.length}/{maxPlayers}
            </span>
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchPlayers().finally(() => setLoading(false)); }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Player List */}
      {players.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="mx-auto h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">No players online</p>
          <p className="text-xs text-gray-600 mt-1">Make sure the server is running</p>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.name}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                {/* Minecraft head via Crafatar */}
                <img
                  src={`https://crafatar.com/avatars/${player.name}?size=32&overlay`}
                  alt={player.name}
                  className="h-8 w-8 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="font-medium">{player.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-400 hover:text-green-300 h-8 px-2"
                  onClick={() => handleAction('op', player.name)}
                  disabled={actionLoading === `op-${player.name}`}
                  title="Give Operator"
                >
                  <Shield className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-yellow-400 hover:text-yellow-300 h-8 px-2"
                  onClick={() => handleAction('deop', player.name)}
                  disabled={actionLoading === `deop-${player.name}`}
                  title="Remove Operator"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-400 hover:text-orange-300 h-8 px-2"
                  onClick={() => handleAction('kick', player.name)}
                  disabled={actionLoading === `kick-${player.name}`}
                  title="Kick"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 h-8 px-2"
                  onClick={() => handleAction('ban', player.name)}
                  disabled={actionLoading === `ban-${player.name}`}
                  title="Ban"
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) runAction(confirmAction.type, confirmAction.player);
        }}
        title={`${confirmAction?.type === 'ban' ? 'Ban' : 'Kick'} Player`}
        message={`Are you sure you want to ${confirmAction?.type} "${confirmAction?.player}"?`}
        confirmLabel={confirmAction?.type === 'ban' ? 'Ban' : 'Kick'}
        confirmVariant="destructive"
      />
    </div>
  );
}
