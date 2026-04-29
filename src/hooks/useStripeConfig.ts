import { useEffect, useState } from 'react';

export type StripeMode = 'live' | 'test' | null;

export type StripeConfigResponse = {
  publishableKey: string | null;
  configured: boolean;
  mode: StripeMode;
  secretLast4: string | null;
  webhookConfigured: boolean;
  appUrl: string | null;
};

let cachedConfig: StripeConfigResponse | null = null;
let cachedError: string | null = null;
let inflightRequest: Promise<StripeConfigResponse> | null = null;

async function fetchStripeConfig(): Promise<StripeConfigResponse> {
  if (cachedConfig) return cachedConfig;
  if (inflightRequest) return inflightRequest;

  inflightRequest = fetch('/api/stripe-config')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Failed to load Stripe configuration.');
      }
      const payload = (await response.json()) as Partial<StripeConfigResponse>;
      cachedConfig = {
        publishableKey: typeof payload.publishableKey === 'string' ? payload.publishableKey : null,
        configured: Boolean(payload.configured),
        mode: payload.mode === 'live' || payload.mode === 'test' ? payload.mode : null,
        secretLast4: typeof payload.secretLast4 === 'string' ? payload.secretLast4 : null,
        webhookConfigured: Boolean(payload.webhookConfigured),
        appUrl: typeof payload.appUrl === 'string' ? payload.appUrl : null,
      };
      cachedError = null;
      return cachedConfig;
    })
    .catch((error) => {
      cachedError = error instanceof Error ? error.message : 'Failed to load Stripe configuration.';
      throw error;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export function useStripeConfig() {
  const [config, setConfig] = useState<StripeConfigResponse | null>(cachedConfig);
  const [loading, setLoading] = useState<boolean>(!cachedConfig && !cachedError);
  const [error, setError] = useState<string | null>(cachedError);

  useEffect(() => {
    if (cachedConfig || cachedError) return;

    let cancelled = false;
    fetchStripeConfig()
      .then((value) => {
        if (cancelled) return;
        setConfig(value);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load Stripe configuration.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    config,
    publishableKey: config?.publishableKey ?? null,
    configured: config?.configured ?? false,
    mode: config?.mode ?? null,
    secretLast4: config?.secretLast4 ?? null,
    webhookConfigured: config?.webhookConfigured ?? false,
    appUrl: config?.appUrl ?? null,
    loading,
    error,
  };
}
