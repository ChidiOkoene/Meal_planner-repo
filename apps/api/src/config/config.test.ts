import { generateKeyEntry } from '@dyjext/db';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const required = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(required);
    expect(config).toMatchObject({ NODE_ENV: 'development', API_PORT: 4000, CORS_ORIGINS: [] });
  });

  it('splits CORS origins', () => {
    const config = loadConfig({ ...required, CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('requires valid encryption keys in production', () => {
    expect(() => loadConfig({ ...required, NODE_ENV: 'production' })).toThrow(
      /DATA_ENCRYPTION_KEYS: Required in production/,
    );
    expect(() => loadConfig({ ...required, DATA_ENCRYPTION_KEYS: 'k1:short' })).toThrow(/32 bytes/);
    const config = loadConfig({
      ...required,
      NODE_ENV: 'production',
      DATA_ENCRYPTION_KEYS: generateKeyEntry('k1'),
      CLERK_SECRET_KEY: 'sk_live_example',
    });
    expect(config.NODE_ENV).toBe('production');
  });

  it('requires the sign-in secret key in production and derives authorized parties', () => {
    expect(() =>
      loadConfig({
        ...required,
        NODE_ENV: 'production',
        DATA_ENCRYPTION_KEYS: generateKeyEntry('k1'),
      }),
    ).toThrow(/CLERK_SECRET_KEY: Required in production/);
    expect(
      loadConfig({ ...required, CORS_ORIGINS: 'http://a.test' }).AUTH_AUTHORIZED_PARTIES,
    ).toEqual(['http://a.test']);
    expect(loadConfig({ ...required, CLERK_JWT_KEY: 'line1\\nline2' }).CLERK_JWT_KEY).toBe(
      'line1\nline2',
    );
  });

  it('treats empty optional settings as unset (as copied from .env.example)', () => {
    const config = loadConfig({
      ...required,
      CLERK_SECRET_KEY: '',
      CLERK_JWT_KEY: '',
      DATA_ENCRYPTION_KEYS: '',
    });
    expect(config).toMatchObject({
      CLERK_SECRET_KEY: undefined,
      CLERK_JWT_KEY: undefined,
      DATA_ENCRYPTION_KEYS: undefined,
    });
  });

  it('never allows staff 2-step to be switched off in production', () => {
    expect(loadConfig(required).STAFF_REQUIRE_TWO_FACTOR).toBe(true);
    expect(
      loadConfig({ ...required, STAFF_REQUIRE_TWO_FACTOR: 'false' }).STAFF_REQUIRE_TWO_FACTOR,
    ).toBe(false);
    expect(() =>
      loadConfig({
        ...required,
        NODE_ENV: 'production',
        DATA_ENCRYPTION_KEYS: generateKeyEntry('k1'),
        CLERK_SECRET_KEY: 'sk_live_example',
        STAFF_REQUIRE_TWO_FACTOR: 'false',
      }),
    ).toThrow(/cannot be turned off in production/);
    expect(() => loadConfig({ ...required, STAFF_REQUIRE_TWO_FACTOR: 'no' })).toThrow(
      /STAFF_REQUIRE_TWO_FACTOR/,
    );
  });

  it('lists every problem in one error', () => {
    expect(() => loadConfig({ API_PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL|REDIS_URL[\s\S]*DATABASE_URL/,
    );
  });
});
