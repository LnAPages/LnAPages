export const getStripePublishableKey = (): string => {
  const value = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof value === 'string' ? value : '';
};
