'use client';

import { FolderOpen, Terminal, Archive, Activity } from 'lucide-react';

const features = [
  {
    icon: Terminal,
    title: 'Live Console',
    description: 'Full server console with real-time log streaming and command input.',
  },
  {
    icon: FolderOpen,
    title: 'File Manager',
    description: 'Browse, edit, upload, and manage your server files right from the browser.',
  },
  {
    icon: Archive,
    title: 'Backups',
    description: 'Create and restore backups with a single click. Never lose progress.',
  },
  {
    icon: Activity,
    title: 'Resource Monitoring',
    description: 'Track CPU, RAM, disk, and network usage in real time.',
  },
];

export function PanelPreview() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#ff7a18]/[0.04] blur-[150px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left - Dashboard mockup */}
          <div className="relative animate-fade-in-up">
            <div className="rounded-2xl border border-gray-800 bg-[#161616] p-1">
              <div className="rounded-xl bg-[#1a1a1a] p-5">
                {/* Panel tabs */}
                <div className="mb-4 flex gap-1 rounded-lg bg-black/30 p-1">
                  {['Console', 'Files', 'Backups', 'Settings'].map((tab, idx) => (
                    <div
                      key={tab}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        idx === 0 ? 'bg-[#ff7a18]/20 text-[#ff7a18]' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Mock console */}
                <div className="rounded-lg bg-black/50 p-4 font-mono text-xs leading-loose">
                  <p className="text-gray-500">[12:04:32] [Server thread/INFO]: Preparing level &quot;world&quot;</p>
                  <p className="text-[#ff7a18]">[12:04:33] [Server thread/INFO]: Preparing start region</p>
                  <p className="text-green-400">[12:04:35] [Server thread/INFO]: Done (2.847s)!</p>
                  <p className="text-gray-500">[12:04:35] [Server thread/INFO]: Starting GS4 status listener</p>
                  <p className="text-blue-400">[12:05:01] [Server thread/INFO]: Player123 joined the game</p>
                </div>

                {/* Resource bars */}
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'CPU Usage', value: 18, color: 'bg-[#ff7a18]' },
                    { label: 'Memory', value: 42, color: 'bg-blue-500' },
                    { label: 'Disk', value: 28, color: 'bg-purple-500' },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-400">{bar.label}</span>
                        <span className="text-gray-500">{bar.value}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div>
            <span className="mb-4 inline-block rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
              Control Panel
            </span>

            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Full Control.{' '}
              <span className="text-gradient">Zero Complexity.</span>
            </h2>

            <p className="mt-4 text-gray-400">
              Manage every aspect of your server through our intuitive Pterodactyl-powered dashboard.
            </p>

            <div className="mt-8 space-y-5">
              {features.map((f) => (
                <div key={f.title} className="group flex gap-4 rounded-xl p-3 transition-colors duration-200 hover:bg-white/[0.03]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a18]/10 transition-colors group-hover:bg-[#ff7a18]/20">
                    <f.icon className="h-5 w-5 text-[#ff7a18]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{f.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
