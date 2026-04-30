import { z } from 'zod';
import { ok } from '../../lib/http';
import type { Env } from '../../lib/types';

const schema = z.object({
  event: z.enum(['booking', 'payment', 'intake']),
  subject: z.string().min(1),
  message: z.string().min(1),
});

async function sendEmail(env: Env, to: string, subject: string, message: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, html: `<p>${message}</p>` }),
  });
}

async function sendSms(env: Env, to: string, message: string): Promise<void> {
  const body = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: message });
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = schema.parse(await request.json());
  const prefs = await env.LNAPAGES_DB.prepare('SELECT * FROM notification_prefs WHERE id = 1').first<{
    admin_email: string;
    admin_phone: string;
    channel: 'email' | 'sms' | 'both';
    notify_on_booking: number;
    notify_on_payment: number;
    notify_on_intake: number;
  }>();

  if (!prefs) return ok({ delivered: false, reason: 'No notification preferences set' });

  const shouldNotify =
    (payload.event === 'booking' && prefs.notify_on_booking === 1) ||
    (payload.event === 'payment' && prefs.notify_on_payment === 1) ||
    (payload.event === 'intake' && prefs.notify_on_intake === 1);

  if (!shouldNotify) return ok({ delivered: false, reason: 'Notifications disabled for this event' });

  if (prefs.channel === 'email' || prefs.channel === 'both') {
    await sendEmail(env, prefs.admin_email, payload.subject, payload.message);
  }
  if (prefs.channel === 'sms' || prefs.channel === 'both') {
    await sendSms(env, prefs.admin_phone, payload.message);
  }

  return ok({ delivered: true });
};
