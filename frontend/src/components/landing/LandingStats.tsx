import { ArrowUpRight, Clock, Globe, Headphones } from 'lucide-react';

const stats = [
  { icon: ArrowUpRight, value: '99.9%', label: 'Uptime', desc: 'Enterprise-grade reliability' },
  { icon: Clock, value: '<1s', label: 'Deployment', desc: 'Instant server provisioning' },
  { icon: Globe, value: 'Global', label: 'Locations', desc: 'Multi-region infrastructure' },
  { icon: Headphones, value: '24/7', label: 'Support', desc: 'Always here to help' },
];

export function LandingStats() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group relative rounded-xl border border-gray-800 bg-[#161616] p-6 text-center shadow-lg transition-all duration-300 hover:scale-105 hover:border-[#ff7a18]/30 hover:shadow-[#ff7a18]/10"
            >
              <div className="absolute inset-0 rounded-xl bg-[#ff7a18]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff7a18]/10">
                  <stat.icon className="h-5 w-5 text-[#ff7a18]" />
                </div>
                <p className="text-3xl font-bold tracking-tight text-white">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-gray-300">{stat.label}</p>
                <p className="mt-1 text-xs text-gray-500">{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
