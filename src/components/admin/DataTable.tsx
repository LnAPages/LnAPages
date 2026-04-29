import type { PropsWithChildren } from 'react';

export function DataTable({ children }: PropsWithChildren) {
  return <div className='overflow-x-auto rounded-md border border-border'>{children}</div>;
}
