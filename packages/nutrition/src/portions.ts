/** Portion multipliers the planner may use, relative to one standard serving. */
export const DEFAULT_PORTION_RANGE = { min: 0.5, max: 1.5, step: 0.25 } as const;

/** Snap a multiplier to the nearest step within [min, max], e.g. 1.37 → 1.25. */
export function snapPortion(
  multiplier: number,
  range: { min: number; max: number; step: number } = DEFAULT_PORTION_RANGE,
): number {
  if (!Number.isFinite(multiplier))
    throw new RangeError(`multiplier must be finite, got ${multiplier}`);
  const snapped = Math.round(multiplier / range.step) * range.step;
  return Math.min(range.max, Math.max(range.min, Number(snapped.toFixed(6))));
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** 1.5 → "1½", 0.25 → "¼", 2 → "2". Other values are shown with up to two decimals. */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value);
  const fraction = Number((value - whole).toFixed(2));
  if (fraction === 0) return String(whole);
  const glyph = FRACTIONS[String(fraction)];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return String(Number(value.toFixed(2)));
}

/** English plural of a serving unit: "wrap" → "wraps", "dish" → "dishes". */
export function pluralise(unit: string, quantity: number): string {
  if (quantity <= 1) return unit;
  if (/(s|x|z|ch|sh)$/.test(unit)) return `${unit}es`;
  return `${unit}s`;
}

/**
 * A portion a parent can follow without a scale: "1½ wraps of Eba", "1 ladle of Efo riro".
 * Fractions above 1 count as plural ("1½ wraps"), quarters and halves below 1 are singular.
 */
export function describePortion(multiplier: number, servingUnit: string, dishName: string): string {
  return `${formatQuantity(multiplier)} ${pluralise(servingUnit, multiplier)} of ${dishName}`;
}
