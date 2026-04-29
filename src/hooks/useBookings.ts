import { useQuery } from '@tanstack/react-query';
import type { Booking } from '@/types';
import { api } from '@/lib/api';

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get<Booking[]>('/bookings'),
  });
}
