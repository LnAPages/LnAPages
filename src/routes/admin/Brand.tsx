import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandAdmin, BrandContactInput, BrandIdentityInput, BrandLegalInput, BrandSocialInput, GalleryItem } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type BrandTab = 'identity' | 'homepage' | 'contact' | 'social' | 'legal';

const TAB_LABELS: Array<{ id: BrandTab; label: string }> = [
  { id: 'identity', label: 'Identity' },
  { id: 'homepage', label: 'Homepage Copy' },
  { id: 'contact', label: 'Contact' },
  { id: 'social', label: 'Social' },
  { id: 'legal', label: 'Legal' },
];

const emptyBrand: BrandAdmin = {
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
    booking_email: '',
    phone: '',
    phone_e164: '',
    sms_ok: false,
    address: { street: '', city: '', region: '', postal_code: '', country: '' },
    service_area: '',
    hours: DAYS.map((day) => ({ day, open: '', close: '', closed: true })),
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
    legal_name: '',
    ein: '',
    terms_url: '',
    privacy_url: '',
    copyright_notice: '',
  },
};

function normalizeHours(hours: BrandAdmin['contact']['hours']): BrandAdmin['contact']['hours'] {
  const byDay = new Map(hours.map((entry) => [entry.day, entry]));
  return DAYS.map((day) => byDay.get(day) ?? { day, open: '', close: '', closed: true });
}

function cloneBrand(input: BrandAdmin): BrandAdmin {
  return {
    identity: { ...input.identity },
    contact: {
      ...input.contact,
      address: { ...input.contact.address },
      hours: normalizeHours(input.contact.hours).map((entry) => ({ ...entry })),
    },
    social: { ...input.social },
    legal: { ...input.legal },
  };
}

function toIdentityInput(input: BrandAdmin['identity']): BrandIdentityInput {
  return {
    business_name: input.business_name,
    short_name: input.short_name,
    tagline: input.tagline,
    hero_paragraph: input.hero_paragraph,
    footer_blurb: input.footer_blurb,
    closing_cta: input.closing_cta,
    credits_marquee: input.credits_marquee,
    press_logos: input.press_logos,
    testimonials: input.testimonials,
    hero_media_mode: input.hero_media_mode,
    hero_media_count: input.hero_media_count,
    hero_media_video_url: input.hero_media_video_url,
    hero_media_poster_url: input.hero_media_poster_url,
    mission: input.mission,
    founded_year: input.founded_year,
    logo_url: input.logo_url,
    wordmark_url: input.wordmark_url,
    favicon_url: input.favicon_url,
    og_image_url: input.og_image_url,
    brand_voice: input.brand_voice,
  };
}

function toContactInput(input: BrandAdmin['contact']): BrandContactInput {
  return {
    email: input.email,
    booking_email: input.booking_email,
    phone: input.phone,
    sms_ok: input.sms_ok,
    address: { ...input.address },
    service_area: input.service_area,
    hours: normalizeHours(input.hours),
    timezone: input.timezone,
  };
}

function toSocialInput(input: BrandAdmin['social']): BrandSocialInput {
  return {
    instagram: input.instagram,
    tiktok: input.tiktok,
    youtube: input.youtube,
    vimeo: input.vimeo,
    x_twitter: input.x_twitter,
    linkedin: input.linkedin,
    facebook: input.facebook,
    threads: input.threads,
    spotify: input.spotify,
    pinterest: input.pinterest,
    behance: input.behance,
  };
}

function toLegalInput(input: BrandAdmin['legal']): BrandLegalInput {
  return {
    legal_name: input.legal_name,
    ein: input.ein,
    terms_url: input.terms_url,
    privacy_url: input.privacy_url,
    copyright_notice: input.copyright_notice,
  };
}

