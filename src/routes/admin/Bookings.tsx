import { Link } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { DataTable } from '@/components/admin/DataTable';

export default function Bookings() {
  const { data = [], isLoading, error } = useBookings();
  if (isLoading) return <p>Loading bookings...</p>;
  if (error) return <p>Failed to load bookings.</p>;

  return (
    <DataTable>
      <table className='min-w-full text-sm'>
        <thead><tr><th className='p-2 text-left'>Customer</th><th className='p-2 text-left'>Status</th><th className='p-2 text-left'>Actions</th></tr></thead>
        <tbody>
          {data.map((booking) => (
            <tr key={booking.id} className='border-t border-border'>
              <td className='p-2'>{booking.customer_name}</td>
              <td className='p-2'>{booking.status}</td>
              <td className='p-2'><Link className='underline' to={`/admin/bookings/${booking.id}`}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
