'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Check, Cpu, HardDrive, MemoryStick, Archive, Network, RefreshCw } from 'lucide-react';

interface CoinPlan {
  id: number;
  name: string;
  icon?: string | null;
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
  icon?: string | null;
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

interface PlanCardProps {
  plan: CoinPlan | RealPlan;
  planType: 'coin' | 'real';
  onPurchase: (plan: CoinPlan | RealPlan) => void;
  purchasing?: boolean;
}

function isCoinPlan(plan: CoinPlan | RealPlan): plan is CoinPlan {
  return 'coinPrice' in plan;
}

export function PlanCard({ plan, planType, onPurchase, purchasing }: PlanCardProps) {
  const inStock = !plan.limitedStock || (plan.stockAmount != null && plan.stockAmount > 0);
  const coin = planType === 'coin' && isCoinPlan(plan);

  return (
    <Card className="flex flex-col gap-4 p-6 hover:border-[#ff7a18]/20">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <div className="flex gap-1.5">
            {coin && (plan as CoinPlan).oneTimePurchase && (
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 uppercase">One-time</span>
            )}
            <span className="rounded-full bg-[#ff7a18]/10 px-2.5 py-0.5 text-xs font-medium text-orange-300 capitalize">
              {plan.category}
            </span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        {coin ? (
          <div>
            <p className="text-3xl font-extrabold tracking-tight">
              <span className="text-yellow-400">{(plan as CoinPlan).initialPrice > 0 ? (plan as CoinPlan).initialPrice : (plan as CoinPlan).coinPrice}</span>
              <span className="ml-1 text-sm font-normal text-gray-500">coins</span>
              {!(plan as CoinPlan).oneTimePurchase && <span className="ml-2 text-sm font-normal text-gray-500">/ {plan.durationDays}d</span>}
            </p>
            {(plan as CoinPlan).renewalPrice > 0 && !(plan as CoinPlan).oneTimePurchase && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <RefreshCw className="h-3 w-3" /> Renews at <strong className="text-white">{(plan as CoinPlan).renewalPrice}</strong> coins
              </p>
            )}
          </div>
        ) : (
          <p className="text-3xl font-extrabold tracking-tight">
            ${(plan as RealPlan).price.toFixed(2)}
            <span className="ml-1 text-sm font-normal text-gray-500">USD</span>
            <span className="ml-2 text-sm font-normal text-gray-500">/ {plan.durationDays}d</span>
          </p>
        )}
      </div>

      {/* Resources */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-3">
          <MemoryStick className="h-3.5 w-3.5 text-[#ff7a18]" />
          <p className="font-semibold">{plan.ram} GB</p>
          <p className="text-gray-500">RAM</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-3">
          <Cpu className="h-3.5 w-3.5 text-green-400" />
          <p className="font-semibold">{plan.cpu}%</p>
          <p className="text-gray-500">CPU</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-3">
          <HardDrive className="h-3.5 w-3.5 text-purple-400" />
          <p className="font-semibold">{plan.storage} GB</p>
          <p className="text-gray-500">Storage</p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-1.5 text-sm text-gray-400">
        {plan.backupCount > 0 && (
          <div className="flex items-center gap-2">
            <Archive className="h-3.5 w-3.5 text-[#ff7a18]" />
            <span>{plan.backupCount} {plan.backupCount === 1 ? 'Backup' : 'Backups'}</span>
          </div>
        )}
        {plan.extraPorts > 0 && (
          <div className="flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-[#ff7a18]" />
            <span>{plan.extraPorts} Extra {plan.extraPorts === 1 ? 'Port' : 'Ports'}</span>
          </div>
        )}
      </div>

      {plan.limitedStock && plan.stockAmount != null && (
        <p className={`text-xs ${plan.stockAmount <= 3 ? 'text-orange-400' : 'text-gray-500'}`}>
          {plan.stockAmount} {plan.stockAmount === 1 ? 'slot' : 'slots'} left
        </p>
      )}

      <Button
        className="mt-auto w-full"
        disabled={!inStock || purchasing}
        onClick={() => inStock && onPurchase(plan)}
      >
        {!inStock ? 'Out of stock' : purchasing ? 'Processing…' : 'Purchase'}
      </Button>
    </Card>
  );
}
