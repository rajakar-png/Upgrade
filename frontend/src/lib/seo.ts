import type { Metadata } from 'next';

export interface SeoRecord {
  id: number;
  pageKey: string;
  pageType: string;
  routePath: string;
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCardTitle: string | null;
  twitterCardDesc: string | null;
  twitterCardImage: string | null;
  articleBody: string | null;
  faqJson: string | null;
  relatedLinksJson: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  isPublic: boolean;
}

function getBackendBaseUrl() {
  return (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');
}

export async function fetchSeoByPath(path: string): Promise<SeoRecord | null> {
  try {
    const baseUrl = getBackendBaseUrl();
    const url = `${baseUrl}/api/site/seo/by-path?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

export function toNextMetadata(seo: SeoRecord | null, fallback: Metadata): Metadata {
  if (!seo) return fallback;

  return {
    ...fallback,
    title: seo.metaTitle || fallback.title,
    description: seo.metaDescription || fallback.description,
    keywords: seo.metaKeywords || fallback.keywords,
    alternates: {
      canonical: seo.canonicalUrl || undefined,
    },
    robots: {
      index: seo.robotsIndex,
      follow: seo.robotsFollow,
    },
    openGraph: {
      title: seo.ogTitle || seo.metaTitle || undefined,
      description: seo.ogDescription || seo.metaDescription || undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.twitterCardTitle || seo.metaTitle || undefined,
      description: seo.twitterCardDesc || seo.metaDescription || undefined,
      images: seo.twitterCardImage ? [seo.twitterCardImage] : undefined,
    },
  };
}
