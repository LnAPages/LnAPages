import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type Link = { to: string; label: string; panel?: string; group?: string };

const ALL_LINKS: Array<Link> = [
  // Operations
  { to: '/admin', label: 'Dashboard', panel: 'dashboard', group: 'Operations' },
  { to: '/admin/pipeline', label: 'Pipeline', panel: 'bookings', group: 'Operations' },
  { to: '/admin/contacts', label: 'Contacts', panel: 'bookings', group: 'Operations' },
  { to: '/admin/bookings', label: 'Bookings', panel: 'bookings', group: 'Operations' },
  { to: '/admin/intakes', label: 'Intakes', panel: 'bookings', group: 'Operations' },
  { to: '/admin/tasks', label: 'Tasks', panel: 'tasks', group: 'Operations' },
  { to: '/admin/invoices', label: 'Invoices', panel: 'bookings', group: 'Operations' },
  { to: '/admin/expenses', label: 'Expenses', panel: 'expenses', group: 'Operations' },
  // Storefront
  { to: '/admin/services', label: 'Services', panel: 'services', group: 'Storefront' },
  { to: '/admin/shop', label: 'Shop', panel: 'shop', group: 'Storefront' },
  { to: '/admin/gallery', label: 'Gallery', panel: 'gallery', group: 'Storefront' },
  { to: '/admin/blog', label: 'Blog', panel: 'settings', group: 'Storefront' },
  { to: '/admin/menu', label: 'Menu', panel: 'settings', group: 'Storefront' },
  // Brand & System
  { to: '/admin/brand', label: 'Brand', panel: 'settings', group: 'Brand & System' },
  { to: '/admin/theme', label: 'Theme', panel: 'settings', group: 'Brand & System' },
  { to: '/admin/notifications', label: 'Notifications', panel: 'settings', group: 'Brand & System' },
  { to: '/admin/settings', label: 'Settings', panel: 'settings', group: 'Brand & System' },
];

export function Sidebar() {
  const { data: me } = useAuth();
  const location = useLocation();

  function canSee(panel?: string): boolean {
    if (!me) return false;
    if (me.role === 'owner' || me.role === 'admin') return true;
    if (!panel) return true;
    return me.permissions.includes(panel);
  }

  const visibleLinks = ALL_LINKS.filter((link) => canSee(link.panel));

  const buckets: Array<{ group: string | null; links: Link[] }> = [];
  for (const link of visibleLinks) {
    const key = link.group ?? null;
    let bucket = buckets.find((b) => b.group === key);
    if (!bucket) {
      bucket = { group: key, links: [] };
      buckets.push(bucket);
    }
    bucket.links.push(link);
  }

  const activeGroup = visibleLinks.find((l) => {
    if (l.to === '/admin') return location.pathname === '/admin';
    return location.pathname === l.to || location.pathname.startsWith(l.to + '/');
  })?.group ?? null;

  return (
    <aside className='w-full md:w-64 space-y-3'>
      {buckets.map((bucket, idx) => {
        const ariaLabel = bucket.group ?? 'Admin navigation';
        const isActiveGroup = bucket.group != null && bucket.group === activeGroup;
        return (
          <nav
            key={bucket.group ?? `__ungrouped-${idx}`}
            aria-label={ariaLabel}
            className='space-y-1'
          >
            {bucket.group && (
              <p
                className={
                  'px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.16em] select-none transition ' +
                  (isActiveGroup ? 'text-foreground' : 'text-muted-foreground')
                }
              >
                / {bucket.group.toLowerCase()}
              </p>
            )}
            {bucket.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin' || link.to === '/admin/theme'}
                className={({ isActive }) =>
                  'block rounded border px-3 py-2 text-sm transition ' +
                  (isActive
                    ? 'border-accent/50 bg-accent/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface/30')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        );
      })}
    </aside>
  );
}
