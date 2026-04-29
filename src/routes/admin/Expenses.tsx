import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Category = { id: number; slug: string; name: string; color: string; sort_order: number };

type Expense = {
  id: number;
  amount_cents: number;
  category_id: number | null;
  category_name: string | null;
  description: string | null;
  vendor: string | null;
  incurred_on: string;
  created_at: string;
};

type ExpensesResponse = { expenses: Expense[]; totalCents: number; count: number };

export default function Expenses() {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [amountDollars, setAmountDollars] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  if (filterCategoryId) params.set('category_id', filterCategoryId);
  const queryString = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', queryString],
    queryFn: () => api.get<ExpensesResponse>(`/admin/expenses${queryString ? `?${queryString}` : ''}`),
  });

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<Category[]>('/admin/expenses/categories'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { amount_cents: number; category_id?: number; vendor?: string; description?: string; incurred_on: string }) =>
      api.post<{ id: number }>('/admin/expenses', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false);
      setAmountDollars('');
      setCategoryId('');
      setVendor('');
      setDescription('');
      setIncurredOn(new Date().toISOString().slice(0, 10));
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(amountDollars);
    if (isNaN(dollars) || dollars <= 0) { setFormError('Enter a valid amount'); return; }
    setFormError(null);
    createMutation.mutate({
      amount_cents: Math.round(dollars * 100),
      category_id: categoryId ? Number(categoryId) : undefined,
      vendor: vendor.trim() || undefined,
      description: description.trim() || undefined,
      incurred_on: incurredOn,
    });
  }

  const expenses = data?.expenses ?? [];

  // Totals by category for the bar chart
  const totalsMap: Record<string, { name: string; cents: number }> = {};
  for (const e of expenses) {
    const key = e.category_name ?? 'Uncategorized';
    if (!totalsMap[key]) totalsMap[key] = { name: key, cents: 0 };
    totalsMap[key].cents += e.amount_cents;
  }
  const sortedTotals = Object.values(totalsMap).sort((a, b) => b.cents - a.cents);
  const grandCents = sortedTotals.reduce((s, t) => s + t.cents, 0);

  return (
    <section className='space-y-6'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-semibold'>Expenses</h1>
        <Button type='button' size='sm' onClick={() => setShowForm(v => !v)}>+ Add Expense</Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className='rounded border border-border p-4 space-y-3'>
          <h2 className='text-lg font-medium'>New Expense</h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-sm font-medium mb-1'>Amount ($)</label>
              <input
                type='number'
                step='0.01'
                min='0.01'
                value={amountDollars}
                onChange={e => setAmountDollars(e.target.value)}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              >
                <option value=''>None</option>
                {categories?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Date</label>
              <input
                type='date'
                value={incurredOn}
                onChange={e => setIncurredOn(e.target.value)}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Vendor</label>
              <input
                type='text'
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              />
            </div>
            <div className='sm:col-span-2'>
              <label className='block text-sm font-medium mb-1'>Description</label>
              <input
                type='text'
                value={description}
                onChange={e => setDescription(e.target.value)}
                className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
              />
            </div>
          </div>
          {formError && <p className='text-sm text-red-400'>{formError}</p>}
          <div className='flex gap-2'>
            <Button type='submit' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Expense'}
            </Button>
            <Button type='button' variant='outline' onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className='flex flex-wrap gap-3'>
        <div>
          <label className='block text-xs text-muted-foreground mb-1'>From</label>
          <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} className='rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm' />
        </div>
        <div>
          <label className='block text-xs text-muted-foreground mb-1'>To</label>
          <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} className='rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm' />
        </div>
        <div>
          <label className='block text-xs text-muted-foreground mb-1'>Category</label>
          <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)} className='rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'>
            <option value=''>All</option>
            {categories?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {sortedTotals.length > 0 && (
        <div className='rounded border border-border p-4 space-y-2'>
          <h2 className='text-sm font-semibold'>Summary</h2>
          {sortedTotals.map(({ name, cents }) => (
            <div key={name} className='space-y-0.5'>
              <div className='flex justify-between text-xs'>
                <span>{name}</span>
                <span>${(cents / 100).toFixed(2)}</span>
              </div>
              <div className='h-2 rounded bg-border overflow-hidden'>
                <div className='h-full bg-primary' style={{ width: `${grandCents > 0 ? (cents / grandCents) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          <p className='text-sm font-medium pt-1'>Total: ${(grandCents / 100).toFixed(2)}</p>
        </div>
      )}

      {isLoading && <p>Loading expenses...</p>}

      <div className='space-y-2'>
        {expenses.map(exp => (
          <div key={exp.id} className='flex flex-wrap items-center gap-3 rounded border border-border p-3'>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium'>${(exp.amount_cents / 100).toFixed(2)}{exp.category_name ? ` · ${exp.category_name}` : ''}</p>
              <p className='text-xs text-muted-foreground'>
                {exp.incurred_on}{exp.vendor ? ` · ${exp.vendor}` : ''}{exp.description ? ` · ${exp.description}` : ''}
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => { if (confirm('Delete this expense?')) deleteMutation.mutate(exp.id); }}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        ))}
        {!isLoading && expenses.length === 0 && <p className='text-sm text-muted-foreground'>No expenses found.</p>}
      </div>
    </section>
  );
}
