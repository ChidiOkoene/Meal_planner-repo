'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type HouseholdSummary, type Me, type RecipientSummary, useApi } from '@/lib/api';

/** Family home: each plan and where it stands. The full dashboard arrives in #37. */
export function FamilyHome() {
  const api = useApi();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me') });
  const households = useQuery({
    queryKey: ['households'],
    queryFn: () => api<HouseholdSummary[]>('/v1/households'),
  });

  if (me.isPending || households.isPending) return <p className="text-text-muted">Loading…</p>;
  if (me.isError || households.isError) {
    return (
      <p role="alert" className="text-bad">
        Could not load your account: {(me.error ?? households.error)?.message}
      </p>
    );
  }

  const recipients = households.data.flatMap((h) =>
    h.recipients.map((r) => ({ ...r, householdName: h.name })),
  );

  return (
    <div className="space-y-6">
      <p className="text-text-muted">
        Signed in as {me.data.displayName} ({me.data.email}).
      </p>

      {recipients.length === 0 ? (
        <section className="max-w-xl rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Start a meal plan</h2>
          <p className="mt-1 text-text-muted">
            For a parent or relative, or for yourself: healthy Nigerian meals for diabetes and high
            blood pressure, approved by a dietitian and sent on WhatsApp.
          </p>
          <Link
            href="/app/onboarding"
            className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast"
          >
            Get started
          </Link>
        </section>
      ) : (
        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="text-lg font-semibold">
            Meal plans
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {recipients.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-semibold">
                  {r.isYou ? `You (${r.displayName})` : r.displayName}
                </p>
                <p className="text-sm text-text-muted">
                  {r.serviceTier === 'full_care' ? 'Full care' : 'Plan only'} · {r.householdName}
                </p>
                <StatusLine recipient={r} />
              </li>
            ))}
          </ul>
          <Link
            href="/app/onboarding"
            className="mt-4 inline-block rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Add someone else
          </Link>
        </section>
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

function StatusLine({ recipient: r }: { recipient: RecipientSummary }) {
  const who = r.isYou ? 'you' : r.displayName;
  const text: Record<RecipientSummary['status'], [string, string]> = {
    invited: [
      'text-warn',
      r.isYou
        ? 'Waiting for you to reply YES on WhatsApp.'
        : `Waiting for ${who} to reply YES on WhatsApp.`,
    ],
    consented: [
      'text-ok',
      `${r.isYou ? 'You' : who} agreed. A dietitian will call to set up the plan.`,
    ],
    active: ['text-ok', 'Active: weekly plans are being sent.'],
    paused: ['text-text-muted', 'Paused.'],
    closed: ['text-text-muted', 'Closed.'],
  };
  const [tone, message] = text[r.status];
  return <p className={`mt-2 text-sm ${tone}`}>{message}</p>;
}
