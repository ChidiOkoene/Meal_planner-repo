// Import a catalogue folder of CSV files.
// Usage (from the repository root):
//   pnpm catalogue:import <folder> [--dry-run]
import { resolve } from 'node:path';
import { createPrismaClient } from '../src/client.js';
import { formatImportReport, importCatalogue } from '../src/catalogue-import/index.js';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dryRun = args.includes('--dry-run');
const folder = args.find((a) => !a.startsWith('--'));
if (!folder) {
  console.error('Usage: pnpm catalogue:import <folder> [--dry-run]');
  process.exit(2);
}

// pnpm runs package scripts from the package folder; resolve paths from where the user ran it.
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), folder);
const prisma = createPrismaClient();
try {
  const result = await importCatalogue(prisma, dir, { dryRun });
  console.log(formatImportReport(result));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
