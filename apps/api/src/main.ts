import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.factory.js';
import { loadConfig } from './config/config.js';

// Local development reads the repository-root .env. Real environments set variables directly,
// and variables that are already set always win.
loadDotenv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen({ port: config.API_PORT, host: config.API_HOST });
}

bootstrap().catch((error: unknown) => {
  // The logger may not exist yet (e.g. invalid configuration), so write directly to stderr.
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
