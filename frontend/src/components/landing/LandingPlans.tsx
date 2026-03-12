'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CoinPlan {
  id: number;
  name: string;
  category: string;
  ram: number;
  cpu: number;
  storage: number;
  coinPrice: number;
  initialPrice: number;
  renewalPrice: number;
  durationType: string;
  durationDays: number;
  backupCount: number;
  extraPorts: number;
  swap: number;
}

interface RealPlan {
  id: number;
  name: string;
  category: string;
  ram: number;
  cpu: number;
  storage: number;
  price: number;
  durationType: string;
  durationDays: number;
  backupCount: number;
  extraPorts: number;
  swap: number;
}

function fmtGB(val: number) {
  return val < 1 ? `${Math.round(val * 1024)} MB` : `${val} GB`;
}

function durationLabel(days: number) {
  if (days >= 365) return '/yr';
  if (days >= 30) return '/mo';
  if (days >= 7) return '/wk';
  return `/${days}d`;
}

type Tab = 'free' | 'paid';

export function LandingPlans() {
  const [coinPlans, setCoinPlans] = useState<CoinPlan[]>([]);
  const [realPlans, setRealPlans] = useState<RealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('free');

  useEffect(() => {
    api.get<{ coin: CoinPlan[]; real: RealPlan[] }>('/site/landing-plans').then((r) => {
      setCoinPlans(r.data.coin || []);
      setRealPlans(r.data.real || []);
      // Default to whichever tab has plans
      if ((r.data.coin || []).length === 0 && (r.data.real || []).length > 0) setTab('paid');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="plans" className="relative py-16 sm:py-24">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#ff7a18]" />
        </div>
      </section>
    );
  }

  if (!coinPlans.length && !realPlans.length) return null;

  const plans = tab === 'free' ? coinPlans : realPlans;

  return (
    <section id="plans" className="relative py-16 sm:py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#ff7a18]/[0.04] blur-[150px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
            Pricing
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Simple, transparent{' '}
            <span className="text-gradient">pricing</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            No hidden fees. Pick a plan and deploy in seconds.
          </p>

          {/* Tabs */}
          {coinPlans.length > 0 && realPlans.length > 0 && (
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-gray-800 bg-[#161616] p-1">
              <button
                onClick={() => setTab('free')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all',
                  tab === 'free'
                    ? 'bg-[#ff7a18] text-white shadow-lg shadow-[#ff7a18]/20'
                    : 'text-gray-400 hover:text-white',
                )}
              >
                Free (Coins)
              </button>
              <button
                onClick={() => setTab('paid')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all',
                  tab === 'paid'
                    ? 'bg-[#ff7a18] text-white shadow-lg shadow-[#ff7a18]/20'
                    : 'text-gray-400 hover:text-white',
                )}
              >
                Paid (INR)
              </button>
            </div>
          )}

          {/* Single type indicator */}
          {coinPlans.length > 0 && realPlans.length === 0 && (
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-gray-800 bg-[#161616] px-5 py-2 text-sm">
              <span className="font-medium text-white">Free Plans</span>
              <span className="text-gray-500">Coin billing</span>
            </div>
          )}
          {realPlans.length > 0 && coinPlans.length === 0 && (
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-gray-800 bg-[#161616] px-5 py-2 text-sm">
              <span className="font-medium text-white">Paid Plans</span>
              <span className="text-gray-500">INR billing</span>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className={`mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 ${
          plans.length >= 3 ? 'lg:grid-cols-3' : ''
        }`}>
          {plans.map((plan, i) => {
            const featured = plans.length >= 3 ? i === Math.floor(plans.length / 2) : i === 0;
            const isCoin = tab === 'free';
            const coinPlan = plan as CoinPlan;
            const isFreeStart = isCoin && coinPlan.initialPrice === 0;
            const renewalCoins = isCoin ? (coinPlan.renewalPrice || coinPlan.coinPrice) : 0;

            return (
              <div
                key={plan.id}
                className={`group relative flex flex-col rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                  featured
                    ? 'border-[#ff7a18]/40 bg-[#161616] shadow-lg shadow-[#ff7a18]/10 sm:scale-[1.03]'
                    : 'border-gray-800 bg-[#161616] hover:border-gray-700 hover:shadow-lg'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff7a18] to-orange-500 px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-[#ff7a18]/25">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-400 capitalize">{plan.category}</p>

                <p className="mt-6">
                  <span className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                    {isFreeStart ? 'Free' : isCoin ? `${coinPlan.initialPrice || coinPlan.coinPrice} Coins` : `₹${(plan as RealPlan).price.toFixed(2)}`}
                  </span>
                  <span className="ml-1 text-base font-normal text-gray-500">
                    {isFreeStart ? 'to start' : durationLabel(plan.durationDays)}
                  </span>
                </p>
                {isFreeStart && (
                  <p className="mt-1 text-sm text-gray-500">
                    then {renewalCoins} Coins{durationLabel(plan.durationDays)} after
                  </p>
                )}

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  {[
                    `${fmtGB(plan.ram)} RAM`,
                    `${plan.cpu}% CPU`,
                    `${fmtGB(plan.storage)} Disk`,
                    plan.swap > 0 ? `${fmtGB(plan.swap)} Swap` : null,
                    plan.backupCount > 0 ? `${plan.backupCount} Backup${plan.backupCount > 1 ? 's' : ''}` : null,
                    plan.extraPorts > 0 ? `${plan.extraPorts} Extra Port${plan.extraPorts > 1 ? 's' : ''}` : null,
                    'DDoS Protection',
                    'Full Panel Access',
                  ].filter(Boolean).map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#ff7a18]" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <Link
                    href="/login"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 ${
                      featured
                        ? 'bg-gradient-to-r from-[#ff7a18] to-orange-500 text-white shadow-lg shadow-[#ff7a18]/20 hover:from-[#ff8c3a] hover:to-orange-400 hover:shadow-[#ff7a18]/40'
                        : 'border border-gray-700 bg-white/5 text-gray-200 hover:border-gray-600 hover:bg-white/10'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
