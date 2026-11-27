import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  dishNutrition,
  NUTRIENT_KEYS,
  type Nutrients,
  nutrientsForGrams,
  nutrientsToCsv,
  roundNutrients,
  scaleNutrients,
  sumNutrients,
  ZERO_NUTRIENTS,
} from './nutrients.js';

const rice: Nutrients = {
  energyKcal: 360,
  proteinG: 6.7,
  carbsG: 80,
  fatG: 0.6,
  fibreG: 1.3,
  sodiumMg: 5,
  potassiumMg: 86,
};
const palmOil: Nutrients = { ...ZERO_NUTRIENTS, energyKcal: 884, fatG: 100, potassiumMg: null };

const nutrientsArb: fc.Arbitrary<Nutrients> = fc.record({
  energyKcal: fc.double({ min: 0, max: 900, noNaN: true }),
  proteinG: fc.double({ min: 0, max: 100, noNaN: true }),
  carbsG: fc.double({ min: 0, max: 100, noNaN: true }),
  fatG: fc.double({ min: 0, max: 100, noNaN: true }),
  fibreG: fc.double({ min: 0, max: 50, noNaN: true }),
  sodiumMg: fc.double({ min: 0, max: 40_000, noNaN: true }),
  potassiumMg: fc.option(fc.double({ min: 0, max: 5_000, noNaN: true }), { nil: null }),
});

function expectClose(actual: Nutrients, expected: Nutrients) {
  for (const key of NUTRIENT_KEYS) {
    const a = actual[key];
    const e = expected[key];
    if (a === null || e === null) {
      expect(a).toBe(e);
    } else {
      expect(a).toBeCloseTo(e, 6);
    }
  }
}

describe('nutrientsForGrams', () => {
  it('scales per-100 g values to the grams used', () => {
    expect(nutrientsForGrams(rice, 70)).toEqual(scaleNutrients(rice, 0.7));
    expect(nutrientsForGrams(rice, 70).energyKcal).toBeCloseTo(252);
  });

  it('rejects negative or non-finite grams and factors', () => {
    expect(() => nutrientsForGrams(rice, -1)).toThrow(RangeError);
    expect(() => nutrientsForGrams(rice, Number.NaN)).toThrow(RangeError);
    expect(() => scaleNutrients(rice, -2)).toThrow(RangeError);
    expect(() => scaleNutrients(rice, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('sumNutrients', () => {
  it('returns zero for an empty list', () => {
    expect(sumNutrients([])).toEqual(ZERO_NUTRIENTS);
  });

  it('keeps potassium unknown if any part is unknown', () => {
    expect(sumNutrients([rice, palmOil]).potassiumMg).toBeNull();
    expect(sumNutrients([rice, rice]).potassiumMg).toBe(172);
  });

  it('aggregating then scaling equals scaling then aggregating', () => {
    fc.assert(
      fc.property(
        fc.array(nutrientsArb, { maxLength: 12 }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (items, factor) => {
          expectClose(
            scaleNutrients(sumNutrients(items), factor),
            sumNutrients(items.map((item) => scaleNutrients(item, factor))),
          );
        },
      ),
    );
  });

  it('is independent of order', () => {
    fc.assert(
      fc.property(fc.array(nutrientsArb, { maxLength: 12 }), (items) => {
        expectClose(sumNutrients(items), sumNutrients([...items].reverse()));
      }),
    );
  });
});

describe('dishNutrition', () => {
  const ingredients = [
    { name: 'Rice', gramsPerServing: 70, per100g: rice },
    { name: 'Palm oil', gramsPerServing: 10, per100g: palmOil },
    { name: 'Garnish', gramsPerServing: 5, isOptional: true, per100g: rice },
    { name: 'Mystery spice', gramsPerServing: 2, per100g: null },
  ];

  it('sums ingredients and reports those without nutrient data', () => {
    const result = dishNutrition(ingredients);
    expect(result.perServing.energyKcal).toBeCloseTo(252 + 88.4);
    expect(result.perServing.fatG).toBeCloseTo(0.42 + 10);
    expect(result.missingProfiles).toEqual(['Mystery spice']);
  });

  it('leaves optional ingredients out unless asked', () => {
    const withOptional = dishNutrition(ingredients, { includeOptional: true });
    expect(withOptional.perServing.energyKcal).toBeCloseTo(252 + 88.4 + 18);
  });
});

describe('zero values', () => {
  // The old calculator treated a real 0 (e.g. no sodium) as "missing" and dropped it.
  it('keeps zeros through scaling, rounding and CSV export', () => {
    const noSodium: Nutrients = { ...rice, sodiumMg: 0, fibreG: 0 };
    expect(scaleNutrients(noSodium, 2).sodiumMg).toBe(0);
    expect(roundNutrients(noSodium).fibreG).toBe(0);
    const csv = nutrientsToCsv(noSodium);
    expect(csv).toContain('Sodium,0,mg');
    expect(csv).toContain('Fibre,0,g');
  });

  it('omits only unknown values from CSV', () => {
    expect(nutrientsToCsv(palmOil)).not.toContain('Potassium');
    expect(nutrientsToCsv(palmOil).split('\n')[0]).toBe('Nutrient,Amount,Unit');
  });
});

describe('roundNutrients', () => {
  it('rounds energy and minerals to whole numbers and grams to one decimal', () => {
    expect(
      roundNutrients({ ...rice, energyKcal: 252.46, proteinG: 4.6899, sodiumMg: 3.5 }),
    ).toMatchObject({ energyKcal: 252, proteinG: 4.7, sodiumMg: 4 });
  });
});
