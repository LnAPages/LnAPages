import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({
  customer_name: z.string().min(2),
  customer_email: z.string().email('Please enter a valid email address'),
  customer_phone: z.string().min(7),
});

type Values = z.infer<typeof schema>;

export function BookingForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <form className='space-y-3' onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('customer_name')} placeholder='Full name' aria-label='Customer name' />
      {errors.customer_name ? <p className='text-sm text-red-600'>{errors.customer_name.message}</p> : null}
      <Input {...register('customer_email')} placeholder='Email' aria-label='Customer email' />
      {errors.customer_email ? <p className='text-sm text-red-600'>{errors.customer_email.message}</p> : null}
      <Input {...register('customer_phone')} placeholder='Phone' aria-label='Customer phone' />
      {errors.customer_phone ? <p className='text-sm text-red-600'>{errors.customer_phone.message}</p> : null}
      <Button type='submit' disabled={isSubmitting}>Continue</Button>
    </form>
  );
}
