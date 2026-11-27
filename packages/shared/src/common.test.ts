import { describe, expect, it } from 'vitest';
import { currencySchema, moneySchema, paginationQuerySchema } from './common.js';

describe('common schemas', () => {
  it('accepts ISO currency codes only', () => {
    expect(currencySchema.safeParse('GBP').success).toBe(true);
    expect(currencySchema.safeParse('gbp').success).toBe(false);
    expect(currencySchema.safeParse('POUND').success).toBe(false);
  });

  it('parses money into BigInt minor units', () => {
    expect(moneySchema.parse({ amountMinor: '4500000', currency: 'NGN' })).toEqual({
      amountMinor: 4_500_000n,
      currency: 'NGN',
    });
  });

  it('applies pagination defaults and limits', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(paginationQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
