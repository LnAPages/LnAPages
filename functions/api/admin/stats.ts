import { ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

type BookingStatRow = {
  created_at: string | null;
  start_time: string | null;
  status: string | null;
  amount_cents: number | null;
  category: string | null;
};

type OrderStatRow = {
  created_at: string | null;
  revenue_cents: number | null;
};

type GalleryStatRow = {
  id: number;
  title: string | null;
  r2_key: string | null;
  sort_order: number | null;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env } = context;

  let bookingRows: BookingStatRow[] = [];
  try {
    const query = await env.LNAPAGES_DB.prepare(
      `SELECT
         b.created_at,
         b.start_time,
         b.status,
         COALESCE(b.amount_cents, 0) AS amount_cents,
         COALESCE(i.category, i.slug, 'general') AS category
       FROM bookings b
       LEFT JOIN items i ON i.id = b.item_id
       ORDER BY COALESCE(b.start_time, b.created_at) DESC`,
    ).all<BookingStatRow>();
    bookingRows = query.results ?? [];
  } catch {
    bookingRows = [];
  }

  let orderRows: OrderStatRow[] = [];
  try {
    const query = await env.LNAPAGES_DB.prepare(
      `SELECT o.created_at, COALESCE(p.price_cents, 0) AS revenue_cents
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       ORDER BY o.created_at DESC`,
    ).all<OrderStatRow>();
    orderRows = query.results ?? [];
  } catch {
    orderRows = [];
  }

  let galleryRows: GalleryStatRow[] = [];
  try {
    const query = await env.LNAPAGES_DB.prepare(
      `SELECT id, title, r2_key, sort_order
       FROM gallery_items
       ORDER BY sort_order ASC, id DESC
       LIMIT 10`,
    ).all<GalleryStatRow>();
    galleryRows = query.results ?? [];
  } catch {
    galleryRows = [];
  }

  return ok({
    bookings: bookingRows.map((row) => ({
      date: row.start_time || row.created_at || '',
      status: (row.status ?? '').toLowerCase(),
      amount_cents: Number(row.amount_cents ?? 0),
      category: (row.category ?? 'general').trim() || 'general',
    })),
    orders: orderRows.map((row) => ({
      date: row.created_at || '',
      revenue_cents: Number(row.revenue_cents ?? 0),
    })),
    gallery: galleryRows.map((row) => ({
      id: row.id,
      title: (row.title ?? '').trim(),
      r2_key: row.r2_key ?? '',
      count: 0,
      sort_order: Number(row.sort_order ?? 0),
    })),
  });
};
