import { type Nutrients } from '@dyjext/nutrition';
import { type Band, type LimitedNutrient, type NutrientBands } from './types.js';

export const LIMITED_NUTRIENTS: LimitedNutrient[] = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fibreG',
  'sodiumMg',
];

/**
 * How far nutrients fall outside the bands, as a sum of relative distances
 * (10% over a maximum counts 0.1). Zero means every band is met.
 */
export function bandViolation(nutrients: Nutrients, bands: NutrientBands | undefined): number {
  if (!bands) return 0;
  let total = 0;
  for (const key of LIMITED_NUTRIENTS) {
    const band = bands[key];
    if (band) total += distance(nutrients[key], band);
  }
  return total;
}

/** Like bandViolation, but only maximums: used while a day is still being filled. */
export function maxViolation(nutrients: Nutrients, bands: NutrientBands | undefined): number {
  if (!bands) return 0;
  let total = 0;
  for (const key of LIMITED_NUTRIENTS) {
    const max = bands[key]?.max;
    if (max !== undefined) total += distance(nutrients[key], { max });
  }
  return total;
}

function distance(value: number, band: Band): number {
  if (band.max !== undefined && value > band.max) return (value - band.max) / Math.max(band.max, 1);
  if (band.min !== undefined && value < band.min) return (band.min - value) / Math.max(band.min, 1);
  return 0;
}

/** Human-readable list of the bands a value breaks, e.g. "carbsG 72 > 60". */
export function describeViolations(
  nutrients: Nutrients,
  bands: NutrientBands | undefined,
): string[] {
  if (!bands) return [];
  const problems: string[] = [];
  for (const key of LIMITED_NUTRIENTS) {
    const band = bands[key];
    const value = nutrients[key];
    if (band?.max !== undefined && value > band.max + 1e-9) {
      problems.push(`${key} ${Math.round(value)} > ${band.max}`);
    }
    if (band?.min !== undefined && value < band.min - 1e-9) {
      problems.push(`${key} ${Math.round(value)} < ${band.min}`);
    }
  }
  return problems;
}
