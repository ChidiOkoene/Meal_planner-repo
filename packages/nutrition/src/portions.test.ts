import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { describePortion, formatQuantity, pluralise, snapPortion } from './portions.js';

describe('snapPortion', () => {
  it('snaps to quarter servings within 0.5–1.5', () => {
    expect(snapPortion(1.37)).toBe(1.25);
    expect(snapPortion(1.4)).toBe(1.5);
    expect(snapPortion(0.1)).toBe(0.5);
    expect(snapPortion(3)).toBe(1.5);
  });

  it('rejects non-finite multipliers', () => {
    expect(() => snapPortion(Number.NaN)).toThrow(RangeError);
  });

  it('always lands on a step inside the range', () => {
    fc.assert(
      fc.property(fc.double({ min: -10, max: 10, noNaN: true }), (value) => {
        const snapped = snapPortion(value);
        expect(snapped).toBeGreaterThanOrEqual(0.5);
        expect(snapped).toBeLessThanOrEqual(1.5);
        expect((snapped * 4) % 1).toBe(0);
      }),
    );
  });
});

describe('describePortion', () => {
  it('writes portions a parent can follow', () => {
    expect(describePortion(1, 'wrap', 'Eba')).toBe('1 wrap of Eba');
    expect(describePortion(1.5, 'wrap', 'Eba')).toBe('1½ wraps of Eba');
    expect(describePortion(0.75, 'ladle', 'Efo riro')).toBe('¾ ladle of Efo riro');
    expect(describePortion(2, 'piece', 'Orange')).toBe('2 pieces of Orange');
  });
});

describe('formatQuantity and pluralise', () => {
  it('formats quarters as fractions', () => {
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(1.75)).toBe('1¾');
    expect(formatQuantity(1.2)).toBe('1.2');
  });

  it('pluralises regular and -es units', () => {
    expect(pluralise('bowl', 2)).toBe('bowls');
    expect(pluralise('dish', 2)).toBe('dishes');
    expect(pluralise('bowl', 1)).toBe('bowl');
  });
});
