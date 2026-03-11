'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { cn } from '@/lib/cn';
import {
  Package, Server, Sword, Bot, Gamepad2, Rocket, Shield, Zap, Globe, Cloud,
  Database, Cpu, HardDrive, MemoryStick, Flame, Crown, Star, Heart, Gem, Sparkles,
} from 'lucide-react';

/* ── Icon picker ────────────────────────────────────────────────────────────── */

const ICON_OPTIONS = [
  { name: 'Package', Icon: Package },
  { name: 'Server', Icon: Server },
  { name: 'Sword', Icon: Sword },
  { name: 'Bot', Icon: Bot },
  { name: 'Gamepad2', Icon: Gamepad2 },
  { name: 'Rocket', Icon: Rocket },
  { name: 'Shield', Icon: Shield },
  { name: 'Zap', Icon: Zap },
  { name: 'Globe', Icon: Globe },
  { name: 'Cloud', Icon: Cloud },
  { name: 'Database', Icon: Database },
  { name: 'Cpu', Icon: Cpu },
  { name: 'HardDrive', Icon: HardDrive },
  { name: 'MemoryStick', Icon: MemoryStick },
  { name: 'Flame', Icon: Flame },
  { name: 'Crown', Icon: Crown },
  { name: 'Star', Icon: Star },
  { name: 'Heart', Icon: Heart },
  { name: 'Gem', Icon: Gem },
  { name: 'Sparkles', Icon: Sparkles },
];

function getIconComponent(name: string | null | undefined) {
  return ICON_OPTIONS.find((i) => i.name === name)?.Icon ?? Package;
}

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface CoinPlan {
  id: number;
  name: string;
  icon: string | null;
  category: string;
  ram: number;
  cpu: number;
  storage: number;
  coinPrice: number;
  initialPrice: number;
  renewalPrice: number;
  durationType: string;
  durationDays: number;
  limitedStock: boolean;
  stockAmount: number | null;
  oneTimePurchase: boolean;
  backupCount: number;
  extraPorts: number;
  swap: number;
}

interface RealPlan {
  id: number;
  name: string;
  icon: string | null;
  category: string;
  ram: number;
  cpu: number;
  storage: number;
  price: number;
  durationType: string;
  durationDays: number;
  limitedStock: boolean;
  stockAmount: number | null;
  backupCount: number;
  extraPorts: number;
  swap: number;
}

type TabType = 'coin' | 'real';

/* ── Defaults ──────────────────────────────────────────────────────────────── */

const COIN_DEFAULTS: Omit<CoinPlan, 'id'> = {
  name: '', icon: 'Package', category: 'minecraft',
  ram: 2, cpu: 100, storage: 5,
  coinPrice: 100, initialPrice: 0, renewalPrice: 0,
  durationType: 'monthly', durationDays: 30,
  limitedStock: false, stockAmount: null,
  oneTimePurchase: false, backupCount: 0, extraPorts: 0, swap: 0,
};

