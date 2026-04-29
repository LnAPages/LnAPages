import { useQuery } from '@tanstack/react-query';
import type { BrandPublic } from '@/types';
import { api } from '@/lib/api';

const defaultHours = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
].map((day) => ({ day, open: '', close: '', closed: true }));

const fallbackBrandPublic: BrandPublic = {
  identity: {
    business_name: '',
    short_name: '',
    tagline: '',
    hero_paragraph: '',
    footer_blurb: '',
    closing_cta: '',
    credits_marquee: [],
    press_logos: [],
    testimonials: [],
    hero_media_mode: 'off',
    hero_media_count: 7,
    hero_media_video_url: '',
    hero_media_poster_url: '',
    mission: '',
    founded_year: null,
    logo_url: '',
    wordmark_url: '',
    favicon_url: '',
    og_image_url: '',
    brand_voice: '',
    updated_at: '',
  },
  contact: {
    email: '',
    phone: '',
    sms_ok: false,
    address: {
      street: '',
      city: '',
      region: '',
      postal_code: '',
      country: '',
    },
    service_area: '',
    hours: defaultHours,
    timezone: '',
    updated_at: '',
  },
  social: {
    instagram: '',
    tiktok: '',
    youtube: '',
    vimeo: '',
    x_twitter: '',
    linkedin: '',
    facebook: '',
    threads: '',
    spotify: '',
    pinterest: '',
    behance: '',
    updated_at: '',
  },
  legal: {
    terms_url: '',
    privacy_url: '',
    copyright_notice: '',
  },
};

export function useBrandPublic() {
  return useQuery({
    queryKey: ['brand-public'],
    queryFn: () => api.get<BrandPublic>('/brand'),
    initialData: fallbackBrandPublic,
  });
}
