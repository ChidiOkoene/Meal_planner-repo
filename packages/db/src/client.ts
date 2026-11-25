import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  /** PostgreSQL connection string. Defaults to the DATABASE_URL environment variable. */
  connectionString?: string;
}

/**
 * Create a Prisma client connected through the `pg` driver adapter (required by Prisma 7).
 * Create one per process and reuse it; call `$disconnect()` on shutdown.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env or set it in the environment.',
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
