import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata: Metadata = { title: 'Start a meal plan' };

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Start a meal plan</h1>
      <p className="mt-1 max-w-2xl text-text-muted">
        A few questions about who the plan is for. It takes about three minutes.
      </p>
      <div className="mt-6">
        <OnboardingWizard />
      </div>
    </main>
  );
}
