'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { type Me, useApi } from '@/lib/api';

interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  twoFactorEnabled: boolean;
  authenticatorApp: boolean;
  lastSignInAt: string | null;
  roles: { role: 'dietitian' | 'ops' | 'admin'; grantedAt: string }[];
}

const ROLE_LABELS = { dietitian: 'Dietitian', ops: 'Operations', admin: 'Admin' } as const;

/** Admins invite staff and remove access. The API refuses non-admins. */
export function StaffAdmin() {
  const api = useApi();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me') });
  const isAdmin = me.data?.staffRoles.includes('admin') ?? false;
  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: () => api<StaffMember[]>('/v1/ops/staff'),
    enabled: isAdmin,
  });

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<keyof typeof ROLE_LABELS>('dietitian');
  const invite = useMutation({
    mutationFn: () =>
      api('/v1/ops/staff/invitations', { method: 'POST', body: JSON.stringify({ email, role }) }),
    onSuccess: () => setEmail(''),
  });
  const remove = useMutation({
    mutationFn: ({ userId, role: r }: { userId: string; role: string }) =>
      api(`/v1/ops/staff/${userId}/roles/${r}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });

  const resetTwoFactor = useMutation({
    mutationFn: (userId: string) => api(`/v1/ops/staff/${userId}/two-factor`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });

  if (me.isPending) return null;
  if (!isAdmin) {
    return <p className="text-text-muted">Only admins can manage staff access.</p>;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    invite.mutate();
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="invite-heading"
        className="max-w-xl rounded-lg border border-border bg-surface p-5"
      >
        <h2 id="invite-heading" className="font-semibold">
          Invite a staff member
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          They get an email link to create an account. They set up an authenticator app the first
          time they open the staff console.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 rounded-md border border-border bg-bg px-2 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as keyof typeof ROLE_LABELS)}
              className="mt-1 rounded-md border border-border bg-bg px-2 py-2"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={invite.isPending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast disabled:opacity-60"
          >
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
        <p aria-live="polite" className="mt-3 text-sm">
          {invite.isSuccess ? <span className="text-ok">Invitation sent.</span> : null}
          {invite.isError ? <span className="text-bad">{invite.error.message}</span> : null}
        </p>
      </section>

      <section aria-labelledby="staff-heading">
        <h2 id="staff-heading" className="font-semibold">
          Current staff
        </h2>
        {remove.isError || resetTwoFactor.isError ? (
          <p role="alert" className="mt-2 text-sm text-bad">
            {(remove.error ?? resetTwoFactor.error)?.message}
          </p>
        ) : null}
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
          {(staff.data ?? []).map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">{person.displayName}</p>
                <p className="text-text-muted">{person.email}</p>
              </div>
              <span
                className={
                  person.authenticatorApp || person.twoFactorEnabled ? 'text-ok' : 'text-warn'
                }
              >
                {person.authenticatorApp || person.twoFactorEnabled
                  ? '2-step on'
                  : '2-step not set up'}
              </span>
              {person.authenticatorApp ? (
                <button
                  type="button"
                  disabled={resetTwoFactor.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Reset 2-step verification for ${person.email}? Use this when they lose their phone. They set up a new authenticator app at their next visit.`,
                      )
                    ) {
                      resetTwoFactor.mutate(person.id);
                    }
                  }}
                  className="rounded-md border border-border px-2 py-1 hover:border-warn"
                  aria-label={`Reset 2-step verification for ${person.email}`}
                >
                  Reset 2-step
                </button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {person.roles.map(({ role: r }) => (
                  <button
                    key={r}
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${ROLE_LABELS[r]} access from ${person.email}? They are signed out at once.`,
                        )
                      ) {
                        remove.mutate({ userId: person.id, role: r });
                      }
                    }}
                    className="rounded-md border border-border px-2 py-1 hover:border-bad hover:text-bad"
                    aria-label={`Remove ${ROLE_LABELS[r]} access from ${person.email}`}
                  >
                    {ROLE_LABELS[r]} ✕
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
