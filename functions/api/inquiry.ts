import { z } from 'zod';
import { fail, ok } from '../lib/http';
import type { Env } from '../lib/types';

const schema = z.object({
  serviceId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  contact: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7),
    notes: z.string().max(2000).optional().default(''),
  }),
});

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    return fail(400, 'BAD_REQUEST', error instanceof Error ? error.message : 'Invalid payload');
  }

  const result = await env.FNLSTG_DB.prepare(
    `INSERT INTO inquiries (service_id, date, time, name, email, phone, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      payload.serviceId,
      payload.date,
      payload.time,
      payload.contact.name,
      payload.contact.email,
      payload.contact.phone,
      payload.contact.notes ?? '',
    )
    .run();

  return ok({ id: Number(result.meta.last_row_id ?? 0) }, 201);
};
