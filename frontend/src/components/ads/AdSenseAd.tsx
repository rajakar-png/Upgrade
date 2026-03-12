'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSenseAdProps {
  publisherId: string;
  slotId: string;
  onAdLoaded?: () => void;
}

export function AdSenseAd({ publisherId, slotId, onAdLoaded }: AdSenseAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;

    // Push the ad after the script loads
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense push failed — likely blocked
      }

      // Check if ad rendered after a delay
      setTimeout(() => {
        if (containerRef.current) {
          const ins = containerRef.current.querySelector('ins');
          if (ins && ins.offsetHeight > 0) {
            onAdLoaded?.();
          }
        }
      }, 2000);
    }, 500);

    return () => clearTimeout(timer);
  }, [onAdLoaded]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: '100px' }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <p className="mt-1 text-center text-[10px] text-gray-600">Advertisement</p>
    </div>
  );
}
