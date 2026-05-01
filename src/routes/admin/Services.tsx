import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TALENTS } from '@/data/talents';
import type { Service } from '@/types';
import { api } from '@/lib/api';

type Draft = Omit<Service, 'id'> & { id?: number; _dirty?: boolean; _saving?: boolean; _error?: string };

const PRICE_UNITS = ['unit', 'syringe', 'session', 'area', 'drip', 'shot', 'treatment', 'vial'] as const;

const empty = (): Draft => ({
  slug: '',
  name: '',
  description: '',
  duration_minutes: 60,
  price_cents: 0,
  price_unit: undefined,
  active: true,
  sort_order: 0,
  talents: [],
  _dirty: true,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const toDollars = (cents: number) => (Number.isFinite(cents) ? (cents / 100).toFixed(2) : '0.00');
const fromDollars = (s: string) => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export default function AdminServices() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: () => api.get<Service[]>('/admin/services'),
  });

  const [rows, setRows] = useState<Draft[]>([]);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(data.map((s) => ({
      ...s,
      _dirty: false,
      _saving: false,
      _error: undefined,
    })));
  }, [data]);
  
  const updateRow = (idx: number, patch: Partial<Draft>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true, _error: undefined } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, empty()]);

  const createMut = useMutation({
    mutationFn: (row: Draft) =>
      api.post<Service>('/services', {
        slug: row.slug || slugify(row.name),
        name: row.name,
        description: row.description,
        duration_minutes: Number(row.duration_minutes) || 0,
        price_cents: Number(row.price_cents) || 0,
        price_unit: row.price_unit || undefined,
        active: !!row.active,
        sort_order: Number(row.sort_order) || 0,
        talents: row.talents ?? [],
      }),
  });

  const updateMut = useMutation({
    mutationFn: (row: Draft) =>
      api.put<Service>(`/admin/services/${row.id}`, {
        slug: row.slug,
        name: row.name,
        description: row.description,
        duration_minutes: Number(row.duration_minutes) || 0,
        price_cents: Number(row.price_cents) || 0,
        price_unit: row.price_unit || null,
        active: !!row.active,
        sort_order: Number(row.sort_order) || 0,
        talents: row.talents ?? [],
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete<{ id: number }>(`/services/${id}`),
  });

  const saveRow = async (idx: number) => {
    const row = rows[idx];
    if (!row.name || row.name.length < 2) return updateRow(idx, { _error: 'Name required (min 2 chars)' });
    if (!row.description || row.description.length < 2) return updateRow(idx, { _error: 'Description required' });
    if (!row.slug) updateRow(idx, { slug: slugify(row.name) });
    updateRow(idx, { _saving: true, _error: undefined });
    try {
      if (row.id) {
        await updateMut.mutateAsync({ ...row, slug: row.slug || slugify(row.name) });
      } else {
        await createMut.mutateAsync({ ...row, slug: row.slug || slugify(row.name) });
      }
      await refetch();
      await qc.invalidateQueries({ queryKey: ['admin', 'services'] });
      qc.invalidateQueries({ queryKey: ['services'] });
    } catch (e: unknown) {
      updateRow(idx, { _error: e instanceof Error ? e.message : 'Save failed', _saving: false });
    }
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(`Delete service "${row.name}"? This cannot be undone.`)) return;
    try {
      await deleteMut.mutateAsync(row.id);
      await refetch();
      await qc.invalidateQueries({ queryKey: ['admin', 'services'] });
      qc.invalidateQueries({ queryKey: ['services'] });
    } catch (e: unknown) {
      updateRow(idx, { _error: e instanceof Error ? e.message : 'Delete failed' });
    }
  };

  const togglePublish = async (idx: number) => {
    const row = rows[idx];
    const next = !row.active;
    updateRow(idx, { active: next });
    if (row.id) {
      try {
        await updateMut.mutateAsync({ ...row, active: next });
        await refetch();
        await qc.invalidateQueries({ queryKey: ['admin', 'services'] });
        qc.invalidateQueries({ queryKey: ['services'] });
      } catch (e: unknown) {
        updateRow(idx, { _error: e instanceof Error ? e.message : 'Publish toggle failed', active: row.active });
      }
    }
  };

  const toggleTalent = (idx: number, slug: string) => {
    const row = rows[idx];
    const current = row.talents ?? [];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    updateRow(idx, { talents: next });
  };

  if (isLoading) return <p className='p-4'>Loading services...</p>;
  if (error) return <p className='p-4 text-red-500'>Failed to load services: {(error as Error).message}</p>;

  return (
    <section className='p-4 space-y-4'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>Services</h1>
          <p className='text-sm text-[hsl(var(--muted-foreground))]'>Add, edit, publish, or remove services shown on the customer site.</p>
        </div>
        <button
          type='button'
          onClick={addRow}
          className='btn-accent px-3 py-2 text-sm font-medium'
        >
          + Add service
        </button>
      </header>

      {rows.length === 0 && (
        <p className='rounded border border-dashed border-border p-6 text-center text-sm text-[hsl(var(--muted-foreground))]'>
          No services yet. Click "+ Add service" to create your first one.
        </p>
      )}

      <ul className='space-y-3'>
        {rows.map((row, idx) => (
          <li
            key={row.id ?? `new-${idx}`}
            className='rounded border border-border bg-[hsl(var(--surface)/0.4)] p-3 space-y-2'
          >
            <div className='grid grid-cols-1 gap-2 md:grid-cols-12'>
              <label className='md:col-span-4 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Name</span>
                <input
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateRow(idx, { name, slug: row.slug || slugify(name) });
                  }}
                  placeholder='Botox / Dysport'
                />
              </label>
              <label className='md:col-span-3 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Slug</span>
                <input
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm font-mono'
                  value={row.slug}
                  onChange={(e) => updateRow(idx, { slug: slugify(e.target.value) })}
                  placeholder='botox-dysport'
                />
              </label>
              <label className='md:col-span-2 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Duration (min)</span>
                <input
                  type='number'
                  min={1}
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                  value={row.duration_minutes}
                  onChange={(e) => updateRow(idx, { duration_minutes: Number(e.target.value) })}
                />
              </label>
              <label className='md:col-span-2 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Price (USD)</span>
                <input
                  inputMode='decimal'
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                  value={toDollars(row.price_cents)}
                  onChange={(e) => updateRow(idx, { price_cents: fromDollars(e.target.value) })}
                />
              </label>
              <label className='md:col-span-1 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Order</span>
                <input
                  type='number'
                  min={0}
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                  value={row.sort_order}
                  onChange={(e) => updateRow(idx, { sort_order: Number(e.target.value) })}
                />
              </label>
            </div>

            <div className='grid grid-cols-1 gap-2 md:grid-cols-12'>
              <label className='md:col-span-3 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))]'>Price Unit</span>
                <select
                  className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                  value={row.price_unit ?? ''}
                  onChange={(e) => updateRow(idx, { price_unit: e.target.value || undefined })}
                >
                  <option value=''>— none —</option>
                  {PRICE_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>
              <div className='md:col-span-9 text-xs'>
                <span className='block text-[hsl(var(--muted-foreground))] mb-1'>
                  Talents
                  <span className='ml-1 text-[hsl(var(--muted-foreground)/0.7)]'>— pick one or more; determines which footer Talent link surfaces this service</span>
                </span>
                <div className='flex flex-wrap gap-1.5'>
                  {TALENTS.map((t) => {
                    const active = (row.talents ?? []).includes(t.slug);
                    return (
                      <button
                        key={t.slug}
                        type='button'
                        onClick={() => toggleTalent(idx, t.slug)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                            : 'bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className='block text-xs'>
              <span className='block text-[hsl(var(--muted-foreground))]'>Description</span>
              <textarea
                rows={2}
                className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                value={row.description}
                onChange={(e) => updateRow(idx, { description: e.target.value })}
                placeholder='What the customer gets...'
              />
            </label>

            <div className='flex flex-wrap items-center gap-3'>
              <button
                type='button'
                onClick={() => togglePublish(idx)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  row.active ? 'bg-emerald-700 text-emerald-100' : 'bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))]'
                }`}
                title='Toggle whether this service is shown publicly'
              >
                {row.active ? 'Published' : 'Unpublished'}
              </button>

              {row._error && <span className='text-xs text-red-400'>{row._error}</span>}

              <div className='ml-auto flex gap-2'>
                <button
                  type='button'
                  onClick={() => saveRow(idx)}
                  disabled={!row._dirty || row._saving}
                  className='btn-accent px-3 py-1 text-xs font-medium disabled:opacity-40'
                >
                  {row._saving ? 'Saving...' : row.id ? 'Save' : 'Create'}
                </button>
                <button
                  type='button'
                  onClick={() => removeRow(idx)}
                  className='rounded border border-red-700 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-900/40'
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
