import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Contact } from './Contacts';

const STAGES = [
  { key: 'new_lead',      label: 'New Lead' },
  { key: 'qualified',     label: 'Qualified' },
  { key: 'proposal',      label: 'Proposal' },
  { key: 'booked',        label: 'Booked' },
  { key: 'in_production', label: 'In Production' },
  { key: 'delivered',     label: 'Delivered' },
  { key: 'past_client',   label: 'Past Client' },
  { key: 'lost',          label: 'Lost' },
] as const;

const STAGE_COLORS: Record<string, string> = {
  new_lead:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  qualified:     'bg-purple-500/15 text-purple-400 border-purple-500/30',
  proposal:      'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  booked:        'bg-green-500/15 text-green-400 border-green-500/30',
  in_production: 'bg-accent/15 text-accent border-accent/30',
  delivered:     'bg-teal-500/15 text-teal-400 border-teal-500/30',
  past_client:   'bg-muted/40 text-muted-foreground border-border',
  lost:          'bg-red-500/15 text-red-400 border-red-500/30',
};

type ActivityEvent = {
  type: 'intake' | 'booking' | 'invoice';
  id: number;
  summary: string;
  status: string;
  timestamp: string;
};

const EVENT_COLORS: Record<string, string> = {
  intake:  'bg-blue-500/15 text-blue-400',
  booking: 'bg-green-500/15 text-green-400',
  invoice: 'bg-yellow-500/15 text-yellow-400',
};

