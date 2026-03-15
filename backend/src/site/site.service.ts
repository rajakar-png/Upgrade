import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServerStatus } from '@prisma/client';

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService) {}

  private normalizePath(path: string) {
    const raw = (path || '/').trim();
    if (!raw) return '/';
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withSlash.replace(/\/+$/, '') || '/';
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async getSection(sectionName: string) {
    const row = await this.prisma.siteContent.findUnique({ where: { sectionName } });
    return row ? JSON.parse(row.contentJson) : null;
  }

  async getAllSections() {
    const rows = await this.prisma.siteContent.findMany();
    return rows.reduce((acc, row) => {
      acc[row.sectionName] = JSON.parse(row.contentJson);
      return acc;
    }, {} as Record<string, any>);
  }

  async upsertSection(sectionName: string, content: any) {
    return this.prisma.siteContent.upsert({
      where: { sectionName },
      create: { sectionName, contentJson: JSON.stringify(content) },
      update: { contentJson: JSON.stringify(content) },
    });
  }

  async getSettings() {
    return this.prisma.siteSetting.findFirst();
  }

  async updateSettings(data: any) {
    const existing = await this.prisma.siteSetting.findFirst();
    if (existing) {
      return this.prisma.siteSetting.update({ where: { id: existing.id }, data });
    }
    return this.prisma.siteSetting.create({ data });
  }

  async getLandingPlans() {
    const [coin, real] = await this.prisma.$transaction([
      this.prisma.planCoin.findMany({ orderBy: { coinPrice: 'asc' } }),
      this.prisma.planReal.findMany({ orderBy: { price: 'asc' } }),
    ]);
    return { coin, real };
  }

  async getFeatures() {
    return this.prisma.feature.findMany();
  }

  async getActivePopups() {
    return this.prisma.popupMessage.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPublicStats() {
    const [activeUsers, activeServers] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.server.count({ where: { status: ServerStatus.active } }),
    ]);
    return { activeUsers, activeServers, uptime: '99.9%' };
  }

  async getSeoByPath(path: string) {
    const routePath = this.normalizePath(path);
    const slugCandidate = routePath.replace(/^\//, '') || undefined;
    const seo = await this.prisma.seoPage.findFirst({
      where: {
        OR: [
          { routePath },
          ...(slugCandidate ? [{ slug: slugCandidate }] : []),
        ],
      },
    });
    if (!seo) return null;
    return {
      ...seo,
      robotsMeta: `${seo.robotsIndex ? 'index' : 'noindex'},${seo.robotsFollow ? 'follow' : 'nofollow'}`,
    };
  }

  async getSeoByKey(pageKey: string) {
    const seo = await this.prisma.seoPage.findUnique({ where: { pageKey } });
    if (!seo) return null;
    return {
      ...seo,
      robotsMeta: `${seo.robotsIndex ? 'index' : 'noindex'},${seo.robotsFollow ? 'follow' : 'nofollow'}`,
    };
  }

  async getSitemapXml() {
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const [seoRows, settings] = await this.prisma.$transaction([
      this.prisma.seoPage.findMany({
        where: { isPublic: true, robotsIndex: true },
        select: { routePath: true, updatedAt: true },
        orderBy: { routePath: 'asc' },
      }),
      this.prisma.siteSetting.findFirst({ select: { sitemapUrlsJson: true } }),
    ]);

    const entries = new Map<string, Date>();
    entries.set('/', new Date());
    for (const row of seoRows) {
      entries.set(this.normalizePath(row.routePath), row.updatedAt);
    }

    try {
      const parsed = JSON.parse(settings?.sitemapUrlsJson || '[]');
      if (Array.isArray(parsed)) {
        for (const rawUrl of parsed) {
          if (typeof rawUrl !== 'string') continue;
          const url = rawUrl.trim();
          if (!url) continue;
          // Accept absolute URLs and same-site paths.
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const normalized = url.replace(/\/$/, '');
            const path = normalized.startsWith(baseUrl) ? normalized.slice(baseUrl.length) || '/' : null;
            if (path) entries.set(this.normalizePath(path), new Date());
          } else {
            entries.set(this.normalizePath(url), new Date());
          }
        }
      }
    } catch {
      // Ignore malformed custom sitemap JSON and continue with SEO-generated routes.
    }

    const urls = Array.from(entries.entries()).map(([path, updatedAt]) => {
      const loc = `${baseUrl}${path === '/' ? '' : path}`;
      return [
        '  <url>',
        `    <loc>${this.escapeXml(loc)}</loc>`,
        `    <lastmod>${updatedAt.toISOString()}</lastmod>`,
        '  </url>',
      ].join('\n');
    }).join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n');
  }

  async getRobotsTxt() {
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const settings = await this.prisma.siteSetting.findFirst({ select: { robotsTxt: true } });
    if (settings?.robotsTxt?.trim()) return settings.robotsTxt;
    return `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml`;
  }
}
