import { useQuery } from '@tanstack/react-query';
import type { SiteConfig } from '@/types';
import { api } from '@/lib/api';

const fallback: SiteConfig = {
  themeColor: '#0f172a',
  logoUrl: '',
  businessHours: 'Mon-Sat 09:00-19:00',
  contactEmail: 'hello@fnlstage.com',
  contactPhone: '+10000000000',
};

export function useSiteConfig() {
  return useQuery({
    queryKey: ['site-config'],
    queryFn: () => api.get<SiteConfig>('/site-config'),
    initialData: fallback,
  });
}
