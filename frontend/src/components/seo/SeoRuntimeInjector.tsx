'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface SeoPayload {
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterCardTitle?: string | null;
  twitterCardDesc?: string | null;
  twitterCardImage?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function SeoRuntimeInjector() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function loadSeo() {
      try {
        const res = await fetch(`/api/site/seo/by-path?path=${encodeURIComponent(pathname || '/')}`);
        if (!res.ok || !active) return;
        const seo = (await res.json()) as SeoPayload | null;
        if (!seo || !active) return;

        if (seo.metaTitle) document.title = seo.metaTitle;
        if (seo.metaDescription) {
          upsertMeta('meta[name="description"]', { name: 'description', content: seo.metaDescription });
        }
        if (seo.metaKeywords) {
          upsertMeta('meta[name="keywords"]', { name: 'keywords', content: seo.metaKeywords });
        }

        const robots = `${seo.robotsIndex === false ? 'noindex' : 'index'},${seo.robotsFollow === false ? 'nofollow' : 'follow'}`;
        upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });

        if (seo.ogTitle) upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.ogTitle });
        if (seo.ogDescription) upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.ogDescription });
        if (seo.ogImage) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: seo.ogImage });

        if (seo.twitterCardTitle) upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.twitterCardTitle });
        if (seo.twitterCardDesc) upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.twitterCardDesc });
        if (seo.twitterCardImage) upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.twitterCardImage });

        upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });

        if (seo.canonicalUrl) {
          upsertCanonical(seo.canonicalUrl);
        }
      } catch {
        // Ignore runtime SEO failures to avoid user-facing impact.
      }
    }

    loadSeo();
    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
