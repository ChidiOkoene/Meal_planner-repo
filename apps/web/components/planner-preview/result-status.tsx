import type { PlannerPreviewResponse } from './types';

/** Headline result: whether the plan meets every limit, and anything a dietitian must know. */
export function ResultStatus({ result }: { result: PlannerPreviewResponse }) {
  const { plan, validation } = result;
  const draftOnly = validation.problems.every((p) => p.rule === 'draft_dish');
  const otherProblems = validation.problems.filter((p) => p.rule !== 'draft_dish');

  if (plan.status === 'infeasible') {
    return (
      <section aria-live="polite" className="rounded-lg border border-bad bg-bad-bg p-4">
        <h2 className="font-semibold text-bad">No plan meets every limit for this profile</h2>
        <p className="mt-1 text-sm">
          The planner never breaks a limit to fill a week. A dietitian would need to adjust the
          limits or add dishes. The best attempt still had these problems:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {plan.unmet.map((rule, index) => (
            <li key={`${rule.rule}-${index}`}>
              {rule.date ? <span className="font-medium">{rule.date}: </span> : null}
              {rule.message}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="rounded-lg border border-ok bg-ok-bg p-4">
      <h2 className="font-semibold text-ok">Plan meets every limit</h2>
      <p className="mt-1 text-sm">
        Checked twice: by the planner, and again by an independent validator that recomputes every
        meal from the raw ingredient data.
        {draftOnly && validation.problems.length > 0
          ? ' The only warnings are that the sample dishes are not dietitian-verified yet.'
          : null}
      </p>
      {otherProblems.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {otherProblems.map((problem, index) => (
            <li key={`${problem.rule}-${index}`}>{problem.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
