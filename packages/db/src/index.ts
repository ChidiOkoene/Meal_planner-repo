// Database access for every app and package. See docs/ARCHITECTURE.md §7.
export { createPrismaClient, type CreatePrismaClientOptions } from './client.js';
// Generated Prisma client: PrismaClient, Prisma namespace, enums and model types.
export * from './generated/prisma/client.js';
// Catalogue import from CSV (issue #12). Also used by the seed.
export * from './catalogue-import/index.js';
