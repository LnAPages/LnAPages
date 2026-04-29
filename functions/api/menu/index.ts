import { menuSchema } from '../../../shared/schemas/menu';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const KV_KEY = 'menu-links';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FNLSTG_CONFIG.get(KV_KEY, 'json');
  const parsed = menuSchema.safeParse(raw);
  if (parsed.success) {
    return ok(parsed.data.links.sort((a, b) => a.sort_order - b.sort_order));
  }

  const fallback = [
    { id: 'home', label: 'Home', url: '/', new_tab: false, sort_order: 0 },
    { id: 'services', label: 'Services', url: '/services', new_tab: false, sort_order: 1 },
    { id: 'booking', label: 'Booking', url: '/booking', new_tab: false, sort_order: 2 },
    { id: 'gallery', label: 'Gallery', url: '/gallery', new_tab: false, sort_order: 3 },
    { id: 'quote', label: 'Quote', url: '/quote', new_tab: false, sort_order: 4 },
  ];
  return ok(fallback);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, menuSchema);
  await context.env.FNLSTG_CONFIG.put(KV_KEY, JSON.stringify(payload));
  return ok(payload.links.sort((a, b) => a.sort_order - b.sort_order));
};
