import { Button } from '@/components/ui/button';

type Props = { onClick: () => void; disabled?: boolean };

export function StripeButton({ onClick, disabled }: Props) {
  return <Button onClick={onClick} disabled={disabled}>Proceed to Stripe Checkout</Button>;
}
