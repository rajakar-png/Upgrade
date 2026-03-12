'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Ticket {
  id: number;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const schema = z.object({
  subject: z.string().min(3, 'Too short'),
  message: z.string().min(10, 'Too short'),
});
type FormValues = z.infer<typeof schema>;

const STATUS_STYLE: Record<string, string> = {
  open: 'text-green-400',
  in_progress: 'text-blue-400',
  resolved: 'text-purple-400',
  closed: 'text-gray-400',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api.get<Ticket[]>('/tickets').then((r) => setTickets(r.data)).catch(() => {});
  }, []);

  async function onSubmit(data: FormValues) {
    setCreating(true);
    try {
      const r = await api.post<Ticket>('/tickets', data);
      toast.success('Ticket created');
      setTickets((prev) => [r.data, ...prev]);
      setShowForm(false);
      reset();
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="mt-1 text-sm text-gray-400">Open a ticket for any issue or question.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ New Ticket'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <Input
            label="Subject"
            placeholder="Brief summary"
            error={errors.subject?.message}
            {...register('subject')}
          />
          <div>
            <label className="mb-1 block text-sm text-gray-300">Message</label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#ff7a18] focus:ring-1 focus:ring-[#ff7a18]"
              rows={4}
              placeholder="Describe your issue…"
              {...register('message')}
            />
            {errors.message && <p className="mt-1 text-xs text-red-400">{errors.message.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={creating}>
            {creating ? 'Submitting…' : 'Submit Ticket'}
          </Button>
        </form>
      )}

      {tickets.length === 0 ? (
        <p className="text-sm text-gray-400">No tickets yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tickets/${t.id}`}
                className="flex items-center justify-between px-4 py-4 text-sm transition hover:bg-white/5"
              >
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-gray-400">#{t.id} · {new Date(t.updatedAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLE[t.status] ?? 'text-gray-400'}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
