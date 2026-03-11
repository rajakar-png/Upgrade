'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Ticket {
  id: number;
  subject: string;
  status: string;
  createdAt: string;
  user: { email: string };
}

interface Message {
  id: number;
  message: string;
  isStaff: boolean;
  createdAt: string;
}

interface TicketDetail {
  id: number;
  subject: string;
  status: string;
  messages: Message[];
  user: { email: string };
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/admin/tickets').then((r) => {
      const data = r.data;
      setTickets(Array.isArray(data) ? data : data.tickets ?? []);
    }).catch(() => {
      toast.error('Failed to load tickets');
    });
  }, []);

  async function open(id: number) {
    try {
      const r = await api.get<TicketDetail>(`/admin/tickets/${id}`);
      setSelected(r.data);
    } catch {
      toast.error('Failed to load ticket');
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/tickets/${selected.id}/reply`, { message: reply });
      setReply('');
      const r = await api.get<TicketDetail>(`/admin/tickets/${selected.id}`);
      setSelected(r.data);
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function closeTicket(id: number) {
    try {
      await api.patch(`/admin/tickets/${id}/close`);
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: 'closed' } : t));
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: 'closed' } : prev);
    } catch {
      toast.error('Failed to close ticket');
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 py-8">
      {/* List */}
      <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-white/10">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="font-semibold">All Tickets</h2>
        </div>
        {tickets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No tickets.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  className={`w-full px-4 py-3 text-left text-sm transition hover:bg-white/5 ${selected?.id === t.id ? 'bg-[#ff7a18]/10' : ''}`}
                  onClick={() => open(t.id)}
                >
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-gray-400">{t.user.email}</p>
                  <p className={`mt-0.5 text-xs capitalize ${t.status === 'open' ? 'text-green-400' : 'text-gray-500'}`}>
                    {t.status}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detail */}
      <div className="flex flex-1 flex-col rounded-xl border border-white/10 overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a ticket
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="font-semibold">{selected.subject}</h3>
                <p className="text-xs text-gray-400">{selected.user.email} · #{selected.id}</p>
              </div>
              {selected.status === 'open' && (
                <Button size="sm" variant="secondary" onClick={() => closeTicket(selected.id)}>
                  Close
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((m) => (
                <div key={m.id} className={`flex ${m.isStaff ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-lg rounded-2xl px-4 py-2 text-sm ${m.isStaff ? 'bg-[#ff7a18] text-white' : 'bg-white/10 text-gray-100'}`}>
                    {m.isStaff && <p className="mb-1 text-xs font-semibold text-orange-200">Staff</p>}
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="mt-1 text-right text-xs opacity-60">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            {selected.status === 'open' && (
              <div className="flex gap-3 border-t border-white/10 p-4">
                <textarea
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#ff7a18] focus:outline-none"
                  rows={2}
                  placeholder="Type reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <Button disabled={sending || !reply.trim()} onClick={sendReply} className="self-end">
                  {sending ? '…' : 'Send'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
