'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DayCard } from './day-card';
import { ResultStatus } from './result-status';
import type { Ingredient, PlannerPresetSummary, PlannerPreviewResponse } from './types';

interface Settings {
  presetId: string;
  softTextureOnly: boolean;
  cooking: 'self' | 'helper';
  excludedIngredientIds: string[];
  seed: string;
}

const DEFAULT_SETTINGS: Settings = {
  presetId: 'diabetes_hypertension',
  softTextureOnly: false,
  cooking: 'helper',
  excludedIngredientIds: [],
  seed: 'week-1',
};

const CATEGORY_LABELS: Record<string, string> = {
  staple: 'Staples',
  legume: 'Beans',
  protein: 'Meat, fish and eggs',
  vegetable: 'Vegetables',
  fruit: 'Fruit',
  oil: 'Oils',
  seasoning: 'Seasoning',
  dairy: 'Dairy',
  nut_seed: 'Nuts and seeds',
  beverage: 'Drinks',
};

export function PlannerPreview() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const presets = useQuery({
    queryKey: ['planner-presets'],
    queryFn: () => api<PlannerPresetSummary[]>('/v1/ops/planner/presets'),
  });
  const ingredients = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api<Ingredient[]>('/v1/ops/ingredients'),
  });
  const preview = useMutation({
    mutationFn: (s: Settings) =>
      api<PlannerPreviewResponse>('/v1/ops/planner/preview', {
        method: 'POST',
        body: JSON.stringify(s),
      }),
  });

  // Generate a first plan as soon as the page opens.
  const { mutate } = preview;
  useEffect(() => {
    mutate(DEFAULT_SETTINGS);
  }, [mutate]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Ingredient[]>();
    for (const ingredient of ingredients.data ?? []) {
      groups.set(ingredient.category, [...(groups.get(ingredient.category) ?? []), ingredient]);
    }
    return [...groups.entries()];
  }, [ingredients.data]);

  const selectedPreset = presets.data?.find((p) => p.id === settings.presetId);
  const update = (changes: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...changes }));

  function generate(event?: FormEvent) {
    event?.preventDefault();
    preview.mutate(settings);
  }

  function anotherWeek() {
    const next = { ...settings, seed: `week-${Math.floor(Math.random() * 100_000)}` };
    setSettings(next);
    preview.mutate(next);
  }

  function toggleIngredient(id: string, excluded: boolean) {
    update({
      excludedIngredientIds: excluded
        ? [...settings.excludedIngredientIds, id]
        : settings.excludedIngredientIds.filter((x) => x !== id),
    });
  }

  const result = preview.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <form
        onSubmit={generate}
        className="space-y-5 self-start rounded-lg border border-border bg-surface p-4"
      >
        <div>
          <label htmlFor="preset" className="block text-sm font-semibold">
            Example parent
          </label>
          <select
            id="preset"
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
            value={settings.presetId}
            onChange={(e) => update({ presetId: e.target.value })}
          >
            {(presets.data ?? []).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          {selectedPreset ? (
            <p className="mt-1 text-xs text-text-muted">{selectedPreset.description}</p>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Needs</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.softTextureOnly || selectedPreset?.softTextureOnly === true}
              disabled={selectedPreset?.softTextureOnly === true}
              onChange={(e) => update({ softTextureOnly: e.target.checked })}
            />
            Soft dishes only (chewing difficulty)
          </label>
          <label htmlFor="cooking" className="mt-3 block text-sm">
            Who cooks
          </label>
          <select
            id="cooking"
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
            value={settings.cooking}
            onChange={(e) => update({ cooking: e.target.value as Settings['cooking'] })}
          >
            <option value="helper">A helper or family member</option>
            <option value="self">The parent cooks for themself</option>
          </select>
        </fieldset>

        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Foods to avoid
            {settings.excludedIngredientIds.length > 0 ? (
              <span className="ml-1 font-normal text-text-muted">
                ({settings.excludedIngredientIds.length})
              </span>
            ) : null}
          </summary>
          <p className="mt-1 text-xs text-text-muted">Allergies, religious rules or dislikes.</p>
          <div className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
            {byCategory.map(([category, items]) => (
              <fieldset key={category}>
                <legend className="text-xs font-semibold text-text-muted">
                  {CATEGORY_LABELS[category] ?? category}
                </legend>
                {items.map((ingredient) => (
                  <label key={ingredient.id} className="mt-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.excludedIngredientIds.includes(ingredient.id)}
                      onChange={(e) => toggleIngredient(ingredient.id, e.target.checked)}
                    />
                    {ingredient.name}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>

        <div>
          <label htmlFor="seed" className="block text-sm font-semibold">
            Week seed
          </label>
          <input
            id="seed"
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
            value={settings.seed}
            maxLength={40}
            onChange={(e) => update({ seed: e.target.value })}
          />
          <p className="mt-1 text-xs text-text-muted">
            Same seed and settings always give the same plan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={preview.isPending || !settings.seed.trim()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast disabled:opacity-60"
          >
            {preview.isPending ? 'Planning…' : 'Generate plan'}
          </button>
          <button
            type="button"
            onClick={anotherWeek}
            disabled={preview.isPending}
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            Try another week
          </button>
        </div>
      </form>

      <div className="min-w-0 space-y-4">
        {preview.isError ? (
          <p role="alert" className="rounded-lg border border-bad bg-bad-bg p-4 text-sm">
            Could not generate a plan: {preview.error.message}. Is the API running on port 4000?
          </p>
        ) : null}
        {!result && preview.isPending ? (
          <p className="text-sm text-text-muted">Planning the week…</p>
        ) : null}
        {result ? (
          <>
            <ResultStatus result={result} />
            <section aria-label="Plan summary" className="text-sm text-text-muted">
              <ul className="space-y-0.5">
                {result.explanation.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li>
                  Engine {result.plan.engineVersion}, seed “{result.plan.seed}”. Catalogue:{' '}
                  {result.catalogue.dishes} dishes, {result.catalogue.verified} dietitian-verified.
                </li>
              </ul>
            </section>
            {result.plan.status === 'ok' ? (
              <section aria-label="Week plan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.plan.days.map((day, index) => (
                  <DayCard key={day.date} day={day} explanation={result.explanation.days[index]} />
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
