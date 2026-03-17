// Shared types for the recipe viewer.
// IMPORTANT: These are duplicated in connector/parse-mela.ts because
// hybrid modules cannot share code between connector and visualization.

export interface ProcessedRecipe {
  id: string;
  status: 'processing' | 'ready' | 'error';
  title: string;
  image: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  notes: string;
  groups: ProcessedGroup[];
  error?: string;
}

export interface ProcessedGroup {
  name: string;
  ingredients: ProcessedIngredient[];
  steps: ProcessedStep[];
}

export interface ProcessedIngredient {
  id: string;
  text: string;
  isReference: boolean;
  referencesGroup?: string;
}

export interface ProcessedStep {
  text: string;
  linkedIngredientIds: string[];
  timers: ProcessedTimer[];
  temperature: string | null;
  equipment: string[];
  technique: string | null;
  goodToKnow: string | null;
}

export interface ProcessedTimer {
  label: string;
  durationSeconds: number;
  maxDurationSeconds?: number;
}

/** Emitted data shape from connector */
export interface RecipeViewerData {
  recipes: Record<string, ProcessedRecipe>;
}

/** Per-recipe UI state managed in the visualization */
export type RecipePhase = 'waiting' | 'gathering' | 'cooking' | 'done';

export interface RecipeUIState {
  phase: RecipePhase;
  currentGroupIndex: number;
  currentStepIndex: number;
  gatherCursorIndex: number;
  gatheredIngredientIds: Set<string>;
  usedIngredientIds: Set<string>;
}
