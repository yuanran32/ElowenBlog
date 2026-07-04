import type { APIRoute } from 'astro';

const robotsTxt = (sitemapUrl: URL) => `User-agent: *
Allow: /

Sitemap: ${sitemapUrl.href}
`;

export const GET: APIRoute = ({ site }) => {
    const sitemapUrl = new URL('sitemap-index.xml', site);
    return new Response(robotsTxt(sitemapUrl), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
};
