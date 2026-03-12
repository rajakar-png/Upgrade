'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Users, Server, DollarSign, AlertCircle, Ticket, Activity, Settings, Tag, Coins, FileText, MessageSquare, Gift, Home, MonitorPlay } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalServers: number;
  activeServers: number;
  totalRevenue: number;
  pendingUtrs: number;
  openTickets: number;
}

const NAV_LINKS = [
  { label: 'Users', href: '/admin/users', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Servers', href: '/admin/servers', icon: Server, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Plans', href: '/admin/plans', icon: Tag, color: 'text-green-400', bg: 'bg-green-500/10' },
  { label: 'Node Assignments', href: '/admin/nodes', icon: Activity, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { label: 'Coupons', href: '/admin/coupons', icon: Tag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'UTR Submissions', href: '/admin/billing', icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { label: 'Tickets', href: '/admin/tickets', icon: Ticket, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { label: 'Audit Log', href: '/admin/audit', icon: FileText, color: 'text-gray-400', bg: 'bg-gray-500/10' },
  { label: 'Homepage Editor', href: '/admin/homepage', icon: Home, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { label: 'Site Settings', href: '/admin/site', icon: Settings, color: 'text-[#ff7a18]', bg: 'bg-[#ff7a18]/10' },
  { label: 'Coin Settings', href: '/admin/coins', icon: Coins, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { label: 'Popup Messages', href: '/admin/popups', icon: MessageSquare, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { label: 'Affiliate Settings', href: '/admin/affiliate', icon: Gift, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { label: 'Ad Settings', href: '/admin/ads', icon: MonitorPlay, color: 'text-rose-400', bg: 'bg-rose-500/10' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const tiles = stats
    ? [
        { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Servers', value: stats.totalServers, icon: Server, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Active Servers', value: stats.activeServers, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Revenue', value: `₹${(stats.totalRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Pending UTRs', value: stats.pendingUtrs, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', warn: stats.pendingUtrs > 0 },
        { label: 'Open Tickets', value: stats.openTickets, icon: Ticket, color: 'text-red-400', bg: 'bg-red-500/10', warn: stats.openTickets > 0 },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Overview of your platform.</p>
      </div>

      {/* Stats grid */}
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={`rounded-2xl border p-5 ${
                t.warn ? 'border-orange-500/30 bg-orange-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{t.label}</p>
                <div className={`rounded-xl ${t.bg} p-2`}>
                  <t.icon className={`h-4 w-4 ${t.color}`} />
                </div>
              </div>
              <p className={`mt-2 text-3xl font-extrabold ${t.warn ? 'text-orange-400' : ''}`}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick navigation */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="group flex items-center gap-3 rounded-2xl border border-gray-800 bg-[#161616] px-4 py-3.5 transition-all duration-200 hover:border-[#ff7a18]/20 hover:bg-[#1a1a1a]"
            >
              <div className={`rounded-xl ${link.bg} p-2`}>
                <link.icon className={`h-4 w-4 ${link.color}`} />
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
