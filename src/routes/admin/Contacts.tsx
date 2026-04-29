import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type Contact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

const STAGES = [
  { key: '', label: 'All' },
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

function StageChip({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.key === stage)?.label ?? stage;
  const color = STAGE_COLORS[stage] ?? 'bg-muted/40 text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

export default function Contacts() {
  const queryClient = useQueryClient();
  const [q, setQ]           = useState('');
  const [stage, setStage]   = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'contacts', q, stage],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q)     params.set('q', q);
      if (stage) params.set('stage', stage);
      const qs = params.toString();
      return api.get<Contact[]>(`/contacts${qs ? `?${qs}` : ''}`);
    },
  });

  const rows = data ?? [];

  return (
    <section className='space-y-6'>
      <header className='flex items-center justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Contacts</h1>
          <p className='text-sm text-muted-foreground'>Master CRM record — one contact per customer across all silos.</p>
        </div>
        <Button type='button' onClick={() => setShowNew(true)}>+ New Contact</Button>
      </header>

      {/* Stage filter chips */}
      <div className='flex flex-wrap gap-2'>
        {STAGES.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => setStage(key)}
            className={
              'rounded-full border px-3 py-1 text-xs font-medium transition ' +
              (stage === key
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-surface/30 text-muted-foreground hover:text-foreground')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder='Search name, email, phone…'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className='max-w-sm'
      />

      {isLoading && <p className='text-sm text-muted-foreground'>Loading contacts…</p>}
      {isError   && <p className='text-sm text-red-400'>Failed to load contacts.</p>}

      {!isLoading && rows.length === 0 && (
        <div className='rounded-2xl border border-border/60 bg-surface/30 px-6 py-10 text-center'>
          <p className='text-sm text-muted-foreground'>No contacts found.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className='overflow-x-auto rounded-2xl border border-border/60'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border/60 bg-surface/30 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground'>
                <th className='px-4 py-3'>Name</th>
                <th className='px-4 py-3'>Email</th>
                <th className='px-4 py-3'>Phone</th>
                <th className='px-4 py-3'>Stage</th>
                <th className='px-4 py-3'>Tags</th>
                <th className='px-4 py-3'>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className='border-b border-border/40 hover:bg-surface/20 transition-colors'>
                  <td className='px-4 py-3 font-medium'>
                    <Link to={`/admin/contacts/${c.id}`} className='hover:text-accent underline-offset-2 hover:underline'>
                      {c.name}
                    </Link>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>{c.email ?? '—'}</td>
                  <td className='px-4 py-3 text-muted-foreground'>{c.phone ?? '—'}</td>
                  <td className='px-4 py-3'><StageChip stage={c.stage} /></td>
                  <td className='px-4 py-3'>
                    <div className='flex flex-wrap gap-1'>
                      {(c.tags ?? []).map((t) => (
                        <span key={t} className='rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground'>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewContactModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
          }}
        />
      )}
    </section>
  );
}

// ── New Contact Modal ────────────────────────────────────────────────────────

type NewForm = {
  name: string;
  email: string;
  phone: string;
  stage: string;
  source: string;
  tags: string;
  notes: string;
};

const BLANK: NewForm = { name: '', email: '', phone: '', stage: 'new_lead', source: 'manual', tags: '', notes: '' };

function NewContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NewForm>(BLANK);
  const create = useMutation({
    mutationFn: () =>
      api.post<Contact>('/contacts', {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        tags:  form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: onSaved,
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60' onClick={onClose}>
      <div
        className='w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-semibold'>New Contact</h2>

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
            {STAGES.filter((s) => s.key !== '').map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label='Tags (comma-separated)'>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder='vip, returning, referral' />
        </Field>
        <Field label='Notes'>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none'
          />
        </Field>

        {create.isError && (
          <p className='text-sm text-red-400'>{create.error instanceof Error ? create.error.message : 'Save failed'}</p>
        )}

        <div className='flex justify-end gap-2 pt-2'>
          <Button variant='outline' type='button' onClick={onClose}>Cancel</Button>
          <Button type='button' disabled={!form.name || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Saving…' : 'Create'}
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
