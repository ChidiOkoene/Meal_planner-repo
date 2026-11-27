import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time codes (RFC 6238), as used by Google Authenticator, Microsoft Authenticator,
 * 1Password, Authy and others: HMAC-SHA1, 30-second steps, 6 digits.
 */

export const STEP_SECONDS = 30;
export const DIGITS = 6;
/** Accept codes from one step either side, so a phone clock that is a little off still works. */
export const WINDOW = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 without padding (the form authenticator apps expect). */
export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random 160-bit secret, base32-encoded (RFC 4226 recommends 160 bits for SHA-1). */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepAt(time: number): number {
  return Math.floor(time / 1000 / STEP_SECONDS);
}

/** The code for one time step (RFC 4226 HOTP with the step as the counter). */
export function codeForStep(secret: Buffer, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Check a code. Returns the time step it matched, or null. A step at or before `lastUsedStep`
 * never matches, so a code (or an older one) can't be replayed after it has been used.
 */
export function verifyCode(
  secretBase32: string,
  code: string,
  options: { now?: number; lastUsedStep?: number | null } = {},
): number | null {
  const digits = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const current = stepAt(options.now ?? Date.now());
  let matched: number | null = null;
  // Check every step in the window (no early exit), so timing doesn't reveal which matched.
  for (let step = current - WINDOW; step <= current + WINDOW; step++) {
    const expected = Buffer.from(codeForStep(secret, step));
    if (timingSafeEqual(expected, Buffer.from(digits)) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (options.lastUsedStep != null && matched <= options.lastUsedStep) return null;
  return matched;
}

/** The link an authenticator app reads from the QR code (Key Uri Format). */
export function otpauthUri(params: { secret: string; issuer: string; account: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

// ─── Backup codes ────────────────────────────────────────────────────────────

/** Letters and digits that can't be confused when copied by hand (no 0/O, 1/I/L). */
const BACKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const BACKUP_CODE_COUNT = 10;

/** A backup code such as "K7M2Q-9XHT4": 10 characters, about 50 bits. */
export function generateBackupCode(): string {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) code += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Uppercase, without spaces or dashes, so "k7m2q 9xht4" matches "K7M2Q-9XHT4". */
export function normaliseBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function looksLikeBackupCode(code: string): boolean {
  return /^[A-Z0-9]{10}$/.test(normaliseBackupCode(code)) && !/^\d+$/.test(code.trim());
}

/**
 * Only this hash is stored. Salted with the user id, so the same code for two people (however
 * unlikely) never collides, and a leaked hash list can't be checked against everyone at once.
 */
export function hashBackupCode(userId: string, code: string): string {
  return createHash('sha256')
    .update(`${userId}:${normaliseBackupCode(code)}`)
    .digest('hex');
}
