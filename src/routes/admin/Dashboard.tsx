import { useMemo, useState } from 'react';
import { StatCard } from '@/components/admin/StatCard';
import { formatMoney } from '@/lib/utils';
import { useAdminStats } from '@/hooks/useAdminStats';

type RangeKey = '30d' | '90d' | '12mo';

const RANGE_DAYS: Record<RangeKey, number> = {
  '30d': 30,
  '90d': 90,
  '12mo': 365,
};
const MIN_BAR_WIDTH_PERCENT = 6;

function toDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() - days);
  return next;
}

function linePointX(index: number, length: number) {
  if (length <= 1) return 50;
  return (index / (length - 1)) * 100;
}

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>('30d');
  const { data } = useAdminStats();
  const now = new Date();
  const windowStart = daysAgo(now, RANGE_DAYS[range] - 1);

  const bookings = useMemo(
    () => data.bookings.filter((entry) => {
      const date = toDate(entry.date);
      return date ? date >= windowStart : false;
    }),
    [data.bookings, windowStart],
  );

  const orders = useMemo(
    () => data.orders.filter((entry) => {
      const date = toDate(entry.date);
      return date ? date >= windowStart : false;
    }),
    [data.orders, windowStart],
  );

  const revenue = bookings.reduce((sum, item) => sum + item.amount_cents, 0);
  const upcoming = bookings.filter((item) => !['completed', 'cancelled'].includes(item.status)).length;

  const bookingPoints = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((entry) => {
      const date = toDate(entry.date);
      if (!date) return;
      const day = startOfDay(date).toISOString().slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  }, [bookings]);

  const categoryRevenue = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((entry) => {
      map.set(entry.category, (map.get(entry.category) ?? 0) + entry.amount_cents);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [bookings]);

  const shopSparkline = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((entry) => {
      const date = toDate(entry.date);
      if (!date) return;
      const day = startOfDay(date).toISOString().slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + entry.revenue_cents);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [orders]);

  const funnel = useMemo(() => {
    const booked = bookings.length;
    const paid = bookings.filter((entry) => ['paid', 'completed'].includes(entry.status)).length;
    const inProgress = bookings.filter((entry) => ['confirmed', 'paid'].includes(entry.status)).length;
    const completed = bookings.filter((entry) => entry.status === 'completed').length;
    return [
      { label: 'Booked', value: booked },
      { label: 'Paid', value: paid },
      { label: 'In Progress', value: inProgress },
      { label: 'Completed', value: completed },
    ];
  }, [bookings]);

  const maxBookingCount = Math.max(1, ...bookingPoints.map((point) => point.count));
  const maxCategoryRevenue = Math.max(1, ...categoryRevenue.map(([, value]) => value));
  const maxSpark = Math.max(1, ...shopSparkline);
  const maxFunnel = Math.max(1, ...funnel.map((step) => step.value));

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>Admin Dashboard</h1>
        <div className='flex gap-2'>
          {(['30d', '90d', '12mo'] as const).map((value) => (
            <button key={value} type='button' className={`pill ${range === value ? 'is-selected' : ''}`} onClick={() => setRange(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-4'>
        <StatCard label='Revenue' value={formatMoney(revenue)} />
        <StatCard label='Upcoming bookings' value={String(upcoming)} />
        <StatCard label='Tracked jobs' value={String(bookings.length)} />
        <StatCard label='Shop revenue' value={formatMoney(orders.reduce((sum, order) => sum + order.revenue_cents, 0))} />
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <article className='card space-y-3'>
          <p className='eyebrow'>bookings over time</p>
          {bookingPoints.length === 0 ? (
            <p className='muted'>No bookings in this window yet.</p>
          ) : (
            <svg viewBox='0 0 100 42' className='h-40 w-full'>
              <polyline
                fill='none'
                stroke='hsl(var(--accent))'
                strokeWidth='2'
                points={bookingPoints.map((point, index) => {
                  const x = linePointX(index, bookingPoints.length);
                  const y = 40 - ((point.count / maxBookingCount) * 36);
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          )}
        </article>

        <article className='card space-y-3'>
          <p className='eyebrow'>revenue by category</p>
          {categoryRevenue.length === 0 ? (
            <p className='muted'>No bookings in this window yet.</p>
          ) : (
            <div className='space-y-2'>
              {categoryRevenue.map(([category, value]) => (
                <div key={category}>
                  <div className='mb-1 flex items-center justify-between text-sm'>
                    <span>{category}</span>
                    <span className='text-[hsl(var(--accent))]'>{formatMoney(value)}</span>
                  </div>
                  <div className='h-2 rounded bg-[hsl(var(--surface-3))]'>
                    <div className='h-2 rounded bg-[hsl(var(--accent))]' style={{ width: `${Math.max(MIN_BAR_WIDTH_PERCENT, (value / maxCategoryRevenue) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className='card space-y-3'>
          <p className='eyebrow'>shop revenue sparkline</p>
          {shopSparkline.length === 0 ? (
            <p className='muted'>No shop orders in this window yet.</p>
          ) : (
            <svg viewBox='0 0 100 32' className='h-24 w-full'>
              <polyline
                fill='none'
                stroke='hsl(var(--accent))'
                strokeWidth='2'
                points={shopSparkline.map((value, index) => {
                  const x = linePointX(index, shopSparkline.length);
                  const y = 30 - ((value / maxSpark) * 26);
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          )}
        </article>

        <article className='card space-y-3'>
          <p className='eyebrow'>gallery engagement</p>
          {data.gallery.length === 0 ? (
            <p className='muted'>No selected images yet.</p>
          ) : (
            <ol className='space-y-2'>
              {data.gallery.map((item, index) => (
                <li key={item.id} className='flex items-center justify-between text-sm'>
                  <span className='truncate'>{index + 1}. {item.title || `Image ${item.id}`}</span>
                  <span className='text-[hsl(var(--accent))]'>selected</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>

      <article className='card space-y-3'>
        <p className='eyebrow'>bookings funnel</p>
        {bookings.length === 0 ? (
          <p className='muted'>No bookings in this window yet.</p>
        ) : (
          <div className='grid gap-2'>
            {funnel.map((step) => (
              <div key={step.label}>
                <div className='mb-1 flex items-center justify-between text-sm'>
                  <span>{step.label}</span>
                  <span>{step.value}</span>
                </div>
                <div className='h-2 rounded bg-[hsl(var(--surface-3))]'>
                  <div className='h-2 rounded bg-[hsl(var(--accent))]' style={{ width: `${(step.value / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
