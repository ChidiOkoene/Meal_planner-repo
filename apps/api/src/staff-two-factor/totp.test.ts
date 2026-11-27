import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  codeForStep,
  generateBackupCode,
  generateSecret,
  hashBackupCode,
  looksLikeBackupCode,
  otpauthUri,
  stepAt,
  verifyCode,
} from './totp.js';

// RFC 6238 appendix B, SHA-1 rows. The key is the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const RFC_VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP', () => {
  it.each(RFC_VECTORS)('matches RFC 6238 at t=%i', (seconds, expected) => {
    const step = stepAt(seconds * 1000);
    expect(codeForStep(base32Decode(RFC_SECRET), step, 8)).toBe(expected);
    // Six-digit codes are the last six digits of the same number.
    expect(codeForStep(base32Decode(RFC_SECRET), step)).toBe(expected.slice(2));
  });

  it('encodes base32 as RFC 4648 does', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb-oi======').toString()).toBe('foobar');
    expect(() => base32Decode('MZ1')).toThrow(/base32/);
  });

  it('round-trips any bytes through base32', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        const buffer = Buffer.from(bytes);
        expect(base32Decode(base32Encode(buffer)).equals(buffer)).toBe(true);
      }),
    );
  });

  it('makes 160-bit secrets', () => {
    const secret = generateSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(generateSecret()).not.toBe(secret);
  });

  it('accepts the current code and one step either side, nothing further', () => {
    const now = 1_800_000_000_000;
    const secret = base32Decode(RFC_SECRET);
    const step = stepAt(now);
    for (const offset of [-1, 0, 1]) {
      expect(verifyCode(RFC_SECRET, codeForStep(secret, step + offset), { now })).toBe(
        step + offset,
      );
    }
    for (const offset of [-3, -2, 2, 3]) {
      expect(verifyCode(RFC_SECRET, codeForStep(secret, step + offset), { now })).toBeNull();
    }
  });

  it('never accepts a code twice, or an older code after a newer one', () => {
    const now = 1_800_000_000_000;
    const secret = base32Decode(RFC_SECRET);
    const step = stepAt(now);
    const code = codeForStep(secret, step);
    expect(verifyCode(RFC_SECRET, code, { now, lastUsedStep: step - 1 })).toBe(step);
    expect(verifyCode(RFC_SECRET, code, { now, lastUsedStep: step })).toBeNull();
    expect(
      verifyCode(RFC_SECRET, codeForStep(secret, step - 1), { now, lastUsedStep: step }),
    ).toBeNull();
  });

  it('rejects anything that is not six digits', () => {
    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 5']) {
      expect(verifyCode(RFC_SECRET, code)).toBeNull();
    }
  });

  it('builds the link authenticator apps scan', () => {
    const uri = new URL(otpauthUri({ secret: 'ABC', issuer: 'Dyjext Care', account: 'a@b.test' }));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.host).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toBe('/Dyjext Care:a@b.test');
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: 'ABC',
      issuer: 'Dyjext Care',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
  });
});

describe('backup codes', () => {
  it('are readable, distinct and recognisable', () => {
    const codes = Array.from({ length: 50 }, generateBackupCode);
    expect(new Set(codes).size).toBe(50);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
      expect(looksLikeBackupCode(code)).toBe(true);
    }
    expect(looksLikeBackupCode('123456')).toBe(false);
  });

  it('hash the same however they are typed, and differently per person', () => {
    expect(hashBackupCode('u1', 'k7m2q 9xht4')).toBe(hashBackupCode('u1', 'K7M2Q-9XHT4'));
    expect(hashBackupCode('u1', 'K7M2Q-9XHT4')).not.toBe(hashBackupCode('u2', 'K7M2Q-9XHT4'));
  });
});
