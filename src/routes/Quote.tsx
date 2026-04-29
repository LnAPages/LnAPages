import { useQuery } from '@tanstack/react-query';
import IntakeForm from '@/components/forms/IntakeForm';
import { api } from '@/lib/api';
import {
  defaultIntakeFormConfig,
  intakeFormConfigSchema,
  type IntakeFormConfig,
} from '@shared/schemas/intakeFormConfig';

export default function Quote() {
  const { data } = useQuery({
    queryKey: ['intake-form-config'],
    queryFn: () => api.get<IntakeFormConfig>('/intake-form-config'),
    staleTime: 5 * 60 * 1000,
  });
  const config =
    data && intakeFormConfigSchema.safeParse(data).success
      ? intakeFormConfigSchema.parse(data)
      : defaultIntakeFormConfig;

  return (
    <section className='mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:py-16'>
      <header className='space-y-3'>
        <p
          className='text-[11px] font-semibold uppercase tracking-[0.22em] text-accent'
          style={{ fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' }}
        >
          / get in touch
        </p>
        <h1 className='text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]'>
          {config.heading}
        </h1>
        {config.subheading && (
          <p
            className='max-w-xl text-base text-muted-foreground'
            style={{ fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' }}
          >
            {config.subheading}
          </p>
        )}
      </header>
      <IntakeForm config={config} />
    </section>
  );
}
