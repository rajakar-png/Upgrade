'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PromptModal } from '@/components/ui/PromptModal';

interface User {
  id: number;
  email: string;
  role: string;
  coins: number;
  banned: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [coinTarget, setCoinTarget] = useState<number | null>(null);

  async function load(q = search, p = page) {
    try {
      const r = await api.get<{ users: User[]; total: number }>('/admin/users', {
        params: { search: q, page: p, limit },
      });
      setUsers(r.data.users);
      setTotal(r.data.total);
    } catch {
      toast.error('Failed to load users');
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleBan(userId: number, banned: boolean) {
    try {
      await api.patch(`/admin/users/${userId}`, { banned: !banned });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned: !banned } : u));
    } catch {
      toast.error('Failed to update user');
    }
  }

  async function adjustCoins(userId: number, raw: string) {
    const delta = parseInt(raw, 10);
    if (isNaN(delta)) return;
    try {
      await api.patch(`/admin/users/${userId}`, { coinDelta: delta });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, coins: u.coins + delta } : u));
      toast.success('Coins updated');
    } catch {
      toast.error('Failed to update coins');
    } finally {
      setCoinTarget(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 py-8">
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(search, 1); } }}
          className="max-w-xs"
        />
        <Button size="sm" onClick={() => { setPage(1); load(search, 1); }}>Search</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs text-gray-400">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Coins</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-gray-400">#{u.id}</td>
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.role === 'admin' ? 'text-[#ff7a18]' : 'text-gray-400'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-yellow-400">{u.coins}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.banned ? 'text-red-400' : 'text-green-400'}`}>
                    {u.banned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-grey-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="flex gap-2 px-4 py-3">
                  <Button size="sm" variant="secondary" onClick={() => setCoinTarget(u.id)}>
                    Coins
                  </Button>
                  <Button
                    size="sm"
                    variant={u.banned ? 'secondary' : 'destructive'}
                    onClick={() => toggleBan(u.id, u.banned)}
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(search, p); }}>
            Prev
          </Button>
          <span className="text-gray-400">{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(search, p); }}>
            Next
          </Button>
        </div>
      )}

      <PromptModal
        open={!!coinTarget}
        onClose={() => setCoinTarget(null)}
        onSubmit={(value) => coinTarget && adjustCoins(coinTarget, value)}
        title="Adjust Coins"
        message="Enter the coin adjustment amount. Use a positive number to add or negative to subtract."
        label="Amount"
        placeholder="e.g. 100 or -50"
        type="number"
        submitLabel="Apply"
      />
    </div>
  );
}
