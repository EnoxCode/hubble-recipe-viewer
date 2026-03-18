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

/** Navigation phase for a recipe */
export type RecipePhase = 'waiting' | 'gathering' | 'cooking' | 'done';

/** Per-recipe navigation state managed by the connector */
export interface RecipeNavState {
  phase: RecipePhase;
  currentGroupIndex: number;
  currentStepIndex: number;
  gatherCursorIndex: number;
  gatheredIngredientIds: string[];
  usedIngredientIds: string[];
}

/** Navigation state included in connector-emitted data */
export interface NavigationState {
  activeRecipeId: string;
  recipes: Record<string, RecipeNavState>;
  pendingTimer: ProcessedTimer | null;
}

/** Emitted data shape from connector */
export interface RecipeViewerData {
  recipes: Record<string, ProcessedRecipe>;
  navigation: NavigationState;
}
