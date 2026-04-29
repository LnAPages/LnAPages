import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Always show same message to not leak info
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <section className='mx-auto max-w-md space-y-3'>
        <h1 className='text-2xl font-semibold'>Check your email</h1>
        <p className='text-sm text-muted-foreground'>If that email is registered, you will receive a password reset link shortly.</p>
        <Link to='/admin/login' className='text-sm text-primary hover:underline'>Back to login</Link>
      </section>
    );
  }

  return (
    <section className='mx-auto max-w-md space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Forgot password</h1>
        <p className='text-sm text-muted-foreground'>Enter your email and we'll send a reset link.</p>
      </div>
      <form onSubmit={handleSubmit} className='space-y-3'>
        <div>
          <label className='block text-sm font-medium mb-1'>Email</label>
          <input
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            className='w-full rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            required
          />
        </div>
        <Button type='submit' disabled={loading} className='w-full'>
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>
    </section>
  );
}
