import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuLink } from '@/types';
import { api } from '@/lib/api';

type DraftLink = MenuLink;

const newId = () => `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Built-in public pages that can be toggled on/off in the hamburger menu
 *  with a single click. Custom links can still be added below. */
const BUILTIN_PAGES: { key: string; label: string; url: string }[] = [
  { key: 'home', label: 'Home', url: '/' },
  { key: 'services', label: 'Services', url: '/services' },
  { key: 'booking', label: 'Booking', url: '/booking' },
  { key: 'gallery', label: 'Gallery', url: '/gallery' },
  { key: 'shop', label: 'Shop', url: '/shop' },
  { key: 'quote', label: 'Quote', url: '/quote' },
  { key: 'blog', label: 'Blog', url: '/blog' },
];

const builtinIdFor = (key: string) => `builtin:${key}`;
const isBuiltinId = (id: string) => id.startsWith('builtin:');

export default function Menu() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['menu-admin'],
    queryFn: () => api.get<MenuLink[]>('/menu'),
  });

  const [draft, setDraft] = useState<DraftLink[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft([...data].sort((a, b) => a.sort_order - b.sort_order).map((l) => ({ ...l })));
  }, [data]);

  const save = useMutation({
    mutationFn: (links: DraftLink[]) => api.put<MenuLink[]>('/menu', { links }),
    onSuccess: (saved) => {
      qc.setQueryData(['menu-admin'], saved);
      qc.invalidateQueries({ queryKey: ['menu'] });
      setStatus('Saved. The customer hamburger now shows these links.');
    },
    onError: (e: unknown) => {
      setStatus(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    },
  });

  const update = (idx: number, patch: Partial<DraftLink>) =>
    setDraft((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const remove = (idx: number) => setDraft((d) => d.filter((_, i) => i !== idx));
  const add = () =>
    setDraft((d) => [
      ...d,
      { id: newId(), label: '', url: '/', new_tab: false, sort_order: d.length },
    ]);
  const move = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((row, i) => ({ ...row, sort_order: i }));
    });
  };

  const builtinEnabled = (key: string) =>
    draft.some((row) => row.id === builtinIdFor(key));

  const toggleBuiltin = (key: string) => {
    const id = builtinIdFor(key);
    const page = BUILTIN_PAGES.find((p) => p.key === key);
    if (!page) return;
    setDraft((d) => {
      if (d.some((row) => row.id === id)) {
        return d.filter((row) => row.id !== id).map((row, i) => ({ ...row, sort_order: i }));
      }
      return [
        ...d,
        {
          id,
          label: page.label,
          url: page.url,
          new_tab: false,
          sort_order: d.length,
        },
      ];
    });
  };

  const submit = () => {
    setStatus(null);
    const cleaned = draft
      .map((row, i) => ({ ...row, sort_order: i }))
      .filter((row) => row.label.trim() && row.url.trim());
    save.mutate(cleaned);
  };

  if (isLoading) return <p>Loading menu links…</p>;

  const customRows = draft
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !isBuiltinId(row.id));

  return (
    <section className='space-y-4'>
      <header className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Menu</h1>
        <button
          type='button'
          onClick={submit}
          disabled={save.isPending}
          className='rounded bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50'
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <div className='rounded border border-border p-4'>
        <h2 className='text-lg font-semibold'>Built-in pages</h2>
        <p className='text-sm text-muted'>
          Flip a switch to show or hide a built-in page in the menu.
        </p>
        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
          {BUILTIN_PAGES.map((page) => {
            const on = builtinEnabled(page.key);
            return (
              <label
                key={page.key}
                className='flex items-center justify-between rounded border border-border px-3 py-2 text-sm'
              >
                <span>
                  <span className='font-medium'>{page.label}</span>
                  <span className='ml-2 text-muted'>{page.url}</span>
                </span>
                <input
                  type='checkbox'
                  checked={on}
                  onChange={() => toggleBuiltin(page.key)}
                  aria-label={`Show ${page.label} in hamburger menu`}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className='rounded border border-border p-4'>
        <h2 className='text-lg font-semibold'>Custom links</h2>
        <p className='text-sm text-muted'>
          Add external links or any other custom destination here.
        </p>
        <div className='mt-3 space-y-2'>
          {customRows.length === 0 && (
            <p className='text-sm text-muted'>No custom links yet.</p>
          )}
          {customRows.map(({ row, idx }) => (
            <div key={row.id} className='flex flex-wrap items-center gap-2'>
              <input
                aria-label='Label'
                placeholder='About'
                value={row.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                className='rounded border border-border bg-transparent px-2 py-1 text-sm'
              />
              <input
                aria-label='URL'
                placeholder='/about or https://example.com'
                value={row.url}
                onChange={(e) => update(idx, { url: e.target.value })}
                className='flex-1 min-w-[12rem] rounded border border-border bg-transparent px-2 py-1 text-sm'
              />
              <label className='flex items-center gap-1 text-xs'>
                <input
                  type='checkbox'
                  checked={row.new_tab}
                  onChange={(e) => update(idx, { new_tab: e.target.checked })}
                />
                New tab
              </label>
              <button
                type='button'
                onClick={() => move(idx, -1)}
                className='rounded border border-border px-2 py-1 text-xs'
                aria-label='Move up'
              >
                ↑
              </button>
              <button
                type='button'
                onClick={() => move(idx, 1)}
                className='rounded border border-border px-2 py-1 text-xs'
                aria-label='Move down'
              >
                ↓
              </button>
              <button
                type='button'
                onClick={() => remove(idx)}
                className='rounded border border-red-500 px-2 py-1 text-xs text-red-500'
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type='button'
            onClick={add}
            className='mt-2 rounded border border-border px-3 py-1 text-sm'
          >
            + Add custom link
          </button>
        </div>
      </div>

      {status && <p className='text-sm text-muted'>{status}</p>}
    </section>
  );
}
