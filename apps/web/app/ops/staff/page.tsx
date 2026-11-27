import type { Metadata } from 'next';
import { StaffAdmin } from '@/components/ops/staff-admin';

export const metadata: Metadata = { title: 'Staff' };

export default function StaffPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <p className="mt-1 mb-6 max-w-prose text-text-muted">
        Who can use the staff console. Removing a role signs that person out immediately.
      </p>
      <StaffAdmin />
    </main>
  );
}
