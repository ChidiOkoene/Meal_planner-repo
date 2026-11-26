import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../client.js';
import { type PrismaClient } from '../generated/prisma/client.js';
import { formatImportReport, importCatalogue, readCatalogue } from './index.js';

const SAMPLE = fileURLToPath(new URL('../../prisma/seed-data/catalogue', import.meta.url));

const HEADERS = {
  'ingredients.csv':
    'name,aliases,category,pantry_staple,perishability_days,energy_kcal,protein_g,carbs_g,fat_g,fibre_g,sodium_mg,potassium_mg,glycaemic_index,source,source_reference,confidence',
  'dishes.csv':
    'name,aliases,cuisine,description,meal_types,dish_type,pairs_with,serving_unit,prep_minutes,cook_minutes,batch_cookable,keeps_days,texture,tags',
  'dish_ingredients.csv': 'dish,ingredient,grams_per_serving,optional,preparation',
  'units.csv': 'ingredient,unit,kind,grams,grams_p10,grams_p90,notes',
  'recipes.csv': 'dish,language,difficulty,equipment,steps',
  'tags.csv': 'slug,label',
} as const;

type Files = Partial<Record<keyof typeof HEADERS, string[]>>;

const dirs: string[] = [];
/** Write a catalogue folder; each file gets its header plus the given rows. */
function catalogue(files: Files): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
  dirs.push(dir);
  for (const [file, rows] of Object.entries(files)) {
    writeFileSync(join(dir, file), [HEADERS[file as keyof typeof HEADERS], ...rows].join('\n'));
  }
  return dir;
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('validation (no database)', () => {
  it('accepts the sample catalogue with warnings only', () => {
    const { problems } = readCatalogue(SAMPLE);
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(problems.some((p) => p.message.includes('estimated nutrients'))).toBe(true);
  });

  it('reports missing files and columns', () => {
    const missing = readCatalogue(catalogue({ 'ingredients.csv': [] }));
    expect(missing.problems.map((p) => `${p.file}: ${p.message}`)).toEqual(
      expect.arrayContaining([
        'dishes.csv: File is missing',
        'dish_ingredients.csv: File is missing',
      ]),
    );

    const dir = catalogue({ 'dishes.csv': [], 'dish_ingredients.csv': [] });
    writeFileSync(join(dir, 'ingredients.csv'), 'name,category\nYam,staple');
    expect(readCatalogue(dir).problems[0]?.message).toMatch(/^Missing columns: aliases/);
  });

  it('reports bad values and broken references with file and line', () => {
    const { problems } = readCatalogue(
      catalogue({
        'ingredients.csv': [
          'Yam,,staple,no,30,118,1.5,28,0.2,4.1,9,,,estimate,,medium',
          'Rice,,grain,no,,360,6.7,80,0.6,1.3,5,,,estimate,,medium',
          'yam,,staple,no,30,118,1.5,28,0.2,4.1,9,,,estimate,,medium',
        ],
        'dishes.csv': [
          'Pounded yam,,nigerian,,lunch; dinner,swallow,soup,wrap,10,25,no,,soft,',
          'Mystery,,nigerian,,brunch,main,,plate,0,0,no,,regular,spicy',
        ],
        'dish_ingredients.csv': [
          'Pounded yam,Yam,180,no,',
          'Pounded yam,Cassava,50,no,',
          'Ghost dish,Yam,10,no,',
        ],
      }),
    );
    const found = problems
      .filter((p) => p.severity === 'error')
      .map((p) => `${p.file}:${p.line} ${p.message}`);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ingredients\.csv:3 category:/),
        'ingredients.csv:4 Duplicate of line 2: "yam"',
        expect.stringMatching(/^dishes\.csv:3 meal_types/),
        'dish_ingredients.csv:3 Unknown ingredient "Cassava"',
        'dish_ingredients.csv:4 Unknown dish "Ghost dish"',
      ]),
    );
  });

  it('warns when energy does not match protein, carbs and fat', () => {
    const { problems } = readCatalogue(
      catalogue({
        'ingredients.csv': ['Odd flour,,staple,no,,100,10,70,5,2,5,,,lab_analysis,,high'],
        'dishes.csv': [],
        'dish_ingredients.csv': [],
      }),
    );
    expect(problems).toContainEqual(expect.objectContaining({ severity: 'warning', line: 2 }));
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('import (database)', () => {
  let prisma: PrismaClient;
  // Unique names, so this never touches the sample catalogue other tests rely on.
  const p = `T${randomUUID().slice(0, 6)}`;
  const tag = `test-${p.toLowerCase()}`;
  const ingredients = [
    `${p} yam,,staple,no,30,118,1.5,28,0.2,4.1,9,816,54,lab_analysis,Test lab 1,high`,
    `${p} egg,,protein,no,21,143,12.6,0.7,9.5,0,142,138,,lab_analysis,Test lab 2,high`,
  ];
  const dish = [
    `${p} yam and egg,,nigerian,Test dish,breakfast,main,,plate,5,20,no,,regular,${tag}`,
  ];
  const dishIngredients = (grams: number) => [
    `${p} yam and egg,${p} yam,${grams},no,`,
    `${p} yam and egg,${p} egg,50,no,boiled`,
  ];
  const files = (grams: number): Files => ({
    'ingredients.csv': ingredients,
    'dishes.csv': dish,
    'dish_ingredients.csv': dishIngredients(grams),
    'units.csv': [`${p} yam,tuber,purchase,2000,1500,3000,`],
    'tags.csv': [`${tag},Test tag`],
    'recipes.csv': [`${p} yam and egg,en,easy,,"1. Boil.\n2. Serve."`],
  });
  const versions = () =>
    prisma.dish.findMany({
      where: { name: `${p} yam and egg` },
      orderBy: { version: 'asc' },
      include: { ingredients: true },
    });

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    await prisma.dish.deleteMany({ where: { name: { startsWith: p } } });
    await prisma.ingredient.deleteMany({ where: { name: { startsWith: p } } });
    await prisma.tag.deleteMany({ where: { slug: tag } });
    await prisma.$disconnect();
  });

  it('changes nothing in a dry run', async () => {
    const result = await importCatalogue(prisma, catalogue(files(150)), { dryRun: true });
    expect(result.ok && result.summary.dishes.created).toBe(1);
    expect(await versions()).toEqual([]);
    expect(await prisma.ingredient.count({ where: { name: { startsWith: p } } })).toBe(0);
  });

  it('imports, then changes nothing when run again', async () => {
    const dir = catalogue(files(150));
    const first = await importCatalogue(prisma, dir);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.summary).toMatchObject({
      ingredients: { created: 2 },
      units: { created: 1 },
      tags: { created: 1 },
      dishes: { created: 1 },
    });
    const [dishRow] = await versions();
    expect(dishRow).toMatchObject({ version: 1, verificationStatus: 'draft' });
    expect(dishRow!.familyId).toBe(dishRow!.id);

    const second = await importCatalogue(prisma, dir);
    expect(second.ok && second.summary).toMatchObject({
      ingredients: { created: 0, updated: 0, unchanged: 2 },
      units: { unchanged: 1 },
      dishes: { created: 0, updated: 0, unchanged: 1, newVersions: 0 },
    });
  });

  it('updates a draft dish in place', async () => {
    const result = await importCatalogue(prisma, catalogue(files(120)));
    expect(result.ok && result.summary.dishes.updated).toBe(1);
    const all = await versions();
    expect(all).toHaveLength(1);
    expect(all[0]!.ingredients.find((i) => i.gramsPerServing === 120)).toBeDefined();
  });

  it('saves a change to a verified dish as a new draft version and leaves the verified one alone', async () => {
    const [v1] = await versions();
    await prisma.dish.update({
      where: { id: v1!.id },
      data: { verificationStatus: 'dietitian_verified' },
    });

    const result = await importCatalogue(prisma, catalogue(files(100)));
    expect(result.ok && result.summary.dishes.newVersions).toBe(1);
    const all = await versions();
    expect(all.map((d) => [d.version, d.verificationStatus])).toEqual([
      [1, 'dietitian_verified'],
      [2, 'draft'],
    ]);
    expect(all[0]!.ingredients.some((i) => i.gramsPerServing === 120)).toBe(true);
    expect(all[1]!.ingredients.some((i) => i.gramsPerServing === 100)).toBe(true);
  });

  it('never changes a retired dish', async () => {
    const all = await versions();
    await prisma.dish.update({
      where: { id: all.at(-1)!.id },
      data: { verificationStatus: 'retired' },
    });
    const result = await importCatalogue(prisma, catalogue(files(90)));
    expect(result.ok && result.summary.dishes.skippedRetired).toBe(1);
    expect(formatImportReport(result)).toMatch(/is retired, so its changes were not imported/);
    expect(await versions()).toHaveLength(2);
  });

  it('imports nothing when any row has an error', async () => {
    const bad = files(80);
    bad['dish_ingredients.csv'] = [
      ...bad['dish_ingredients.csv']!,
      `${p} yam and egg,${p} cassava,10,no,`,
    ];
    const result = await importCatalogue(prisma, catalogue(bad));
    expect(result.ok).toBe(false);
    expect(formatImportReport(result)).toMatch(/Nothing was imported/);
  });
});
