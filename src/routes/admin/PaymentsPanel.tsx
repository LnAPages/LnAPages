import { useState } from 'react';
import { useStripeConfig } from '@/hooks/useStripeConfig';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type VerifyResponse = {
  ok: boolean;
  message?: string;
  account?: { id: string; email: string | null; charges_enabled: boolean; details_submitted: boolean } | null;
};

export default function PaymentsPanel() {
  const { configured, mode, secretLast4, webhookConfigured, publishableKey, appUrl, loading, error } = useStripeConfig();
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);

  async function runVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post<VerifyResponse>('/admin/payments/verify', {});
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ ok: false, message: err instanceof Error ? err.message : 'Verify failed.' });
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <p className='text-sm text-muted-foreground'>Loading payment configuration…</p>;
  }
  if (error) {
    return <p className='text-sm text-red-400'>Failed to load Stripe configuration: {error}</p>;
  }

  return (
    <div className='space-y-6'>
      <header className='space-y-1'>
        <h2 className='text-lg font-semibold'>Payments</h2>
        <p className='text-sm text-muted-foreground'>
          Stripe powers both bookings and shop products. Secrets are managed via Cloudflare Pages env vars
          (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) so changing them
          requires git-level access. This panel is read-only.
        </p>
      </header>

      <div className='card p-4 space-y-3'>
        <div className='flex items-center justify-between'>
          <p className='eyebrow'>pipeline status</p>
          <span
            className={
              'rounded-full border px-3 py-1 text-xs ' +
              (configured
                ? 'border-emerald-500 text-emerald-400'
                : 'border-amber-500 text-amber-400')
            }
          >
            {configured ? 'Live & configured' : 'Not configured'}
          </span>
        </div>
        <dl className='grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm'>
          <div>
            <dt className='muted'>Mode</dt>
            <dd>{mode ? mode.toUpperCase() : '—'}</dd>
          </div>
          <div>
            <dt className='muted'>Secret key</dt>
            <dd>{secretLast4 ? `•••• •••• ${secretLast4}` : 'Missing'}</dd>
          </div>
          <div>
            <dt className='muted'>Publishable key</dt>
            <dd>{publishableKey ? publishableKey.slice(0, 12) + '…' : 'Not set (optional)'}</dd>
          </div>
          <div>
            <dt className='muted'>Webhook secret</dt>
            <dd>{webhookConfigured ? 'Configured' : 'Missing'}</dd>
          </div>
          <div>
            <dt className='muted'>App URL</dt>
            <dd>{appUrl ?? '—'}</dd>
          </div>
          <div>
            <dt className='muted'>Pipeline</dt>
            <dd>Unified (bookings + shop → Stripe Checkout)</dd>
          </div>
        </dl>
      </div>

      <div className='card p-4 space-y-3'>
        <p className='eyebrow'>verify connection</p>
        <p className='text-sm text-muted-foreground'>
          Hits Stripe with the configured secret to confirm the account is live and charges are enabled.
          Read-only; no charges or webhooks are created.
        </p>
        <Button onClick={runVerify} disabled={verifying || !configured}>
          {verifying ? 'Verifying…' : 'Verify Stripe connection'}
        </Button>
        {verifyResult ? (
          <div
            className={
              'rounded border px-3 py-2 text-sm ' +
              (verifyResult.ok ? 'border-emerald-500 text-emerald-300' : 'border-red-500 text-red-300')
            }
          >
            {verifyResult.ok
              ? `Connected to Stripe account ${verifyResult.account?.id}${verifyResult.account?.email ? ` (${verifyResult.account.email})` : ''}. ${verifyResult.account?.charges_enabled ? 'Charges enabled.' : 'Charges NOT enabled.'}`
              : verifyResult.message ?? 'Verify failed.'}
          </div>
        ) : null}
      </div>

      <div className='card p-4 space-y-2 text-sm'>
        <p className='eyebrow'>changing the pipeline</p>
        <p className='text-muted-foreground'>
          To rotate keys or switch live/test, update Cloudflare Pages env vars and redeploy. This requires
          repository write access. The booking and shop checkouts both read the same
          <code className='mx-1'>STRIPE_SECRET_KEY</code>so changing it once updates both.
        </p>
      </div>
    </div>
  );
}
