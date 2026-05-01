import { menuLinkSchema, menuSchema } from '../../../shared/schemas/menu';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';
import { z } from 'zod';

const KV_KEY = 'menu-links';

const DEFAULT_LINKS = [
  { id: 'home', label: 'Home', url: '/', new_tab: false, sort_order: 0 },
  { id: 'services', label: 'Services', url: '/services', new_tab: false, sort_order: 1 },
  { id: 'booking', label: 'Booking', url: '/booking', new_tab: false, sort_order: 2 },
  { id: 'gallery', label: 'Gallery', url: '/gallery', new_tab: false, sort_order: 3 },
  { id: 'quote', label: 'Quote', url: '/quote', new_tab: false, sort_order: 4 },
];

const DEFAULT_TALENTS = [
  { id: 'talent-web-design', label: 'Web Design', url: '/services?talent=web-design', new_tab: false, sort_order: 0 },
  { id: 'talent-photography', label: 'Photography', url: '/services?talent=photography', new_tab: false, sort_order: 1 },
  { id: 'talent-videography', label: 'Videography', url: '/services?talent=videography', new_tab: false, sort_order: 2 },
  { id: 'talent-content-promotion', label: 'Content Promotion', url: '/services?talent=content-promotion', new_tab: false, sort_order: 3 },
  { id: 'talent-artist-packages', label: 'Artist Packages', url: '/services?talent=artist-packages', new_tab: false, sort_order: 4 },
];

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.LNAPAGES_CONFIG.get(KV_KEY, 'json');
  const parsed = menuSchema.safeParse(raw);
  if (parsed.success) {
    return ok({
      links: parsed.data.links.sort((a, b) => a.sort_order - b.sort_order),
      talents: parsed.data.talents.sort((a, b) => a.sort_order - b.sort_order),
    });
  }

  // Legacy: KV may hold a flat array of links (old format) — migrate on read.
  const legacyLinks = z.array(menuLinkSchema).safeParse(raw);
  if (legacyLinks.success) {
    return ok({
      links: legacyLinks.data.sort((a, b) => a.sort_order - b.sort_order),
      talents: DEFAULT_TALENTS,
    });
  }

  return ok({ links: DEFAULT_LINKS, talents: DEFAULT_TALENTS });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, menuSchema);
  await context.env.LNAPAGES_CONFIG.put(KV_KEY, JSON.stringify(payload));
  return ok({
    links: payload.links.sort((a, b) => a.sort_order - b.sort_order),
    talents: payload.talents.sort((a, b) => a.sort_order - b.sort_order),
  });
};