const REAL_DEFAULTS: Omit<RealPlan, 'id'> = {
  name: '', icon: 'Server', category: 'minecraft',
  ram: 2, cpu: 100, storage: 5,
  price: 5,
  durationType: 'monthly', durationDays: 30,
  limitedStock: false, stockAmount: null,
  backupCount: 0, extraPorts: 0, swap: 0,
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const sel = 'w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function AdminPlansPage() {
  const [tab, setTab] = useState<TabType>('coin');
  const [coinPlans, setCoinPlans] = useState<CoinPlan[]>([]);
  const [realPlans, setRealPlans] = useState<RealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoin, setEditingCoin] = useState<CoinPlan | null>(null);
  const [editingReal, setEditingReal] = useState<RealPlan | null>(null);
  const [coinForm, setCoinForm] = useState(COIN_DEFAULTS);
  const [realForm, setRealForm] = useState(REAL_DEFAULTS);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'coin' | 'real'; id: number } | null>(null);

  useEffect(() => {
    api.get<{ coin: CoinPlan[]; real: RealPlan[] }>('/plans')
      .then((r) => {
        setCoinPlans(r.data.coin);
        setRealPlans(r.data.real);
      })
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  /* ── Actions ───────────────────────────────── */

  function openCreate() {
    setEditingCoin(null);
    setEditingReal(null);
    setCoinForm(COIN_DEFAULTS);
    setRealForm(REAL_DEFAULTS);
    setFormOpen(true);
  }

  function openEditCoin(p: CoinPlan) {
    setTab('coin');
    setEditingCoin(p);
    setEditingReal(null);
    setCoinForm({ ...p });
    setFormOpen(true);
  }

  function openEditReal(p: RealPlan) {
    setTab('real');
    setEditingReal(p);
    setEditingCoin(null);
    setRealForm({ ...p });
    setFormOpen(true);
  }

  async function saveCoin() {
    try {
      const body = {
        ...coinForm,
        stockAmount: coinForm.limitedStock ? (coinForm.stockAmount ?? 0) : null,
      };
      if (editingCoin) {
        const r = await api.put<CoinPlan>(`/admin/plans/coin/${editingCoin.id}`, body);
        setCoinPlans((prev) => prev.map((p) => (p.id === editingCoin.id ? r.data : p)));
        toast.success('Coin plan updated');
      } else {
        const r = await api.post<CoinPlan>('/admin/plans/coin', body);
        setCoinPlans((prev) => [...prev, r.data]);
        toast.success('Coin plan created');
      }
      setFormOpen(false);
    } catch {
      toast.error('Failed to save coin plan');
    }
  }

  async function saveReal() {
    try {
      const body = {
        ...realForm,
        stockAmount: realForm.limitedStock ? (realForm.stockAmount ?? 0) : null,
      };
      if (editingReal) {
        const r = await api.put<RealPlan>(`/admin/plans/real/${editingReal.id}`, body);
        setRealPlans((prev) => prev.map((p) => (p.id === editingReal.id ? r.data : p)));
        toast.success('Real plan updated');
      } else {
        const r = await api.post<RealPlan>('/admin/plans/real', body);
        setRealPlans((prev) => [...prev, r.data]);
        toast.success('Real plan created');
      }
      setFormOpen(false);
    } catch {
      toast.error('Failed to save real plan');
    }
  }

  async function deleteCoin(id: number) {
    try {
      await api.delete(`/admin/plans/coin/${id}`);
      setCoinPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success('Coin plan deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  }

  async function deleteReal(id: number) {
    try {
      await api.delete(`/admin/plans/real/${id}`);
      setRealPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success('Real plan deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  }

  /* ── Render ────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <Button size="sm" onClick={openCreate}>+ New Plan</Button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-gray-900 p-1 w-fit">
        {(['coin', 'real'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-5 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-[#ff7a18] text-white' : 'text-gray-400 hover:text-white',
            )}
          >
            {t === 'coin' ? 'Coin Plans' : 'Real Plans (USD)'}
          </button>
        ))}
      </div>

      {/* ────────────────── FORM ────────────────── */}
      {formOpen && tab === 'coin' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
          <h2 className="text-lg font-semibold">{editingCoin ? 'Edit Coin Plan' : 'New Coin Plan'}</h2>

          {/* Icon picker */}
          <Field label="Icon">
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCoinForm((f) => ({ ...f, icon: name }))}
                  className={cn(
                    'rounded-lg p-2 border transition-colors',
                    coinForm.icon === name
                      ? 'border-[#ff7a18] bg-[#ff7a18]/10 text-[#ff7a18]'
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20',
                  )}
                  title={name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Name" value={coinForm.name} onChange={(e) => setCoinForm((f) => ({ ...f, name: e.target.value }))} />
            <Field label="Category">
              <select className={sel} value={coinForm.category} onChange={(e) => setCoinForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="minecraft">Minecraft</option>
                <option value="bot">Bot / Discord</option>
              </select>
            </Field>
            <Field label="Duration Type">
              <select className={sel} value={coinForm.durationType} onChange={(e) => setCoinForm((f) => ({ ...f, durationType: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="days">Custom Days</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </Field>
            <Input label="Duration (days)" type="number" min={1} value={coinForm.durationDays} onChange={(e) => setCoinForm((f) => ({ ...f, durationDays: +e.target.value }))} />
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-semibold text-[#ff7a18] uppercase tracking-wide mb-3">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Coin Price" type="number" min={0} value={coinForm.coinPrice} onChange={(e) => setCoinForm((f) => ({ ...f, coinPrice: +e.target.value }))} />
              <Input label="Initial Price (coins)" type="number" min={0} value={coinForm.initialPrice} onChange={(e) => setCoinForm((f) => ({ ...f, initialPrice: +e.target.value }))} />
              <Input label="Renewal Price (coins)" type="number" min={0} value={coinForm.renewalPrice} onChange={(e) => setCoinForm((f) => ({ ...f, renewalPrice: +e.target.value }))} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Initial Price = first purchase. Renewal Price = each renewal. Coin Price = legacy/fallback price.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-[#ff7a18] uppercase tracking-wide mb-3">Resources</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="RAM (GB)" type="number" min={0.5} step={0.5} value={coinForm.ram} onChange={(e) => setCoinForm((f) => ({ ...f, ram: +e.target.value }))} />
              <Input label="CPU (%)" type="number" min={10} step={10} value={coinForm.cpu} onChange={(e) => setCoinForm((f) => ({ ...f, cpu: +e.target.value }))} />
              <Input label="Storage (GB)" type="number" min={1} step={1} value={coinForm.storage} onChange={(e) => setCoinForm((f) => ({ ...f, storage: +e.target.value }))} />
              <Field label="Swap (MB)" hint="Subtracted from total RAM. E.g. 3 GB RAM + 512 MB swap = 2.5 GB real + 512 MB swap = 3 GB total.">
                <input className={sel} type="number" min={0} step={128} value={coinForm.swap} onChange={(e) => setCoinForm((f) => ({ ...f, swap: +e.target.value }))} />
              </Field>
              <Input label="Backup Slots" type="number" min={0} value={coinForm.backupCount} onChange={(e) => setCoinForm((f) => ({ ...f, backupCount: +e.target.value }))} />
              <Input label="Extra Ports" type="number" min={0} value={coinForm.extraPorts} onChange={(e) => setCoinForm((f) => ({ ...f, extraPorts: +e.target.value }))} />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[#ff7a18] rounded" checked={coinForm.oneTimePurchase} onChange={(e) => setCoinForm((f) => ({ ...f, oneTimePurchase: e.target.checked }))} />
              <span className="text-sm text-gray-300">One-Time Purchase</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[#ff7a18] rounded" checked={coinForm.limitedStock} onChange={(e) => setCoinForm((f) => ({ ...f, limitedStock: e.target.checked }))} />
              <span className="text-sm text-gray-300">Limited Stock</span>
            </label>
            {coinForm.limitedStock && (
              <Input label="Stock Amount" type="number" min={0} value={coinForm.stockAmount ?? 0} onChange={(e) => setCoinForm((f) => ({ ...f, stockAmount: +e.target.value }))} />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveCoin}>{editingCoin ? 'Update Plan' : 'Create Plan'}</Button>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {formOpen && tab === 'real' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
          <h2 className="text-lg font-semibold">{editingReal ? 'Edit Real Plan' : 'New Real Plan'}</h2>

          {/* Icon picker */}
          <Field label="Icon">
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setRealForm((f) => ({ ...f, icon: name }))}
                  className={cn(
                    'rounded-lg p-2 border transition-colors',
                    realForm.icon === name
                      ? 'border-[#ff7a18] bg-[#ff7a18]/10 text-[#ff7a18]'
                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20',
                  )}
                  title={name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Name" value={realForm.name} onChange={(e) => setRealForm((f) => ({ ...f, name: e.target.value }))} />
            <Field label="Category">
              <select className={sel} value={realForm.category} onChange={(e) => setRealForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="minecraft">Minecraft</option>
                <option value="bot">Bot / Discord</option>
              </select>
            </Field>
            <Input label="Price (USD)" type="number" min={0} step={0.01} value={realForm.price} onChange={(e) => setRealForm((f) => ({ ...f, price: +e.target.value }))} />
            <Field label="Duration Type">
              <select className={sel} value={realForm.durationType} onChange={(e) => setRealForm((f) => ({ ...f, durationType: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="days">Custom Days</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </Field>
            <Input label="Duration (days)" type="number" min={1} value={realForm.durationDays} onChange={(e) => setRealForm((f) => ({ ...f, durationDays: +e.target.value }))} />
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-[#ff7a18] uppercase tracking-wide mb-3">Resources</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="RAM (GB)" type="number" min={0.5} step={0.5} value={realForm.ram} onChange={(e) => setRealForm((f) => ({ ...f, ram: +e.target.value }))} />
              <Input label="CPU (%)" type="number" min={10} step={10} value={realForm.cpu} onChange={(e) => setRealForm((f) => ({ ...f, cpu: +e.target.value }))} />
              <Input label="Storage (GB)" type="number" min={1} step={1} value={realForm.storage} onChange={(e) => setRealForm((f) => ({ ...f, storage: +e.target.value }))} />
              <Field label="Swap (MB)" hint="Subtracted from total RAM. E.g. 3 GB RAM + 512 MB swap = 2.5 GB real + 512 MB swap.">
                <input className={sel} type="number" min={0} step={128} value={realForm.swap} onChange={(e) => setRealForm((f) => ({ ...f, swap: +e.target.value }))} />
              </Field>
              <Input label="Backup Slots" type="number" min={0} value={realForm.backupCount} onChange={(e) => setRealForm((f) => ({ ...f, backupCount: +e.target.value }))} />
              <Input label="Extra Ports" type="number" min={0} value={realForm.extraPorts} onChange={(e) => setRealForm((f) => ({ ...f, extraPorts: +e.target.value }))} />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[#ff7a18] rounded" checked={realForm.limitedStock} onChange={(e) => setRealForm((f) => ({ ...f, limitedStock: e.target.checked }))} />
              <span className="text-sm text-gray-300">Limited Stock</span>
            </label>
            {realForm.limitedStock && (
              <Input label="Stock Amount" type="number" min={0} value={realForm.stockAmount ?? 0} onChange={(e) => setRealForm((f) => ({ ...f, stockAmount: +e.target.value }))} />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveReal}>{editingReal ? 'Update Plan' : 'Create Plan'}</Button>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ────────────────── PLAN LIST ────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
          ))}
        </div>
      ) : tab === 'coin' ? (
        coinPlans.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No coin plans yet. Create one above.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coinPlans.map((p) => {
              const PlanIcon = getIconComponent(p.icon);
              return (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 hover:border-[#ff7a18]/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[#ff7a18]/10 p-2.5">
                        <PlanIcon className="h-5 w-5 text-[#ff7a18]" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <span className="text-xs text-gray-500 capitalize">{p.category}</span>
                      </div>
                    </div>
                    {p.oneTimePurchase && (
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 uppercase">One-time</span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-yellow-400">{p.coinPrice}</span>
                    <span className="text-xs text-gray-500">coins / {p.durationDays}d</span>
                  </div>
                  {(p.initialPrice > 0 || p.renewalPrice > 0) && (
                    <div className="flex gap-3 text-xs text-gray-400">
                      {p.initialPrice > 0 && <span>Initial: <strong className="text-white">{p.initialPrice}</strong></span>}
                      {p.renewalPrice > 0 && <span>Renewal: <strong className="text-white">{p.renewalPrice}</strong></span>}
                    </div>
                  )}

                  {/* Resources */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.ram} GB</span><br /><span className="text-gray-500">RAM</span></div>
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.cpu}%</span><br /><span className="text-gray-500">CPU</span></div>
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.storage} GB</span><br /><span className="text-gray-500">Storage</span></div>
                  </div>

                  {/* Extra features */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {p.swap > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">Swap: {p.swap} MB</span>}
                    {p.backupCount > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">Backups: {p.backupCount}</span>}
                    {p.extraPorts > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">+{p.extraPorts} ports</span>}
                    {p.limitedStock && <span className="rounded-full border border-orange-500/30 px-2 py-0.5 text-orange-400">{p.stockAmount ?? 0} left</span>}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => openEditCoin(p)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: 'coin', id: p.id })}>Delete</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        realPlans.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No real plans yet. Create one above.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realPlans.map((p) => {
              const PlanIcon = getIconComponent(p.icon);
              return (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 hover:border-[#ff7a18]/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-green-500/10 p-2.5">
                        <PlanIcon className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <span className="text-xs text-gray-500 capitalize">{p.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-green-400">${p.price.toFixed(2)}</span>
                    <span className="text-xs text-gray-500">/ {p.durationDays}d</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.ram} GB</span><br /><span className="text-gray-500">RAM</span></div>
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.cpu}%</span><br /><span className="text-gray-500">CPU</span></div>
                    <div className="rounded-lg bg-white/[0.04] py-1.5"><span className="font-semibold">{p.storage} GB</span><br /><span className="text-gray-500">Storage</span></div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {p.swap > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">Swap: {p.swap} MB</span>}
                    {p.backupCount > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">Backups: {p.backupCount}</span>}
                    {p.extraPorts > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-400">+{p.extraPorts} ports</span>}
                    {p.limitedStock && <span className="rounded-full border border-orange-500/30 px-2 py-0.5 text-orange-400">{p.stockAmount ?? 0} left</span>}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => openEditReal(p)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: 'real', id: p.id })}>Delete</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'coin') deleteCoin(deleteTarget.id);
          else if (deleteTarget?.type === 'real') deleteReal(deleteTarget.id);
        }}
        title="Delete Plan"
        message="Delete this plan? Existing servers using it will NOT be affected."
        confirmLabel="Delete Plan"
        confirmVariant="destructive"
      />
    </div>
  );
}
