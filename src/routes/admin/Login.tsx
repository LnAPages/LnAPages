import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className='mx-auto max-w-md space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Admin Login</h1>
        <p className='text-sm text-muted-foreground'>Sign in to the admin panel.</p>
      </div>
      {oauthError === 'unauthorized' && (
        <p className='text-sm text-red-400'>Your GitHub account is not authorized as a repo owner admin.</p>
      )}
      <a
        href='/api/auth/github/start'
        className='inline-flex w-full items-center justify-center gap-2 rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--surface-3))]'
      >
        Continue with GitHub (repo owner)
      </a>
      <div className='relative my-2 text-center text-xs text-muted-foreground'>
        <div className='absolute inset-x-0 top-1/2 h-px bg-border' />
        <span className='relative z-10 bg-background px-2'>or sign in with password</span>
      </div>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <div>
          <label className='block text-sm font-medium mb-1'>Email</label>
          <input
            type='email'
            autoComplete='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            required
          />
        </div>
        <div>
          <label className='block text-sm font-medium mb-1'>Password</label>
          <input
            type='password'
            autoComplete='current-password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            required
          />
        </div>
        {error && <p className='text-sm text-red-400'>{error}</p>}
        <Button type='submit' disabled={loading} className='w-full'>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className='text-sm text-center'>
        <Link to='/forgot-password' className='text-primary hover:underline'>Forgot password?</Link>
      </p>
    </section>
  );
}
