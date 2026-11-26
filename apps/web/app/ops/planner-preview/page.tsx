import type { Metadata } from 'next';
import { PlannerPreview } from '@/components/planner-preview/planner-preview';

export const metadata: Metadata = { title: 'Planner preview' };

export default function PlannerPreviewPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div role="note" className="mb-6 rounded-lg border border-warn bg-warn-bg px-4 py-3 text-sm">
        <strong>Development preview.</strong> Sample dishes with estimated nutrients and
        illustrative limits. Not dietitian-verified; never use these plans for a real person.
      </div>
      <h1 className="text-2xl font-semibold">Planner preview</h1>
      <p className="mt-1 mb-6 max-w-prose text-text-muted">
        Generate a week of meals for an example parent and see how it fits their limits.
      </p>
      <PlannerPreview />
    </main>
  );
}
