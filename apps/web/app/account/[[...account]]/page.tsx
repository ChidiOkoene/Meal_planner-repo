import { UserProfile } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = { title: 'Your account' };

/** Sign-in methods, passkeys and 2-step verification, managed by Clerk. */
export default function AccountPage() {
  return (
    <>
      <SiteHeader section="Account" />
      <main className="flex justify-center px-4 py-8">
        <UserProfile />
      </main>
    </>
  );
}
