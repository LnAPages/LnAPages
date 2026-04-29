import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<{ email: string; role: string; expiresAt: string }>(`/invite/${token}`),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return; }
    setError(null);
    setLoading(true);
    try {
      await api.post(`/invite/${token}`, { password, name: name.trim() || undefined });
      navigate('/admin/login?invited=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <p>Loading invite...</p>;
  if (fetchError || !data) return <p className='text-red-400'>{fetchError instanceof Error ? fetchError.message : 'Invalid or expired invite'}</p>;

  return (
    <section className='mx-auto max-w-md space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Accept Invite</h1>
        <p className='text-sm text-muted-foreground'>You have been invited as <strong>{data.role}</strong>. Your email: <strong>{data.email}</strong></p>
      </div>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <div>
          <label className='block text-sm font-medium mb-1'>Display name (optional)</label>
          <input
            type='text'
            value={name}
            onChange={e => setName(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            placeholder='Your name'
          />
        </div>
        <div>
          <label className='block text-sm font-medium mb-1'>Password (min 12 characters)</label>
          <input
            type='password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            required
            minLength={12}
          />
        </div>
        <div>
          <label className='block text-sm font-medium mb-1'>Confirm password</label>
          <input
            type='password'
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            required
          />
        </div>
        {error && <p className='text-sm text-red-400'>{error}</p>}
        <Button type='submit' disabled={loading} className='w-full'>
          {loading ? 'Setting up account...' : 'Set password & join'}
        </Button>
      </form>
    </section>
  );
}
