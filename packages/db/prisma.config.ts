// Prisma CLI configuration (Prisma 7). The CLI does not read .env files itself,
// so load the repository-root .env here. Variables already set (e.g. in CI) win.
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not every command needs a database (e.g. `prisma generate`), so don't fail when unset.
    url: process.env.DATABASE_URL ?? '',
    // Empty scratch database used by `migrate diff` / `migrate dev` to replay migrations.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
