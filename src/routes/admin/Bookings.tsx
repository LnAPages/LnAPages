import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '@/components/admin/DataTable';
import type { Booking } from '@/types';
import { api } from '@/lib/api';

type SyncStatus = 'pending' | 'synced' | 'failed' | null | undefined;

function CalendarSyncBadge({ status }: { status: SyncStatus }) {
  const map: Record<NonNullable<SyncStatus>, { label: string; className: string }> = {
    synced: { label: 'Synced', className: 'bg-green-100 text-green-800' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  };
  if (!status) return <span className='text-muted-foreground text-xs'>—</span>;
  const { label, className } = map[status] ?? map.pending;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function RetryCalendarButton({ bookingId, onSuccess }: { bookingId: number; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/admin/bookings/${bookingId}/calendar-resync`, {});
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        onClick={handleRetry}
        disabled={loading}
        className='ml-2 text-xs underline disabled:opacity-50'
      >
        {loading ? 'Retrying…' : 'Retry sync'}
      </button>
      {error && <span className='ml-1 text-xs text-red-600'>{error}</span>}
    </span>
  );
}

export default function Bookings() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get<Booking[]>('/bookings'),
  });

  if (isLoading) return <p>Loading bookings...</p>;
  if (error) return <p>Failed to load bookings.</p>;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }

  return (
    <DataTable>
      <table className='min-w-full text-sm'>
        <thead>
          <tr>
            <th className='p-2 text-left'>Customer</th>
            <th className='p-2 text-left'>Status</th>
            <th className='p-2 text-left'>Calendar</th>
            <th className='p-2 text-left'>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((booking) => (
            <tr key={booking.id} className='border-t border-border'>
              <td className='p-2'>{booking.customer_name}</td>
              <td className='p-2'>{booking.status}</td>
              <td className='p-2'>
                <CalendarSyncBadge status={booking.google_calendar_sync_status} />
                {booking.google_calendar_sync_status === 'failed' && booking.id && (
                  <RetryCalendarButton bookingId={booking.id} onSuccess={invalidate} />
                )}
              </td>
              <td className='p-2'>
                <Link className='underline' to={`/admin/bookings/${booking.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
