import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Documentation | AstraNodes',
  description: 'Get started with AstraNodes, set up your hosting environment, and manage your server with best practices.',
};

const sections = [
  {
    title: 'Getting Started',
    items: [
      'Create your account and verify your email.',
      'Choose a plan based on RAM, CPU, and storage requirements.',
      'Deploy your first server and test connectivity.',
    ],
  },
  {
    title: 'Server Management',
    items: [
      'Use the dashboard to start, stop, and monitor your instances.',
      'Configure backups and restore points before major updates.',
      'Track usage metrics to optimize performance and costs.',
    ],
  },
  {
    title: 'Security and Reliability',
    items: [
      'Use strong credentials and rotate tokens regularly.',
      'Restrict panel access and monitor login activity.',
      'Keep plugins and dependencies updated to avoid vulnerabilities.',
    ],
  },
];

export default function DocsPage() {
  return (
    <>
      <PublicNav />
      <main className="min-h-[70vh] px-6 py-16">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#ff7a18]">Documentation</p>
            <h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">AstraNodes Docs</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300">
              Everything you need to launch and manage your servers: setup guides, operational tips, and maintenance best practices.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-300">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-xl font-bold text-white">Quick Links</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/plans" className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-200 hover:border-[#ff7a18]/50 hover:text-white">
                View Plans
              </Link>
              <Link href="/status" className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-200 hover:border-[#ff7a18]/50 hover:text-white">
                Platform Status
              </Link>
              <Link href="/login" className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-200 hover:border-[#ff7a18]/50 hover:text-white">
                Dashboard Login
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
