import { z } from 'zod';
import Stripe from 'stripe';
import { fail, ok, parseJson } from '../../lib/http';
import { isShopEnabled } from '../../lib/shop';
import type { Env } from '../../lib/types';

const schema = z.object({
  productId: z.number().int().positive(),
  email: z.string().email(),
});

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await isShopEnabled(env))) {
    return fail(404, 'NOT_FOUND', 'Shop is disabled');
  }
  if (!env.STRIPE_SECRET_KEY || !env.APP_URL) {
    return fail(500, 'MISCONFIGURED', 'Stripe is not configured');
  }
  const payload = await parseJson(request, schema);
  const product = await env.FNLSTG_DB.prepare(
    'SELECT id, name, description, price_cents, active FROM products WHERE id = ?',
  ).bind(payload.productId).first<{ id: number; name: string; description: string | null; price_cents: number; active: number }>();

  if (!product || product.active !== 1) {
    return fail(404, 'NOT_FOUND', 'Product not found');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: payload.email,
    success_url: `${env.APP_URL}/shop/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/shop`,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: product.price_cents,
        product_data: {
          name: product.name,
          description: product.description ?? undefined,
        },
      },
    }],
    metadata: {
      product_id: String(product.id),
      email: payload.email,
    },
  });

  return ok({ sessionId: session.id, url: session.url });
};
