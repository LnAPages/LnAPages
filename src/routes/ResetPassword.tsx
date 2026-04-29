import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return; }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/admin/login?reset=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <p className='text-red-400'>Invalid reset link.</p>;

  return (
    <section className='mx-auto max-w-md space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Reset password</h1>
        <p className='text-sm text-muted-foreground'>Choose a new password (minimum 12 characters).</p>
      </div>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <div>
          <label className='block text-sm font-medium mb-1'>New password</label>
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
          <label className='block text-sm font-medium mb-1'>Confirm new password</label>
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
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </form>
    </section>
  );
}
