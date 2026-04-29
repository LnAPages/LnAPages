import type { Env } from '../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const secret = env.STRIPE_SECRET_KEY ?? '';
  const mode = secret.startsWith('sk_live_')
    ? 'live'
    : secret.startsWith('sk_test_')
      ? 'test'
      : null;
  const last4 = secret ? secret.slice(-4) : null;
  return Response.json(
    {
      publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
      configured: Boolean(secret),
      mode,
      secretLast4: last4,
      webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
      appUrl: env.APP_URL ?? null,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    },
  );
};
