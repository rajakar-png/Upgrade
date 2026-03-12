'use client';

import { ShieldAlert } from 'lucide-react';

export function AdBlockerWarning() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <ShieldAlert className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-red-400">Ad Blocker Detected</h2>
        <p className="mt-3 text-sm text-gray-400">
          Please disable your ad blocker to earn coins. Ads help keep this platform free
          and allow us to reward you with coins.
        </p>
        <div className="mt-6 rounded-xl bg-white/[0.03] p-4 text-left">
          <p className="text-xs font-semibold text-gray-300">How to disable your ad blocker:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-gray-500">
            <li>Click the ad blocker icon in your browser toolbar</li>
            <li>Select &ldquo;Pause&rdquo; or &ldquo;Disable&rdquo; for this site</li>
            <li>Refresh this page</li>
          </ol>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-6 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/30"
        >
          I&apos;ve Disabled It — Refresh
        </button>
      </div>
    </div>
  );
}
