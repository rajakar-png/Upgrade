import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { fetchSeoByPath, toNextMetadata } from '@/lib/seo';

interface SlugPageProps {
  params: {
    slug: string;
  };
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function labelFromPageKey(pageKey: string | null | undefined) {
  if (!pageKey) return 'Guide';
  return pageKey
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function summaryFromSlug(slug: string) {
  const title = titleFromSlug(slug);
  return `This guide explains ${title.toLowerCase()} with practical steps, common mistakes to avoid, and optimization tips for better performance.`;
}

function buildFaqItems(topicTitle: string) {
  return [
    {
      q: `What is the fastest way to start ${topicTitle.toLowerCase()}?`,
      a: 'Start with a clear setup checklist: choose resources, configure software, secure access, and test performance before sharing publicly.',
    },
    {
      q: `How do I optimize ${topicTitle.toLowerCase()} for speed?`,
      a: 'Use caching where possible, remove unnecessary plugins/modules, compress heavy assets, and monitor CPU/RAM usage regularly.',
    },
    {
      q: `How can I make this page rank better on Google?`,
      a: 'Keep content useful and complete, include search-intent headings, add internal links from high-traffic pages, and earn relevant backlinks over time.',
    },
  ];
}

function parseFaqJson(raw: string | null | undefined, topicTitle: string) {
  if (!raw) return buildFaqItems(topicTitle);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return buildFaqItems(topicTitle);
    const filtered = parsed
      .filter((item) => item && typeof item.q === 'string' && typeof item.a === 'string')
      .map((item) => ({ q: item.q.trim(), a: item.a.trim() }))
      .filter((item) => item.q && item.a);
    return filtered.length ? filtered : buildFaqItems(topicTitle);
  } catch {
    return buildFaqItems(topicTitle);
  }
}

function parseRelatedLinksJson(raw: string | null | undefined) {
  const fallback = [
    { label: 'Homepage', href: '/' },
    { label: 'Hosting Plans', href: '/plans' },
    { label: 'Login', href: '/login' },
  ];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const filtered = parsed
      .filter((item) => item && typeof item.label === 'string' && typeof item.href === 'string')
      .map((item) => ({ label: item.label.trim(), href: item.href.trim() }))
      .filter((item) => item.label && item.href);
    return filtered.length ? filtered : fallback;
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const path = `/${params.slug}`;
  const seo = await fetchSeoByPath(path);

  const fallbackTitle = `${titleFromSlug(params.slug)} | AstraNodes`;
  return toNextMetadata(seo, {
    title: fallbackTitle,
    description: `Read more about ${titleFromSlug(params.slug)} on AstraNodes.`,
  });
}

export default async function DynamicSlugPage({ params }: SlugPageProps) {
  const path = `/${params.slug}`;
  const seo = await fetchSeoByPath(path);

  // Only render slug pages that are configured in SEO settings.
  if (!seo) {
    notFound();
  }

  const articleTitle = seo.metaTitle || titleFromSlug(params.slug);
  const articleDescription = seo.metaDescription || summaryFromSlug(params.slug);
  const articleLabel = labelFromPageKey(seo.pageKey);
  const canonical = seo.canonicalUrl || `https://example.com${path}`;
  const publishedAt = new Date().toISOString();
  const faqItems = parseFaqJson(seo.faqJson, articleTitle);
  const relatedLinks = parseRelatedLinksJson(seo.relatedLinksJson);
  const articleBody = seo.articleBody || '';
  const articleParagraphs = articleBody
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: articleTitle,
    description: articleDescription,
    datePublished: publishedAt,
    dateModified: publishedAt,
    mainEntityOfPage: canonical,
    author: {
      '@type': 'Organization',
      name: 'AstraNodes',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AstraNodes',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicNav />
      <main className="min-h-[70vh] px-6 py-16">
        <article className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-10">
          <header className="space-y-4 border-b border-white/10 pb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#ff7a18]">{articleLabel}</p>
            <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">{articleTitle}</h1>
            <p className="text-base leading-7 text-gray-300">{articleDescription}</p>
            <p className="text-xs text-gray-500">Published by AstraNodes</p>
          </header>

          {articleParagraphs.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Guide</h2>
              <div className="space-y-4 text-sm leading-7 text-gray-300">
                {articleParagraphs.map((paragraph, idx) => (
                  <p key={`${idx}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-2xl font-bold text-white">Step 1: Plan Your Setup</h2>
              <p className="text-sm leading-7 text-gray-300">
                Define your requirements first: expected traffic, software stack, and uptime goals. Clear planning helps avoid expensive migrations and downtime later.
              </p>
              <h3 className="text-lg font-semibold text-gray-100">Checklist</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-gray-300">
                <li>Choose region and resources (CPU, RAM, storage).</li>
                <li>Set access controls and backup policy.</li>
                <li>Prepare monitoring and alerting basics.</li>
              </ul>
            </section>
          )}

          <section className="space-y-4 border-t border-white/10 pt-6">
            <h2 className="text-2xl font-bold text-white">FAQ</h2>
            <div className="space-y-4">
              {faqItems.map((item) => (
                <div key={item.q} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="text-base font-semibold text-gray-100">{item.q}</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-300">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 border-t border-white/10 pt-6">
            <h2 className="text-lg font-bold text-white">Related Pages</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {relatedLinks.map((link) => (
                <Link key={`${link.label}-${link.href}`} href={link.href} className="rounded-lg border border-white/10 px-3 py-1.5 text-gray-200 hover:border-[#ff7a18]/50 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
            <p className="pt-2 text-xs text-gray-500">Canonical URL: {canonical}</p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
