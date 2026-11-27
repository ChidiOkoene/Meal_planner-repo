import { describe, expect, it } from 'vitest';
import {
  canPayerChangeStatus,
  createRecipientSchema,
  isDeliveryArea,
  normaliseMobileNumber,
} from './households.js';

const lagosAddress = { line1: '12 Example Street', area: 'Surulere', city: 'Lagos' };

describe('phone numbers', () => {
  it('normalise local and international forms to E.164', () => {
    expect(normaliseMobileNumber('0803 123 4567', 'NG')).toBe('+2348031234567');
    expect(normaliseMobileNumber('+234 803 123 4567')).toBe('+2348031234567');
    expect(normaliseMobileNumber('07911 123456', 'GB')).toBe('+447911123456');
    expect(normaliseMobileNumber('+1 613 555 0123')).toBe('+16135550123');
  });

  it('refuse invalid numbers and landlines', () => {
    expect(normaliseMobileNumber('12345', 'NG')).toBeNull();
    expect(normaliseMobileNumber('020 7946 0018', 'GB')).toBeNull(); // London landline
  });
});

describe('createRecipientSchema', () => {
  it('defaults to full care in Lagos, with the Lagos time zone', () => {
    const result = createRecipientSchema.parse({
      relationship: 'parent',
      displayName: 'Mama',
      phone: '0803 123 4567',
      countryCode: 'NG',
      address: lagosAddress,
    });
    expect(result).toMatchObject({
      phoneE164: '+2348031234567',
      serviceTier: 'full_care',
      timezone: 'Africa/Lagos',
      language: 'en',
    });
  });

  it('defaults to plan only outside delivery areas, and keeps no address', () => {
    const abuja = createRecipientSchema.parse({
      relationship: 'parent',
      displayName: 'Papa',
      phone: '+2348031234568',
      countryCode: 'NG',
      address: { line1: '1 Road', city: 'Abuja' },
    });
    expect(abuja).toMatchObject({ serviceTier: 'plan_only', address: undefined });

    const london = createRecipientSchema.parse({
      relationship: 'self',
      displayName: 'Tunde',
      phone: '07911 123456',
      countryCode: 'GB',
    });
    expect(london).toMatchObject({ serviceTier: 'plan_only', timezone: 'Europe/London' });
  });

  it('lets a Lagos payer choose plan only', () => {
    const result = createRecipientSchema.parse({
      relationship: 'self',
      displayName: 'Ada',
      phone: '0803 123 4569',
      countryCode: 'NG',
      serviceTier: 'plan_only',
    });
    expect(result.serviceTier).toBe('plan_only');
  });

  it('refuses full care outside delivery areas or without an address', () => {
    const outside = createRecipientSchema.safeParse({
      relationship: 'parent',
      displayName: 'Papa',
      phone: '07911 123456',
      countryCode: 'GB',
      serviceTier: 'full_care',
      address: { line1: '1 Road', city: 'London' },
    });
    expect(outside.success).toBe(false);
    expect(outside.error?.issues.map((i) => i.path.join('.'))).toContain('serviceTier');

    const noAddress = createRecipientSchema.safeParse({
      relationship: 'parent',
      displayName: 'Mama',
      phone: '0803 123 4567',
      countryCode: 'NG',
      serviceTier: 'full_care',
    });
    expect(noAddress.error?.issues.map((i) => i.path.join('.'))).toContain('address');
  });

  it('needs a time zone where a country has several', () => {
    const base = {
      relationship: 'relative',
      displayName: 'Aunty',
      phone: '+1 613 555 0123',
      countryCode: 'CA',
    } as const;
    expect(createRecipientSchema.safeParse(base).error?.issues[0]?.path).toEqual(['timezone']);
    expect(createRecipientSchema.parse({ ...base, timezone: 'America/Toronto' }).timezone).toBe(
      'America/Toronto',
    );
    expect(createRecipientSchema.safeParse({ ...base, timezone: 'Mars/Base' }).success).toBe(false);
  });

  it('refuses countries without an ingredient list', () => {
    expect(
      createRecipientSchema.safeParse({
        relationship: 'parent',
        displayName: 'Mama',
        phone: '+491701234567',
        countryCode: 'DE',
      }).success,
    ).toBe(false);
  });
});

describe('delivery areas and status changes', () => {
  it('matches Lagos however it is typed', () => {
    expect(isDeliveryArea('NG', ' lagos ')).toBe(true);
    expect(isDeliveryArea('NG', 'Ibadan')).toBe(false);
    expect(isDeliveryArea('GB', 'Lagos')).toBe(false);
  });

  it('lets payers pause, resume and close, but not consent on the recipient’s behalf', () => {
    expect(canPayerChangeStatus('active', 'paused')).toBe(true);
    expect(canPayerChangeStatus('paused', 'active')).toBe(true);
    expect(canPayerChangeStatus('invited', 'closed')).toBe(true);
    expect(canPayerChangeStatus('invited', 'active')).toBe(false);
    expect(canPayerChangeStatus('consented', 'active')).toBe(false);
    expect(canPayerChangeStatus('closed', 'active')).toBe(false);
  });
});
