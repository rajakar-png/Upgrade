'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Zap, Cpu, Globe, Shield, Package, Code2 } from 'lucide-react';

const defaultFeatures = [
  { title: 'Instant Provisioning', description: 'Servers deploy in seconds using our automated infrastructure.' },
  { title: 'Powerful Hardware', description: 'NVMe SSDs and high-frequency CPUs for lag-free gameplay.' },
  { title: 'Global Locations', description: 'Low latency servers across multiple regions.' },
  { title: 'DDoS Protection', description: 'Enterprise-grade network protection included.' },
  { title: 'One-Click Modpacks', description: 'Install modpacks like Forge, Fabric, and Paper instantly.' },
  { title: 'Developer API', description: 'Full API access for automation and integrations.' },
];

const ICONS = [Zap, Cpu, Globe, Shield, Package, Code2];

const defaultSection = {
  sectionTitle: 'Everything you need to dominate',
  sectionSubtitle: 'A complete hosting platform built for gamers, not just a panel wrapper.',
};

export function LandingFeatures() {
  const [features, setFeatures] = useState(defaultFeatures);
  const [section, setSection] = useState(defaultSection);

  useEffect(() => {
    api.get('/site/frontpage/features').then((r) => {
      if (r.data) {
        if (r.data.items?.length) setFeatures(r.data.items);
        if (r.data.sectionTitle) {
          setSection({
            sectionTitle: r.data.sectionTitle,
            sectionSubtitle: r.data.sectionSubtitle || '',
          });
        }
      }
    }).catch(() => {});
  }, []);

  return (
    <section id="features" className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
            Features
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            {section.sectionTitle.includes('dominate') ? (
              <>
                Everything you need to{' '}
                <span className="text-gradient">dominate</span>
              </>
            ) : (
              section.sectionTitle
            )}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            {section.sectionSubtitle}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={f.title}
                className="group relative rounded-xl border border-gray-800 bg-[#161616] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff7a18]/40 hover:shadow-xl hover:shadow-[#ff7a18]/10"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#ff7a18]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7a18]/10 transition-colors duration-300 group-hover:bg-[#ff7a18]/20">
                    <Icon className="h-5 w-5 text-[#ff7a18]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
