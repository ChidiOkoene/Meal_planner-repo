import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../client.js';
import { type PrismaClient } from '../generated/prisma/client.js';
import {
  decryptValue,
  encryptValue,
  generateKeyEntry,
  isEncrypted,
  LocalKeyProvider,
} from './envelope.js';
import { fieldEncryption } from './extension.js';

const keyA = generateKeyEntry('2026a');
const keyB = generateKeyEntry('2026b');

describe('envelope encryption', () => {
  const keys = new LocalKeyProvider(keyA);

  it('round-trips text, including non-ASCII', () => {
    const secret = 'Metformin 500 mg twice daily · ọ̀gbẹ́ni';
    const stored = encryptValue(secret, keys);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('Metformin');
    expect(decryptValue(stored, keys)).toBe(secret);
  });

  it('gives a different ciphertext every time', () => {
    expect(encryptValue('same', keys)).not.toBe(encryptValue('same', keys));
  });

  it('detects tampering', () => {
    const stored = encryptValue('blood pressure 150/95', keys);
    const parts = stored.split(':');
    const sealed = Buffer.from(parts.at(-1)!, 'base64url');
    sealed[0] = sealed[0]! ^ 1;
    parts[parts.length - 1] = sealed.toString('base64url');
    expect(() => decryptValue(parts.join(':'), keys)).toThrow();
  });

  it('supports key rotation: new values use the first key, old ones still decrypt', () => {
    const oldValue = encryptValue('written before rotation', new LocalKeyProvider(keyA));
    const rotated = new LocalKeyProvider(`${keyB},${keyA}`);
    expect(decryptValue(oldValue, rotated)).toBe('written before rotation');
    expect(encryptValue('new', rotated)).toMatch(/^enc:v1:2026b:/);
  });

  it('refuses to decrypt without the right key', () => {
    const stored = encryptValue('x', new LocalKeyProvider(keyA));
    expect(() => decryptValue(stored, new LocalKeyProvider(keyB))).toThrow(
      /Unknown encryption key "2026a"/,
    );
  });

  it('rejects malformed key configuration', () => {
    expect(() => new LocalKeyProvider('')).toThrow(/At least one/);
    expect(() => new LocalKeyProvider('k1:dG9vLXNob3J0')).toThrow(/32 bytes/);
    expect(() => new LocalKeyProvider(`${keyA},${keyA}`)).toThrow(/unique/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('fieldEncryption extension', () => {
  // Address.line1 stands in for a health field (health profiles arrive in issue #19).
  const keys = new LocalKeyProvider(keyA);
  let base: PrismaClient;
  let db: ReturnType<typeof extend>;
  const city = `Test-${randomUUID().slice(0, 8)}`;
  const extend = (client: PrismaClient) =>
    client.$extends(fieldEncryption({ Address: ['line1', 'landmark'] }, keys));

  beforeAll(() => {
    base = createPrismaClient();
    db = extend(base);
  });

  afterAll(async () => {
    await base.address.deleteMany({ where: { city } });
    await base.$disconnect();
  });

  it('stores ciphertext and returns plaintext', async () => {
    const created = await db.address.create({
      data: { line1: '12 Example Street', city, countryCode: 'NG', landmark: 'Blue gate' },
    });
    expect(created.line1).toBe('12 Example Street');

    const raw = await base.$queryRaw<{ line1: string; landmark: string; city: string }[]>`
      SELECT line1, landmark, city FROM addresses WHERE id = ${created.id}::uuid`;
    expect(isEncrypted(raw[0]!.line1)).toBe(true);
    expect(isEncrypted(raw[0]!.landmark)).toBe(true);
    expect(raw[0]!.city).toBe(city); // fields not configured stay plain

    const read = await db.address.findUniqueOrThrow({ where: { id: created.id } });
    expect(read).toMatchObject({ line1: '12 Example Street', landmark: 'Blue gate' });
  });

  it('encrypts updates, upserts and createMany', async () => {
    const row = await db.address.create({ data: { line1: 'a', city, countryCode: 'NG' } });
    await db.address.update({ where: { id: row.id }, data: { line1: { set: 'b' } } });
    await db.address.upsert({
      where: { id: row.id },
      create: { line1: 'x', city, countryCode: 'NG' },
      update: { landmark: 'c' },
    });
    await db.address.createMany({ data: [{ line1: 'd', city, countryCode: 'NG' }] });

    const raw = await base.address.findMany({ where: { city } });
    expect(raw.every((a) => isEncrypted(a.line1))).toBe(true);
    const read = await db.address.findMany({ where: { city }, orderBy: { createdAt: 'asc' } });
    expect(read.map((a) => a.line1)).toEqual(expect.arrayContaining(['b', 'd']));
    expect(read.find((a) => a.id === row.id)?.landmark).toBe('c');
  });

  it('refuses to filter or sort on an encrypted field', async () => {
    await expect(db.address.findFirst({ where: { line1: '12 Example Street' } })).rejects.toThrow(
      /encrypted/,
    );
    await expect(db.address.findMany({ where: { OR: [{ landmark: 'x' }] } })).rejects.toThrow(
      /encrypted/,
    );
    await expect(db.address.findMany({ orderBy: { line1: 'asc' } })).rejects.toThrow(/encrypted/);
  });
});
