'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    atOptions?: Record<string, unknown>;
  }
}

interface AdsterraAdProps {
  bannerKey: string;   // Full script URL for banner (atOptions iframe format)
  nativeKey?: string;  // Full script URL for native (container-based format)
  onAdLoaded?: () => void;
}

// Extract the hex key from an Adsterra script URL like
// https://domain.com/ea5f1c0a65197deceee484aa52672b4d/invoke.js
function extractKey(url: string): string | null {
  const match = url.match(/\/([a-f0-9]{32})\/invoke\.js/i);
  return match ? match[1] : null;
}

export function AdsterraAd({ bannerKey, nativeKey, onAdLoaded }: AdsterraAdProps) {
  const nativeRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    let adDetected = false;
    const markLoaded = () => {
      if (!adDetected) {
        adDetected = true;
        onAdLoaded?.();
      }
    };

    // ── Native ad (container-based) ─────────────────────────────────
    if (nativeKey) {
      const nativeScript = document.createElement('script');
      nativeScript.async = true;
      nativeScript.setAttribute('data-cfasync', 'false');
      nativeScript.src = nativeKey;
      nativeScript.onload = () => setTimeout(markLoaded, 1500);
      nativeRef.current?.appendChild(nativeScript);
    }

    // ── Banner ad (atOptions iframe) ────────────────────────────────
    if (bannerKey) {
      const key = extractKey(bannerKey);
      if (key) {
        // Set atOptions before loading the script
        const optScript = document.createElement('script');
        optScript.textContent = `atOptions = { 'key': '${key}', 'format': 'iframe', 'height': 60, 'width': 468, 'params': {} };`;
        bannerRef.current?.appendChild(optScript);
      }

      const script = document.createElement('script');
      script.src = bannerKey;
      script.async = true;
      script.onload = () => setTimeout(markLoaded, 1500);
      bannerRef.current?.appendChild(script);
    }

    // Fallback: consider ad loaded after 4s even if detection missed it
    const fallback = setTimeout(markLoaded, 4000);

    return () => {
      clearTimeout(fallback);
    };
  }, [bannerKey, nativeKey, onAdLoaded]);

  const nativeAdKey = nativeKey ? extractKey(nativeKey) : null;

  return (
    <div className="w-full space-y-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      {/* Native ad slot */}
      {nativeKey && (
        <div ref={nativeRef}>
          {nativeAdKey && <div id={`container-${nativeAdKey}`} />}
        </div>
      )}
      {/* Banner ad slot */}
      {bannerKey && (
        <div ref={bannerRef} style={{ minHeight: '60px' }} />
      )}
      <p className="text-center text-[10px] text-gray-600">Advertisement</p>
    </div>
  );
}
