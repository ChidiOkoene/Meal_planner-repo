import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Envelope encryption for sensitive fields (docs/ARCHITECTURE.md §15).
 *
 * Each value is encrypted with its own random 256-bit data key (AES-256-GCM). The data key is
 * itself encrypted ("wrapped") with a master key that never touches the database. Stored form:
 *
 *   enc:v1:<masterKeyId>:<wrapped data key>:<iv>:<ciphertext + auth tag>   (base64url parts)
 *
 * The master key id lets old values be read after a new master key is introduced (rotation).
 */

export const ENCRYPTED_PREFIX = 'enc:v1:';

/** Wraps and unwraps data keys. Local keys for development; a cloud KMS in production. */
export interface KeyProvider {
  /** Id of the key new values are encrypted with. */
  readonly currentKeyId: string;
  wrap(dataKey: Buffer): { keyId: string; wrapped: Buffer };
  unwrap(keyId: string, wrapped: Buffer): Buffer;
}

const b64 = (buffer: Buffer) => buffer.toString('base64url');
const unb64 = (text: string) => Buffer.from(text, 'base64url');

function seal(key: Buffer, plaintext: Buffer): { iv: Buffer; sealed: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return { iv, sealed };
}

function open(key: Buffer, iv: Buffer, sealed: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/** Encrypt a string. The same input gives a different output every time. */
export function encryptValue(plaintext: string, keys: KeyProvider): string {
  const dataKey = randomBytes(32);
  try {
    const { iv, sealed } = seal(dataKey, Buffer.from(plaintext, 'utf8'));
    const { keyId, wrapped } = keys.wrap(dataKey);
    return `${ENCRYPTED_PREFIX}${keyId}:${b64(wrapped)}:${b64(iv)}:${b64(sealed)}`;
  } finally {
    dataKey.fill(0);
  }
}

/** Decrypt a value produced by encryptValue. Throws if it was tampered with. */
export function decryptValue(stored: string, keys: KeyProvider): string {
  if (!isEncrypted(stored)) throw new Error('Value is not encrypted');
  const parts = stored.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 4) throw new Error('Malformed encrypted value');
  const [keyId, wrapped, iv, sealed] = parts as [string, string, string, string];
  const dataKey = keys.unwrap(keyId, unb64(wrapped));
  try {
    return open(dataKey, unb64(iv), unb64(sealed)).toString('utf8');
  } finally {
    dataKey.fill(0);
  }
}

/**
 * Master keys held locally, e.g. from an environment variable. For development and tests, and
 * as a fallback; production uses a cloud KMS provider (issue #10).
 *
 * `keyring` format: "id:base64key,id:base64key". The first key encrypts new values; the
 * others only decrypt existing ones (keep old keys until every value is re-encrypted).
 */
export class LocalKeyProvider implements KeyProvider {
  readonly currentKeyId: string;
  private readonly keys: Map<string, Buffer>;

  constructor(keyring: string) {
    const entries = keyring
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf(':');
        if (separator <= 0) throw new Error('Each key must be written as id:base64key');
        const id = entry.slice(0, separator);
        if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Invalid key id "${id}"`);
        const key = Buffer.from(entry.slice(separator + 1), 'base64');
        if (key.length !== 32) throw new Error(`Key "${id}" must be 32 bytes (base64-encoded)`);
        return [id, key] as const;
      });
    if (entries.length === 0) throw new Error('At least one encryption key is required');
    this.keys = new Map(entries);
    if (this.keys.size !== entries.length) throw new Error('Key ids must be unique');
    this.currentKeyId = entries[0]![0];
  }

  wrap(dataKey: Buffer): { keyId: string; wrapped: Buffer } {
    const { iv, sealed } = seal(this.keys.get(this.currentKeyId)!, dataKey);
    return { keyId: this.currentKeyId, wrapped: Buffer.concat([iv, sealed]) };
  }

  unwrap(keyId: string, wrapped: Buffer): Buffer {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`Unknown encryption key "${keyId}"`);
    return open(key, wrapped.subarray(0, 12), wrapped.subarray(12));
  }
}

/** Generate a new master key entry for DATA_ENCRYPTION_KEYS. */
export function generateKeyEntry(id: string): string {
  return `${id}:${randomBytes(32).toString('base64')}`;
}
