'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AdSettings {
  adProvider: 'none' | 'adsense' | 'adsterra';
  adBlockerDetection: boolean;
  requireAdView: boolean;
  adsensePublisherId: string;
  adsenseSlotId: string;
  adsterraBannerKey: string;
  adsterraNativeKey: string;
}

const PROVIDERS = [
  { value: 'none', label: 'None (Disabled)', desc: 'No ads will be shown on the coins page.' },
  { value: 'adsense', label: 'Google AdSense', desc: 'Display Google AdSense ads. Requires a publisher ID and ad slot ID.' },
  { value: 'adsterra', label: 'Adsterra', desc: 'Display Adsterra banner/native ads. Requires ad zone keys.' },
] as const;

export default function AdminAdSettingsPage() {
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm<AdSettings>({
    defaultValues: {
      adProvider: 'none',
      adBlockerDetection: true,
      requireAdView: true,
      adsensePublisherId: '',
      adsenseSlotId: '',
      adsterraBannerKey: '',
      adsterraNativeKey: '',
    },
  });

  const provider = watch('adProvider');

  useEffect(() => {
    api.get<AdSettings>('/admin/ad-settings')
      .then((r) => reset({
        adProvider: r.data.adProvider || 'none',
        adBlockerDetection: r.data.adBlockerDetection ?? true,
        requireAdView: r.data.requireAdView ?? true,
        adsensePublisherId: r.data.adsensePublisherId || '',
        adsenseSlotId: r.data.adsenseSlotId || '',
        adsterraBannerKey: r.data.adsterraBannerKey || '',
        adsterraNativeKey: r.data.adsterraNativeKey || '',
      }))
      .catch(() => toast.error('Failed to load ad settings'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: AdSettings) {
    setSaving(true);
    try {
      await api.put('/admin/ad-settings', data);
      toast.success('Ad settings updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">Ad Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure ads on the coins earning page. Users must view ads before claiming coins.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Provider Selection */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Ad Provider</h2>
          <div className="space-y-3">
            {PROVIDERS.map((p) => (
              <label
                key={p.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  provider === p.value
                    ? 'border-[#ff7a18]/40 bg-[#ff7a18]/[0.06]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  value={p.value}
                  {...register('adProvider')}
                  className="mt-0.5 accent-[#ff7a18]"
                />
                <div>
                  <span className="text-sm font-medium">{p.label}</span>
                  <p className="mt-0.5 text-xs text-gray-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Google AdSense Config */}
        {provider === 'adsense' && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-blue-400">Google AdSense Configuration</h2>
            <p className="text-xs text-gray-500">
              Get these from your <a href="https://www.google.com/adsense" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Google AdSense dashboard</a>.
            </p>
            <Input
              label="Publisher ID"
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              {...register('adsensePublisherId')}
            />
            <Input
              label="Ad Slot ID"
              placeholder="1234567890"
              {...register('adsenseSlotId')}
            />
          </div>
        )}

        {/* Adsterra Config */}
        {provider === 'adsterra' && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400">Adsterra Configuration</h2>
            <p className="text-xs text-gray-500">
              Get these from your <a href="https://www.adsterra.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Adsterra dashboard</a>. Paste the full script URL from your ad zone embed code.
            </p>
            <Input
              label="Banner Ad Script URL (atOptions format)"
              placeholder="https://yourdomain.com/KEY/invoke.js"
              {...register('adsterraBannerKey')}
            />
            <Input
              label="Native Ad Script URL (Optional, container format)"
              placeholder="https://yourdomain.com/KEY/invoke.js"
              {...register('adsterraNativeKey')}
            />
          </div>
        )}

        {/* General Settings */}
        {provider !== 'none' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Ad Behavior</h2>

            <label className="flex items-center justify-between rounded-xl border border-white/10 p-4">
              <div>
                <p className="text-sm font-medium">Ad Blocker Detection</p>
                <p className="text-xs text-gray-500">Block users from earning coins if an ad blocker is detected.</p>
              </div>
              <input
                type="checkbox"
                {...register('adBlockerDetection')}
                className="h-5 w-5 rounded accent-[#ff7a18]"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-white/10 p-4">
              <div>
                <p className="text-sm font-medium">Require Ad View to Claim</p>
                <p className="text-xs text-gray-500">Users must wait for the ad to load before the claim button is enabled.</p>
              </div>
              <input
                type="checkbox"
                {...register('requireAdView')}
                className="h-5 w-5 rounded accent-[#ff7a18]"
              />
            </label>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save Ad Settings'}
        </Button>
      </form>
    </div>
  );
}
