import type { PropsWithChildren } from 'react';

export function FormField({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className='block space-y-1 text-sm'>
      <span>{label}</span>
      {children}
    </label>
  );
}
