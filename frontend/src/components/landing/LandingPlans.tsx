'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Check } from 'lucide-react';

interface LandingPlan {
  id: number;
  name: string;
  description: string | null;
  priceUsd: number;
  duration: number;
  ram: number;
  cpu: number;
  disk: number;
  tag: string | null;
}

const fallbackPlans: LandingPlan[] = [
  { id: 1, name: 'Starter', description: 'Perfect for small servers', priceUsd: 2, duration: 30, ram: 2048, cpu: 100, disk: 10240, tag: null },
  { id: 2, name: 'Pro', description: 'For growing communities', priceUsd: 6, duration: 30, ram: 6144, cpu: 200, disk: 25600, tag: 'Most Popular' },
  { id: 3, name: 'Elite', description: 'Maximum performance', priceUsd: 12, duration: 30, ram: 12288, cpu: 400, disk: 51200, tag: null },
];

function fmtMB(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
}

export function LandingPlans() {
  const [plans, setPlans] = useState<LandingPlan[]>(fallbackPlans);

  useEffect(() => {
    api.get<LandingPlan[]>('/site/landing-plans').then((r) => {
      if (r.data.length) setPlans(r.data);
    }).catch(() => {});
  }, []);

  return (
    <section id="plans" className="relative py-24">
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

          {/* Monthly indicator */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-gray-800 bg-[#161616] px-5 py-2 text-sm">
            <span className="font-medium text-white">Monthly</span>
            <span className="text-gray-500">billing</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const featured = !!plan.tag || i === 1;
            return (
              <div
                key={plan.id}
                className={`group relative flex flex-col rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                  featured
                    ? 'border-[#ff7a18]/40 bg-[#161616] shadow-lg shadow-[#ff7a18]/10 scale-[1.03]'
                    : 'border-gray-800 bg-[#161616] hover:border-gray-700 hover:shadow-lg'
                }`}
              >
                {plan.tag && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff7a18] to-orange-500 px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-[#ff7a18]/25">
                    {plan.tag}
                  </span>
                )}

                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-gray-400">{plan.description}</p>
                )}

                <p className="mt-6">
                  <span className="text-4xl font-extrabold tracking-tight text-white">${plan.priceUsd.toFixed(2)}</span>
                  <span className="ml-1 text-base font-normal text-gray-500">/mo</span>
                </p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  {[
                    `${fmtMB(plan.ram)} RAM`,
                    `${plan.cpu}% CPU`,
                    `${fmtMB(plan.disk)} Disk`,
                    'DDoS Protection',
                    'Automated Backups',
                    'Full Panel Access',
                  ].map((item) => (
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
