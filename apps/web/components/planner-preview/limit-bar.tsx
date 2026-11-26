import type { LimitCheck } from '@dyjext/planner';

const STATUS_STYLES = {
  within: { bar: 'bg-ok', text: 'text-ok', label: 'Within limit' },
  near_limit: { bar: 'bg-warn', text: 'text-warn', label: 'Close to limit' },
  outside: { bar: 'bg-bad', text: 'text-bad', label: 'Outside limit' },
} as const;

function formatRange(check: LimitCheck): string {
  if (check.min !== undefined && check.max !== undefined) return `${check.min}–${check.max}`;
  if (check.max !== undefined) return `≤ ${check.max}`;
  return `≥ ${check.min}`;
}

/** One nutrient against its limit: value, allowed range and a coloured bar. */
export function LimitBar({ check }: { check: LimitCheck }) {
  const style = STATUS_STYLES[check.status];
  // Scale so a maximum sits at 100%; for a minimum-only limit, the minimum sits at two thirds.
  const scale = check.max ?? (check.min ?? 1) * 1.5;
  const width = Math.min(100, Math.max(2, (check.value / scale) * 100));
  return (
    <div className="text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-muted">{check.label}</span>
        <span>
          <span className={`font-medium ${style.text}`}>{Math.round(check.value)}</span>
          <span className="text-text-muted">
            {' '}
            / {formatRange(check)} {check.unit}
          </span>
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`${check.label} ${Math.round(check.value)} ${check.unit}, limit ${formatRange(check)} ${check.unit}: ${style.label}`}
      >
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
