'use client';

import { useState, useEffect } from 'react';

export function useAdBlockDetector(enabled: boolean) {
  const [adBlockDetected, setAdBlockDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function detect() {
      // Method 1: Bait element — ad blockers hide elements with these class names
      const bait = document.createElement('div');
      bait.className = 'adsbox ad-banner ad-placeholder textads banner-ads';
      bait.style.cssText = 'position:absolute;top:-10px;left:-10px;width:1px;height:1px;';
      bait.innerHTML = '&nbsp;';
      document.body.appendChild(bait);

      // Give the ad blocker time to act on the bait element
      await new Promise((r) => setTimeout(r, 150));

      const baitBlocked = bait.offsetHeight === 0 || bait.clientHeight === 0 || !document.body.contains(bait);
      bait.remove();

      // Method 2: Try to fetch a URL that ad blockers typically block
      let fetchBlocked = false;
      try {
        const resp = await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
        });
        // If we get here, it wasn't blocked (no-cors always returns opaque response)
      } catch {
        fetchBlocked = true;
      }

      if (!cancelled) {
        setAdBlockDetected(baitBlocked || fetchBlocked);
        setChecking(false);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [enabled]);

  return { adBlockDetected, checking };
}
