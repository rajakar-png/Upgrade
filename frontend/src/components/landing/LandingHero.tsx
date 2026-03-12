'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULTS = {
  badge: 'Powered by Pterodactyl',
  headingBefore: 'Hosting crafted for',
  headingHighlight: 'Minecraft empires.',
  subtitle: 'Deploy powerful game servers instantly with enterprise infrastructure and gamer-friendly pricing.',
  primaryBtn: 'Deploy Server',
  primaryLink: '/login',
  secondaryBtn: 'View Plans',
  secondaryLink: '#plans',
};

export function LandingHero() {
  const [d, setD] = useState(DEFAULTS);

  useEffect(() => {
    api.get('/site/frontpage/hero').then((r) => {
      if (r.data && typeof r.data === 'object') setD((prev) => ({ ...prev, ...r.data }));
    }).catch(() => {});
  }, []);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-36">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[#ff7a18]/10 blur-[150px] animate-pulse-glow" />
        <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-orange-600/8 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute -bottom-20 left-1/3 h-[400px] w-[400px] rounded-full bg-[#ff7a18]/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,122,24,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,122,24,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div>
            {/* Badge */}
            <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1.5 text-sm text-orange-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff7a18] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff7a18]" />
              </span>
              {d.badge}
            </div>

            {/* Heading */}
            <h1 className="animate-fade-in-up text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl">
              {d.headingBefore}{' '}
              <span className="text-gradient animate-gradient">{d.headingHighlight}</span>
            </h1>

            {/* Subtext */}
            <p className="animate-fade-in-up-d1 mt-4 max-w-xl text-base leading-relaxed text-gray-400 sm:mt-6 sm:text-lg md:text-xl">
              {d.subtitle}
            </p>

            {/* Buttons */}
            <div className="animate-fade-in-up-d2 mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
              <Link
                href={d.primaryLink}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#ff7a18] to-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#ff7a18]/25 transition-all duration-200 hover:from-[#ff8c3a] hover:to-orange-400 hover:shadow-xl hover:shadow-[#ff7a18]/40"
              >
                {d.primaryBtn}
              </Link>
              <Link
                href={d.secondaryLink}
                className="inline-flex items-center justify-center rounded-xl border border-gray-700 bg-white/5 px-8 py-3.5 text-base font-semibold text-gray-200 transition-all duration-200 hover:border-gray-600 hover:bg-white/10"
              >
                {d.secondaryBtn}
              </Link>
            </div>
          </div>

          {/* Right - Dashboard mockup */}
          <div className="animate-fade-in-up-d2 relative hidden lg:block">
            <div className="relative rounded-2xl border border-gray-800 bg-[#161616] p-1 shadow-2xl shadow-[#ff7a18]/5">
              <div className="rounded-xl bg-[#161616] p-6">
                {/* Window chrome */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/70" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                    <div className="h-3 w-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 rounded-lg bg-black/30 px-3 py-1.5 text-xs text-gray-500">
                    panel.astranodes.com
                  </div>
                </div>

                {/* Console */}
                <div className="rounded-lg bg-black/50 p-4 font-mono text-xs leading-loose">
                  <p className="text-gray-500">[AstraNodes] Starting server...</p>
                  <p className="text-[#ff7a18]">[Server] Loading world data...</p>
                  <p className="text-green-400">[Server] Done (2.1s)! For help, type &quot;help&quot;</p>
                  <p className="text-gray-500">[Server] 0/100 players online</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[#ff7a18]">&gt;</span>
                    <span className="h-4 w-px animate-pulse bg-[#ff7a18]" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'CPU', value: '12%' },
                    { label: 'RAM', value: '1.2 GB' },
                    { label: 'Disk', value: '3.4 GB' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-black/30 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating glows */}
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#ff7a18]/15 blur-2xl animate-float-slow" />
            <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-orange-500/10 blur-xl animate-float-slower" />
          </div>
        </div>
      </div>
    </section>
  );
}
