import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { MenuLink } from '@/types';
import { api } from '@/lib/api';

/** Inline SVG hamburger icon that morphs into an X when open.
 *  Three bars transition via CSS transforms in 250ms — no JS animation library.
 *  Background uses surface-2 theme token, never a hardcoded colour.
 */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width='18'
      height='18'
      viewBox='0 0 18 18'
      aria-hidden='true'
      focusable='false'
      style={{ display: 'block' }}
    >
      {/* Top bar: slides down + rotates 45° when open */}
      <rect
        x='2'
        y='4'
        width='14'
        height='1.5'
        rx='0.75'
        fill='currentColor'
        style={{
          transformOrigin: '9px 4.75px',
          transition: 'transform 250ms cubic-bezier(0.2,0.8,0.2,1)',
          transform: open ? 'translateY(4.25px) rotate(45deg)' : 'none',
        }}
      />
      {/* Middle bar: fades out when open */}
      <rect
        x='2'
        y='8.25'
        width='14'
        height='1.5'
        rx='0.75'
        fill='currentColor'
        style={{
          transformOrigin: '9px 9px',
          transition: 'opacity 150ms ease, transform 250ms cubic-bezier(0.2,0.8,0.2,1)',
          opacity: open ? 0 : 1,
          transform: open ? 'scaleX(0)' : 'none',
        }}
      />
      {/* Bottom bar: slides up + rotates -45° when open */}
      <rect
        x='2'
        y='12.5'
        width='14'
        height='1.5'
        rx='0.75'
        fill='currentColor'
        style={{
          transformOrigin: '9px 13.25px',
          transition: 'transform 250ms cubic-bezier(0.2,0.8,0.2,1)',
          transform: open ? 'translateY(-4.25px) rotate(-45deg)' : 'none',
        }}
      />
    </svg>
  );
}

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get<MenuLink[]>('/menu'),
  });

  return (
    <nav aria-label='Main navigation' className='relative'>
      <button
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className='rounded-md border border-border bg-[hsl(var(--surface-2))] p-2 text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--surface-3))]'
      >
        <HamburgerIcon open={open} />
      </button>
      {open ? (
        <div className='absolute right-0 z-20 mt-2 min-w-56 rounded-md border border-border bg-[hsl(var(--surface-2))] p-2 shadow-lg'>
          {data.map((link) => (
            <Link
              key={link.id}
              to={link.url}
              target={link.new_tab ? '_blank' : undefined}
              rel={link.new_tab ? 'noreferrer' : undefined}
              className='block rounded px-3 py-2 hover:bg-[hsl(var(--surface-3))] hover:text-[hsl(var(--accent))]'
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
