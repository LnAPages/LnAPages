import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Employees from './Employees';
import PaymentsPanel from './PaymentsPanel';

type TestEmailResponse = {
  sent: boolean;
  to: string;
  from: string;
  provider_response: unknown;
};

type SettingsTab = 'account' | 'team' | 'email' | 'payments';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'account';
  const allowed: ReadonlyArray<SettingsTab> = ['account', 'team', 'email', 'payments'];
  const [tab, setTab] = useState<SettingsTab>(
    allowed.includes(initialTab) ? initialTab : 'account'
  );

  function changeTab(next: SettingsTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'account') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <section className='space-y-6'>
      <header className='space-y-1'>
        <h1 className='text-2xl font-semibold'>Settings</h1>
        <p className='text-sm text-muted-foreground'>
          Account access, team members, and email delivery.
        </p>
      </header>

      <nav className='flex gap-1 border-b border-border'>
        {allowed.map((key) => (
          <button
            key={key}
            type='button'
            onClick={() => changeTab(key)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
              (tab === key
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {key === 'account' ? 'Account' : key === 'team' ? 'Team' : key === 'email' ? 'Email' : 'Payments'}
          </button>
        ))}
      </nav>

      {tab === 'account' && <AccountPanel />}
      {tab === 'team' && <Employees />}
      {tab === 'email' && <EmailPanel />}
      {tab === 'payments' && <PaymentsPanel />}
    </section>
  );
}

function AccountPanel() {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data } = useQuery({
    queryKey: ['admin-github-admins'],
    queryFn: () => api.get<{ repoOwner: string; usernames: string[] }>('/admin/admins'),
  });
  const initialUsernames = useMemo(() => (data?.usernames ?? []).join('\n'), [data?.usernames]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const raw = textareaRef.current?.value ?? '';
      const usernames = raw
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return api.put<{ repoOwner: string; usernames: string[] }>('/admin/admins', { usernames });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['admin-github-admins'], next);
      if (textareaRef.current) textareaRef.current.value = next.usernames.join('\n');
    },
  });

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <p className='text-sm font-medium'>Repo owner (always admin)</p>
        <p className='text-sm text-muted-foreground'>{data?.repoOwner ?? '-'}</p>
      </div>

      <div className='space-y-1'>
        <p className='text-sm font-medium'>Additional GitHub admins</p>
        <p className='text-sm text-muted-foreground'>One username per line (or comma-separated).</p>
        <Textarea ref={textareaRef} key={initialUsernames} defaultValue={initialUsernames} rows={8} />
        <Button type='button' onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save admins
        </Button>
      </div>
    </div>
  );
}

function EmailPanel() {
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<
    { kind: 'ok'; data: TestEmailResponse } | { kind: 'err'; message: string } | null
  >(null);

  const testEmailMutation = useMutation({
    mutationFn: (to: string) => api.post<TestEmailResponse>('/admin/test-email', { to }),
    onSuccess: (res) => setTestResult({ kind: 'ok', data: res }),
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ kind: 'err', message });
    },
  });

  return (
    <div className='space-y-2 rounded border border-border p-4'>
      <h2 className='text-lg font-semibold'>Resend email test</h2>
      <p className='text-sm text-muted-foreground'>
        Sends a test email using your configured <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code>.
        Use this after you finish Resend's DNS verification to confirm it works.
      </p>
      <div className='flex flex-col gap-2 sm:flex-row'>
        <input
          type='email'
          placeholder='your@email.com'
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          className='flex-1 rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
        />
        <Button
          type='button'
          onClick={() => {
            setTestResult(null);
            if (testTo) testEmailMutation.mutate(testTo);
          }}
          disabled={testEmailMutation.isPending || !testTo}
        >
          {testEmailMutation.isPending ? 'Sending...' : 'Send test email'}
        </Button>
      </div>

      {testResult?.kind === 'ok' && (
        <p className='text-sm text-emerald-400'>
          Sent to <strong>{testResult.data.to}</strong> from{' '}
          <strong>{testResult.data.from}</strong>. Check your inbox (and spam).
        </p>
      )}
      {testResult?.kind === 'err' && (
        <pre className='whitespace-pre-wrap rounded bg-red-950/40 p-2 text-xs text-red-300'>
          {testResult.message}
        </pre>
      )}
    </div>
  );
}
