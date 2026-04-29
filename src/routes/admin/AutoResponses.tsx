import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type AutoResponse = {
  id: number;
  trigger_event: string;
  scope: string;
  channel: string;
  subject: string | null;
  body_text?: string;
  active: boolean | number;
  created_at: string;
};

type FormState = {
  trigger_event: string;
  scope: 'global' | 'service' | 'product';
  channel: string;
  subject: string;
  body_text: string;
  active: boolean;
};

const EMPTY: FormState = { trigger_event: '', scope: 'global', channel: 'email', subject: '', body_text: '', active: true };

export default function AutoResponses() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AutoResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const { data: responses, isLoading } = useQuery({
    queryKey: ['auto-responses'],
    queryFn: () => api.get<AutoResponse[]>('/admin/auto-responses'),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => api.post<{ id: number }>('/admin/auto-responses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-responses'] }); setCreating(false); setForm(EMPTY); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormState>) => api.put<{ updated: boolean }>(`/admin/auto-responses/${editing!.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-responses'] }); setEditing(null); setForm(EMPTY); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/auto-responses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-responses'] }),
  });

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); }
  async function openEdit(r: AutoResponse) {
    setLoadingEdit(true);
    try {
      const full = await api.get<AutoResponse>(`/admin/auto-responses/${r.id}`);
      setForm({
        trigger_event: full.trigger_event,
        scope: (full.scope as FormState['scope']) ?? 'global',
        channel: full.channel,
        subject: full.subject ?? '',
        body_text: full.body_text ?? '',
        active: Boolean(full.active),
      });
      setEditing(r);
      setCreating(false);
    } finally {
      setLoadingEdit(false);
    }
  }
  function cancel() { setCreating(false); setEditing(null); setForm(EMPTY); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const submitError = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <section className='space-y-6'>
      <div className='flex items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>Auto Responses</h1>
        <Button type='button' size='sm' onClick={openCreate}>+ New Response</Button>
      </div>

      {(creating || editing) && (
        <form onSubmit={handleSubmit} className='rounded border border-border p-4 space-y-3'>
          <h2 className='text-lg font-medium'>{editing ? 'Edit Auto Response' : 'New Auto Response'}</h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-sm font-medium mb-1'>Trigger Event</label>
              <input
                type='text'
                value={form.trigger_event}
                onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                placeholder='e.g. booking_confirmed'
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Channel</label>
              <select
                value={form.channel}
                onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              >
                <option value='email'>Email</option>
                <option value='sms'>SMS</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Scope</label>
              <select
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value as FormState['scope'] }))}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              >
                <option value='global'>Global</option>
                <option value='service'>Service</option>
                <option value='product'>Product</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Subject</label>
              <input
                type='text'
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                placeholder='Email subject'
              />
            </div>
            <div className='sm:col-span-2'>
              <label className='block text-sm font-medium mb-1'>Body</label>
              <textarea
                value={form.body_text}
                onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                rows={5}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                required
              />
            </div>
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='active'
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor='active' className='text-sm'>Active</label>
            </div>
          </div>
          {submitError && <p className='text-sm text-red-400'>{submitError.message}</p>}
          <div className='flex gap-2'>
            <Button type='submit' disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
            <Button type='button' variant='outline' onClick={cancel}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading && <p>Loading auto responses...</p>}

      {responses && (
        <div className='space-y-2'>
          {responses.map(r => (
            <div key={r.id} className='flex flex-wrap items-start gap-3 rounded border border-border p-3'>
              <div className='flex-1 min-w-0 space-y-0.5'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <p className='text-sm font-medium'>{r.trigger_event}</p>
                  <span className='text-xs px-1.5 py-0.5 rounded bg-border'>{r.channel}</span>
                  <span className='text-xs px-1.5 py-0.5 rounded bg-border'>{r.scope}</span>
                  {!r.active && <span className='text-xs text-muted-foreground'>inactive</span>}
                </div>
                {r.subject && <p className='text-xs text-muted-foreground'>Subject: {r.subject}</p>}
              </div>
              <div className='flex gap-2'>
                <Button type='button' variant='outline' size='sm' onClick={() => openEdit(r)} disabled={loadingEdit}>Edit</Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => { if (confirm('Delete this auto response?')) deleteMutation.mutate(r.id); }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {responses.length === 0 && <p className='text-sm text-muted-foreground'>No auto responses yet.</p>}
        </div>
      )}
    </section>
  );
}
