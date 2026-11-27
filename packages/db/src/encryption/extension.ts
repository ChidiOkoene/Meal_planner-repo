import { Prisma } from '../generated/prisma/client.js';
import { decryptValue, encryptValue, isEncrypted, type KeyProvider } from './envelope.js';

/** Which string fields of which models are encrypted, e.g. { HealthProfile: ['medicationsText'] }. */
export type EncryptedFields = Partial<Record<Prisma.ModelName, string[]>>;

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
]);
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

/**
 * Prisma client extension: encrypts configured fields on write and decrypts them on read.
 *
 * Limits, enforced or documented:
 * - Filtering or sorting on an encrypted field is refused (it would silently never match).
 * - Writes must target the model directly. Nested writes from another model (e.g. creating a
 *   health profile inside recipient.create) are not encrypted, so the API's write paths for
 *   encrypted models must use that model's own client methods.
 * - Any value in a result that carries the encrypted prefix is decrypted, including values
 *   loaded through `include`.
 */
export function fieldEncryption(fields: EncryptedFields, keys: KeyProvider) {
  return Prisma.defineExtension({
    name: 'field-encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const encrypted = new Set(fields[model] ?? []);
          if (encrypted.size > 0) {
            const a = args as Record<string, unknown>;
            if (WHERE_OPERATIONS.has(operation)) {
              for (const key of ['where', 'orderBy', 'cursor', 'by', 'distinct']) {
                const used = findField(a[key], encrypted);
                if (used) {
                  throw new Error(`${model}.${used} is encrypted and cannot be used in "${key}"`);
                }
              }
            }
            if (WRITE_OPERATIONS.has(operation)) {
              if (operation === 'upsert') {
                a.create = encryptData(a.create, encrypted, keys);
                a.update = encryptData(a.update, encrypted, keys);
              } else {
                a.data = Array.isArray(a.data)
                  ? a.data.map((row) => encryptData(row, encrypted, keys))
                  : encryptData(a.data, encrypted, keys);
              }
            }
          }
          return decryptResult(await query(args), keys);
        },
      },
    },
  });
}

function encryptData(data: unknown, encrypted: Set<string>, keys: KeyProvider): unknown {
  if (!data || typeof data !== 'object') return data;
  const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of encrypted) {
    let value = copy[field];
    if (value && typeof value === 'object' && 'set' in value) value = value.set;
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') throw new Error(`Encrypted field "${field}" must be a string`);
    copy[field] = isEncrypted(value) ? value : encryptValue(value, keys);
  }
  return copy;
}

function decryptResult(value: unknown, keys: KeyProvider): unknown {
  if (isEncrypted(value)) return decryptValue(value, keys);
  if (Array.isArray(value)) return value.map((item) => decryptResult(item, keys));
  if (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value) &&
    !Prisma.Decimal.isDecimal(value)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = decryptResult(v, keys);
    return out;
  }
  return value;
}

/** First encrypted field referenced anywhere in a where/orderBy/... argument. */
function findField(value: unknown, encrypted: Set<string>): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found =
        typeof item === 'string' && encrypted.has(item) ? item : findField(item, encrypted);
      if (found) return found;
    }
    return null;
  }
  for (const [key, inner] of Object.entries(value)) {
    if (encrypted.has(key)) return key;
    if (['AND', 'OR', 'NOT'].includes(key)) {
      const found = findField(inner, encrypted);
      if (found) return found;
    }
  }
  return null;
}
