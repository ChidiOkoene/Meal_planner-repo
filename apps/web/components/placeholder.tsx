import type { ReactNode } from 'react';

/** Placeholder content for screens that later issues build. */
export function Placeholder({
  title,
  issue,
  children,
}: {
  title: string;
  issue: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-prose text-text-muted">{children}</p>
      <p className="mt-6 inline-block rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
        Built in issue {issue}.
      </p>
    </main>
  );
}
