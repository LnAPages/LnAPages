import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Product = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  price_cents: number;
  kind: 'digital' | 'apparel' | '3d' | 'shipped';
  tags: string[];
};

export default function Shop() {
  const [email, setEmail] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { data: products = [], error, isLoading } = useQuery({
    queryKey: ['shop', 'products'],
    queryFn: () => api.get<Product[]>('/shop/products'),
  });

  const filteredProducts = useMemo(
    () => (activeTag ? products.filter((product) => product.tags?.includes(activeTag)) : products),
    [activeTag, products],
  );

  const checkoutMutation = useMutation({
    mutationFn: (productId: number) => api.post<{ url: string }>('/shop/checkout', { productId, email }),
    onSuccess: (payload) => {
      if (payload.url) window.location.href = payload.url;
    },
  });

  if (isLoading) return <p>Loading shop…</p>;
  if (error) return <p>Shop is unavailable.</p>;

  return (
    <section className='space-y-4'>
      <header>
        <h1 className='text-2xl font-semibold'>Shop</h1>
      </header>
      <label className='block text-sm'>
        <span className='block text-slate-400'>Email for delivery</span>
        <input
          type='email'
          className='mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm'
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder='you@example.com'
        />
      </label>
      {activeTag ? (
        <button
          type='button'
          className='w-fit rounded-full border border-slate-600 px-3 py-1 text-xs'
          onClick={() => setActiveTag(null)}
        >
          Clear filter: {activeTag}
        </button>
      ) : null}
      <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
        {filteredProducts.map((product) => (
          <article key={product.id} className='rounded border border-slate-700 bg-slate-900/40 p-4 space-y-2'>
            <h2 className='font-medium'>{product.name}</h2>
            <p className='text-sm text-slate-400'>{product.description}</p>
            {product.tags?.length ? (
              <div className='flex flex-wrap gap-2'>
                {product.tags.map((tag) => (
                  <button
                    type='button'
                    key={tag}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${activeTag === tag ? 'border-blue-400 text-blue-300' : 'border-slate-600 text-slate-300'}`}
                    onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
            <p className='text-sm'>${(product.price_cents / 100).toFixed(2)}</p>
            <button
              type='button'
              disabled={!email || checkoutMutation.isPending}
              className='rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50'
              onClick={() => checkoutMutation.mutate(product.id)}
            >
              Buy
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
