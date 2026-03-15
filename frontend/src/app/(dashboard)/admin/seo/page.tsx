'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';

type PageType = 'homepage' | 'main' | 'blog' | 'product' | 'service' | 'dynamic';

interface FaqItem {
  q: string;
  a: string;
}

interface RelatedLinkItem {
  label: string;
  href: string;
}

interface SeoPage {
  id: number;
  pageKey: string;
  pageType: PageType;
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
  updatedAt: string;
}

type SeoForm = Omit<SeoPage, 'id' | 'updatedAt'> & { id?: number };

const EMPTY_FORM: SeoForm = {
  pageKey: '',
  pageType: 'main',
  routePath: '/',
  slug: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  canonicalUrl: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterCardTitle: '',
  twitterCardDesc: '',
  twitterCardImage: '',
  articleBody: '',
  faqJson: '[\n  {"q":"What is this page about?","a":"Answer here"}\n]',
  relatedLinksJson: '[\n  {"label":"Homepage","href":"/"}\n]',
  robotsIndex: true,
  robotsFollow: true,
  isPublic: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseFaqItems(raw: string | null | undefined): FaqItem[] {
  if (!raw) return [{ q: '', a: '' }];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [{ q: '', a: '' }];
    const rows = parsed
      .filter((item) => item && typeof item.q === 'string' && typeof item.a === 'string')
      .map((item) => ({ q: item.q, a: item.a }));
    return rows.length ? rows : [{ q: '', a: '' }];
  } catch {
    return [{ q: '', a: '' }];
  }
}

function parseRelatedLinks(raw: string | null | undefined): RelatedLinkItem[] {
  if (!raw) return [{ label: '', href: '' }];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [{ label: '', href: '' }];
    const rows = parsed
      .filter((item) => item && typeof item.label === 'string' && typeof item.href === 'string')
      .map((item) => ({ label: item.label, href: item.href }));
    return rows.length ? rows : [{ label: '', href: '' }];
  } catch {
    return [{ label: '', href: '' }];
  }
}

