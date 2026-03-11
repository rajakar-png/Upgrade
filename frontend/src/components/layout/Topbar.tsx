'use client';

import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/Button';
import { LogOut, Coins } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-gray-800 bg-[#0f0f0f]/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 rounded-xl bg-yellow-500/10 px-3 py-1.5 text-sm font-medium text-yellow-400">
        <Coins className="h-4 w-4" />
        {user?.coins ?? 0}
      </div>
      <span className="text-sm text-gray-400">{user?.email}</span>
      <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-400">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
