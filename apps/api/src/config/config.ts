import { LocalKeyProvider } from '@dyjext/db';
import { z } from 'zod';

const listOfOrigins = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

/** An optional setting; an empty value (e.g. `KEY=` copied from .env.example) counts as unset. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** Every environment variable the API reads, validated once at startup. */
export const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    /** Comma-separated browser origins allowed to call the API, e.g. the web app URL. */
    CORS_ORIGINS: listOfOrigins,
    /** Requests allowed per client IP per minute. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
    /** Release identifier (git sha or tag); reported by /v1/meta and error tracking. */
    APP_VERSION: z.string().default('0.0.0-dev'),
    /**
     * Master keys for encrypting health data: "id:base64key,…", newest first
     * (see packages/db/src/encryption). Required in production.
     */
    DATA_ENCRYPTION_KEYS: optional(z.string()),
    /** Clerk backend secret key (sign-in). Required in production. */
    CLERK_SECRET_KEY: optional(z.string().startsWith('sk_')),
    /** Clerk PEM public key, for verifying tokens without a network call. Optional. */
    CLERK_JWT_KEY: optional(z.string()).transform((v) => v?.replace(/\\n/g, '\n')),
    /** Web origins allowed to have issued a session token. Defaults to CORS_ORIGINS. */
    AUTH_AUTHORIZED_PARTIES: listOfOrigins,
    /** Public URL of the web app, for links in emails (e.g. staff invitations). */
    WEB_URL: z.string().url().default('http://localhost:3000'),
  })
  .transform((c) => ({
    ...c,
    AUTH_AUTHORIZED_PARTIES:
      c.AUTH_AUTHORIZED_PARTIES.length > 0 ? c.AUTH_AUTHORIZED_PARTIES : c.CORS_ORIGINS,
  }))
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production' && !c.CLERK_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLERK_SECRET_KEY'],
        message: 'Required in production',
      });
    }
    if (!c.DATA_ENCRYPTION_KEYS) {
      if (c.NODE_ENV === 'production') {
        ctx.addIssue({
          code: 'custom',
          path: ['DATA_ENCRYPTION_KEYS'],
          message: 'Required in production',
        });
      }
      return;
    }
    // Fail at startup, not on the first encrypted read, if a key is malformed.
    try {
      new LocalKeyProvider(c.DATA_ENCRYPTION_KEYS);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATA_ENCRYPTION_KEYS'],
        message: (error as Error).message,
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

/** Injection token for the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Validate environment variables. Throws one readable error listing every problem,
 * so a misconfigured deployment fails at startup instead of on the first request.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  return result.data;
}
