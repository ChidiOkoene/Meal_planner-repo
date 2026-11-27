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

  it('lists every problem in one error', () => {
    expect(() => loadConfig({ API_PORT: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL|REDIS_URL[\s\S]*DATABASE_URL/,
    );
  });
});
