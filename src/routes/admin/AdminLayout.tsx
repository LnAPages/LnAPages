import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/admin/Sidebar';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const { data, isLoading } = useAuth();
  if (isLoading) return <p>Loading admin...</p>;
  if (!data) return <Navigate to='/admin/login' replace />;

  return (
    <section className='grid gap-4 md:grid-cols-[16rem_1fr]'>
      <Sidebar />
      <div>
        <Outlet />
      </div>
    </section>
  );
}
