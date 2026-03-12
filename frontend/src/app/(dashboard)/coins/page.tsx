'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useAdBlockDetector } from '@/lib/useAdBlockDetector';
import { AdSenseAd } from '@/components/ads/AdSenseAd';
import { AdsterraAd } from '@/components/ads/AdsterraAd';
import { AdBlockerWarning } from '@/components/ads/AdBlockerWarning';

interface EarnState {
  token: string;
  expiresAt: number;
}

interface AdConfig {
  adProvider: 'none' | 'adsense' | 'adsterra';
  adBlockerDetection: boolean;
  requireAdView: boolean;
  adsensePublisherId?: string;
  adsenseSlotId?: string;
  adsterraBannerKey?: string;
  adsterraNativeKey?: string;
}

export default function CoinsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [earn, setEarn] = useState<EarnState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [adConfig, setAdConfig] = useState<AdConfig | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef(0); // Track latest session to prevent race conditions

  const adsEnabled = adConfig?.adProvider !== 'none' && adConfig?.adProvider !== undefined;
  const { adBlockDetected, checking: adBlockChecking } = useAdBlockDetector(
    adsEnabled && (adConfig?.adBlockerDetection ?? false),
  );

  useEffect(() => {
    api.get<{ coins: number }>('/coins/balance').then((r) => setBalance(r.data.coins)).catch(() => {});
    api.get<AdConfig>('/coins/ad-config').then((r) => setAdConfig(r.data)).catch(() => {});
    startSession();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startSession() {
    setAdLoaded(false);
    setSessionStarted(true);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const myId = ++sessionIdRef.current; // Capture this session's ID
    try {
      const r = await api.post<EarnState>('/coins/session');
      // If another session started while we were awaiting, discard this one
      if (myId !== sessionIdRef.current) return;
      setEarn(r.data);
      const secs = Math.max(0, Math.ceil((r.data.expiresAt - Date.now()) / 1000));
      setSecondsLeft(secs);
      // Clear any interval that another concurrent call may have created
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (secs > 0) {
        timerRef.current = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      }
    } catch {
      // Not an error to surface; session may still be active
    }
  }

  async function claim() {
    if (!earn) return;
    setClaiming(true);
    try {
      const r = await api.post<{ earned?: number; balance?: number; error?: string; waitSeconds?: number }>('/coins/claim', {
        earnToken: earn.token,
        adViewed: adLoaded || !adsEnabled,
      });
      // Backend returns 200 for both success and semantic errors
      if (r.data.error) {
        toast.error(r.data.error);
        setClaiming(false);
        return;
      }
      toast.success(`+${r.data.earned} coins earned!`);
      // Reload page so ads reload fresh
      setTimeout(() => window.location.reload(), 600);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
        ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to claim coins');
      setClaiming(false);
    }
  }

  const requiresAd = adsEnabled && adConfig?.requireAdView;
  const canClaim = earn && secondsLeft === 0 && (!requiresAd || adLoaded);

  // Show ad blocker warning if ads are enabled and blocker detected
  if (adsEnabled && adConfig?.adBlockerDetection && !adBlockChecking && adBlockDetected) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Earn Coins</h1>
          <p className="mt-1 text-sm text-gray-400">View ads and earn coins to use on servers.</p>
        </div>
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-8 text-center">
          <p className="text-sm text-gray-400">Current Balance</p>
          <p className="mt-2 text-5xl font-extrabold text-yellow-400">{balance ?? '—'}</p>
          <p className="mt-1 text-sm text-gray-500">coins</p>
        </div>
        <div className="mt-6">
          <AdBlockerWarning />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">Earn Coins</h1>
        <p className="mt-1 text-sm text-gray-400">View the ad and claim your coins when the timer ends.</p>
      </div>

      {/* Balance */}
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-6 text-center">
        <p className="text-sm text-gray-400">Current Balance</p>
        <p className="mt-2 text-5xl font-extrabold text-yellow-400">
          {balance ?? '—'}
        </p>
        <p className="mt-1 text-sm text-gray-500">coins</p>
      </div>

      {/* Timer + Claim Button (TOP) */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        {earn ? (
          <>
            <p className="text-sm text-gray-400">
              {secondsLeft > 0
                ? `Claim available in ${secondsLeft}s`
                : requiresAd && !adLoaded
                  ? 'Waiting for ad to load…'
                  : 'Ready to claim!'}
            </p>
            <div className="my-5">
              {secondsLeft > 0 ? (
                <div className="relative mx-auto h-24 w-24">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(99,102,241)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={`${283}`} strokeDashoffset={`${283 * (secondsLeft / 30)}`}
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
            {requiresAd && !adLoaded && secondsLeft === 0 && (
              <p className="mt-2 text-xs text-amber-400">Scroll down and view the ad to unlock claiming</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            {sessionStarted ? 'Starting new session…' : 'Loading…'}
          </p>
        )}
      </div>

      {/* Ads (BELOW claim button) */}
      {adsEnabled && adConfig?.adProvider === 'adsense' && adConfig.adsensePublisherId && adConfig.adsenseSlotId && (
        <AdSenseAd
          publisherId={adConfig.adsensePublisherId}
          slotId={adConfig.adsenseSlotId}
          onAdLoaded={() => setAdLoaded(true)}
        />
      )}

      {adsEnabled && adConfig?.adProvider === 'adsterra' && adConfig.adsterraBannerKey && (
        <AdsterraAd
          bannerKey={adConfig.adsterraBannerKey}
          nativeKey={adConfig.adsterraNativeKey}
          onAdLoaded={() => setAdLoaded(true)}
        />
      )}

      <p className="text-center text-xs text-gray-500">
        Coins can be used to purchase and renew servers on the Plans page.
      </p>
    </div>
  );
}
