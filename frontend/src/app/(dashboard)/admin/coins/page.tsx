'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CoinSettings {
  coinsPerMinute: number;
}

export default function AdminCoinSettingsPage() {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<CoinSettings>();

  useEffect(() => {
    api.get<CoinSettings>('/admin/settings/coins').then((r) => reset(r.data)).catch(() => toast.error('Failed to load settings'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: CoinSettings) {
    setSaving(true);
    try {
      await api.put('/admin/settings/coins', { coinsPerMinute: data.coinsPerMinute });
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
          label="Coins Per Claim"
          type="number"
          {...register('coinsPerMinute', { valueAsNumber: true })}
        />
        <p className="text-xs text-gray-500">
          Number of coins a user earns each time they claim. The claim cooldown is 60 seconds and the session token lasts 40 seconds.
        </p>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
