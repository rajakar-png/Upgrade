import { Zap, Cpu, Globe, Shield, Package, Code2 } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Instant Provisioning', description: 'Servers deploy in seconds using our automated infrastructure.' },
  { icon: Cpu, title: 'Powerful Hardware', description: 'NVMe SSDs and high-frequency CPUs for lag-free gameplay.' },
  { icon: Globe, title: 'Global Locations', description: 'Low latency servers across multiple regions.' },
  { icon: Shield, title: 'DDoS Protection', description: 'Enterprise-grade network protection included.' },
  { icon: Package, title: 'One-Click Modpacks', description: 'Install modpacks like Forge, Fabric, and Paper instantly.' },
  { icon: Code2, title: 'Developer API', description: 'Full API access for automation and integrations.' },
];

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
            Features
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Everything you need to{' '}
            <span className="text-gradient">dominate</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            A complete hosting platform built for gamers, not just a panel wrapper.
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-xl border border-gray-800 bg-[#161616] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#ff7a18]/40 hover:shadow-xl hover:shadow-[#ff7a18]/10"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#ff7a18]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7a18]/10 transition-colors duration-300 group-hover:bg-[#ff7a18]/20">
                  <f.icon className="h-5 w-5 text-[#ff7a18]" />
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
