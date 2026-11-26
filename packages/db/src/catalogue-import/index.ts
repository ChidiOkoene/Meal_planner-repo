import { type PrismaClient } from '../generated/prisma/client.js';
import { applyCatalogue, type ImportSummary } from './apply.js';
import { type ImportProblem, readCatalogue } from './validate.js';

export { CATALOGUE_FILES } from './schemas.js';
export { readCatalogue, type CatalogueData, type ImportProblem } from './validate.js';
export { applyCatalogue, type ImportSummary } from './apply.js';

export type ImportResult =
  | { ok: false; problems: ImportProblem[] }
  | { ok: true; problems: ImportProblem[]; summary: ImportSummary };

/** Validate a catalogue folder and, if it has no errors, import it (or dry-run it). */
export async function importCatalogue(
  prisma: PrismaClient,
  dir: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const { data, problems } = readCatalogue(dir);
  if (problems.some((p) => p.severity === 'error')) return { ok: false, problems };
  const summary = await applyCatalogue(prisma, data, options);
  return { ok: true, problems: [...problems, ...summary.warnings], summary };
}

/** Human-readable report of an import, for the command line. */
export function formatImportReport(result: ImportResult): string {
  const lines: string[] = [];
  const errors = result.problems.filter((p) => p.severity === 'error');
  const warnings = result.problems.filter((p) => p.severity === 'warning');
  const where = (p: ImportProblem) => `${p.file}${p.line ? `:${p.line}` : ''}`;

  if (errors.length > 0) {
    lines.push(`${errors.length} error(s). Nothing was imported.`, '');
    for (const p of errors) lines.push(`  ✗ ${where(p)}  ${p.message}`);
  }
  if (warnings.length > 0) {
    lines.push('', `${warnings.length} warning(s):`, '');
    for (const p of warnings) lines.push(`  ! ${where(p)}  ${p.message}`);
  }
  if (result.ok) {
    const s = result.summary;
    const row = (label: string, c: { created: number; updated: number; unchanged: number }) =>
      `  ${label.padEnd(12)} ${c.created} new, ${c.updated} updated, ${c.unchanged} unchanged`;
    lines.push(
      '',
      s.dryRun ? 'Dry run: nothing was saved. This is what an import would do:' : 'Imported:',
      row('Ingredients', s.ingredients),
      row('Units', s.units),
      row('Tags', s.tags),
      `${row('Dishes', s.dishes)}, ${s.dishes.newVersions} new draft version(s) of verified dishes, ${s.dishes.skippedRetired} retired skipped`,
    );
  }
  return lines.join('\n').trim();
}
