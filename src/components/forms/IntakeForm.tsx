import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { intakeCreateSchema } from '@shared/schemas/intake';
import {
  defaultIntakeFormConfig,
  intakeFormConfigSchema,
  type IntakeFormConfig,
} from '@shared/schemas/intakeFormConfig';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Values = z.infer<typeof intakeCreateSchema>;

function getInitialItemId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('item');
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const fieldsetCls =
  'rounded-2xl border border-border/60 bg-surface/30 px-5 py-5 sm:px-6 sm:py-6 space-y-5';
const legendCls =
  'px-2 -ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground';
const labelCls =
  'block text-sm font-medium text-foreground mb-1.5';
const helpCls = 'mt-1.5 text-xs text-muted-foreground';
const errCls = 'mt-1.5 text-xs text-red-400';
const selectCls =
  'block w-full rounded-md border border-border bg-surface-2 text-foreground px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition';
const sansStyle = { fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' } as const;

export interface IntakeFormProps {
  config?: IntakeFormConfig;
}

export function IntakeForm({ config: configProp }: IntakeFormProps = {}) {
  const { data: fetched } = useQuery({
    queryKey: ['intake-form-config'],
    queryFn: () => api.get<IntakeFormConfig>('/intake-form-config'),
    enabled: !configProp,
    staleTime: 5 * 60 * 1000,
  });
  const config = configProp ?? (fetched && intakeFormConfigSchema.safeParse(fetched).success
    ? intakeFormConfigSchema.parse(fetched)
    : defaultIntakeFormConfig);

  const [submitState, setSubmitState] = useState<
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(intakeCreateSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      project_type: '',
      budget: '',
      timeline: '',
      message: '',
      item_id: getInitialItemId(),
    },
  });

  if (submitState.status === 'success') {
    return (
      <div
        style={sansStyle}
        className='rounded-2xl border border-border/60 bg-surface/30 p-6 sm:p-8 text-center space-y-4'
      >
        <div
          className='mx-auto w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center text-accent text-2xl'
          aria-hidden='true'
        >
          {'\u2713'}
        </div>
        <h2 className='text-xl font-semibold tracking-tight'>{config.successHeading}</h2>
        <p className='text-sm text-muted-foreground'>{config.successMessage}</p>
        <Button
          variant='outline'
          onClick={() => {
            reset();
            setSubmitState({ status: 'idle' });
          }}
        >
          Submit another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setSubmitState({ status: 'idle' });
        try {
          await api.post('/intake', values);
          setSubmitState({ status: 'success' });
        } catch (e: unknown) {
          setSubmitState({
            status: 'error',
            message:
              e instanceof Error
                ? e.message
                : 'Something went wrong. Please try again.',
          });
        }
      })}
      className='space-y-6'
      style={sansStyle}
      noValidate
    >
      <input type='hidden' {...register('item_id', { setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)) })} />

      <fieldset className={fieldsetCls}>
        <legend className={legendCls}>Your contact</legend>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <label htmlFor='intake-name' className={labelCls}>
              Name <span className='text-accent'>*</span>
            </label>
            <Input
              id='intake-name'
              placeholder='Jane Doe'
              autoComplete='name'
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && <p className={errCls}>{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor='intake-email' className={labelCls}>
              Email <span className='text-accent'>*</span>
            </label>
            <Input
              id='intake-email'
              type='email'
              placeholder='you@studio.com'
              autoComplete='email'
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className={errCls}>{errors.email.message}</p>}
          </div>
          {config.showPhone && (
            <div className='sm:col-span-2'>
              <label htmlFor='intake-phone' className={labelCls}>
                Phone <span className='text-accent'>*</span>
              </label>
              <Input
                id='intake-phone'
                type='tel'
                placeholder='(555) 123-4567'
                autoComplete='tel'
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
              {errors.phone && <p className={errCls}>{errors.phone.message}</p>}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className={fieldsetCls}>
        <legend className={legendCls}>Project</legend>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <label htmlFor='intake-project-type' className={labelCls}>
              Project type <span className='text-accent'>*</span>
            </label>
            <select
              id='intake-project-type'
              className={selectCls}
              defaultValue=''
              aria-invalid={!!errors.project_type}
              {...register('project_type')}
            >
              <option value='' disabled>
                Select one...
              </option>
              {config.projectTypes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.project_type && (
              <p className={errCls}>{errors.project_type.message}</p>
            )}
          </div>
          {config.showBudget && (
            <div>
              <label htmlFor='intake-budget' className={labelCls}>
                Budget
              </label>
              <select
                id='intake-budget'
                className={selectCls}
                defaultValue=''
                {...register('budget')}
              >
                <option value=''>Prefer not to say</option>
                {config.budgetRanges.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className={helpCls}>Optional - helps us scope the right team.</p>
            </div>
          )}
          {config.showTimeline && (
            <div className='sm:col-span-2'>
              <label htmlFor='intake-timeline' className={labelCls}>
                Timeline
              </label>
              <Input
                id='intake-timeline'
                placeholder='e.g. shooting in 4-6 weeks, delivery by Q3'
                autoComplete='off'
                {...register('timeline')}
              />
              <p className={helpCls}>Optional - rough dates help us check capacity.</p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor='intake-message' className={labelCls}>
            Tell us about the project <span className='text-accent'>*</span>
          </label>
          <Textarea
            id='intake-message'
            rows={5}
            placeholder='Concept, deliverables, locations, ideal timeline, references...'
            aria-invalid={!!errors.message}
            {...register('message')}
          />
          {errors.message && (
            <p className={errCls}>{errors.message.message}</p>
          )}
        </div>
      </fieldset>

      {submitState.status === 'error' && (
        <div
          role='alert'
          className='rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'
        >
          {submitState.message}
        </div>
      )}

      <div className='flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1'>
        <p className='text-xs text-muted-foreground'>{config.consentText}</p>
        <Button type='submit' disabled={isSubmitting} className='sm:min-w-[10rem]'>
          {isSubmitting ? 'Sending...' : config.submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default IntakeForm;
