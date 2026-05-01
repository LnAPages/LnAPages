import { z } from 'zod';
import { ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const schema = z.object({
  admin_email: z.string().email(),
  admin_phone: z.string(),
  channel: z.enum(['email', 'sms', 'both']),
  notify_on_booking: z.boolean(),
  notify_on_payment: z.boolean(),
  notify_on_intake: z.boolean(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const row = await context.env.LNAPAGES_DB.prepare('SELECT * FROM notification_prefs WHERE id = 1').first();
  return ok(row);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = schema.parse(await context.request.json());
  await context.env.LNAPAGES_DB.prepare(
    `INSERT INTO notification_prefs (id, admin_email, admin_phone, channel, notify_on_booking, notify_on_payment, notify_on_intake, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
      admin_email = excluded.admin_email,
      admin_phone = excluded.admin_phone,
      channel = excluded.channel,
      notify_on_booking = excluded.notify_on_booking,
      notify_on_payment = excluded.notify_on_payment,
      notify_on_intake = excluded.notify_on_intake,
      updated_at = datetime('now')`,
  ).bind(payload.admin_email, payload.admin_phone, payload.channel, payload.notify_on_booking ? 1 : 0, payload.notify_on_payment ? 1 : 0, payload.notify_on_intake ? 1 : 0).run();
  return ok(payload);
};
