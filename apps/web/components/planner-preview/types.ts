import type { PlanExplanation, PlannerResult, PlannerTargets, Problem } from '@dyjext/planner';

/** Response of POST /v1/ops/planner/preview (mirrors the API's PlannerPreviewResponse). */
export interface PlannerPreviewResponse {
  preset: { id: string; label: string; description: string; targets: PlannerTargets };
  plan: PlannerResult;
  validation: { status: 'ok' | 'warnings' | 'failed'; problems: Problem[] };
  explanation: PlanExplanation;
  catalogue: { dishes: number; verified: number };
}

export interface PlannerPresetSummary {
  id: string;
  label: string;
  description: string;
  softTextureOnly: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
}
