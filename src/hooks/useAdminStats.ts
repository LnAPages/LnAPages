import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AdminStats = {
  bookings: Array<{ date: string; status: string; amount_cents: number; category: string }>;
  orders: Array<{ date: string; revenue_cents: number }>;
  gallery: Array<{ id: number; title: string; r2_key: string; count: number; sort_order: number }>;
};

const emptyStats: AdminStats = {
  bookings: [],
  orders: [],
  gallery: [],
};

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
    initialData: emptyStats,
  });
}
