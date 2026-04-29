import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Service } from '@/types';
import { api } from '@/lib/api';
import { useStripeConfig } from '@/hooks/useStripeConfig';
import { ServicePicker } from '@/components/ServicePicker';
import { BookingSummary } from '@/components/BookingSummary';

const TIME_OPTIONS = ['9:00 AM', '10:30 AM', '12:00 PM', '1:30 PM', '3:00 PM', '4:30 PM', 'Sunset'] as const;

function clampStep(step: number): 1 | 2 | 3 {
  if (step <= 1 || Number.isNaN(step)) return 1;
  if (step >= 3) return 3;
  return 2;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function weekdayLabels() {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
}

type CalendarDay = { date: string; day: number; muted: boolean; isToday: boolean; disabled: boolean };

function getCalendarDays(monthCursor: Date): CalendarDay[] {
  const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const startOffset = start.getDay();
  const cells = 42;
  const days: CalendarDay[] = [];
  const today = formatIsoDate(new Date());

  for (let index = 0; index < cells; index += 1) {
    const current = new Date(start);
    current.setDate(index - startOffset + 1);
    const date = formatIsoDate(current);
    const muted = current < start || current > end;
    const disabled = !muted && date < today;
    days.push({
      date,
      day: current.getDate(),
      muted,
      isToday: date === today,
      disabled,
    });
  }
  return days;
}

export default function Booking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const step = clampStep(Number(searchParams.get('step') ?? '1'));
  const selectedDate = searchParams.get('date') ?? '';
  const selectedTime = searchParams.get('time') ?? '';
  const requestedService = searchParams.get('service') ?? '';
  const { configured, loading: stripeConfigLoading } = useStripeConfig();
  const paymentsConfigured = !stripeConfigLoading && configured;
  const showPaymentsNotConfiguredBanner = !stripeConfigLoading && !configured;

  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<Service[]>('/services'),
  });

  const selectedService = useMemo(
    () =>
      services.find((service) => {
        if (!requestedService) return false;
        return String(service.id) === requestedService || service.slug === requestedService;
      }) ?? null,
    [services, requestedService],
  );

  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    selectedDate ? parseDate(selectedDate) : new Date(),
  );

  const [contact, setContact] = useState({ name: '', email: '', phone: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const calendarDays = useMemo(() => getCalendarDays(monthCursor), [monthCursor]);
  const canContinue = Boolean(selectedService && selectedDate && selectedTime);
  const canSubmit =
    canContinue &&
    contact.name.trim() &&
    contact.email.trim() &&
    contact.phone.trim() &&
    !stripeConfigLoading;

  function updateParams(patch: Partial<Record<'step' | 'service' | 'date' | 'time', string | null>>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }

  async function submitCheckout() {
    if (!selectedService || !selectedDate || !selectedTime || !canSubmit) {
      setToast({ type: 'error', message: 'Please complete every required field before continuing.' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const payload = {
        serviceId: selectedService.id,
        date: selectedDate,
        time: selectedTime,
        contact,
      };

      if (stripeConfigLoading) {
        throw new Error('Loading payment configuration. Please try again.');
      }

      if (paymentsConfigured) {
        const response = await api.post<{ url: string }>('/checkout', payload);
        if (!response.url) {
          throw new Error('Checkout URL was not returned.');
        }
        window.location.assign(response.url);
        return;
      }

      await api.post<{ id: number }>('/inquiry', payload);
      setToast({ type: 'success', message: 'Inquiry saved. We will contact you to confirm your session.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit booking request.';
      setToast({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <p className='muted' role='status' aria-live='polite'>Loading services...</p>;
  if (error) return <p className='muted' role='alert'>Failed to load booking options.</p>;

  return (
    <section className='container-narrow section space-y-8'>
      <div className='space-y-2'>
        <p className='eyebrow'>Book a session</p>
        <h1 className='font-display text-5xl'>Reserve your date</h1>
      </div>

      {showPaymentsNotConfiguredBanner ? (
        <div className='card border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] p-4 text-sm'>
          Payments are not configured yet. Bookings will be saved as inquiries.
        </div>
      ) : null}

      <nav aria-label='Booking steps' className='border-b border-border pb-4'>
        <ol className='flex flex-wrap items-center gap-3 font-sans text-xs uppercase tracking-[0.2em]'>
          <li>
            <button type='button' aria-label='Step 1: Choose service' aria-current={step === 1 ? 'step' : undefined} className={step === 1 ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]'} onClick={() => updateParams({ step: '1' })}>Step 1 · Service</button>
          </li>
          <li>
            <button type='button' aria-label='Step 2: Select date and time' aria-current={step === 2 ? 'step' : undefined} className={step === 2 ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]'} onClick={() => updateParams({ step: selectedService ? '2' : '1' })}>Step 2 · Date + Time</button>
          </li>
          <li>
            <button type='button' aria-label='Step 3: Enter contact details and checkout' aria-current={step === 3 ? 'step' : undefined} className={step === 3 ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]'} onClick={() => updateParams({ step: canContinue ? '3' : '2' })}>Step 3 · Checkout</button>
          </li>
        </ol>
      </nav>

      {step === 1 ? (
        <ServicePicker
          services={services}
          selectedServiceId={selectedService?.id ?? null}
          onSelect={(service) => {
            updateParams({ service: String(service.id), step: '2' });
          }}
        />
      ) : null}

      {step === 2 ? (
        <div className='grid gap-6 lg:grid-cols-[1fr_24rem]'>
          <div className='card min-w-0 space-y-6'>
            <div className='flex items-center justify-between'>
              <p className='eyebrow'>Select date</p>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  className='pill h-9 w-9 p-0'
                  onClick={() =>
                    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                  aria-label='Previous month'
                >
                  ←
                </button>
                <p className='font-sans text-sm uppercase tracking-[0.2em]'>{monthLabel(monthCursor)}</p>
                <button
                  type='button'
                  className='pill h-9 w-9 p-0'
                  onClick={() =>
                    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                  aria-label='Next month'
                >
                  →
                </button>
              </div>
            </div>

            <div className='grid grid-cols-7 gap-2 text-center font-sans text-xs tracking-[0.16em] text-[hsl(var(--muted-foreground))]'>
              {weekdayLabels().map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className='grid grid-cols-7 gap-2'>
              {calendarDays.map((day) => (
                <button
                  key={day.date}
                  type='button'
                  disabled={day.disabled}
                  className={`cal-day ${day.muted ? 'is-muted' : ''} ${day.isToday ? 'is-today' : ''} ${selectedDate === day.date ? 'is-selected' : ''}`}
                  onClick={() => {
                    updateParams({ date: day.date, step: '2' });
                    setMonthCursor(parseDate(day.date));
                  }}
                >
                  {day.day}
                </button>
              ))}
            </div>

            <div className='space-y-3'>
              <p className='eyebrow'>Select time</p>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {TIME_OPTIONS.map((time) => (
                  <button
                    key={time}
                    type='button'
                    className={`pill ${selectedTime === time ? 'is-selected' : ''}`}
                    onClick={() => updateParams({ time, step: '2' })}
                    aria-pressed={selectedTime === time}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <button
              type='button'
              className='btn-accent w-full'
              disabled={!canContinue}
              onClick={() => updateParams({ step: '3' })}
            >
              Continue to checkout
            </button>
            <p className='muted text-sm'>30% deposit locks your date · Balance due day of shoot</p>
          </div>

          <BookingSummary service={selectedService} date={selectedDate} time={selectedTime} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className='grid gap-6 lg:grid-cols-[1fr_24rem]'>
          <form
            className='card min-w-0 space-y-4'
            onSubmit={async (event) => {
              event.preventDefault();
              await submitCheckout();
            }}
          >
            <p className='eyebrow'>Contact + Checkout</p>
            <label className='space-y-1 text-sm'>
              <span>Name</span>
              <input
                required
                value={contact.name}
                onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Email</span>
              <input
                type='email'
                required
                value={contact.email}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Phone</span>
              <input
                required
                value={contact.phone}
                onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Notes</span>
              <textarea
                rows={4}
                value={contact.notes}
                onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))}
                placeholder='Anything we should know before shoot day?'
              />
            </label>

            <button type='submit' className='btn-accent w-full' disabled={!canSubmit || isSubmitting}>
              {paymentsConfigured ? 'Proceed to Stripe Checkout' : 'Send inquiry request'}
            </button>

            {toast ? (
              <div
                role='alert'
                className={`rounded border px-3 py-2 text-sm ${
                  toast.type === 'error'
                    ? 'border-red-500/60 bg-red-950/40 text-red-200'
                    : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                }`}
              >
                {toast.message}
              </div>
            ) : null}
          </form>

          <BookingSummary service={selectedService} date={selectedDate} time={selectedTime} />
        </div>
      ) : null}
    </section>
  );
}
