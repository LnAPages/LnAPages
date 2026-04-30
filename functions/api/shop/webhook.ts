import Stripe from 'stripe';
import { fail, ok } from '../../lib/http';
import type { Env, PresignableR2Bucket } from '../../lib/types';

function presignUrlToString(presigned: string | URL | { url: string | URL }): string {
  if (typeof presigned === 'string') return presigned;
  if (presigned instanceof URL) return presigned.toString();
  if (typeof presigned.url === 'string') return presigned.url;
  return presigned.url.toString();
}

async function createDownloadUrl(env: Env, key: string): Promise<string | null> {
  const bucket = env.R2_SHOP as PresignableR2Bucket | undefined;
  if (!bucket || typeof bucket.createPresignedUrl !== 'function') return null;
  const presigned = await bucket.createPresignedUrl({ method: 'GET', key, expiresIn: 60 * 60 * 24 });
  return presignUrlToString(presigned);
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return fail(400, 'BAD_REQUEST', 'Missing stripe signature');
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return fail(500, 'MISCONFIGURED', 'Stripe webhook is not configured');
  }

  const body = await request.text();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return fail(400, 'INVALID_SIGNATURE', error instanceof Error ? error.message : 'Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const productId = Number(session.metadata?.product_id ?? 0);
    const email = String(session.customer_email ?? session.metadata?.email ?? '').trim();

    if (productId > 0 && email) {
      const existing = await env.LNAPAGES_DB.prepare(
        'SELECT id FROM orders WHERE stripe_session_id = ?',
      ).bind(session.id).first<{ id: number }>();
      if (!existing) {
        await env.LNAPAGES_DB.prepare(
          `INSERT INTO orders (stripe_session_id, product_id, email, download_token, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
        ).bind(session.id, productId, email, crypto.randomUUID()).run();
      }

      const product = await env.LNAPAGES_DB.prepare(
        'SELECT id, kind, r2_key FROM products WHERE id = ?',
      ).bind(productId).first<{ id: number; kind: string; r2_key: string | null }>();

      if (product?.kind === 'digital' && product.r2_key) {
        const downloadUrl = await createDownloadUrl(env, product.r2_key);
        if (downloadUrl) {
          await env.LNAPAGES_DB.prepare(
            `UPDATE orders SET fulfilled_at = datetime('now') WHERE stripe_session_id = ?`,
          ).bind(session.id).run();
          console.log(`[shop-webhook] send download URL to ${email}: ${downloadUrl}`);
        } else {
          console.log(`[shop-webhook] no signed URL support for ${email}, key=${product.r2_key}`);
        }
      }
    }
  }

  return ok({ received: true });
};
