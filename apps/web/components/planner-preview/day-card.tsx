import type { PlanExplanation, PlannedDay } from '@dyjext/planner';
import { LimitBar } from './limit-bar';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function formatDate(iso: string): { weekday: string; date: string } {
  const date = new Date(`${iso}T12:00:00Z`);
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  };
}

/** One day of the plan: meals with portions and reasons, then the day's totals against limits. */
export function DayCard({
  day,
  explanation,
}: {
  day: PlannedDay;
  explanation?: PlanExplanation['days'][number];
}) {
  const { weekday, date } = formatDate(day.date);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <h3 className="font-semibold">
        {weekday} <span className="font-normal text-text-muted">{date}</span>
      </h3>
      <ul className="mt-3 space-y-3">
        {day.meals.map((meal, mealIndex) => {
          const reasons = explanation?.meals[mealIndex]?.items.flatMap((item) =>
            item.reasons.map((reason) => `${item.name}: ${reason}`),
          );
          return (
            <li key={meal.mealType}>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                {MEAL_LABELS[meal.mealType] ?? meal.mealType}
                <span className="ml-2 font-normal normal-case tracking-normal text-text-muted">
                  {Math.round(meal.nutrients.carbsG)} g carbs
                </span>
              </p>
              <p className="mt-0.5 text-sm">
                {meal.items.map((item) => item.portionText).join(' + ')}
              </p>
              {reasons && reasons.length > 0 ? (
                <details className="mt-1 text-xs text-text-muted">
                  <summary className="cursor-pointer select-none hover:text-text">
                    Why this?
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      {explanation && explanation.checks.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-text-muted">Day total</p>
          {explanation.checks.map((check) => (
            <LimitBar key={check.nutrient} check={check} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
