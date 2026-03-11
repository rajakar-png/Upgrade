'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Submission {
  id: number;
  utrNumber: string;
  amount: number;
  status: string;
  screenshotUrl: string | null;
  createdAt: string;
  user: { email: string };
}

export default function AdminBillingPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    api.get<Submission[]>('/admin/utr').then((r) => setSubmissions(r.data)).catch(() => {
      toast.error('Failed to load submissions');
    });
  }, []);

  async function process(id: number, action: 'approve' | 'reject') {
    setProcessing(id);
    try {
      await api.post(`/admin/utr/${id}/${action}`);
      toast.success(`Submission ${action}d`);
      setSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' } : s));
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setProcessing(null);
    }
  }

  const pending = submissions.filter((s) => s.status === 'pending');
  const processed = submissions.filter((s) => s.status !== 'pending');

  return (
    <div className="space-y-8 py-8">
      <h1 className="text-2xl font-bold">UTR Submissions</h1>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold text-yellow-400">Pending ({pending.length})</h2>
          <SubmissionTable submissions={pending} processing={processing} onProcess={process} />
        </section>
      )}

      {processed.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold text-gray-400">Processed</h2>
          <SubmissionTable submissions={processed} processing={null} onProcess={process} />
        </section>
      )}

      {submissions.length === 0 && (
        <p className="text-sm text-gray-400">No submissions yet.</p>
      )}
    </div>
  );
}

function SubmissionTable({
  submissions,
  processing,
  onProcess,
}: {
  submissions: Submission[];
  processing: number | null;
  onProcess: (id: number, action: 'approve' | 'reject') => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="border-b border-white/10 text-left text-xs text-gray-400">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">UTR</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Screenshot</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {submissions.map((s) => (
            <tr key={s.id} className="hover:bg-white/5">
              <td className="px-4 py-3">{s.user.email}</td>
              <td className="px-4 py-3 font-mono">{s.utrNumber}</td>
              <td className="px-4 py-3">₹{s.amount}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {s.screenshotUrl ? (
                  <a href={s.screenshotUrl} target="_blank" rel="noreferrer" className="text-[#ff7a18] hover:underline">
                    View
                  </a>
                ) : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs capitalize ${s.status === 'approved' ? 'text-green-400' : s.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {s.status}
                </span>
              </td>
              <td className="flex gap-2 px-4 py-3">
                {s.status === 'pending' && (
                  <>
                    <Button size="sm" disabled={processing === s.id} onClick={() => onProcess(s.id, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" disabled={processing === s.id} onClick={() => onProcess(s.id, 'reject')}>
                      Reject
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
