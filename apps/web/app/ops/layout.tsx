import type { ReactNode } from 'react';
import { StaffGate } from '@/components/ops/staff-gate';
import { SiteHeader } from '@/components/site-header';

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader
        section="Staff console"
        nav={[
          { href: '/ops', label: 'Home' },
          { href: '/ops/planner-preview', label: 'Planner preview' },
          { href: '/ops/staff', label: 'Staff' },
        ]}
      />
      <StaffGate>{children}</StaffGate>
    </>
  );
}
