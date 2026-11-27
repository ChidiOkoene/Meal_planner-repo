import type { Metadata } from 'next';
import { FamilyHome } from '@/components/family-home';

export const metadata: Metadata = { title: 'Family home' };

export default function PayerHomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Your family</h1>
      <div className="mt-4">
        <FamilyHome />
      </div>
    </main>
  );
}
