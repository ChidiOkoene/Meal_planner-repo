'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { type Me, useApi } from '@/lib/api';

/**
 * Shows the staff console only to staff with 2-step verification on. The API enforces the same
 * rules on every request; this just explains what's missing instead of showing errors.
 */
export function StaffGate({ children }: { children: ReactNode }) {
  const api = useApi();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me') });

  if (me.isPending)
    return <p className="mx-auto max-w-6xl px-4 py-10 text-text-muted">Checking access…</p>;
  if (me.isError) {
    return (
      <Notice title="Could not check your access">
        {me.error.message}. Is the API running, and is sign-in configured?
      </Notice>
    );
  }
  if (!me.data.staff) {
    return (
      <Notice title="Staff only">
        You are signed in as {me.data.email}, which has no staff access. Staff join by invitation
        from an admin.
      </Notice>
    );
  }
  if (!me.data.staff.unlocked) {
    return (
      <Notice title="Turn on 2-step verification">
        Staff can see health information, so the staff console needs 2-step verification with an
        authenticator app.{' '}
        <Link href="/account/security" className="font-semibold underline">
          Set it up in your account
        </Link>
        , then sign out and sign in again using it.
      </Notice>
    );
  }
  return (
    <>
      {me.data.staff.twoFactorRequired ? null : (
        <div role="note" className="border-b border-bad bg-bad-bg px-4 py-2 text-center text-sm">
          <strong>2-step verification is switched off for staff</strong>{' '}
          (STAFF_REQUIRE_TWO_FACTOR=false). For testing only; production refuses to start like this.
        </div>
      )}
      {children}
    </>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div role="alert" className="max-w-xl rounded-lg border border-warn bg-warn-bg p-5">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm">{children}</p>
      </div>
    </main>
  );
}