function parseLineList(raw: string): string[] {
  return raw
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type UploadResult = {
  url: string;
  key: string;
  storage: 'r2' | 'kv_data_url';
};

export default function Brand() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<BrandTab>('identity');
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<keyof BrandAdmin['identity'] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-brand'],
    queryFn: () => api.get<BrandAdmin>('/admin/brand'),
  });
  const { data: galleryItems = [] } = useQuery({
    queryKey: ['admin-gallery'],
    queryFn: () => api.get<Array<GalleryItem & { selected?: boolean }>>('/admin/gallery'),
  });

  const [draft, setDraft] = useState<BrandAdmin>(emptyBrand);
  const [prevData, setPrevData] = useState<BrandAdmin | undefined>(undefined);
  if (data && prevData !== data) {
    setPrevData(data);
    setDraft(cloneBrand(data));
  }

  const saveIdentity = useMutation({
    mutationFn: (payload: BrandIdentityInput) => api.put<BrandAdmin['identity']>('/admin/brand/identity', payload),
    onSuccess: (identity) => {
      queryClient.setQueryData<BrandAdmin>(['admin-brand'], (current) => ({ ...(current ?? emptyBrand), identity }));
      queryClient.invalidateQueries({ queryKey: ['brand-public'] });
      setStatus('Identity saved.');
    },
    onError: (error: unknown) => setStatus(error instanceof Error ? error.message : 'Failed to save identity'),
  });

  const saveContact = useMutation({
    mutationFn: (payload: BrandContactInput) => api.put<BrandAdmin['contact']>('/admin/brand/contact', payload),
    onSuccess: (contact) => {
      queryClient.setQueryData<BrandAdmin>(['admin-brand'], (current) => ({ ...(current ?? emptyBrand), contact }));
      queryClient.invalidateQueries({ queryKey: ['brand-public'] });
      setStatus('Contact saved.');
    },
    onError: (error: unknown) => setStatus(error instanceof Error ? error.message : 'Failed to save contact'),
  });

  const saveSocial = useMutation({
    mutationFn: (payload: BrandSocialInput) => api.put<BrandAdmin['social']>('/admin/brand/social', payload),
    onSuccess: (social) => {
      queryClient.setQueryData<BrandAdmin>(['admin-brand'], (current) => ({ ...(current ?? emptyBrand), social }));
      queryClient.invalidateQueries({ queryKey: ['brand-public'] });
      setStatus('Social links saved and normalized.');
    },
    onError: (error: unknown) => setStatus(error instanceof Error ? error.message : 'Failed to save social links'),
  });

  const saveLegal = useMutation({
    mutationFn: (payload: BrandLegalInput) => api.put<BrandAdmin['legal']>('/admin/brand/legal', payload),
    onSuccess: (legal) => {
      queryClient.setQueryData<BrandAdmin>(['admin-brand'], (current) => ({ ...(current ?? emptyBrand), legal }));
      queryClient.invalidateQueries({ queryKey: ['brand-public'] });
      setStatus('Legal saved.');
    },
    onError: (error: unknown) => setStatus(error instanceof Error ? error.message : 'Failed to save legal settings'),
  });

  const uploadAsset = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.set('file', file);
      return api.postForm<UploadResult>('/admin/brand/upload', formData);
    },
    onError: (error: unknown) => setStatus(error instanceof Error ? error.message : 'Upload failed'),
  });

  const isSaving = saveIdentity.isPending || saveContact.isPending || saveSocial.isPending || saveLegal.isPending;
  const deselectHeroPhotoMutation = useMutation({
    mutationFn: (itemKey: string) =>
      api.put('/admin/gallery/overrides', { itemKey, override: { selected: false } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-gallery'] }),
  });
  const heroPreviewItems = useMemo(
    () => galleryItems.filter((item) => item.selected === true).slice(0, draft.identity.hero_media_count),
    [galleryItems, draft.identity.hero_media_count],
  );

  if (isLoading) return <p>Loading brand profile...</p>;

  return (
    <section className='space-y-6'>
      <header className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>Brand & Contact</h1>
          <p className='text-sm text-muted-foreground'>KV-governed identity, contact, social, legal, and asset settings.</p>
        </div>
      </header>

      <nav className='flex flex-wrap gap-2'>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            className={`rounded border px-3 py-1.5 text-sm ${activeTab === tab.id ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'identity' ? (
        <div className='space-y-4 rounded border border-border p-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['business_name', 'Business name'],
              ['short_name', 'Short name'],
              ['tagline', 'Tagline'],
            ] as const).map(([field, label]) => (
              <label key={field} className='space-y-1'>
                <span className='text-sm'>{label}</span>
                <input
                  value={draft.identity[field]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, [field]: event.target.value } }))}
                  className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                />
              </label>
            ))}
            <label className='space-y-1'>
              <span className='text-sm'>Founded year</span>
              <input
                type='number'
                value={draft.identity.founded_year ?? ''}
                onChange={(event) => setDraft((prev) => ({
                  ...prev,
                  identity: {
                    ...prev.identity,
                    founded_year: event.target.value.trim() ? Number(event.target.value) : null,
                  },
                }))}
                className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
              />
            </label>
          </div>

          <div className='space-y-3 rounded border border-border p-3'>
            <p className='text-sm font-medium'>Hero media</p>
            <div className='flex flex-wrap gap-2'>
              {([
                ['off', 'Off'],
                ['photo', 'Photo carousel'],
                ['video', 'Video'],
                ['photo+video', 'Photo + Video'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type='button'
                  size='sm'
                  variant={draft.identity.hero_media_mode === value ? 'default' : 'secondary'}
                  onClick={() => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, hero_media_mode: value } }))}
                >
                  {label}
                </Button>
              ))}
            </div>

            {(draft.identity.hero_media_mode === 'photo' || draft.identity.hero_media_mode === 'photo+video') ? (
              <div className='space-y-2'>
                <label className='space-y-1'>
                  <span className='text-sm'>Photos to rotate ({draft.identity.hero_media_count})</span>
                  <input
                    type='range'
                    min={3}
                    max={12}
                    step={1}
                    value={draft.identity.hero_media_count}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      identity: { ...prev.identity, hero_media_count: Number(event.target.value) },
                    }))}
                  />
                </label>
                <div className='grid grid-cols-4 gap-2 md:grid-cols-7'>
                  {heroPreviewItems.map((item) => (
                    <div key={`${item.id ?? item.r2_key}`} className='relative group'>
                      <img
                        src={item.thumb_url ?? item.r2_key}
                        alt={item.alt_text || item.title || ''}
                        className='h-16 w-full rounded border border-border object-cover'
                      />
                      <button
                        type='button'
                        onClick={() => deselectHeroPhotoMutation.mutate(item.r2_key!)}
                        disabled={deselectHeroPhotoMutation.isPending}
                        className='absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/60 rounded transition-opacity'
                        title='Remove from hero carousel'
                      >
                        <span className='text-white text-xs font-bold'>✕</span>
                      </button>
                    </div>
                  ))}
                  {heroPreviewItems.length === 0 ? <p className='col-span-full text-xs text-muted-foreground'>No selected gallery images available.</p> : null}
                </div>
              </div>
            ) : null}

            {(draft.identity.hero_media_mode === 'video' || draft.identity.hero_media_mode === 'photo+video') ? (
              <div className='grid gap-3 md:grid-cols-2'>
                <label className='space-y-1'>
                  <span className='text-sm'>Video URL</span>
                  <input
                    value={draft.identity.hero_media_video_url}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      identity: { ...prev.identity, hero_media_video_url: event.target.value },
                    }))}
                    placeholder='https://.../hero.mp4'
                    className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                  />
                </label>
                <label className='space-y-1'>
                  <span className='text-sm'>Poster image URL (optional)</span>
                  <input
                    value={draft.identity.hero_media_poster_url}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      identity: { ...prev.identity, hero_media_poster_url: event.target.value },
                    }))}
                    placeholder='https://.../poster.jpg'
                    className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                  />
                </label>
              </div>
            ) : null}
          </div>

          <label className='block space-y-1'>
            <span className='text-sm'>Mission</span>
            <textarea
              value={draft.identity.mission}
              onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, mission: event.target.value } }))}
              rows={3}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>

          <label className='block space-y-1'>
            <span className='text-sm'>Brand voice</span>
            <textarea
              value={draft.identity.brand_voice}
              onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, brand_voice: event.target.value } }))}
              rows={3}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>

          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['logo_url', 'Logo URL'],
              ['wordmark_url', 'Wordmark URL'],
              ['favicon_url', 'Favicon URL'],
              ['og_image_url', 'OG image URL'],
            ] as const).map(([field, label]) => (
              <div key={field} className='space-y-2 rounded border border-border p-3'>
                <label className='block space-y-1'>
                  <span className='text-sm'>{label}</span>
                  <input
                    value={draft.identity[field]}
                    onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, [field]: event.target.value } }))}
                    className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                  />
                </label>
                <div className='flex items-center gap-2'>
                  <input
                    type='file'
                    accept='image/*'
                    className='max-w-full text-xs'
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setStatus(null);
                      setUploadingField(field);
                      try {
                        const uploaded = await uploadAsset.mutateAsync({ file });
                        setDraft((prev) => ({ ...prev, identity: { ...prev.identity, [field]: uploaded.url } }));
                        setStatus(`Uploaded ${label} via ${uploaded.storage}.`);
                      } finally {
                        setUploadingField(null);
                        event.target.value = '';
                      }
                    }}
                  />
                  {uploadingField === field ? <span className='text-xs text-muted-foreground'>Uploading…</span> : null}
                </div>
              </div>
            ))}
          </div>

          <Button
            type='button'
            disabled={saveIdentity.isPending}
            onClick={() => {
              setStatus(null);
              saveIdentity.mutate(toIdentityInput(draft.identity));
            }}
          >
            {saveIdentity.isPending ? 'Saving...' : 'Save identity'}
          </Button>
        </div>
      ) : null}

      {activeTab === 'homepage' ? (
        <div className='space-y-4 rounded border border-border p-4'>
          <label className='block space-y-1'>
            <span className='text-sm'>Hero headline</span>
            <input
              value={draft.identity.tagline}
              onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, tagline: event.target.value } }))}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>

          <label className='block space-y-1'>
            <span className='text-sm'>Hero paragraph</span>
            <textarea
              value={draft.identity.hero_paragraph}
              onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, hero_paragraph: event.target.value } }))}
              rows={3}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>

          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className='text-sm'>Footer blurb</span>
              <textarea
                value={draft.identity.footer_blurb}
                onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, footer_blurb: event.target.value } }))}
                rows={3}
                className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
              />
            </label>
            <label className='space-y-1'>
              <span className='text-sm'>Closing CTA</span>
              <input
                value={draft.identity.closing_cta}
                onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, closing_cta: event.target.value } }))}
                className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
              />
            </label>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
            <label className='space-y-1'>
              <span className='text-sm'>Credits marquee (one per line)</span>
              <textarea
                defaultValue={draft.identity.credits_marquee.join('\n')}
                key={draft.identity.credits_marquee.join('|')}
                onBlur={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, credits_marquee: parseLineList(event.target.value) } }))}
                rows={6}
                className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
              />
            </label>

            <label className='space-y-1'>
              <span className='text-sm'>Press logos row (one per line)</span>
              <textarea
                value={draft.identity.press_logos.join('\n')}
                onChange={(event) => setDraft((prev) => ({ ...prev, identity: { ...prev.identity, press_logos: parseLineList(event.target.value) } }))}
                rows={6}
                className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
              />
            </label>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <p className='text-sm font-medium'>Testimonials</p>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  identity: {
                    ...prev.identity,
                    testimonials: [...prev.identity.testimonials, { quote: '', attribution: '' }],
                  },
                }))}
              >
                Add testimonial
              </Button>
            </div>

            <div className='space-y-3'>
              {draft.identity.testimonials.map((testimonial, index) => (
                <div key={index} className='space-y-2 rounded border border-border p-3'>
                  <textarea
                    value={testimonial.quote}
                    onChange={(event) => setDraft((prev) => {
                      const testimonials = [...prev.identity.testimonials];
                      testimonials[index] = { ...testimonials[index], quote: event.target.value };
                      return { ...prev, identity: { ...prev.identity, testimonials } };
                    })}
                    rows={3}
                    placeholder='Quote'
                    className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                  />
                  <div className='flex items-center gap-2'>
                    <input
                      value={testimonial.attribution}
                      onChange={(event) => setDraft((prev) => {
                        const testimonials = [...prev.identity.testimonials];
                        testimonials[index] = { ...testimonials[index], attribution: event.target.value };
                        return { ...prev, identity: { ...prev.identity, testimonials } };
                      })}
                      placeholder='Attribution'
                      className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                    />
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={() => setDraft((prev) => ({
                        ...prev,
                        identity: {
                          ...prev.identity,
                          testimonials: prev.identity.testimonials.filter((_, i) => i !== index),
                        },
                      }))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            type='button'
            disabled={saveIdentity.isPending}
            onClick={() => {
              setStatus(null);
              saveIdentity.mutate(toIdentityInput(draft.identity));
            }}
          >
            {saveIdentity.isPending ? 'Saving...' : 'Save homepage copy'}
          </Button>
        </div>
      ) : null}

      {activeTab === 'contact' ? (
        <div className='space-y-4 rounded border border-border p-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['email', 'Public email'],
              ['booking_email', 'Booking email'],
              ['phone', 'Phone'],
              ['timezone', 'Timezone'],
            ] as const).map(([field, label]) => (
              <label key={field} className='space-y-1'>
                <span className='text-sm'>{label}</span>
                <input
                  value={draft.contact[field]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, contact: { ...prev.contact, [field]: event.target.value } }))}
                  className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                />
              </label>
            ))}
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={draft.contact.sms_ok}
              onChange={(event) => setDraft((prev) => ({ ...prev, contact: { ...prev.contact, sms_ok: event.target.checked } }))}
            />
            SMS replies allowed
          </label>

          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['street', 'Street'],
              ['city', 'City'],
              ['region', 'Region/State'],
              ['postal_code', 'Postal code'],
              ['country', 'Country'],
            ] as const).map(([field, label]) => (
              <label key={field} className='space-y-1'>
                <span className='text-sm'>{label}</span>
                <input
                  value={draft.contact.address[field]}
                  onChange={(event) => setDraft((prev) => ({
                    ...prev,
                    contact: {
                      ...prev.contact,
                      address: { ...prev.contact.address, [field]: event.target.value },
                    },
                  }))}
                  className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                />
              </label>
            ))}
          </div>

          <label className='block space-y-1'>
            <span className='text-sm'>Service area</span>
            <textarea
              value={draft.contact.service_area}
              onChange={(event) => setDraft((prev) => ({ ...prev, contact: { ...prev.contact, service_area: event.target.value } }))}
              rows={2}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>

          <div className='space-y-2'>
            <p className='text-sm font-medium'>Hours</p>
            <div className='space-y-2'>
              {normalizeHours(draft.contact.hours).map((entry, index) => (
                <div key={entry.day} className='grid grid-cols-1 gap-2 rounded border border-border p-2 md:grid-cols-[140px_1fr_1fr_auto]'>
                  <span className='self-center text-sm'>{entry.day}</span>
                  <input
                    value={entry.open}
                    onChange={(event) => setDraft((prev) => {
                      const hours = normalizeHours(prev.contact.hours);
                      hours[index] = { ...hours[index], open: event.target.value };
                      return { ...prev, contact: { ...prev.contact, hours } };
                    })}
                    disabled={entry.closed}
                    placeholder='Open'
                    className='w-full rounded border border-border bg-transparent px-2 py-1 text-sm'
                  />
                  <input
                    value={entry.close}
                    onChange={(event) => setDraft((prev) => {
                      const hours = normalizeHours(prev.contact.hours);
                      hours[index] = { ...hours[index], close: event.target.value };
                      return { ...prev, contact: { ...prev.contact, hours } };
                    })}
                    disabled={entry.closed}
                    placeholder='Close'
                    className='w-full rounded border border-border bg-transparent px-2 py-1 text-sm'
                  />
                  <label className='flex items-center gap-1 text-xs'>
                    <input
                      type='checkbox'
                      checked={entry.closed}
                      onChange={(event) => setDraft((prev) => {
                        const hours = normalizeHours(prev.contact.hours);
                        hours[index] = {
                          ...hours[index],
                          closed: event.target.checked,
                          open: event.target.checked ? '' : hours[index].open,
                          close: event.target.checked ? '' : hours[index].close,
                        };
                        return { ...prev, contact: { ...prev.contact, hours } };
                      })}
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
          </div>

          {draft.contact.phone_e164 ? <p className='text-xs text-muted-foreground'>Computed E.164: {draft.contact.phone_e164}</p> : null}

          <Button
            type='button'
            disabled={saveContact.isPending}
            onClick={() => {
              setStatus(null);
              saveContact.mutate(toContactInput(draft.contact));
            }}
          >
            {saveContact.isPending ? 'Saving...' : 'Save contact'}
          </Button>
        </div>
      ) : null}

      {activeTab === 'social' ? (
        <div className='space-y-4 rounded border border-border p-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['instagram', 'Instagram'],
              ['tiktok', 'TikTok'],
              ['youtube', 'YouTube'],
              ['vimeo', 'Vimeo'],
              ['x_twitter', 'X/Twitter'],
              ['linkedin', 'LinkedIn'],
              ['facebook', 'Facebook'],
              ['threads', 'Threads'],
              ['spotify', 'Spotify'],
              ['pinterest', 'Pinterest'],
              ['behance', 'Behance'],
            ] as const).map(([field, label]) => (
              <label key={field} className='space-y-1'>
                <span className='text-sm'>{label}</span>
                <input
                  value={draft.social[field]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, social: { ...prev.social, [field]: event.target.value } }))}
                  placeholder='@handle or full URL'
                  className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                />
              </label>
            ))}
          </div>
          <Button
            type='button'
            disabled={saveSocial.isPending}
            onClick={() => {
              setStatus(null);
              saveSocial.mutate(toSocialInput(draft.social));
            }}
          >
            {saveSocial.isPending ? 'Saving...' : 'Save social'}
          </Button>
        </div>
      ) : null}

      {activeTab === 'legal' ? (
        <div className='space-y-4 rounded border border-border p-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            {([
              ['legal_name', 'Legal name'],
              ['ein', 'EIN'],
              ['terms_url', 'Terms URL'],
              ['privacy_url', 'Privacy URL'],
            ] as const).map(([field, label]) => (
              <label key={field} className='space-y-1'>
                <span className='text-sm'>{label}</span>
                <input
                  value={draft.legal[field]}
                  onChange={(event) => setDraft((prev) => ({ ...prev, legal: { ...prev.legal, [field]: event.target.value } }))}
                  className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
                />
              </label>
            ))}
          </div>
          <label className='block space-y-1'>
            <span className='text-sm'>Copyright notice</span>
            <textarea
              value={draft.legal.copyright_notice}
              onChange={(event) => setDraft((prev) => ({ ...prev, legal: { ...prev.legal, copyright_notice: event.target.value } }))}
              rows={2}
              className='w-full rounded border border-border bg-transparent px-3 py-2 text-sm'
            />
          </label>
          <Button
            type='button'
            disabled={saveLegal.isPending}
            onClick={() => {
              setStatus(null);
              saveLegal.mutate(toLegalInput(draft.legal));
            }}
          >
            {saveLegal.isPending ? 'Saving...' : 'Save legal'}
          </Button>
        </div>
      ) : null}

      {status ? <p className='rounded border border-border bg-[hsl(var(--surface-2))] p-2 text-sm'>{status}</p> : null}
      {isSaving ? <p className='text-xs text-muted-foreground'>Saving changes…</p> : null}
    </section>
  );
}
