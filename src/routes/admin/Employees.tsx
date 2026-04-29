import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

type Employee = {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  invited_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

type Panel = {
  panel_key: string;
  can_view: boolean;
  can_edit: boolean;
};

const PANEL_KEYS = ['dashboard', 'bookings', 'gallery', 'services', 'shop', 'blog', 'expenses', 'tasks', 'responses', 'settings', 'employees'];

export default function Employees() {
  const { data: me } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/admin/employees'),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api.post<{ inviteUrl: string; expiresAt: string }>('/admin/employees/invite', data),
    onSuccess: (res) => {
      setInviteResult(`Invite sent! Link: ${res.inviteUrl}`);
      setInviteEmail('');
    },
    onError: (err: Error) => setInviteResult(`Error: ${err.message}`),
  });

  async function loadPermissions(emp: Employee) {
    const full = await api.get<Employee & { permissions: Array<{ panel_key: string; can_view: number; can_edit: number }> }>(`/admin/employees/${emp.id}`);
    const perms = full.permissions.map(p => ({ panel_key: p.panel_key, can_view: Boolean(p.can_view), can_edit: Boolean(p.can_edit) }));
    setPanels(perms.length ? perms : PANEL_KEYS.map(k => ({ panel_key: k, can_view: false, can_edit: false })));
    setSelected(emp);
  }

  const savePermsMutation = useMutation({
    mutationFn: (data: { permissions: Panel[] }) =>
      api.put(`/admin/employees/${selected!.id}/permissions`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setSaveSuccess(true); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/admin/employees/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const isOwner = me?.role === 'owner';

  return (
    <section className='space-y-6'>
      <h1 className='text-2xl font-semibold'>Employees</h1>

      {isOwner && (
        <div className='rounded border border-border p-4 space-y-3'>
          <h2 className='text-lg font-medium'>Invite Employee</h2>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <input
              type='email'
              placeholder='employee@example.com'
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className='flex-1 rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className='rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm'
            >
              <option value='employee'>Employee</option>
              <option value='admin'>Admin</option>
            </select>
            <Button
              type='button'
              onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
              disabled={inviteMutation.isPending || !inviteEmail}
            >
              Send Invite
            </Button>
          </div>
          {inviteResult && <p className='text-sm break-all'>{inviteResult}</p>}
        </div>
      )}

      {isLoading && <p>Loading employees...</p>}

      {employees && (
        <div className='space-y-2'>
          {employees.map(emp => (
            <div key={emp.id} className='flex flex-wrap items-center gap-3 rounded border border-border p-3'>
              <div className='flex-1 min-w-0'>
                <p className='font-medium text-sm truncate'>{emp.name || emp.email}</p>
                <p className='text-xs text-muted-foreground'>{emp.email} · {emp.role} · {emp.status}</p>
              </div>
              <div className='flex gap-2'>
                <Button type='button' variant='outline' size='sm' onClick={() => loadPermissions(emp)}>
                  Permissions
                </Button>
                {isOwner && emp.status === 'active' && me?.email !== emp.email && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => statusMutation.mutate({ id: emp.id, status: 'suspended' })}
                  >
                    Suspend
                  </Button>
                )}
                {isOwner && emp.status === 'suspended' && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => statusMutation.mutate({ id: emp.id, status: 'active' })}
                  >
                    Unsuspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className='rounded border border-border p-4 space-y-3'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium'>Permissions: {selected.name || selected.email}</h2>
            <Button type='button' variant='outline' size='sm' onClick={() => setSelected(null)}>Close</Button>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='text-left text-muted-foreground'>
                  <th className='py-1 pr-4'>Panel</th>
                  <th className='py-1 pr-4'>Can View</th>
                  <th className='py-1'>Can Edit</th>
                </tr>
              </thead>
              <tbody>
                {PANEL_KEYS.map(key => {
                  const perm = panels.find(p => p.panel_key === key) ?? { panel_key: key, can_view: false, can_edit: false };
                  return (
                    <tr key={key} className='border-t border-border'>
                      <td className='py-1 pr-4 capitalize'>{key}</td>
                      <td className='py-1 pr-4'>
                        <input
                          type='checkbox'
                          checked={perm.can_view}
                          onChange={e => {
                            const checked = e.target.checked;
                            setPanels(prev => {
                              const exists = prev.find(p => p.panel_key === key);
                              return exists
                                ? prev.map(p => p.panel_key === key ? { ...p, can_view: checked } : p)
                                : [...prev, { panel_key: key, can_view: checked, can_edit: false }];
                            });
                          }}
                        />
                      </td>
                      <td className='py-1'>
                        <input
                          type='checkbox'
                          checked={perm.can_edit}
                          onChange={e => {
                            const checked = e.target.checked;
                            setPanels(prev => {
                              const exists = prev.find(p => p.panel_key === key);
                              return exists
                                ? prev.map(p => p.panel_key === key ? { ...p, can_edit: checked } : p)
                                : [...prev, { panel_key: key, can_view: false, can_edit: checked }];
                            });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            type='button'
            onClick={() => { setSaveSuccess(false); savePermsMutation.mutate({ permissions: panels }); }}
            disabled={savePermsMutation.isPending}
          >
            Save Permissions
          </Button>
          {saveSuccess && <p className='text-sm text-green-500'>Permissions saved successfully.</p>}
          {savePermsMutation.isError && <p className='text-sm text-red-400'>{(savePermsMutation.error as Error).message}</p>}
        </div>
      )}
    </section>
  );
}
