'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard, Server, CreditCard, Ticket, Coins, Settings, ShieldCheck,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/plans', label: 'Plans', icon: Server },
  { href: '/coins', label: 'Coins', icon: Coins },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/tickets', label: 'Support', icon: Ticket },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Admin Panel', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = [...NAV, ...(user?.role === 'admin' ? ADMIN_NAV : [])];

  return (
    <aside className="flex w-64 flex-col border-r border-gray-800 bg-[#0a0a0a]">
      <div className="flex h-16 items-center border-b border-gray-800 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff7a18]">
            <span className="text-xs font-black text-white">A</span>
          </div>
          <span className="text-lg font-bold text-white">AstraNodes</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-[#ff7a18]/10 text-[#ff7a18] border border-[#ff7a18]/20'
                  : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 border border-transparent',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff7a18]/10 text-xs font-bold text-[#ff7a18]">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-200">{user?.email ?? 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role ?? 'user'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
