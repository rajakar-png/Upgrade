'use client';

import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/Button';
import { LogOut, Coins, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-gray-800 bg-[#0f0f0f]/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 rounded-xl bg-yellow-500/10 px-2.5 py-1.5 text-xs font-medium text-yellow-400 sm:px-3 sm:text-sm">
          <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {user?.coins ?? 0}
        </div>
        <span className="hidden text-sm text-gray-400 sm:inline">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-400">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
