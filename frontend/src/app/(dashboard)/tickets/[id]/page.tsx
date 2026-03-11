'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/context/auth-context';

interface Message {
  id: number;
  message: string;
  isStaff: boolean;
  createdAt: string;
  author?: { email: string };
}

interface TicketDetail {
  id: number;
  subject: string;
  status: string;
  messages: Message[];
}

const schema = z.object({ message: z.string().min(1, 'Required') });
type FormValues = z.infer<typeof schema>;

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [sending, setSending] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api.get<TicketDetail>(`/tickets/${id}`).then((r) => setTicket(r.data)).catch(() => {
      toast.error('Failed to load ticket');
    });
  }, [id]);

  async function onSubmit(data: FormValues) {
    setSending(true);
    try {
      await api.post(`/tickets/${id}/reply`, data);
      reset();
      const r = await api.get<TicketDetail>(`/tickets/${id}`);
      setTicket(r.data);
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function closeTicket() {
    try {
      await api.patch(`/tickets/${id}/close`);
      setTicket((prev) => prev ? { ...prev, status: 'closed' } : prev);
      toast.success('Ticket closed');
    } catch {
      toast.error('Failed to close ticket');
    } finally {
      setShowCloseConfirm(false);
    }
  }

  if (!ticket) {
    return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-gray-400">Ticket #{ticket.id} · {ticket.status}</p>
        </div>
        {ticket.status === 'open' && (
          <Button size="sm" variant="secondary" onClick={() => setShowCloseConfirm(true)}>
            Close Ticket
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {ticket.messages.map((msg) => {
          const isMe = !msg.isStaff;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl rounded-2xl px-4 py-3 text-sm ${isMe ? 'bg-[#ff7a18] text-white' : 'bg-white/10 text-gray-100'}`}>
                {msg.isStaff && (
                  <p className="mb-1 text-xs font-semibold text-orange-300">Support</p>
                )}
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <p className="mt-1 text-right text-xs opacity-60">
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {ticket.status === 'open' && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3">
          <div className="flex-1">
            <textarea
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#ff7a18] focus:ring-1 focus:ring-[#ff7a18]"
              rows={3}
              placeholder="Type a reply…"
              {...register('message')}
            />
            {errors.message && <p className="mt-1 text-xs text-red-400">{errors.message.message}</p>}
          </div>
          <Button type="submit" disabled={sending} className="self-end">
            {sending ? '…' : 'Send'}
          </Button>
        </form>
      )}

      <ConfirmModal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={closeTicket}
        title="Close Ticket"
        message="Are you sure you want to close this ticket?"
        confirmLabel="Close Ticket"
      />
    </div>
  );
}
