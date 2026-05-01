import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Contact = {
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
  { key: 'new_lead',      label: 'New Lead',      hint: 'Comes from /quote intakes' },
  { key: 'qualified',     label: 'Qualified',     hint: 'You have replied and confirmed fit' },
  { key: 'proposal',      label: 'Proposal',      hint: 'Quote sent; waiting on decision' },
  { key: 'booked',        label: 'Booked',        hint: 'Deposit / contract received' },
  { key: 'in_production', label: 'In Production', hint: 'Job in progress' },
  { key: 'delivered',     label: 'Delivered',     hint: 'Final files / product delivered' },
  { key: 'past_client',   label: 'Past Client',   hint: 'Closed-won; nurture for repeat' },
  { key: 'lost',          label: 'Lost',          hint: 'Closed-lost' },
] as const;

type StageKey = typeof STAGES[number]['key'];

const STAGE_ACCENT: Record<StageKey, string> = {
  new_lead:      'border-blue-500/40',
  qualified:     'border-purple-500/40',
  proposal:      'border-yellow-500/40',
  booked:        'border-green-500/40',
  in_production: 'border-accent/50',
  delivered:     'border-teal-500/40',
  past_client:   'border-border',
  lost:          'border-red-500/40',
};

type ContactWithExtras = Contact & {
  estimated_value_cents?: number | null;
  service_interest?: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatUsd(cents: number): string {
  const dollars = Math.round(cents / 100);
  return DOLLAR_SIGN + dollars.toLocaleString();
}
const DOLLAR_SIGN = String.fromCharCode(36);

function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = 60 * 1000;
  const hr  = 60 * min;
  const day = 24 * hr;
  if (diff < min)      return 'just now';
  if (diff < hr)       return Math.floor(diff / min) + 'm ago';
  if (diff < day)      return Math.floor(diff / hr) + 'h ago';
  if (diff < 7 * day)  return Math.floor(diff / day) + 'd ago';
  return new Date(iso).toLocaleDateString();
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function ContactCard({
  contact,
  onDragStart,
  onClick,
  onPickStage,
  isMobileView,
}: {
  contact: ContactWithExtras;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onClick: () => void;
  onPickStage: (id: number) => void;
  isMobileView: boolean;
}) {
  const tags = (contact.tags ?? []).slice(0, 3);
  return (
    <article
      draggable={!isMobileView}
      onDragStart={(e) => onDragStart(e, contact.id)}
      onClick={onClick}
      className="cursor-pointer rounded-md border border-border bg-surface/60 p-3 hover:bg-surface/80 transition focus:outline-none focus:ring-2 focus:ring-accent"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold uppercase text-foreground">
          {initials(contact.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{contact.name}</p>
          {contact.service_interest ? (
            <p className="truncate text-[11px] text-muted-foreground">{contact.service_interest}</p>
          ) : null}
        </div>
        {typeof contact.estimated_value_cents === 'number' && contact.estimated_value_cents > 0 ? (
          <span className="shrink-0 text-[11px] font-medium text-foreground">
            {formatUsd(contact.estimated_value_cents)}
          </span>
        ) : null}
      </div>
      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {contact.last_activity_at ? relativeTime(contact.last_activity_at) : ''}
        </span>
        {isMobileView ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPickStage(contact.id);
            }}
            className="text-[10px] underline text-muted-foreground hover:text-foreground"
          >
            Move
          </button>
        ) : null}
      </div>
    </article>
  );
}

function NewLeadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      return api.post<Contact>('/contacts', {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: 'manual',
        stage: 'new_lead',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pipeline'] });
      onClose();
    },
    onError: (e) => {
      setError((e as Error).message || 'Failed to create lead');
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    create.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New Lead"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">New Lead</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="lead-name">Name</label>
          <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="lead-email">Email</label>
          <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="lead-phone">Phone</label>
          <Input id="lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create lead'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StagePickerModal({
  contact,
  onClose,
  onPick,
}: {
  contact: ContactWithExtras;
  onClose: () => void;
  onPick: (stage: StageKey) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Move to stage"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-xl"
      >
        <p className="mb-3 text-sm font-medium">Move {contact.name} to:</p>
        <div className="space-y-1">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onPick(s.key)}
              disabled={s.key === contact.stage}
              className="block w-full rounded border border-border px-3 py-2 text-left text-sm hover:bg-surface/50 disabled:opacity-40"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [pickFor, setPickFor] = useState<ContactWithExtras | null>(null);
  const [dragOver, setDragOver] = useState<StageKey | null>(null);
  const isMobileView = isMobile();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'pipeline'],
    queryFn: () => api.get<ContactWithExtras[]>('/contacts'),
    refetchOnWindowFocus: true,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: StageKey }) => {
      return api.patch<Contact>(`/contacts/${id}`, { stage });
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'pipeline'] });
      const prev = queryClient.getQueryData<ContactWithExtras[]>(['admin', 'pipeline']);
      if (prev) {
        queryClient.setQueryData<ContactWithExtras[]>(
          ['admin', 'pipeline'],
          prev.map((c) => (c.id === id ? { ...c, stage } : c)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin', 'pipeline'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pipeline'] });
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const grouped = useMemo(() => {
    const out: Record<StageKey, ContactWithExtras[]> = {
      new_lead: [], qualified: [], proposal: [], booked: [],
      in_production: [], delivered: [], past_client: [], lost: [],
    };
    for (const c of filtered) {
      const key = (c.stage as StageKey);
      if (out[key]) out[key].push(c);
    }
    return out;
  }, [filtered]);

  function handleDragStart(e: React.DragEvent, id: number) {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, stage: StageKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== stage) setDragOver(stage);
  }

  function handleDrop(e: React.DragEvent, stage: StageKey) {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(id) || id <= 0) return;
    const current = (data ?? []).find((c) => c.id === id);
    if (!current || current.stage === stage) return;
    updateStage.mutate({ id, stage });
  }

  return (
    <div className="space-y-4 max-w-full">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            aria-label="Search contacts"
          />
        </div>
        <Button onClick={() => setShowNew(true)}>+ New Lead</Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Failed to load pipeline.</p>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none md:flex-wrap md:overflow-x-visible"
          aria-label="Pipeline columns"
          role="list"
        >
          {STAGES.map((s) => {
            const items = grouped[s.key];
            const count = items.length;
            const total = items.reduce(
              (sum, c) => sum + (typeof c.estimated_value_cents === 'number' ? c.estimated_value_cents : 0),
              0,
            );
            const isOver = dragOver === s.key;
            return (
              <section
                key={s.key}
                role="listitem"
                aria-label={`${s.label} column`}
                onDragOver={(e) => handleDragOver(e, s.key)}
                onDragLeave={() => setDragOver((d) => (d === s.key ? null : d))}
                onDrop={(e) => handleDrop(e, s.key)}
                className={`shrink-0 snap-start w-[85vw] md:w-64 md:shrink md:flex-1 rounded-lg border bg-surface/30 p-3 transition ${STAGE_ACCENT[s.key]} ${isOver ? 'ring-2 ring-accent' : ''}`}
              >
                <header className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">{s.label}</h2>
                  <span className="text-[10px] text-muted-foreground">
                    {count}{total > 0 ? ` · ${formatUsd(total)}` : ''}
                  </span>
                </header>
                {s.key === 'new_lead' ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowNew(true)}
                    className="mb-3 w-full text-xs"
                  >
                    + New Lead
                  </Button>
                ) : null}
                <div className="space-y-2 min-h-[60px]">
                  {items.length === 0 ? (
                    <p className="rounded border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
                      {s.hint}
                    </p>
                  ) : (
                    items.map((c) => (
                      <ContactCard
                        key={c.id}
                        contact={c}
                        onDragStart={handleDragStart}
                        onClick={() => navigate(`/admin/contacts/${c.id}`)}
                        onPickStage={() => setPickFor(c)}
                        isMobileView={isMobileView}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Tip: drag a card to another column to move it. Charts moved to{' '}
        <Link to="/admin/dashboard" className="underline">/admin/dashboard</Link>.
      </p>

      {showNew ? <NewLeadModal onClose={() => setShowNew(false)} /> : null}
      {pickFor ? (
        <StagePickerModal
          contact={pickFor}
          onClose={() => setPickFor(null)}
          onPick={(stage) => {
            updateStage.mutate({ id: pickFor.id, stage });
            setPickFor(null);
          }}
        />
      ) : null}
    </div>
  );
}
