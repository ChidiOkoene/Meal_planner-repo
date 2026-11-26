'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type Me, useApi } from '@/lib/api';

/** Placeholder family home: shows who is signed in until onboarding (#18) and the dashboard (#37). */
export function FamilyHome() {
  const api = useApi();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me') });

  if (me.isPending) return <p className="text-text-muted">Loading…</p>;
  if (me.isError)
    return (
      <p role="alert" className="text-bad">
        Could not load your account: {me.error.message}
      </p>
    );
  return (
    <div className="space-y-3">
      <p>
        Signed in as <strong>{me.data.displayName}</strong> ({me.data.email}).
      </p>
      {me.data.households.length === 0 ? (
        <p className="text-text-muted">
          You haven’t added a parent yet. That arrives with onboarding (#18).
        </p>
      ) : (
        <ul className="list-disc pl-5">
          {me.data.households.map((h) => (
            <li key={h.id}>{h.name}</li>
          ))}
        </ul>
      )}
      {me.data.staff ? (
        <p>
          <Link href="/ops" className="underline hover:text-brand">
            Go to the staff console
          </Link>
        </p>
      ) : null}
    </div>
  );
}
