'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface EarnState {
  token: string;
  expiresAt: number;
}

export default function CoinsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [earn, setEarn] = useState<EarnState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get<{ balance: number }>('/coins/balance').then((r) => setBalance(r.data.balance)).catch(() => {});
    startSession();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startSession() {
    try {
      const r = await api.post<EarnState>('/coins/session');
      setEarn(r.data);
      const secs = Math.ceil((r.data.expiresAt - Date.now()) / 1000);
      setSecondsLeft(secs);
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      // Not an error to surface; session may still be active
    }
  }

  async function claim() {
    if (!earn) return;
    setClaiming(true);
    try {
      const r = await api.post<{ coinsAdded: number; balance: number }>('/coins/claim', {
        token: earn.token,
      });
      toast.success(`+${r.data.coinsAdded} coins earned!`);
      setBalance(r.data.balance);
      setEarn(null);
      setSecondsLeft(0);
      // Start next session after claim
      setTimeout(startSession, 1000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to claim coins');
    } finally {
      setClaiming(false);
    }
  }

  const canClaim = earn && secondsLeft === 0;

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">Earn Coins</h1>
        <p className="mt-1 text-sm text-gray-400">Keep this page open — coins accumulate over time.</p>
      </div>

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-8 text-center">
        <p className="text-sm text-gray-400">Current Balance</p>
        <p className="mt-2 text-5xl font-extrabold text-yellow-400">
          {balance ?? '—'}
        </p>
        <p className="mt-1 text-sm text-gray-500">coins</p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        {earn ? (
          <>
            <p className="text-sm text-gray-400">
              {secondsLeft > 0
                ? `Earning in progress… claim in ${secondsLeft}s`
                : 'Ready to claim!'}
            </p>
            <div className="my-6">
              {secondsLeft > 0 ? (
                <div className="relative mx-auto h-24 w-24">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(99,102,241)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={`${283}`} strokeDashoffset={`${283 * (secondsLeft / 120)}`}
                      className="transition-all duration-1000" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{secondsLeft}</span>
                </div>
              ) : (
                <div className="text-5xl">&#127881;</div>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!canClaim || claiming}
              onClick={claim}
            >
              {claiming ? 'Claiming…' : 'Claim Coins'}
            </Button>
          </>
        ) : (
          <p className="text-sm text-gray-400">Starting new session…</p>
        )}
      </div>

      <p className="text-center text-xs text-gray-500">
        Coins can be used to purchase and renew servers on the Plans page.
      </p>
    </div>
  );
}
