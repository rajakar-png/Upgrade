'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PlanCard } from '@/components/plans/PlanCard';
import { PurchaseModal } from '@/components/servers/PurchaseModal';
import { cn } from '@/lib/cn';

const CATEGORIES = ['minecraft', 'bot'] as const;
const PLAN_TYPES = [
  { key: 'coin', label: 'Coin Plans' },
  { key: 'real', label: 'Real Plans' },
] as const;

export default function PlansPage() {
  const [plans, setPlans] = useState<any>({ coin: [], real: [] });
  const [category, setCategory] = useState<'minecraft' | 'bot'>('minecraft');
  const [planType, setPlanType] = useState<'coin' | 'real'>('coin');
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    api.get('/plans').then((r) => setPlans(r.data)).finally(() => setLoading(false));
  }, []);

  const displayed = (plans[planType] as any[]).filter(
    (p) => p.category === category,
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Choose a Plan</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-lg bg-gray-900 p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                category === c ? 'bg-[#ff7a18] text-white' : 'text-gray-400 hover:text-white',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-gray-900 p-1">
          {PLAN_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPlanType(key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                planType === key ? 'bg-[#ff7a18] text-white' : 'text-gray-400 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((plan) => (
            <PlanCard key={plan.id} plan={plan} planType={planType} onPurchase={setSelectedPlan} />
          ))}
        </div>
      )}

      <PurchaseModal
        open={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        plan={selectedPlan}
        planType={planType}
        category={category}
      />
    </div>
  );
}
