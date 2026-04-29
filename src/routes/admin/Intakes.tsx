import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AutoResponses from './AutoResponses';
import { Link } from 'react-router-dom';
import {
  defaultIntakeFormConfig,
  intakeFormConfigSchema,
  type IntakeFormConfig,
} from '@shared/schemas/intakeFormConfig';

type IntakeRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  project_type: string;
  budget?: string | null;
  timeline?: string | null;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at?: string;
  booking_id?: number | null;
  contact_id?: number | null;
  contact_name?: string | null;
};

type Tab = 'submissions' | 'auto-responses' | 'settings';

export default function Intakes() {
  const [tab, setTab] = useState<Tab>('submissions');
  return (
    <section className='space-y-6'>
      <header className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Intakes</h1>
        <p className='text-sm text-muted-foreground'>
          Project inquiries from the public /quote form, plus the form&apos;s editable copy and options.
        </p>
      </header>

      <nav className='flex gap-1 border-b border-border'>
        {(['submissions', 'auto-responses', 'settings'] as const).map((key) => (
          <button
            key={key}
            type='button'
            onClick={() => setTab(key)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
              (tab === key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {key === 'submissions' ? 'Submissions' : key === 'auto-responses' ? 'Auto Responses' : 'Form settings'}
          </button>
        ))}
      </nav>

      {tab === 'submissions' ? <SubmissionsPanel /> : tab === 'auto-responses' ? <AutoResponses /> : <FormSettingsPanel />}
    </section>
  );
}

function SubmissionsPanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'intakes'],
    queryFn: () => api.get<IntakeRow[]>('/intake'),
  });
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const convertingIntake = (data ?? []).find((r) => r.id === convertingId) ?? null;

  if (isLoading) return <p className='text-sm text-muted-foreground'>Loading submissions...</p>;
  if (isError) {
    return (
      <p className='text-sm text-red-400'>
        Failed to load: {error instanceof Error ? error.message : 'unknown error'}
      </p>
    );
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <div className='rounded-2xl border border-border/60 bg-surface/30 px-6 py-10 text-center'>
        <p className='text-sm text-muted-foreground'>No intake submissions yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className='space-y-3'>
      {rows.map((r) => (
        <article
          key={r.id}
          className='rounded-xl border border-border/60 bg-surface/30 p-4 sm:p-5 space-y-2'
        >
          <header className='flex flex-wrap items-baseline justify-between gap-2'>
            <div>
              <h3 className='text-base font-semibold tracking-tight'>{r.name}</h3>
              <p className='text-xs text-muted-foreground'>
                {r.email}
                {r.phone ? ' \u00b7 ' + r.phone : ''}
              </p>
              {r.contact_id ? (
                <p className='text-xs'>
                  <Link to={'/admin/contacts/' + r.contact_id} className='text-accent hover:underline'>
                    Contact: {r.contact_name ?? '#' + r.contact_id}
                  </Link>
                </p>
              ) : null}
            </div>
            <div className='flex flex-col items-end gap-2'>
              <span className='text-[11px] uppercase tracking-[0.16em] text-accent'>
                {r.booking_id ? 'converted' : r.status}
              </span>
              {r.booking_id ? (
                <Link
                  to={`/admin/bookings/${r.booking_id}`}
                  className='text-xs underline text-accent hover:text-foreground'
                >
                  View booking →
                </Link>
              ) : (
                <Button type='button' variant='outline' onClick={() => setConvertingId(r.id)}>
                  Convert to booking
                </Button>
              )}
            </div>
          </header>
          <p className='text-xs text-muted-foreground'>
            {r.project_type}
            {r.budget ? ' \u00b7 ' + r.budget : ''}
            {r.timeline ? ' \u00b7 ' + r.timeline : ''}
            {r.created_at ? ' \u00b7 ' + new Date(r.created_at).toLocaleString() : ''}
          </p>
          <p className='text-sm whitespace-pre-wrap'>{r.message}</p>
        </article>
      ))}
      </div>
      {convertingIntake && (
        <ConvertModal
          intake={convertingIntake}
          onClose={() => setConvertingId(null)}
        />
      )}
    </>
  );
}


type ServiceOption = {
  id: number;
  name: string;
  slug: string;
  billing_mode: 'one_time' | 'hourly' | 'monthly_retainer';
  price_cents: number;
  active: number;
};

