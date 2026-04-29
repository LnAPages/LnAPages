import Stripe from 'stripe';
import { fail, ok } from '../../lib/http';
import type { Env } from '../../lib/types';

async function sendAdminNotification(
  env: Env,
  event: 'payment' | 'booking' | 'intake',
  subject: string,
  message: string,
) {
  await fetch(`${env.APP_URL}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, subject, message }),
  });
}

async function generateInvoice(env: Env, bookingId: number) {
  await fetch(`${env.APP_URL}/api/invoices/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId }),
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const signature = request.headers.get('stripe-signature');
  const payload = await request.text();
  if (!signature) {
    return fail(400, 'BAD_REQUEST', 'Missing stripe signature');
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return fail(500, 'MISCONFIGURED', 'Stripe webhook is not configured');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return fail(400, 'INVALID_SIGNATURE', err instanceof Error ? err.message : 'Bad signature');
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const booking = await env.FNLSTG_DB
      .prepare('SELECT id, deposit_amount_cents FROM bookings WHERE stripe_payment_intent = ?')
      .bind(intent.id)
      .first<{ id: number; deposit_amount_cents: number }>();
    if (booking) {
      const paidInFull = (booking.deposit_amount_cents ?? 0) === 0 ? 1 : 0;
      await env.FNLSTG_DB.prepare(
        "UPDATE bookings SET status = ?, stripe_payment_intent = ?, paid_in_full = ?, paid_at = datetime('now'), deposit_paid = 1, updated_at = datetime('now') WHERE id = ?",
      )
        .bind('paid', intent.id, paidInFull, booking.id)
        .run();
      await generateInvoice(env, booking.id);
      await sendAdminNotification(env, 'payment', 'New payment received', `Booking #${booking.id} was paid.`);
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = Number(session.metadata?.booking_id ?? 0);
    const chargeMode = session.metadata?.charge_mode === 'deposit' ? 'deposit' : 'full';
    const paidInFull = chargeMode === 'full' ? 1 : 0;
    if (bookingId > 0) {
      await env.FNLSTG_DB.prepare(
        "UPDATE bookings SET status = ?, stripe_payment_intent = ?, paid_in_full = ?, deposit_paid = 1, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      )
        .bind(paidInFull === 1 ? 'paid' : 'deposit_paid', String(session.payment_intent ?? ''), paidInFull, bookingId)
        .run();
      await generateInvoice(env, bookingId);
      await sendAdminNotification(env, 'payment', 'New payment received', `Booking #${bookingId} — ${chargeMode === 'full' ? 'paid in full' : 'deposit received'}.`);
    }
  }

  return ok({ received: true });
};
