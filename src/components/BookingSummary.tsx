import type { Service } from '@/types';
import { formatMoney } from '@/lib/utils';

type Props = {
  service: Service | null;
  date: string;
  time: string;
};

function formatDate(value: string): string {
  if (!value) return 'Not selected';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BookingSummary({ service, date, time }: Props) {
  return (
    <aside className='card sticky top-24 min-w-0 space-y-4'>
      <p className='eyebrow'>Session summary</p>
      <div>
        <p className='font-display text-2xl'>{service?.name ?? 'Choose a service'}</p>
        <p className='price mt-1 text-sm'>{service ? formatMoney(service.price_cents) : '—'}</p>
      </div>
      <div className='space-y-2 border-t border-border pt-4 text-base'>
        <p>
          <span className='muted'>Date:</span> {formatDate(date)}
        </p>
        <p>
          <span className='muted'>Time:</span> {time || 'Not selected'}
        </p>
      </div>
      <p className='muted border-t border-border pt-4 text-sm'>
        30% deposit locks your date · Balance due day of shoot
      </p>
    </aside>
  );
}
