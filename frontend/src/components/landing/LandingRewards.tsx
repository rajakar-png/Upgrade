'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Coins, Clock, Gift, Zap } from 'lucide-react';

const defaultRewards = [
  {
    title: 'Stay Online',
    description: 'Earn coins passively just by keeping AstraNodes open in your browser.',
    coins: '+5/hr',
  },
  {
    title: 'Daily Rewards',
    description: 'Claim bonus coins every day. Streak bonuses for consecutive logins.',
    coins: '+50/day',
  },
  {
    title: 'Redeem for Time',
    description: 'Convert your earned coins into server hosting time. Free hosting is real.',
    coins: 'Redeem',
  },
];

const ICONS = [Clock, Gift, Zap];

const defaultSection = {
  sectionTitle: 'Earn Coins While You Stay Online',
  sectionSubtitle: 'AstraNodes rewards active users with coins that can be redeemed for free server hosting time. The more you engage, the more you save.',
};

export function LandingRewards() {
  const [rewards, setRewards] = useState(defaultRewards);
  const [section, setSection] = useState(defaultSection);

  useEffect(() => {
    api.get('/site/frontpage/rewards').then((r) => {
      if (r.data) {
        if (r.data.items?.length) setRewards(r.data.items);
        if (r.data.sectionTitle) setSection({ sectionTitle: r.data.sectionTitle, sectionSubtitle: r.data.sectionSubtitle || '' });
      }
    }).catch(() => {});
  }, []);

  return (
    <section className="relative py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#ff7a18]/[0.05] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left - Content */}
          <div>
            <span className="mb-4 inline-block rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
              Rewards
            </span>

            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              {section.sectionTitle}
            </h2>

            <p className="mt-4 text-gray-400">
              {section.sectionSubtitle}
            </p>

            {/* Coin balance mockup */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/5 px-6 py-3">
              <Coins className="h-8 w-8 text-[#ff7a18]" />
              <div>
                <p className="text-xs text-gray-500">Your Balance</p>
                <p className="text-2xl font-bold text-white">1,250 <span className="text-sm text-[#ff7a18]">coins</span></p>
              </div>
            </div>
          </div>

          {/* Right - Reward cards */}
          <div className="space-y-4">
            {rewards.map((r, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <div
                  key={r.title}
                  className="group flex items-center gap-3 rounded-xl border border-gray-800 bg-[#161616] p-3 transition-all duration-300 hover:border-[#ff7a18]/30 hover:shadow-lg hover:shadow-[#ff7a18]/5 sm:gap-5 sm:p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a18]/10 transition-colors group-hover:bg-[#ff7a18]/20 sm:h-12 sm:w-12">
                    <Icon className="h-6 w-6 text-[#ff7a18]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{r.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{r.description}</p>
                  </div>
                  <div className="rounded-full bg-[#ff7a18]/10 px-3 py-1 text-sm font-semibold text-[#ff7a18]">
                    {r.coins}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
