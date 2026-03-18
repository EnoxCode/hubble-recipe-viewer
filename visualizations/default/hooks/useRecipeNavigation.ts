import { useMemo } from 'react';
import type {
  RecipeViewerData,
  ProcessedRecipe,
  ProcessedIngredient,
  RecipePhase,
  RecipeNavState,
} from '../types';

const DEFAULT_NAV: RecipeNavState = {
  phase: 'waiting',
  currentGroupIndex: 0,
  currentStepIndex: 0,
  gatherCursorIndex: 0,
  gatheredIngredientIds: [],
  usedIngredientIds: [],
};

function getNonRefIngredients(recipe: ProcessedRecipe): ProcessedIngredient[] {
  const result: ProcessedIngredient[] = [];
  for (const group of recipe.groups) {
    for (const ing of group.ingredients) {
      if (!ing.isReference) result.push(ing);
    }
  }
  return result;
}

function getTotalSteps(recipe: ProcessedRecipe): number {
  let total = 0;
  for (const group of recipe.groups) total += group.steps.length;
  return total;
}

function getLinearStepIndex(recipe: ProcessedRecipe, groupIndex: number, stepIndex: number): number {
  let idx = 0;
  for (let g = 0; g < groupIndex && g < recipe.groups.length; g++) {
    idx += recipe.groups[g].steps.length;
  }
  return idx + stepIndex;
}

/** Read-only hook — derives display values from connector-managed navigation state. */
export function useRecipeNavigation(data: RecipeViewerData | null) {
  const navigation = data?.navigation;
  const activeRecipeId = navigation?.activeRecipeId ?? '';
  const recipeNav = navigation?.recipes[activeRecipeId] ?? DEFAULT_NAV;
  const activeRecipe = data?.recipes[activeRecipeId] ?? null;

  const gatheredIds = useMemo(
    () => new Set(recipeNav.gatheredIngredientIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipeNav.gatheredIngredientIds.join(',')],
  );

  const usedIds = useMemo(
    () => new Set(recipeNav.usedIngredientIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipeNav.usedIngredientIds.join(',')],
  );

  const activeIngredientIds = useMemo(() => {
    if (!activeRecipe || recipeNav.phase !== 'cooking') return [];
    const group = activeRecipe.groups[recipeNav.currentGroupIndex];
    if (!group) return [];
    const step = group.steps[recipeNav.currentStepIndex];
    return step?.linkedIngredientIds ?? [];
  }, [activeRecipe, recipeNav.phase, recipeNav.currentGroupIndex, recipeNav.currentStepIndex]);

  const allPhases = useMemo(() => {
    const result: Record<string, RecipePhase> = {};
    if (!navigation) return result;
    for (const [id, rs] of Object.entries(navigation.recipes)) {
      result[id] = rs.phase;
    }
    return result;
  }, [navigation]);

  const allStepProgress = useMemo(() => {
    const result: Record<string, { current: number; total: number }> = {};
    if (!data || !navigation) return result;
    for (const [id, rs] of Object.entries(navigation.recipes)) {
      const recipe = data.recipes[id];
      if (!recipe) continue;
      const total = getTotalSteps(recipe);
      const current = getLinearStepIndex(recipe, rs.currentGroupIndex, rs.currentStepIndex);
      result[id] = { current, total };
    }
    return result;
  }, [navigation, data]);

  const gatherCursorIngredientId = useMemo(() => {
    if (!activeRecipe || recipeNav.phase !== 'gathering') return null;
    const nonRef = getNonRefIngredients(activeRecipe);
    return nonRef[recipeNav.gatherCursorIndex]?.id ?? null;
  }, [activeRecipe, recipeNav.phase, recipeNav.gatherCursorIndex]);

  return {
    activeRecipeId,
    activeRecipe,
    phase: recipeNav.phase,
    currentGroupIndex: recipeNav.currentGroupIndex,
    currentStepIndex: recipeNav.currentStepIndex,
    gatherCursorIndex: recipeNav.gatherCursorIndex,
    gatherCursorIngredientId,
    gatheredIds,
    usedIds,
    activeIngredientIds,
    allPhases,
    allStepProgress,
  };
}
