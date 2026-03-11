'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { ServerCard } from '@/components/servers/ServerCard';
import { Button } from '@/components/ui/Button';
import { Plus, Server, Coins, CreditCard, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/servers').then((r) => setServers(r.data.servers || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-400">Here&apos;s what&apos;s happening with your servers.</p>
        </div>
        <Button asChild>
          <Link href="/plans">
            <Plus className="mr-2 h-4 w-4" />
            New Server
          </Link>
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Servers', value: servers.filter(s => s.status === 'active').length, icon: Server, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Coin Balance', value: user?.coins ?? 0, icon: Coins, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Balance', value: `$${(user?.balance ?? 0).toFixed(2)}`, icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Total Servers', value: servers.length, icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-800 bg-[#161616] p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{stat.label}</p>
              <div className={`rounded-xl ${stat.bg} p-2`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Servers */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">My Servers</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/[0.03] border border-white/[0.06]" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
            <div className="rounded-2xl bg-[#ff7a18]/10 p-4">
              <Server className="h-8 w-8 text-[#ff7a18]" />
            </div>
            <h2 className="mt-4 text-lg font-medium">No servers yet</h2>
            <p className="mt-1.5 text-sm text-gray-500">Purchase a plan to launch your first server.</p>
            <Button className="mt-6" asChild>
              <Link href="/plans">Browse Plans</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
