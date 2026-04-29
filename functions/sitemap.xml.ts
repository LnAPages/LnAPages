import type { Env } from './lib/types';

const routes = ['/', '/services', '/booking', '/gallery', '/quote'];

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const base = env.APP_URL.replace(/\/$/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes
    .map((route) => `<url><loc>${base}${route}</loc></url>`)
    .join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
