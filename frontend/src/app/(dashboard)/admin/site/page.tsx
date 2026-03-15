'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Upload, RefreshCw } from 'lucide-react';

interface SiteSettings {
  id?: number;
  siteName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  backgroundImage?: string;
  backgroundOverlayOpacity?: number;
  faviconPath?: string;
  logoPath?: string;
  logoAlt?: string;
  backgroundImageAlt?: string;
  maintenanceMode?: boolean;
  discordInviteUrl?: string;
  discordPopupEnabled?: boolean;
  discordBotToken?: string;
  discordBotEnabled?: boolean;
  discordUtrChannelId?: string;
  discordTicketChannelId?: string;
  discordPingRoleId?: string;
}

export default function AdminSitePage() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<SiteSettings>('/site/settings').then((r) => {
      setSettings(r.data || {});
    }).catch(() => toast.error('Failed to load settings'));
  }, []);

  function handleChange(key: keyof SiteSettings, value: string | boolean | number) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    try {
      const form = new FormData();
      if (settings.siteName !== undefined) form.append('siteName', settings.siteName || '');
      if (settings.heroTitle !== undefined) form.append('heroTitle', settings.heroTitle || '');
      if (settings.heroSubtitle !== undefined) form.append('heroSubtitle', settings.heroSubtitle || '');
      if (settings.faviconPath !== undefined) form.append('faviconPath', settings.faviconPath || '');
      if (settings.logoPath !== undefined) form.append('logoPath', settings.logoPath || '');
      if (settings.logoAlt !== undefined) form.append('logoAlt', settings.logoAlt || '');
      if (settings.backgroundImageAlt !== undefined) form.append('backgroundImageAlt', settings.backgroundImageAlt || '');
      if (settings.discordInviteUrl !== undefined) form.append('discordInviteUrl', settings.discordInviteUrl || '');
      if (settings.backgroundOverlayOpacity !== undefined) form.append('backgroundOverlayOpacity', String(settings.backgroundOverlayOpacity));
      form.append('maintenanceMode', String(!!settings.maintenanceMode));
      form.append('discordPopupEnabled', String(!!settings.discordPopupEnabled));
      form.append('discordBotEnabled', String(!!settings.discordBotEnabled));
      if (settings.discordBotToken !== undefined) form.append('discordBotToken', settings.discordBotToken || '');
      if (settings.discordUtrChannelId !== undefined) form.append('discordUtrChannelId', settings.discordUtrChannelId || '');
      if (settings.discordTicketChannelId !== undefined) form.append('discordTicketChannelId', settings.discordTicketChannelId || '');
      if (settings.discordPingRoleId !== undefined) form.append('discordPingRoleId', settings.discordPingRoleId || '');
      if (imageFile) form.append('image', imageFile);

      await api.put('/admin/site/settings', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Settings saved');
      setImageFile(null);
      setImagePreview(null);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold">Site Settings</h1>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* General */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-white/10 pb-2">General</h2>
          <Input
            label="Site Name"
            value={settings.siteName || ''}
            onChange={(e) => handleChange('siteName', e.target.value)}
          />
          <Input
            label="Hero Title"
            value={settings.heroTitle || ''}
            onChange={(e) => handleChange('heroTitle', e.target.value)}
          />
          <Input
            label="Hero Subtitle"
            value={settings.heroSubtitle || ''}
            onChange={(e) => handleChange('heroSubtitle', e.target.value)}
          />
        </div>

        {/* Images */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-white/10 pb-2">Branding &amp; Images</h2>
          <Input
            label="Favicon URL"
            value={settings.faviconPath || ''}
            onChange={(e) => handleChange('faviconPath', e.target.value)}
            placeholder="/uploads/favicon.ico or https://..."
          />
          <Input
            label="Logo URL"
            value={settings.logoPath || ''}
            onChange={(e) => handleChange('logoPath', e.target.value)}
            placeholder="/uploads/logo.png or https://..."
          />
          <Input
            label="Logo ALT Text"
            value={settings.logoAlt || ''}
            onChange={(e) => handleChange('logoAlt', e.target.value)}
            placeholder="Accessible logo description"
          />

          {/* Background Image Upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Background Image</label>
            {(imagePreview || settings.backgroundImage) && (
              <div className="relative mb-3 aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-white/10">
                <img
                  src={imagePreview || settings.backgroundImage || ''}
                  alt="Background preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {settings.backgroundImage ? 'Change Image' : 'Upload Image'}
            </Button>
            {settings.backgroundImage && !imageFile && (
              <p className="mt-1 text-xs text-gray-500">Current: {settings.backgroundImage}</p>
            )}
          </div>

          <Input
            label="Background Overlay Opacity (0-1)"
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={String(settings.backgroundOverlayOpacity ?? 0.5)}
            onChange={(e) => handleChange('backgroundOverlayOpacity', parseFloat(e.target.value) || 0)}
          />
          <Input
            label="Background Image ALT Text"
            value={settings.backgroundImageAlt || ''}
            onChange={(e) => handleChange('backgroundImageAlt', e.target.value)}
            placeholder="Describe background image content"
          />
        </div>

        {/* Discord */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-white/10 pb-2">Discord</h2>
          <Input
            label="Discord Invite URL"
            value={settings.discordInviteUrl || ''}
            onChange={(e) => handleChange('discordInviteUrl', e.target.value)}
            placeholder="https://discord.gg/..."
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.discordPopupEnabled}
              onChange={(e) => handleChange('discordPopupEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]"
            />
            <span className="text-sm text-gray-300">Show Discord join popup on login page</span>
          </label>
        </div>

        {/* Discord Bot */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-white/10 pb-2">Discord Bot</h2>
          <p className="text-xs text-gray-500">
            Configure a Discord bot to receive UTR payment notifications (with Approve / Reject buttons) and ticket alerts directly in your server.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.discordBotEnabled}
              onChange={(e) => handleChange('discordBotEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]"
            />
            <span className="text-sm text-gray-300">Enable Discord Bot</span>
          </label>
          <Input
            label="Bot Token"
            type="password"
            value={settings.discordBotToken || ''}
            onChange={(e) => handleChange('discordBotToken', e.target.value)}
            placeholder="Bot token from Discord Developer Portal"
          />
          <Input
            label="UTR Payment Channel ID"
            value={settings.discordUtrChannelId || ''}
            onChange={(e) => handleChange('discordUtrChannelId', e.target.value)}
            placeholder="Channel ID for payment notifications"
          />
          <Input
            label="Ticket Notification Channel ID"
            value={settings.discordTicketChannelId || ''}
            onChange={(e) => handleChange('discordTicketChannelId', e.target.value)}
            placeholder="Channel ID for ticket notifications"
          />
          <Input
            label="Ping Role ID (optional)"
            value={settings.discordPingRoleId || ''}
            onChange={(e) => handleChange('discordPingRoleId', e.target.value)}
            placeholder="Role ID to ping on new events"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={async () => {
              try {
                await api.post('/admin/discord-bot/reconnect');
                toast.success('Discord bot reconnection triggered');
              } catch {
                toast.error('Failed to reconnect bot');
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reconnect Bot
          </Button>
        </div>

        {/* Maintenance */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-white/10 pb-2">Advanced</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.maintenanceMode}
              onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]"
            />
            <span className="text-sm text-gray-300">Maintenance Mode</span>
          </label>
        </div>

        <Button onClick={save} className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
