import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex justify-center px-4 py-10">
        <SignUp />
      </main>
    </>
  );
}
