'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Coupon {
  id: number;
  code: string;
  discountPercent: number | null;
  discountCoins: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface FormValues {
  code: string;
  discountPercent: string;
  discountCoins: string;
  maxUses: string;
  expiresAt: string;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [creating, setCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    api.get<Coupon[]>('/admin/coupons').then((r) => setCoupons(r.data)).catch(() => toast.error('Failed to load coupons'));
  }, []);

  async function onSubmit(data: FormValues) {
    try {
      const payload = {
        code: data.code,
        discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
        discountCoins: data.discountCoins ? Number(data.discountCoins) : null,
        maxUses: data.maxUses ? Number(data.maxUses) : null,
        expiresAt: data.expiresAt || null,
      };
      const r = await api.post<Coupon>('/admin/coupons', payload);
      setCoupons((prev) => [r.data, ...prev]);
      toast.success('Coupon created');
      setCreating(false);
      reset();
    } catch {
      toast.error('Failed to create coupon');
    }
  }

  async function deleteCoupon(id: number) {
    try {
      await api.delete(`/admin/coupons/${id}`);
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      toast.success('Coupon deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <Button size="sm" onClick={() => { setCreating(!creating); reset(); }}>
          {creating ? 'Cancel' : '+ New Coupon'}
        </Button>
      </div>

      {creating && (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
          <Input label="Code" placeholder="SUMMER20" {...register('code', { required: true })} />
          <Input label="Discount %" type="number" placeholder="e.g. 20" {...register('discountPercent')} />
          <Input label="Discount Coins" type="number" placeholder="e.g. 500" {...register('discountCoins')} />
          <Input label="Max Uses (blank = unlimited)" type="number" {...register('maxUses')} />
          <Input label="Expires At (optional)" type="datetime-local" {...register('expiresAt')} />
          <div className="col-span-2">
            <Button type="submit">Create</Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs text-gray-400">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount %</th>
              <th className="px-4 py-3">Discount Coins</th>
              <th className="px-4 py-3">Uses</th>
              <th className="px-4 py-3">Max Uses</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {coupons.map((c) => (
              <tr key={c.id} className="hover:bg-white/5">
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3">{c.discountPercent ?? '—'}</td>
                <td className="px-4 py-3">{c.discountCoins ?? '—'}</td>
                <td className="px-4 py-3">{c.usedCount}</td>
                <td className="px-4 py-3">{c.maxUses ?? '∞'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={c.isActive ? 'text-green-400' : 'text-gray-400'}>{c.isActive ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(c.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCoupon(deleteTarget)}
        title="Delete Coupon"
        message="Are you sure you want to delete this coupon?"
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </div>
  );
}
