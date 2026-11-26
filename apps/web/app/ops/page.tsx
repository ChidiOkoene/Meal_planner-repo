import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Staff console' };

const upcoming = [
  ['Catalogue editor', '#14'],
  ['Recipients and intake', '#20'],
  ['Plan review queue', '#27'],
  ['Orders board', '#32'],
];

export default function OpsHomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Staff console</h1>
      <p className="mt-2 max-w-prose text-text-muted">
        Tools for dietitians and the operations team. Sign-in and role checks arrive in issue #8.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/ops/planner-preview"
          className="rounded-lg border border-border bg-surface p-5 hover:border-brand"
        >
          <h2 className="font-semibold">Planner preview</h2>
          <p className="mt-1 text-sm text-text-muted">
            Generate a week of meals for an example parent and check it against their limits.
          </p>
        </Link>
        <div className="rounded-lg border border-dashed border-border p-5">
          <h2 className="font-semibold">Coming next</h2>
          <ul className="mt-2 space-y-1 text-sm text-text-muted">
            {upcoming.map(([label, issue]) => (
              <li key={label}>
                {label} <span className="text-xs">({issue})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