export default function AdminSeoPage() {
  const [items, setItems] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SeoForm | null>(null);
  const [robotsTxt, setRobotsTxt] = useState('');
  const [robotsSaving, setRobotsSaving] = useState(false);
  const [sitemapUrls, setSitemapUrls] = useState<string[]>(['']);
  const [sitemapSaving, setSitemapSaving] = useState(false);

  const previewTitle = form?.metaTitle || 'Your page title appears here';
  const previewDesc = form?.metaDescription || 'Your meta description appears here and should clearly explain the page for search users.';
  const previewUrl = form?.canonicalUrl || `https://example.com${form?.routePath || '/'}`;

  const robotsMeta = useMemo(() => {
    if (!form) return 'index,follow';
    return `${form.robotsIndex ? 'index' : 'noindex'},${form.robotsFollow ? 'follow' : 'nofollow'}`;
  }, [form]);

  const faqItems = useMemo(() => parseFaqItems(form?.faqJson), [form?.faqJson]);
  const relatedLinks = useMemo(() => parseRelatedLinks(form?.relatedLinksJson), [form?.relatedLinksJson]);

  async function loadSeoPages() {
    setLoading(true);
    try {
      const [pagesRes, robotsRes, sitemapRes] = await Promise.all([
        api.get<SeoPage[]>('/admin/seo/pages'),
        api.get<{ robotsTxt: string }>('/admin/seo/robots'),
        api.get<{ sitemapUrls: string[] }>('/admin/seo/sitemap-urls'),
      ]);
      setItems(pagesRes.data || []);
      setRobotsTxt(robotsRes.data?.robotsTxt || '');
      const parsedUrls = Array.isArray(sitemapRes.data?.sitemapUrls) ? sitemapRes.data.sitemapUrls : [];
      setSitemapUrls(parsedUrls.length ? parsedUrls : ['']);
    } catch {
      toast.error('Failed to load SEO settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeoPages();
  }, []);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(item: SeoPage) {
    setForm({ ...item, slug: item.slug || '' });
  }

  function updateField<K extends keyof (typeof EMPTY_FORM)>(key: K, value: (typeof EMPTY_FORM)[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }

  function setFaqItems(nextItems: FaqItem[]) {
    updateField('faqJson', JSON.stringify(nextItems, null, 2));
  }

  function setRelatedLinks(nextLinks: RelatedLinkItem[]) {
    updateField('relatedLinksJson', JSON.stringify(nextLinks, null, 2));
  }

  async function saveSeoPage() {
    if (!form) return;
    if (!form.pageKey.trim()) {
      toast.error('Page key is required');
      return;
    }
    if (!form.routePath.trim()) {
      toast.error('Route path is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || '',
      };

      if (form.id) {
        await api.put(`/admin/seo/pages/${form.id}`, payload);
        toast.success('SEO page updated');
      } else {
        await api.post('/admin/seo/pages', payload);
        toast.success('SEO page created');
      }

      setForm(null);
      loadSeoPages();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save SEO page');
    } finally {
      setSaving(false);
    }
  }

  async function removeSeoPage(id: number) {
    if (!confirm('Delete this SEO page configuration?')) return;
    try {
      await api.delete(`/admin/seo/pages/${id}`);
      toast.success('SEO page removed');
      loadSeoPages();
    } catch {
      toast.error('Failed to delete SEO page');
    }
  }

  async function saveRobotsTxt() {
    setRobotsSaving(true);
    try {
      await api.put('/admin/seo/robots', { robotsTxt });
      toast.success('robots.txt updated');
    } catch {
      toast.error('Failed to update robots.txt');
    } finally {
      setRobotsSaving(false);
    }
  }

  async function saveSitemapUrls() {
    setSitemapSaving(true);
    try {
      const normalized = Array.from(new Set(sitemapUrls.map((u) => u.trim()).filter(Boolean)));
      await api.put('/admin/seo/sitemap-urls', { sitemapUrls: normalized });
      setSitemapUrls(normalized.length ? normalized : ['']);
      toast.success('Sitemap URLs updated');
    } catch {
      toast.error('Failed to update sitemap URLs');
    } finally {
      setSitemapSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SEO Settings</h1>
          <p className="mt-1 text-sm text-gray-400">Manage page-level metadata, slugs, robots rules, and search previews.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New SEO Page
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-semibold">Configured Pages</h2>
          <div className="space-y-3">
            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {!loading && items.length === 0 && <p className="text-sm text-gray-500">No SEO pages configured yet.</p>}
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-100">{item.metaTitle || item.pageKey}</p>
                    <p className="truncate text-xs text-gray-400">{item.routePath} · {item.pageType}</p>
                    <p className="mt-1 text-xs text-gray-500">Robots: {item.robotsIndex ? 'index' : 'noindex'},{item.robotsFollow ? 'follow' : 'nofollow'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeSeoPage(item.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-sky-400" />
            <h2 className="text-lg font-semibold">Google Preview</h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#11161d] p-4">
            <p className="line-clamp-1 text-xl text-[#8ab4f8]">{previewTitle}</p>
            <p className="mt-1 line-clamp-1 text-sm text-[#9aa0a6]">{previewUrl}</p>
            <p className="mt-2 line-clamp-2 text-sm text-[#bdc1c6]">{previewDesc}</p>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-gray-400">
            <p>Robots meta preview: <span className="text-gray-200">{robotsMeta}</span></p>
            <p>Canonical preview: <span className="text-gray-200">{form?.canonicalUrl || '(none)'}</span></p>
            <p>Open Graph image: <span className="text-gray-200">{form?.ogImage || '(none)'}</span></p>
            <p>Twitter image: <span className="text-gray-200">{form?.twitterCardImage || '(none)'}</span></p>
          </div>
        </section>
      </div>

      {form && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">{form.id ? 'Edit SEO Page' : 'Create SEO Page'}</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Page Key" value={form.pageKey} onChange={(e) => updateField('pageKey', e.target.value)} placeholder="homepage | blog-how-to-host" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Page Type</label>
              <select
                value={form.pageType}
                onChange={(e) => updateField('pageType', e.target.value as PageType)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
              >
                <option value="homepage">Homepage</option>
                <option value="main">Main Page</option>
                <option value="blog">Blog Page</option>
                <option value="product">Product Page</option>
                <option value="service">Service Page</option>
                <option value="dynamic">Dynamic Page</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Route Path" value={form.routePath} onChange={(e) => updateField('routePath', e.target.value)} placeholder="/blog/how-to-make-server" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Slug</label>
              <div className="flex gap-2">
                <Input value={form.slug || ''} onChange={(e) => updateField('slug', e.target.value)} placeholder="how-to-make-server" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => updateField('slug', slugify(form.metaTitle || form.pageKey || ''))}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <Input label="Meta Title" value={form.metaTitle || ''} onChange={(e) => updateField('metaTitle', e.target.value)} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Meta Description</label>
            <textarea
              rows={3}
              value={form.metaDescription || ''}
              onChange={(e) => updateField('metaDescription', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
            />
          </div>
          <Input label="Meta Keywords" value={form.metaKeywords || ''} onChange={(e) => updateField('metaKeywords', e.target.value)} placeholder="hosting, minecraft server, game panel" />
          <Input label="Canonical URL" value={form.canonicalUrl || ''} onChange={(e) => updateField('canonicalUrl', e.target.value)} placeholder="https://example.com/route" />

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Open Graph Title" value={form.ogTitle || ''} onChange={(e) => updateField('ogTitle', e.target.value)} />
            <Input label="Open Graph Image" value={form.ogImage || ''} onChange={(e) => updateField('ogImage', e.target.value)} placeholder="https://.../og.jpg" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Open Graph Description</label>
            <textarea
              rows={2}
              value={form.ogDescription || ''}
              onChange={(e) => updateField('ogDescription', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Twitter Card Title" value={form.twitterCardTitle || ''} onChange={(e) => updateField('twitterCardTitle', e.target.value)} />
            <Input label="Twitter Card Image" value={form.twitterCardImage || ''} onChange={(e) => updateField('twitterCardImage', e.target.value)} placeholder="https://.../twitter.jpg" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Twitter Card Description</label>
            <textarea
              rows={2}
              value={form.twitterCardDesc || ''}
              onChange={(e) => updateField('twitterCardDesc', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.robotsIndex} onChange={(e) => updateField('robotsIndex', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]" />
              <span className="text-sm text-gray-300">Index</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.robotsFollow} onChange={(e) => updateField('robotsFollow', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]" />
              <span className="text-sm text-gray-300">Follow</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.isPublic} onChange={(e) => updateField('isPublic', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]" />
              <span className="text-sm text-gray-300">Public page</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Article Body (plain text)</label>
            <textarea
              rows={8}
              value={form.articleBody || ''}
              onChange={(e) => updateField('articleBody', e.target.value)}
              placeholder="Write the full article content for this SEO page..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">FAQ Items</label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setFaqItems([...faqItems, { q: '', a: '' }])}
                >
                  Add FAQ
                </Button>
              </div>
              <div className="space-y-2">
                {faqItems.map((item, idx) => (
                  <div key={`faq-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <Input
                      label={`Question ${idx + 1}`}
                      value={item.q}
                      onChange={(e) => {
                        const next = [...faqItems];
                        next[idx] = { ...next[idx], q: e.target.value };
                        setFaqItems(next);
                      }}
                    />
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Answer</label>
                      <textarea
                        rows={3}
                        value={item.a}
                        onChange={(e) => {
                          const next = [...faqItems];
                          next[idx] = { ...next[idx], a: e.target.value };
                          setFaqItems(next);
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = faqItems.filter((_, i) => i !== idx);
                          setFaqItems(next.length ? next : [{ q: '', a: '' }]);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Related Links</label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setRelatedLinks([...relatedLinks, { label: '', href: '' }])}
                >
                  Add Link
                </Button>
              </div>
              <div className="space-y-2">
                {relatedLinks.map((item, idx) => (
                  <div key={`link-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <Input
                      label={`Label ${idx + 1}`}
                      value={item.label}
                      onChange={(e) => {
                        const next = [...relatedLinks];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setRelatedLinks(next);
                      }}
                    />
                    <Input
                      label="URL Path"
                      value={item.href}
                      onChange={(e) => {
                        const next = [...relatedLinks];
                        next[idx] = { ...next[idx], href: e.target.value };
                        setRelatedLinks(next);
                      }}
                      placeholder="/plans"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = relatedLinks.filter((_, i) => i !== idx);
                          setRelatedLinks(next.length ? next : [{ label: '', href: '' }]);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveSeoPage} disabled={saving}>{saving ? 'Saving...' : form.id ? 'Update SEO Page' : 'Create SEO Page'}</Button>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">robots.txt Manager</h2>
        <textarea
          rows={10}
          value={robotsTxt}
          onChange={(e) => setRobotsTxt(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
        />
        <Button onClick={saveRobotsTxt} disabled={robotsSaving}>{robotsSaving ? 'Saving...' : 'Save robots.txt'}</Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sitemap URL Manager</h2>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSitemapUrls((prev) => [...prev, ''])}
          >
            Add URL
          </Button>
        </div>
        <p className="text-xs text-gray-500">Add extra URLs you want in sitemap.xml. Use paths like /docs or full URLs.</p>

        <div className="space-y-2">
          {sitemapUrls.map((url, idx) => (
            <div key={`sitemap-url-${idx}`} className="flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  const next = [...sitemapUrls];
                  next[idx] = e.target.value;
                  setSitemapUrls(next);
                }}
                placeholder="/docs"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = sitemapUrls.filter((_, i) => i !== idx);
                  setSitemapUrls(next.length ? next : ['']);
                }}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={saveSitemapUrls} disabled={sitemapSaving}>{sitemapSaving ? 'Saving...' : 'Save sitemap URLs'}</Button>
      </section>
    </div>
  );
}
