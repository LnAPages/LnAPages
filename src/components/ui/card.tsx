import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('rounded-xl border border-border bg-[hsl(var(--surface-2))] p-5 shadow-sm', className)}>{children}</div>;
}
