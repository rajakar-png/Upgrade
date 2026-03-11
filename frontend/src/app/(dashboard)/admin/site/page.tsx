'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SiteSetting {
  key: string;
  value: string;
}

function objectToSettings(obj: Record<string, any> | null): SiteSetting[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([key]) => key !== 'id')
    .map(([key, value]) => ({ key, value: value ?? '' }));
}

export default function AdminSitePage() {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const { register, handleSubmit, reset } = useForm<Record<string, string>>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/site/settings').then((r) => {
      const data = r.data;
      const entries = Array.isArray(data) ? data : objectToSettings(data);
      setSettings(entries);
      const defaults: Record<string, string> = {};
      entries.forEach((s: SiteSetting) => { defaults[s.key] = s.value; });
      reset(defaults);
    }).catch(() => toast.error('Failed to load settings'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: Record<string, string>) {
    setSaving(true);
    try {
      await api.patch('/admin/site/settings', data);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold">Site Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        {settings.map((s) => (
          <Input key={s.key} label={s.key} {...register(s.key)} />
        ))}
        <Button type="submit" className="w-full" disabled={saving || settings.length === 0}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}
