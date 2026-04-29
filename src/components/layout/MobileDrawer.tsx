import type { PropsWithChildren } from 'react';

export function MobileDrawer({ children }: PropsWithChildren) {
  return <div className='md:hidden'>{children}</div>;
}
