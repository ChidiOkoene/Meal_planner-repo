/** A local measure and its weight, e.g. `{ name: 'derica', grams: 260 }`. */
export interface UnitWeight {
  name: string;
  grams: number;
}

export interface PurchaseQuantity {
  /** Unit name, or "g" when the ingredient has no purchase unit. */
  unit: string;
  quantity: number;
  /** Grams actually bought (quantity × unit weight). Always at least the grams needed. */
  grams: number;
}

/**
 * How much to buy to cover `gramsNeeded`, in the market's own units.
 * Picks the unit that wastes the least after rounding up to whole units (halves for units
 * listed in `halfUnits`), and prefers fewer, larger units when waste is equal.
 * Without units, rounds up to the next `fallbackStepGrams`.
 */
export function purchaseQuantity(
  gramsNeeded: number,
  units: readonly UnitWeight[],
  options: { halfUnits?: readonly string[]; fallbackStepGrams?: number } = {},
): PurchaseQuantity {
  if (!Number.isFinite(gramsNeeded) || gramsNeeded < 0) {
    throw new RangeError(`gramsNeeded must be a non-negative number, got ${gramsNeeded}`);
  }
  const usable = units.filter((u) => u.grams > 0);
  if (gramsNeeded === 0) {
    return { unit: usable[0]?.name ?? 'g', quantity: 0, grams: 0 };
  }
  if (usable.length === 0) {
    const step = options.fallbackStepGrams ?? 50;
    const grams = Math.ceil(gramsNeeded / step) * step;
    return { unit: 'g', quantity: grams, grams };
  }

  const halves = new Set(options.halfUnits ?? []);
  const candidates = usable.map((unit) => {
    const step = halves.has(unit.name) ? 0.5 : 1;
    // Small tolerance so 2.0000001 units (float noise) doesn't round up to 3.
    const quantity = Math.ceil(gramsNeeded / unit.grams / step - 1e-9) * step;
    const grams = quantity * unit.grams;
    return { unit: unit.name, quantity, grams, waste: grams - gramsNeeded };
  });
  candidates.sort((a, b) => a.waste - b.waste || a.quantity - b.quantity);
  const best = candidates[0]!;
  return { unit: best.unit, quantity: best.quantity, grams: best.grams };
}

/** Convert grams to a number of units, e.g. 520 g of rice → 2 derica. */
export function gramsToUnits(grams: number, unit: UnitWeight): number {
  if (unit.grams <= 0) throw new RangeError(`Unit "${unit.name}" has no weight`);
  return grams / unit.grams;
}
