import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex justify-center px-4 py-10">
        <SignIn />
      </main>
    </>
  );
}
