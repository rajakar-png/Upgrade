'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface AuditEntry {
  id: number;
  action: string;
  targetId: number | null;
  targetType: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  admin: { email: string };
}

export default function AdminAuditPage() {
  const [log, setLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api.get('/admin/audit').then((r) => {
      const data = r.data;
      setLog(Array.isArray(data) ? data : data.logs ?? []);
    }).catch(() => toast.error('Failed to load audit log'));
  }, []);

  return (
    <div className="space-y-6 py-8">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs text-gray-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {log.map((e) => (
              <tr key={e.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{e.admin.email}</td>
                <td className="px-4 py-3 font-mono text-orange-300">{e.action}</td>
                <td className="px-4 py-3 text-gray-400">
                  {e.targetType ? `${e.targetType}#${e.targetId}` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {e.meta ? JSON.stringify(e.meta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
