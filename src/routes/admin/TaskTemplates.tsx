import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Template = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

type FormState = { name: string; description: string };
const EMPTY: FormState = { name: '', description: '' };

export default function TaskTemplates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['task-templates'],
    queryFn: () => api.get<Template[]>('/admin/tasks/templates'),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => api.post<Template>('/admin/tasks/templates', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); setCreating(false); setForm(EMPTY); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormState) => api.put<Template>(`/admin/tasks/templates/${editing!.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); setEditing(null); setForm(EMPTY); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/tasks/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates'] }),
  });

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); }
  function openEdit(t: Template) { setForm({ name: t.name, description: t.description ?? '' }); setEditing(t); setCreating(false); }
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
        <h1 className='text-2xl font-semibold'>Task Templates</h1>
        <Button type='button' size='sm' onClick={openCreate}>+ New Template</Button>
      </div>

      {(creating || editing) && (
        <form onSubmit={handleSubmit} className='rounded border border-border p-4 space-y-3'>
          <h2 className='text-lg font-medium'>{editing ? 'Edit Template' : 'New Template'}</h2>
          <div>
            <label className='block text-sm font-medium mb-1'>Name</label>
            <input
              type='text'
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            />
          </div>
          {submitError && <p className='text-sm text-red-400'>{submitError.message}</p>}
          <div className='flex gap-2'>
            <Button type='submit' disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
            <Button type='button' variant='outline' onClick={cancel}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading && <p>Loading templates...</p>}

      {templates && (
        <div className='space-y-2'>
          {templates.map(t => (
            <div key={t.id} className='flex flex-wrap items-center gap-3 rounded border border-border p-3'>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium'>{t.name}</p>
                {t.description && <p className='text-xs text-muted-foreground truncate'>{t.description}</p>}
              </div>
              <div className='flex gap-2'>
                <Button type='button' variant='outline' size='sm' onClick={() => openEdit(t)}>Edit</Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(t.id); }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className='text-sm text-muted-foreground'>No templates yet.</p>}
        </div>
      )}
    </section>
  );
}
