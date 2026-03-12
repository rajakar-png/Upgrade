'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, Server, ArrowUpRight, Clock } from 'lucide-react';

const ICONS = [Users, Server, ArrowUpRight, Clock];

export function LandingStats() {
  const [stats, setStats] = useState([
    { value: '0', label: 'Active Users', desc: 'Registered users on the platform' },
    { value: '0', label: 'Active Servers', desc: 'Running servers right now' },
    { value: '99.9%', label: 'Uptime', desc: 'Enterprise-grade reliability' },
    { value: '24/7', label: 'Support', desc: 'Always here to help' },
  ]);

  useEffect(() => {
    api.get('/site/public-stats').then((r) => {
      const d = r.data;
      setStats([
        { value: String(d.activeUsers ?? 0), label: 'Active Users', desc: 'Registered users on the platform' },
        { value: String(d.activeServers ?? 0), label: 'Active Servers', desc: 'Running servers right now' },
        { value: d.uptime || '99.9%', label: 'Uptime', desc: 'Enterprise-grade reliability' },
        { value: '24/7', label: 'Support', desc: 'Always here to help' },
      ]);
    }).catch(() => {});
  }, []);

  return (
    <section className="relative py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {stats.map((stat, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={stat.label}
                className="group relative rounded-xl border border-gray-800 bg-[#161616] p-4 text-center shadow-lg transition-all duration-300 hover:scale-105 hover:border-[#ff7a18]/30 hover:shadow-[#ff7a18]/10 sm:p-6"
              >
                <div className="absolute inset-0 rounded-xl bg-[#ff7a18]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7a18]/10 sm:mb-4 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 text-[#ff7a18]" />
                  </div>
                  <p className="text-xl font-bold tracking-tight text-white sm:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-sm font-medium text-gray-300">{stat.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{stat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
