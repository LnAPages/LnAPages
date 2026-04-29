import { Camera } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBrandPublic } from '@/hooks/useBrand';
import { HamburgerMenu } from './HamburgerMenu';

function setMetaTitle(selector: string, value: string) {
  const tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (tag) {
    tag.setAttribute('content', value);
  }
}

export function Header() {
  const location = useLocation();
  const { data: brand, refetch } = useBrandPublic();
  const label = brand?.identity.business_name || brand?.identity.short_name || '';
  const logo = brand?.identity.wordmark_url || brand?.identity.logo_url;

  useEffect(() => {
    void refetch();
  }, [location.pathname, refetch]);

  useEffect(() => {
    document.title = label;
    setMetaTitle('meta[property="og:title"]', label);
    setMetaTitle('meta[name="twitter:title"]', label);
  }, [label]);

  return (
    <header className='border-b border-border'>
      <div className='mx-auto flex w-full max-w-[var(--max-content-width)] items-center justify-between px-4 py-3'>
        <Link to='/' className='flex items-center gap-2 font-semibold'>
          {logo ? <img src={logo} alt={label || 'logo'} className='h-6 w-auto max-w-[9rem] object-contain' /> : <Camera size={18} />}
          {label ? <span>{label}</span> : null}
        </Link>
        <HamburgerMenu />
      </div>
    </header>
  );
}
