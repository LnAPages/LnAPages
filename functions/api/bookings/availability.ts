import { z } from 'zod';
import { ok } from '../../lib/http';
import type { Env } from '../../lib/types';

const schema = z.object({ start: z.string().min(10), end: z.string().min(10) });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const { start } = schema.parse({ start: url.searchParams.get('start') ?? '', end: url.searchParams.get('end') ?? '' });

  const dayStart = `${start}T00:00:00.000Z`;
  const dayEnd = `${start}T23:59:59.999Z`;
  const { results } = await env.LNAPAGES_DB.prepare('SELECT start_time FROM bookings WHERE start_time BETWEEN ? AND ? AND status != ?').bind(dayStart, dayEnd, 'cancelled').all<{ start_time: string }>();
  const used = new Set((results ?? []).map((row: { start_time: string }) => new Date(row.start_time).toISOString().slice(11, 16)));
  const slots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'].filter((slot) => !used.has(slot));
  return ok(slots);
};