function formatUsd(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function ConvertModal({ intake, onClose }: { intake: IntakeRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [itemId, setItemId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [hours, setHours] = useState<string>('');
  const [notes, setNotes] = useState<string>(intake.message ?? '');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ['admin', 'services', 'for-convert'],
    queryFn: () => api.get<ServiceOption[]>('/services'),
  });

  const selectedService = useMemo(() => {
    const list = services.data ?? [];
    return list.find((s) => s.id === itemId) ?? null;
  }, [services.data, itemId]);

  const livePriceLabel = useMemo(() => {
    if (!selectedService) return null;
    if (selectedService.billing_mode === 'hourly') {
      const h = Number(hours);
      if (!Number.isFinite(h) || h <= 0) {
        return formatUsd(selectedService.price_cents) + ' / hour';
      }
      return formatUsd(Math.round(selectedService.price_cents * h)) + ' (' + h + ' hours)';
    }
    return formatUsd(selectedService.price_cents);
  }, [selectedService, hours]);

  const convert = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error('Pick a service first');
      if (!startTime) throw new Error('Pick a date and time');
      const hoursNumber =
        selectedService?.billing_mode === 'hourly' && hours ? Number(hours) : null;
      return api.post<{
        intake_id: number;
        booking_id: number;
        contact_id: number | null;
        already_converted?: boolean;
      }>('/intake/convert', {
        intake_id: intake.id,
        item_id: itemId,
        start_time: startTime,
        hours_requested: hoursNumber,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intakes'] });
      onClose();
    },
    onError: (err: unknown) => {
      setErrMsg(err instanceof Error ? err.message : 'Failed to convert');
    },
  });

  const activeServices = (services.data ?? []).filter((s) => s.active === 1);
  const noServices = services.isSuccess && activeServices.length === 0;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
      onClick={onClose}
    >
      <div
        className='relative max-w-lg w-full bg-[hsl(var(--surface-1))] border border-border rounded-lg p-5 shadow-xl space-y-3'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Convert intake to booking</h2>
          <button
            type='button'
            className='text-sm opacity-70 hover:opacity-100'
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p className='text-xs text-muted-foreground'>
          Customer: {intake.name} · {intake.email}
          {intake.phone ? ' · ' + intake.phone : ''}
        </p>

        {noServices ? (
          <div className='rounded border border-border bg-surface/30 p-3 text-sm space-y-2'>
            <p className='text-muted-foreground'>
              No published services yet. Create one before converting an intake.
            </p>
            <Link to='/admin/services' className='underline text-accent text-sm'>
              Open Services →
            </Link>
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='space-y-1'>
              <label className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                Service
              </label>
              <select
                className='w-full rounded border border-border bg-background px-3 py-2 text-sm'
                value={itemId ?? ''}
                onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}
                disabled={services.isLoading}
              >
                <option value=''>Select a service…</option>
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.billing_mode === 'hourly'
                      ? ' (hourly — ' + formatUsd(s.price_cents) + '/hr)'
                      : ' — ' + formatUsd(s.price_cents)}
                  </option>
                ))}
              </select>
              {livePriceLabel && (
                <p className='text-xs text-muted-foreground'>Subtotal: {livePriceLabel}</p>
              )}
            </div>

            <div className='space-y-1'>
              <label className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                Date & time
              </label>
              <Input
                type='datetime-local'
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            {selectedService?.billing_mode === 'hourly' && (
              <div className='space-y-1'>
                <label className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                  Hours
                </label>
                <Input
                  type='number'
                  min='0.25'
                  step='0.25'
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            )}

            <div className='space-y-1'>
              <label className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                Notes
              </label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {errMsg && <p className='text-xs text-red-400'>{errMsg}</p>}

            <div className='flex items-center justify-end gap-2 pt-1'>
              <Button type='button' variant='outline' onClick={onClose}>
                Cancel
              </Button>
              <Button
                type='button'
                onClick={() => {
                  setErrMsg(null);
                  convert.mutate();
                }}
                disabled={convert.isPending || !itemId || !startTime}
              >
                {convert.isPending ? 'Converting…' : 'Convert to booking'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormSettingsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['intake-form-config'],
    queryFn: () => api.get<IntakeFormConfig>('/intake-form-config'),
  });

  const initial = useMemo<IntakeFormConfig>(() => {
    if (!data) return defaultIntakeFormConfig;
    const parsed = intakeFormConfigSchema.safeParse(data);
    return parsed.success ? parsed.data : defaultIntakeFormConfig;
  }, [data]);

  const [draft, setDraft] = useState<IntakeFormConfig>(initial);
  const [projectTypesText, setProjectTypesText] = useState('');
  const [budgetRangesText, setBudgetRangesText] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(initial);
    setProjectTypesText(initial.projectTypes.join('\n'));
    setBudgetRangesText(initial.budgetRanges.join('\n'));
  }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: IntakeFormConfig = {
        ...draft,
        projectTypes: linesToArr(projectTypesText),
        budgetRanges: linesToArr(budgetRangesText),
      };
      const validated = intakeFormConfigSchema.parse(payload);
      return api.put<IntakeFormConfig>('/intake-form-config', validated);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['intake-form-config'], saved);
      setSavedAt(Date.now());
    },
  });

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Loading settings...</p>;
  }

  return (
    <div className='space-y-6 max-w-2xl'>
      <Section title='Page copy' description='Shown on the public /quote page.'>
        <Field label='Heading'>
          <Input value={draft.heading} onChange={(e) => setDraft({ ...draft, heading: e.target.value })} />
        </Field>
        <Field label='Subheading' help='One-line intro under the heading.'>
          <Textarea
            rows={2}
            value={draft.subheading}
            onChange={(e) => setDraft({ ...draft, subheading: e.target.value })}
          />
        </Field>
        <Field label='Submit button label'>
          <Input value={draft.submitLabel} onChange={(e) => setDraft({ ...draft, submitLabel: e.target.value })} />
        </Field>
        <Field label='Consent line' help='Tiny text next to the submit button.'>
          <Input value={draft.consentText} onChange={(e) => setDraft({ ...draft, consentText: e.target.value })} />
        </Field>
      </Section>

      <Section title='Success message' description='Shown after a visitor submits.'>
        <Field label='Heading'>
          <Input
            value={draft.successHeading}
            onChange={(e) => setDraft({ ...draft, successHeading: e.target.value })}
          />
        </Field>
        <Field label='Message'>
          <Textarea
            rows={2}
            value={draft.successMessage}
            onChange={(e) => setDraft({ ...draft, successMessage: e.target.value })}
          />
        </Field>
      </Section>

      <Section title='Dropdown options' description='One option per line. At least one is required.'>
        <Field label='Project types'>
          <Textarea
            rows={6}
            value={projectTypesText}
            onChange={(e) => setProjectTypesText(e.target.value)}
          />
        </Field>
        <Field label='Budget ranges'>
          <Textarea
            rows={6}
            value={budgetRangesText}
            onChange={(e) => setBudgetRangesText(e.target.value)}
          />
        </Field>
      </Section>

      <Section title='Visible fields' description='Toggle which optional fields appear.'>
        <Toggle label='Phone' checked={draft.showPhone} onChange={(v) => setDraft({ ...draft, showPhone: v })} />
        <Toggle label='Budget' checked={draft.showBudget} onChange={(v) => setDraft({ ...draft, showBudget: v })} />
        <Toggle label='Timeline' checked={draft.showTimeline} onChange={(v) => setDraft({ ...draft, showTimeline: v })} />
      </Section>

      <div className='flex items-center gap-3 pt-2'>
        <Button type='button' onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save changes'}
        </Button>
        {save.isError && (
          <span className='text-sm text-red-400'>
            {save.error instanceof Error ? save.error.message : 'Save failed'}
          </span>
        )}
        {savedAt && !save.isPending && !save.isError && (
          <span className='text-sm text-muted-foreground'>Saved {new Date(savedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='rounded-2xl border border-border/60 bg-surface/30 p-5 space-y-4'>
      <header className='space-y-1'>
        <h2 className='text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground'>{title}</h2>
        {description && <p className='text-xs text-muted-foreground'>{description}</p>}
      </header>
      <div className='space-y-4'>{children}</div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className='block text-sm font-medium text-foreground mb-1.5'>{label}</label>
      {children}
      {help && <p className='mt-1 text-xs text-muted-foreground'>{help}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className='flex items-center gap-3 cursor-pointer select-none'>
      <input
        type='checkbox'
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className='h-4 w-4 rounded border-border accent-accent'
      />
      <span className='text-sm text-foreground'>{label}</span>
    </label>
  );
}

function linesToArr(text: string): string[] {
  return text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0);
}
