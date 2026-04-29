import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Values = { name: string; email: string; message: string };

export function ContactForm() {
  const { register, handleSubmit, reset } = useForm<Values>();
  return (
    <form onSubmit={handleSubmit(() => reset())} className='space-y-3'>
      <Input {...register('name')} placeholder='Name' />
      <Input {...register('email')} placeholder='Email' />
      <Textarea {...register('message')} placeholder='Message' />
      <Button type='submit'>Send</Button>
    </form>
  );
}
