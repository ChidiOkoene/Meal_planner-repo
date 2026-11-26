import { Show, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

/** Top bar used by each section of the app. */
export function SiteHeader({ section, nav = [] }: { section?: string; nav?: NavItem[] }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-brand">
          Dyjext Care
        </Link>
        {section ? <span className="text-sm text-text-muted">{section}</span> : null}
        {nav.length > 0 ? (
          <nav
            aria-label={`${section ?? 'Main'} navigation`}
            className="flex flex-wrap gap-4 text-sm"
          >
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-text hover:text-brand">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-text hover:text-brand">
              Sign in
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/app" className="text-text hover:text-brand">
              My family
            </Link>
            <UserButton userProfileUrl="/account" />
          </Show>
        </div>
      </div>
    </header>
  );
}
