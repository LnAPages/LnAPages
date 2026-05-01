import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type NotificationPrefs = {
  admin_email: string;
  admin_phone: string;
  channel: 'email' | 'sms' | 'both';
  notify_on_booking: boolean;
  notify_on_payment: boolean;
  notify_on_intake: boolean;
};

type DbRow = {
  admin_email: string | null;
  admin_phone: string | null;
  channel: string | null;
  notify_on_booking: number | boolean | null;
  notify_on_payment: number | boolean | null;
  notify_on_intake: number | boolean | null;
};

const BLANK: NotificationPrefs = {
  admin_email: '',
  admin_phone: '',
  channel: 'email',
  notify_on_booking: true,
  notify_on_payment: true,
  notify_on_intake: true,
};

function rowToPrefs(row: DbRow | null | undefined): NotificationPrefs {
  if (!row) return BLANK;
  return {
    admin_email: row.admin_email ?? '',
    admin_phone: row.admin_phone ?? '',
    channel: (row.channel as NotificationPrefs['channel']) ?? 'email',
    notify_on_booking: Boolean(row.notify_on_booking),
    notify_on_payment: Boolean(row.notify_on_payment),
    notify_on_intake: Boolean(row.notify_on_intake),
  };
}

export default function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get<DbRow | null>('/notifications/prefs'),
  });

  const [form, setForm] = useState<NotificationPrefs>(BLANK);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setForm(rowToPrefs(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      api.put<NotificationPrefs>('/notifications/prefs', prefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] });
      setStatus('Saved.');
    },
    onError: (e: unknown) => {
      setStatus(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    },
  });

  const set = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    save.mutate(form);
  };

  if (isLoading) return <p className='p-4'>Loading…</p>;

  return (
    <section className='space-y-6 max-w-lg'>
      <header>
        <h1 className='text-2xl font-semibold'>Notification Settings</h1>
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>
          Configure where and when admin notifications are sent.
        </p>
      </header>

      <form onSubmit={handleSubmit} className='space-y-5'>
        <label className='block text-sm'>
          <span className='block font-medium mb-1'>Admin email</span>
          <input
            type='email'
            value={form.admin_email}
            onChange={(e) => set('admin_email', e.target.value)}
            placeholder='you@example.com'
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
          />
        </label>

        <label className='block text-sm'>
          <span className='block font-medium mb-1'>Admin phone (E.164)</span>
          <input
            type='tel'
            value={form.admin_phone}
            onChange={(e) => set('admin_phone', e.target.value)}
            placeholder='+12065550100'
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
          />
        </label>

        <fieldset className='space-y-2'>
          <legend className='text-sm font-medium'>Channel</legend>
          {(['email', 'sms', 'both'] as const).map((ch) => (
            <label key={ch} className='flex items-center gap-2 text-sm'>
              <input
                type='radio'
                name='channel'
                value={ch}
                checked={form.channel === ch}
                onChange={() => set('channel', ch)}
              />
              {ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Both (email + SMS)'}
            </label>
          ))}
        </fieldset>

        <fieldset className='space-y-2'>
          <legend className='text-sm font-medium'>Notify on</legend>
          {(
            [
              { key: 'notify_on_booking', label: 'New booking' },
              { key: 'notify_on_payment', label: 'Payment received' },
              { key: 'notify_on_intake', label: 'New intake submission' },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className='flex items-center gap-3'>
          <button
            type='submit'
            disabled={save.isPending}
            className='rounded bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50'
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          {status && <p className='text-sm text-[hsl(var(--muted-foreground))]'>{status}</p>}
        </div>
      </form>
    </section>
  );
}
