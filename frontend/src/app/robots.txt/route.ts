export async function GET() {
  const baseUrl = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '');
  const fallbackHost = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  try {
    const res = await fetch(`${baseUrl}/api/site/robots.txt`, { next: { revalidate: 300 } });
    const robots = await res.text();
    return new Response(robots, {
      status: res.ok ? 200 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    const fallback = `User-agent: *\nAllow: /\nSitemap: ${fallbackHost}/sitemap.xml`;
    return new Response(fallback, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
