import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Product = {
  id?: number;
  slug: string;
  name: string;
  description?: string | null;
  price_cents: number;
  kind: 'digital' | 'apparel' | '3d' | 'shipped';
  r2_key?: string | null;
  active: boolean;
};

type ProductTagsResponse = { tags: string[] };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const emptyProduct: Product = {
  slug: '',
  name: '',
  description: '',
  price_cents: 0,
  kind: 'digital',
  active: true,
  r2_key: '',
};

export default function AdminShop() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSlugEditable, setIsSlugEditable] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['admin', 'shop', 'products'],
    queryFn: () => api.get<Product[]>('/admin/shop/products'),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ product, tags }: { product: Product; tags: string[] }) => {
      const saved = product.id
        ? await api.put<Product>(`/admin/shop/products/${product.id}`, product)
        : await api.post<Product>('/admin/shop/products', product);

      if (saved.id) {
        await api.put<ProductTagsResponse>(`/admin/products/${saved.id}/tags`, { tags });
      }
      return saved;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] });
      setDraft(saved);
      setIsSlugEditable(false);
      setSlugManuallyEdited(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/shop/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] });
      if (draft.id) {
        setDraft(emptyProduct);
        setDraftTags([]);
        setTagInput('');
        setIsSlugEditable(false);
        setSlugManuallyEdited(false);
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const presign = await api.post<{ url: string; key: string; headers: Record<string, string> }>('/admin/shop/upload', {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      });
      await fetch(presign.url, { method: 'PUT', headers: presign.headers, body: file });
      return presign.key;
    },
    onSuccess: (key) => setDraft((current) => ({ ...current, r2_key: key })),
  });

  const addTag = (rawTag: string) => {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    setDraftTags((current) => {
      if (current.some((item) => item.toLowerCase() === tag.toLowerCase())) return current;
      return [...current, tag];
    });
    setTagInput('');
  };

  const onTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(tagInput);
    }
  };

  const handleProductSelect = async (product: Product) => {
    setDraft(product);
    setTagInput('');
    setIsSlugEditable(false);
    setSlugManuallyEdited(false);
    if (!product.id) {
      setDraftTags([]);
      return;
    }
    const payload = await api.get<ProductTagsResponse>(`/admin/products/${product.id}/tags`);
    setDraftTags(payload.tags);
  };

  return (
    <section className='p-4 space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-semibold'>{draft.id ? 'Edit product' : 'Create product'}</h2>
        <button
          type='button'
          className='rounded border border-border px-2 py-1 text-xs'
          onClick={() => {
            setDraft(emptyProduct);
            setDraftTags([]);
            setTagInput('');
            setIsSlugEditable(false);
            setSlugManuallyEdited(false);
          }}
        >
          New product
        </button>
      </div>

      <div className='rounded border border-border bg-[hsl(var(--surface)/0.4)] p-3 space-y-2'>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
          <input
            className='rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
            placeholder='Name'
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value;
              setDraft((current) => ({
                ...current,
                name,
                slug: slugManuallyEdited ? current.slug : slugify(name),
              }));
            }}
          />

          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-[hsl(var(--muted-foreground))]'>Slug</span>
              {!isSlugEditable ? (
                <button
                  type='button'
                  className='text-xs text-blue-300 underline'
                  onClick={() => {
                    setIsSlugEditable(true);
                    setSlugManuallyEdited(true);
                  }}
                >
                  Edit
                </button>
              ) : null}
            </div>
            <input
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
              placeholder='Slug'
              value={draft.slug}
              readOnly={!isSlugEditable}
              onChange={(e) => {
                setDraft((current) => ({ ...current, slug: slugify(e.target.value) }));
                setSlugManuallyEdited(true);
              }}
            />
            <p className='text-[11px] text-[hsl(var(--muted-foreground))]'>Used in the product URL, e.g. fnlstage.com/shop/your-slug. Auto-filled from Name.</p>
          </div>

          <input
            className='rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
            placeholder='Price cents'
            type='number'
            value={draft.price_cents}
            onChange={(e) => setDraft((current) => ({ ...current, price_cents: Number(e.target.value) }))}
          />

          <label className='space-y-1 text-xs text-[hsl(var(--muted-foreground))]'>
            Fulfillment type
            <select
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm text-[hsl(var(--foreground))]'
              value={draft.kind}
              onChange={(e) => setDraft((current) => ({ ...current, kind: e.target.value as Product['kind'] }))}
            >
              <option value='digital'>digital</option>
              <option value='apparel'>apparel</option>
              <option value='3d'>3d</option>
              <option value='shipped'>shipped</option>
            </select>
          </label>

          <label className='inline-flex items-center gap-2 text-xs'><input type='checkbox' checked={draft.active} onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))} />Active</label>

          <textarea className='md:col-span-2 rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm' placeholder='Description' value={draft.description ?? ''} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />

          <div className='md:col-span-2 space-y-2'>
            <label className='block text-xs text-[hsl(var(--muted-foreground))]'>Product tags</label>
            <input
              className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
              placeholder='Type a tag and press Enter'
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={onTagInputKeyDown}
              onBlur={() => addTag(tagInput)}
            />
            <div className='flex flex-wrap gap-2'>
              {draftTags.map((tag) => (
                <span key={tag.toLowerCase()} className='inline-flex items-center gap-2 rounded-full border border-border px-2 py-0.5 text-xs'>
                  {tag}
                  <button
                    type='button'
                    className='text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    onClick={() => setDraftTags((current) => current.filter((item) => item !== tag))}
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <label className='md:col-span-2 text-xs text-[hsl(var(--muted-foreground))]'>
            Digital file
            <input type='file' className='mt-1 block text-xs' onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadMutation.mutate(file); }} />
          </label>
          {draft.r2_key ? <p className='md:col-span-2 text-xs text-emerald-400'>Uploaded: {draft.r2_key}</p> : null}
        </div>
        <button
          type='button'
          className='btn-accent px-3 py-1 text-xs disabled:opacity-60'
          onClick={() => saveMutation.mutate({ product: draft, tags: draftTags })}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save product'}
        </button>
      </div>

      <ul className='space-y-2'>
        {products.map((product) => (
          <li key={product.id} className='rounded border border-border bg-[hsl(var(--surface)/0.4)] p-3 flex items-center justify-between gap-2'>
            <div>
              <p className='font-medium'>{product.name}</p>
              <p className='text-xs text-[hsl(var(--muted-foreground))]'>{product.slug} · ${(product.price_cents / 100).toFixed(2)} · {product.kind}</p>
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                className='rounded border border-border px-2 py-1 text-xs'
                onClick={() => {
                  handleProductSelect(product).catch((error) => {
                    console.error('Failed to load product tags', error);
                  });
                }}
              >
                Edit
              </button>
              {product.id ? (
                <button type='button' className='rounded border border-red-700 px-2 py-1 text-xs text-red-300' onClick={() => removeMutation.mutate(product.id!)}>
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
