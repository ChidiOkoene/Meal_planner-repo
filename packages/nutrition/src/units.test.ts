import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gramsToUnits, purchaseQuantity } from './units.js';

const riceUnits = [
  { name: 'derica', grams: 260 },
  { name: 'mudu', grams: 1300 },
];

describe('purchaseQuantity', () => {
  it('rounds up to whole market units', () => {
    expect(purchaseQuantity(500, riceUnits)).toEqual({ unit: 'derica', quantity: 2, grams: 520 });
  });

  it('prefers a larger unit when it fits exactly', () => {
    expect(purchaseQuantity(1300, riceUnits)).toEqual({ unit: 'mudu', quantity: 1, grams: 1300 });
  });

  it('allows half units where markets sell them', () => {
    expect(purchaseQuantity(120, riceUnits, { halfUnits: ['derica'] })).toEqual({
      unit: 'derica',
      quantity: 0.5,
      grams: 130,
    });
  });

  it('falls back to grams, rounded up, when there is no market unit', () => {
    expect(purchaseQuantity(120, [])).toEqual({ unit: 'g', quantity: 150, grams: 150 });
  });

  it('never rounds a tiny real need down to nothing', () => {
    // Found by the property test in CI: 0.000001 g of a 1 kg unit was bought as 0 units.
    expect(purchaseQuantity(0.000001, [{ name: 'bag', grams: 1000.0000000000001 }]).quantity).toBe(
      1,
    );
  });

  it('does not round up float noise', () => {
    expect(purchaseQuantity(260 * 3, riceUnits).quantity).toBe(3);
    // 0.1 + 0.2 style noise: 780.0000000001 g is still 3 derica, not 4.
    expect(purchaseQuantity(780.0000000001, [{ name: 'derica', grams: 260 }]).quantity).toBe(3);
  });

  it('never buys less than needed', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 20_000, noNaN: true }),
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1 }),
            grams: fc.double({ min: 1, max: 5000, noNaN: true }),
          }),
          {
            maxLength: 4,
          },
        ),
        (needed, units) => {
          const result = purchaseQuantity(needed, units);
          expect(result.grams).toBeGreaterThanOrEqual(needed - 1e-6);
        },
      ),
    );
  });

  it('buys nothing when nothing is needed', () => {
    expect(purchaseQuantity(0, riceUnits)).toEqual({ unit: 'derica', quantity: 0, grams: 0 });
    expect(purchaseQuantity(0, [])).toEqual({ unit: 'g', quantity: 0, grams: 0 });
  });

  it('rejects negative amounts', () => {
    expect(() => purchaseQuantity(-5, riceUnits)).toThrow(RangeError);
  });
});

describe('gramsToUnits', () => {
  it('converts grams to a number of units', () => {
    expect(gramsToUnits(520, { name: 'derica', grams: 260 })).toBe(2);
  });

  it('rejects a unit with no weight', () => {
    expect(() => gramsToUnits(100, { name: 'broken', grams: 0 })).toThrow(RangeError);
  });
});
