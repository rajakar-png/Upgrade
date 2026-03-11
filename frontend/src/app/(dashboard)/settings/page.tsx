'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, { message: 'Passwords must match', path: ['confirm'] });
type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setSaving(true);
    try {
      await api.post('/auth/reset-password', { newPassword: data.newPassword });
      toast.success('Password updated');
      reset();
    } catch {
      toast.error('Failed to update password');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your profile and security.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <div className="space-y-2 text-sm">
          <p><span className="text-gray-400">Email: </span>{user.email}</p>
          <p><span className="text-gray-400">Role: </span>{user.role}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Change Password</h2>
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}
