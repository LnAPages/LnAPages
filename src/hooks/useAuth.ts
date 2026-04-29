import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Me = {
  email: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
} | null;

export function useAuth() {
  return useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<Me>('/auth/me'),
  });
}
