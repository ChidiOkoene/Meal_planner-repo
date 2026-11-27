import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Family home' };

export default function PayerHomePage() {
  return (
    <Placeholder title="Your family" issue="#18 (onboarding) and #37 (dashboard)">
      This is where you will add your parent, see this week&apos;s meals and deliveries, and manage
      payments.
    </Placeholder>
  );
}