type Tab = 'overview' | 'activity' | 'bookings' | 'invoices' | 'tasks' | 'files' | 'notes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'activity',  label: 'Activity' },
  { key: 'bookings',  label: 'Bookings' },
  { key: 'invoices',  label: 'Invoices' },
  { key: 'tasks',     label: 'Tasks' },
  { key: 'files',     label: 'Files' },
  { key: 'notes',     label: 'Notes' },
];

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);

  const { data: contact, isLoading, isError } = useQuery({
    queryKey: ['admin', 'contact', id],
    queryFn: () => api.get<Contact>(`/contacts/${id}`),
    enabled: !!id,
  });

  const { data: activity } = useQuery({
    queryKey: ['admin', 'contact', id, 'activity'],
    queryFn: () => api.get<ActivityEvent[]>(`/contacts/${id}/activity`),
    enabled: !!id && tab === 'activity',
  });

  const deleteContact = useMutation({
    mutationFn: () => api.delete<{ id: number }>(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      navigate('/admin/contacts');
    },
  });

  if (isLoading) return <p className='text-sm text-muted-foreground'>Loading contact…</p>;
  if (isError || !contact) return <p className='text-sm text-red-400'>Contact not found.</p>;

  return (
    <section className='space-y-6'>
      {/* Breadcrumb */}
      <nav className='text-xs text-muted-foreground'>
        <Link to='/admin/contacts' className='hover:text-foreground'>Contacts</Link>
        <span className='mx-1.5'>›</span>
        <span className='text-foreground'>{contact.name}</span>
      </nav>

      {/* Header */}
      <header className='rounded-2xl border border-border/60 bg-surface/30 p-6 space-y-4'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-semibold tracking-tight'>{contact.name}</h1>
            <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
              {contact.email && <a href={`mailto:${contact.email}`} className='hover:text-foreground'>{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone}`} className='hover:text-foreground'>{contact.phone}</a>}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <StageSelector contact={contact} />
            <Button variant='outline' size='sm' type='button' onClick={() => setEditing(true)}>Edit</Button>
            <Button
              variant='outline'
              size='sm'
              type='button'
              className='text-red-400 hover:text-red-300'
              disabled={deleteContact.isPending}
              onClick={() => {
                if (confirm('Delete this contact? This cannot be undone.')) deleteContact.mutate();
              }}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {contact.tags.map((t) => (
              <span key={t} className='rounded-full bg-muted/40 border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground'>
                {t}
              </span>
            ))}
          </div>
        )}

        <div className='text-xs text-muted-foreground'>
          Source: <span className='capitalize'>{contact.source}</span>
          {' · '}Last activity: {new Date(contact.last_activity_at).toLocaleString()}
        </div>
      </header>

      {/* Tab nav */}
      <nav className='flex gap-1 border-b border-border overflow-x-auto'>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => setTab(key)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ' +
              (tab === key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === 'overview'  && <OverviewTab contact={contact} />}
      {tab === 'activity'  && <ActivityTab events={activity ?? []} />}
      {tab === 'bookings'  && <ComingSoon name='Bookings' />}
      {tab === 'invoices'  && <ComingSoon name='Invoices' />}
      {tab === 'tasks'     && <ComingSoon name='Tasks' />}
      {tab === 'files'     && <ComingSoon name='Files' />}
      {tab === 'notes'     && <NotesTab contact={contact} />}

      {editing && (
        <EditContactModal
          contact={contact}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'contact', id] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
          }}
        />
      )}
    </section>
  );
}

// ── Stage selector (inline PATCH) ────────────────────────────────────────────

function StageSelector({ contact }: { contact: Contact }) {
  const queryClient = useQueryClient();
  const patch = useMutation({
    mutationFn: (stage: string) => api.patch<Contact>(`/contacts/${contact.id}`, { stage }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'contact', String(contact.id)], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
    },
  });

  const color = STAGE_COLORS[contact.stage] ?? 'bg-muted/40 text-muted-foreground border-border';

  return (
    <div className='relative'>
      <select
        value={contact.stage}
        disabled={patch.isPending}
        onChange={(e) => patch.mutate(e.target.value)}
        className={`appearance-none rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide cursor-pointer ${color}`}
      >
        {STAGES.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ contact }: { contact: Contact }) {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <InfoCard label='Email'>{contact.email ?? '—'}</InfoCard>
      <InfoCard label='Phone'>{contact.phone ?? '—'}</InfoCard>
      <InfoCard label='Stage'>{STAGES.find((s) => s.key === contact.stage)?.label ?? contact.stage}</InfoCard>
      <InfoCard label='Source' className='capitalize'>{contact.source}</InfoCard>
      <InfoCard label='Created'>{new Date(contact.created_at).toLocaleString()}</InfoCard>
      <InfoCard label='Updated'>{new Date(contact.updated_at).toLocaleString()}</InfoCard>
    </div>
  );
}

function InfoCard({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className='rounded-xl border border-border/60 bg-surface/30 p-4 space-y-1'>
      <p className='text-[11px] uppercase tracking-widest text-muted-foreground'>{label}</p>
      <p className={`text-sm font-medium ${className ?? ''}`}>{children}</p>
    </div>
  );
}

// ── Activity tab ─────────────────────────────────────────────────────────────

function ActivityTab({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className='rounded-2xl border border-border/60 bg-surface/30 px-6 py-10 text-center'>
        <p className='text-sm text-muted-foreground'>No activity yet.</p>
      </div>
    );
  }

  return (
    <ol className='space-y-3'>
      {events.map((e, i) => (
        <li key={i} className='flex gap-3'>
          <span className={`mt-0.5 inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide ${EVENT_COLORS[e.type] ?? ''}`}>
            {e.type}
          </span>
          <div>
            <p className='text-sm font-medium'>{e.summary}</p>
            <p className='text-xs text-muted-foreground'>
              {new Date(e.timestamp).toLocaleString()} · {e.status}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ contact }: { contact: Contact }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(contact.notes ?? '');
  const save = useMutation({
    mutationFn: () => api.patch<Contact>(`/contacts/${contact.id}`, { notes: draft }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'contact', String(contact.id)], updated);
    },
  });

  return (
    <div className='space-y-3'>
      <textarea
        rows={8}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder='Markdown notes about this contact…'
        className='w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent'
      />
      <div className='flex items-center gap-3'>
        <Button type='button' size='sm' onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save notes'}
        </Button>
        {save.isError && <span className='text-xs text-red-400'>Save failed</span>}
        {save.isSuccess && !save.isPending && <span className='text-xs text-muted-foreground'>Saved</span>}
      </div>
    </div>
  );
}

// ── Coming-soon placeholder ───────────────────────────────────────────────────

function ComingSoon({ name }: { name: string }) {
  return (
    <div className='rounded-2xl border border-border/60 bg-surface/30 px-6 py-10 text-center'>
      <p className='text-sm text-muted-foreground'>{name} tab coming soon.</p>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditContactModal({ contact, onClose, onSaved }: { contact: Contact; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name:  contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    stage: contact.stage,
    tags:  (contact.tags ?? []).join(', '),
    notes: contact.notes ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch<Contact>(`/contacts/${contact.id}`, {
        name:  form.name,
        email: form.email || null,
        phone: form.phone || null,
        stage: form.stage,
        tags:  form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes: form.notes || null,
      }),
    onSuccess: onSaved,
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60' onClick={onClose}>
      <div
        className='w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-semibold'>Edit Contact</h2>

        <Field label='Name *'>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label='Email'>
          <Input type='email' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label='Phone'>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label='Stage'>
          <select
            value={form.stage}
            onChange={(e) => setForm({ ...form, stage: e.target.value })}
            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
          >
            {STAGES.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label='Tags (comma-separated)'>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </Field>
        <Field label='Notes'>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none'
          />
        </Field>

        {save.isError && (
          <p className='text-sm text-red-400'>{save.error instanceof Error ? save.error.message : 'Save failed'}</p>
        )}

        <div className='flex justify-end gap-2 pt-2'>
          <Button variant='outline' type='button' onClick={onClose}>Cancel</Button>
          <Button type='button' disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className='block text-sm font-medium text-foreground mb-1'>{label}</label>
      {children}
    </div>
  );
}
