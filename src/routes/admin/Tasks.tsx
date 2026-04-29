import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Task = {
  id: number;
  title: string;
  subject_type: string;
  subject_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: string;
  due_at: string | null;
  assignee_name: string | null;
  created_at: string;
};

const STATUS_COLS: Task['status'][] = ['pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_LABELS: Record<Task['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Tasks() {
  const qc = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectType, setSubjectType] = useState('general');
  const [subjectId, setSubjectId] = useState('1');
  const [dueAt, setDueAt] = useState('');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/admin/tasks'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; subject_type: string; subject_id: number; due_at?: string }) =>
      api.post<{ id: number }>('/admin/tasks', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowForm(false);
      setTitle('');
      setDueAt('');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Task['status'] }) =>
      api.put(`/admin/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      title,
      subject_type: subjectType,
      subject_id: Number(subjectId) || 1,
      due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
    });
  }

  return (
    <section className='space-y-6'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-semibold'>Tasks</h1>
        <div className='flex gap-2'>
          <Button type='button' variant={view === 'kanban' ? 'default' : 'outline'} size='sm' onClick={() => setView('kanban')}>Kanban</Button>
          <Button type='button' variant={view === 'list' ? 'default' : 'outline'} size='sm' onClick={() => setView('list')}>List</Button>
          <Button type='button' size='sm' onClick={() => setShowForm(v => !v)}>+ New Task</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className='rounded border border-border p-4 space-y-3'>
          <h2 className='text-lg font-medium'>New Task</h2>
          <div>
            <label className='block text-sm font-medium mb-1'>Title</label>
            <input
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              required
            />
          </div>
          <div className='flex gap-3 flex-wrap'>
            <div>
              <label className='block text-sm font-medium mb-1'>Subject type</label>
              <input
                type='text'
                value={subjectType}
                onChange={e => setSubjectType(e.target.value)}
                className='rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                placeholder='e.g. general'
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Subject ID</label>
              <input
                type='number'
                min='1'
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                className='rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm w-24'
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Due date</label>
              <input
                type='datetime-local'
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
                className='rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              />
            </div>
          </div>
          <div className='flex gap-2'>
            <Button type='submit' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
            <Button type='button' variant='outline' onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          {createMutation.isError && (
            <p className='text-sm text-red-400'>{(createMutation.error as Error).message}</p>
          )}
        </form>
      )}

      {isLoading && <p>Loading tasks...</p>}

      {tasks && view === 'kanban' && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          {STATUS_COLS.map(col => (
            <div key={col} className='rounded border border-border p-3 space-y-2'>
              <h2 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>{STATUS_LABELS[col]}</h2>
              {tasks.filter(t => t.status === col).map(task => (
                <div key={task.id} className='rounded border border-border bg-[hsl(var(--surface-2))] p-3 space-y-2'>
                  <p className='text-sm font-medium'>{task.title}</p>
                  {task.assignee_name && <p className='text-xs text-muted-foreground'>Assigned: {task.assignee_name}</p>}
                  {task.due_at && <p className='text-xs text-muted-foreground'>{new Date(task.due_at).toLocaleDateString()}</p>}
                  <select
                    value={task.status}
                    onChange={e => statusMutation.mutate({ id: task.id, status: e.target.value as Task['status'] })}
                    className='w-full rounded border border-border bg-background px-2 py-1 text-xs'
                  >
                    {STATUS_COLS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              ))}
              {tasks.filter(t => t.status === col).length === 0 && (
                <p className='text-xs text-muted-foreground'>No tasks</p>
              )}
            </div>
          ))}
        </div>
      )}

      {tasks && view === 'list' && (
        <div className='space-y-2'>
          {tasks.map(task => (
            <div key={task.id} className='flex flex-wrap items-center gap-3 rounded border border-border p-3'>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium'>{task.title}</p>
                <p className='text-xs text-muted-foreground'>{task.subject_type}{task.due_at ? ` · due ${new Date(task.due_at).toLocaleDateString()}` : ''}</p>
              </div>
              <select
                value={task.status}
                onChange={e => statusMutation.mutate({ id: task.id, status: e.target.value as Task['status'] })}
                className='rounded border border-border bg-background px-2 py-1 text-xs'
              >
                {STATUS_COLS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          ))}
          {tasks.length === 0 && <p className='text-sm text-muted-foreground'>No tasks yet.</p>}
        </div>
      )}
    </section>
  );
}
