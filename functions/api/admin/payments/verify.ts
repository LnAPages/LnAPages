import Stripe from 'stripe';
import { fail, ok } from '../../../lib/http';
import type { Env } from '../../../lib/types';

// POST /api/admin/payments/verify
// Read-only: hits Stripe with the configured secret to verify the connection.
// Returns the account id and whether charges are enabled. No charges, customers,
// or webhooks are created. Auth is enforced upstream by functions/_middleware.ts
// (anything under /api/admin/* requires an authenticated session).
export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  if (!env.STRIPE_SECRET_KEY) {
    return fail(500, 'MISCONFIGURED', 'Stripe secret key is not configured.');
  }
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    const account = await stripe.accounts.retrieve();
    return ok({
      ok: true,
      account: {
        id: account.id,
        email: account.email ?? null,
        charges_enabled: Boolean(account.charges_enabled),
        details_submitted: Boolean(account.details_submitted),
      },
    });
  } catch (err) {
    return ok({
      ok: false,
      message: err instanceof Error ? err.message : 'Stripe verify failed.',
      account: null,
    });
  }
};
