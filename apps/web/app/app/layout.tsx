import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

export default function PayerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader section="Family" nav={[{ href: '/app', label: 'Home' }]} />
      {children}
    </>
  );
}
