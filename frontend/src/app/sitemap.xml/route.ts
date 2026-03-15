export async function GET() {
  const baseUrl = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

  const fallbackXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${siteUrl}</loc>`,
    `    <lastmod>${new Date().toISOString()}</lastmod>`,
    '  </url>',
    '</urlset>',
  ].join('\n');

  try {
    const res = await fetch(`${baseUrl}/api/site/sitemap.xml`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return new Response(fallbackXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=60',
        },
      });
    }
    const xml = await res.text();
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    return new Response(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  }
}
