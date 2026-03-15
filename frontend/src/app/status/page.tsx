import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'System Status | AstraNodes',
  description: 'Live health status for AstraNodes services including API, database, and Redis.',
};

interface HealthResponse {
  status: string;
  timestamp: string;
  checks: {
    database?: string;
    redis?: string;
  };
}

function statusBadge(status: string) {
  if (status === 'ok') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

async function getHealth(): Promise<HealthResponse | null> {
  try {
    const baseUrl = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const health = await getHealth();
  const checks = [
    { key: 'API', value: health?.status === 'ok' ? 'ok' : 'error' },
    { key: 'Database', value: health?.checks?.database || 'error' },
    { key: 'Redis', value: health?.checks?.redis || 'error' },
  ];

  return (
    <>
      <PublicNav />
      <main className="min-h-[70vh] px-6 py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          <header className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#ff7a18]">System Status</p>
            <h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Platform Health</h1>
            <p className="mt-4 text-sm leading-7 text-gray-300">
              Real-time service checks for the API infrastructure and core dependencies.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {checks.map((check) => (
              <article key={check.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-sm font-semibold text-gray-300">{check.key}</h2>
                <div className={`mt-3 inline-flex rounded-lg border px-3 py-1.5 text-sm font-medium ${statusBadge(check.value)}`}>
                  {check.value === 'ok' ? 'Operational' : 'Issue Detected'}
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-gray-300">
            <p>Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Unavailable'}</p>
            {!health && <p className="mt-2 text-red-300">Health endpoint is not reachable right now. Check backend service availability.</p>}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
