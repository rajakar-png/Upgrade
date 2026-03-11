'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CoinSettings {
  coinsPerSession: number;
  sessionDurationSeconds: number;
  cooldownSeconds: number;
}

export default function AdminCoinSettingsPage() {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<CoinSettings>();

  useEffect(() => {
    api.get<CoinSettings>('/admin/coin-settings').then((r) => reset(r.data)).catch(() => toast.error('Failed to load settings'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: CoinSettings) {
    setSaving(true);
    try {
      await api.patch('/admin/coin-settings', data);
      toast.success('Coin settings updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <h1 className="text-2xl font-bold">Coin Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <Input
          label="Coins Per Session"
          type="number"
          {...register('coinsPerSession', { valueAsNumber: true })}
        />
        <Input
          label="Session Duration (seconds)"
          type="number"
          {...register('sessionDurationSeconds', { valueAsNumber: true })}
        />
        <Input
          label="Cooldown Between Claims (seconds)"
          type="number"
          {...register('cooldownSeconds', { valueAsNumber: true })}
        />
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
