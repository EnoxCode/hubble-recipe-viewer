import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  RecipeViewerData,
  ProcessedRecipe,
  ProcessedTimer,
  RecipePhase,
  ProcessedIngredient,
} from '../types';

/** Serializable per-recipe state */
interface RecipeState {
  phase: RecipePhase;
  currentGroupIndex: number;
  currentStepIndex: number;
  gatherCursorIndex: number;
  gatheredIngredientIds: string[];
  usedIngredientIds: string[];
}

interface NavigationState {
  activeRecipeId: string;
  recipes: Record<string, RecipeState>;
  pendingTimer: ProcessedTimer | null;
}

function makeInitialRecipeState(): RecipeState {
  return {
    phase: 'waiting',
    currentGroupIndex: 0,
    currentStepIndex: 0,
    gatherCursorIndex: 0,
    gatheredIngredientIds: [],
    usedIngredientIds: [],
  };
}

function makeInitialState(): NavigationState {
  return {
    activeRecipeId: '',
    recipes: {},
    pendingTimer: null,
  };
}

/** Get flat list of non-reference ingredients across all groups */
function getNonRefIngredients(recipe: ProcessedRecipe): ProcessedIngredient[] {
  const result: ProcessedIngredient[] = [];
  for (const group of recipe.groups) {
    for (const ing of group.ingredients) {
      if (!ing.isReference) result.push(ing);
    }
  }
  return result;
}

/** Count total steps across all groups */
function getTotalSteps(recipe: ProcessedRecipe): number {
  let total = 0;
  for (const group of recipe.groups) {
    total += group.steps.length;
  }
  return total;
}

/** Get current linear step index (across groups) */
function getLinearStepIndex(recipe: ProcessedRecipe, groupIndex: number, stepIndex: number): number {
  let idx = 0;
  for (let g = 0; g < groupIndex && g < recipe.groups.length; g++) {
    idx += recipe.groups[g].steps.length;
  }
  return idx + stepIndex;
}

export function useRecipeNavigation(data: RecipeViewerData | null) {
  const [state, setState] = useState<NavigationState>(makeInitialState);

  // Sync new recipes into state when data changes
  useEffect(() => {
    if (!data) return;
    setState(prev => {
      const recipeIds = Object.keys(data.recipes);
      let changed = false;
      const newRecipes = { ...prev.recipes };

      for (const id of recipeIds) {
        if (!(id in newRecipes)) {
          newRecipes[id] = makeInitialRecipeState();
          changed = true;
        }
      }

      // Set active recipe if none or current is gone
      let activeId = prev.activeRecipeId;
      if (!activeId || !(activeId in data.recipes)) {
        activeId = recipeIds[0] || '';
        changed = true;
      }

      if (!changed) return prev;
      return { ...prev, activeRecipeId: activeId, recipes: newRecipes };
    });
  }, [data]);

  const activeRecipe = data?.recipes[state.activeRecipeId] ?? null;
  const recipeState = state.recipes[state.activeRecipeId] ?? makeInitialRecipeState();

  const gatheredIds = useMemo(() => new Set(recipeState.gatheredIngredientIds), [recipeState.gatheredIngredientIds]);
  const usedIds = useMemo(() => new Set(recipeState.usedIngredientIds), [recipeState.usedIngredientIds]);

  const activeIngredientIds = useMemo(() => {
    if (!activeRecipe || recipeState.phase !== 'cooking') return [];
    const group = activeRecipe.groups[recipeState.currentGroupIndex];
    if (!group) return [];
    const step = group.steps[recipeState.currentStepIndex];
    return step?.linkedIngredientIds ?? [];
  }, [activeRecipe, recipeState.phase, recipeState.currentGroupIndex, recipeState.currentStepIndex]);

  const allPhases = useMemo(() => {
    const result: Record<string, RecipePhase> = {};
    for (const [id, rs] of Object.entries(state.recipes)) {
      result[id] = rs.phase;
    }
    return result;
  }, [state.recipes]);

  const allStepProgress = useMemo(() => {
    const result: Record<string, { current: number; total: number }> = {};
    if (!data) return result;
    for (const [id, rs] of Object.entries(state.recipes)) {
      const recipe = data.recipes[id];
      if (!recipe) continue;
      const total = getTotalSteps(recipe);
      const current = getLinearStepIndex(recipe, rs.currentGroupIndex, rs.currentStepIndex);
      result[id] = { current, total };
    }
    return result;
  }, [state.recipes, data]);

  const clearPendingTimer = useCallback(() => {
    setState(prev => ({ ...prev, pendingTimer: null }));
  }, []);

  const handleButton = useCallback((action: 'primary' | 'back' | 'contextual' | 'switch') => {
    setState(prev => {
      if (!data) return prev;

      const recipeIds = Object.keys(data.recipes);
      if (recipeIds.length === 0) return prev;

      // Switch cycles through recipes
      if (action === 'switch') {
        const idx = recipeIds.indexOf(prev.activeRecipeId);
        const nextIdx = (idx + 1) % recipeIds.length;
        return { ...prev, activeRecipeId: recipeIds[nextIdx] };
      }

      const activeId = prev.activeRecipeId;
      const rs = prev.recipes[activeId];
      if (!rs) return prev;

      const recipe = data.recipes[activeId];
      if (!recipe) return prev;

      const updateRecipe = (updates: Partial<RecipeState>): NavigationState => ({
        ...prev,
        recipes: { ...prev.recipes, [activeId]: { ...rs, ...updates } },
      });

      switch (rs.phase) {
        case 'waiting': {
          if (action === 'primary') {
            return updateRecipe({ phase: 'gathering', gatherCursorIndex: 0 });
          }
          return prev;
        }

        case 'gathering': {
          const nonRef = getNonRefIngredients(recipe);

          if (action === 'contextual') {
            // Toggle ingredient at cursor, then advance to next unchecked
            const ing = nonRef[rs.gatherCursorIndex];
            if (!ing) return prev;
            const gathered = new Set(rs.gatheredIngredientIds);
            if (gathered.has(ing.id)) {
              gathered.delete(ing.id);
            } else {
              gathered.add(ing.id);
            }

            // Auto-advance cursor to next unchecked ingredient
            let nextCursor = rs.gatherCursorIndex + 1;
            while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) {
              nextCursor++;
            }
            if (nextCursor >= nonRef.length) {
              // Wrap around
              nextCursor = 0;
              while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) {
                nextCursor++;
              }
            }
            // If all gathered, stay on last
            if (nextCursor >= nonRef.length) nextCursor = rs.gatherCursorIndex;

            return updateRecipe({ gatheredIngredientIds: [...gathered], gatherCursorIndex: nextCursor });
          }

          if (action === 'primary') {
            const gathered = new Set(rs.gatheredIngredientIds);

            // Check if all are gathered
            const allGathered = nonRef.every(ing => gathered.has(ing.id));
            if (allGathered) {
              // Transition to cooking, reset gathered
              return updateRecipe({
                phase: 'cooking',
                gatheredIngredientIds: [],
                currentGroupIndex: 0,
                currentStepIndex: 0,
                gatherCursorIndex: 0,
              });
            }

            // Advance cursor to next unchecked
            let nextCursor = rs.gatherCursorIndex + 1;
            while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) {
              nextCursor++;
            }
            // Wrap around if needed
            if (nextCursor >= nonRef.length) {
              nextCursor = 0;
              while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) {
                nextCursor++;
              }
            }
            return updateRecipe({ gatherCursorIndex: nextCursor });
          }
          return prev;
        }

        case 'cooking': {
          if (action === 'primary') {
            // Auto-check linked ingredients of current step as used
            const group = recipe.groups[rs.currentGroupIndex];
            const step = group?.steps[rs.currentStepIndex];
            const newUsed = new Set(rs.usedIngredientIds);
            if (step) {
              for (const id of step.linkedIngredientIds) {
                newUsed.add(id);
              }
            }

            // Advance to next step
            let nextGroup = rs.currentGroupIndex;
            let nextStep = rs.currentStepIndex + 1;

            if (nextStep >= (recipe.groups[nextGroup]?.steps.length ?? 0)) {
              // Move to next group
              nextGroup++;
              nextStep = 0;
            }

            if (nextGroup >= recipe.groups.length) {
              // Done
              return updateRecipe({
                phase: 'done',
                usedIngredientIds: [...newUsed],
              });
            }

            return updateRecipe({
              currentGroupIndex: nextGroup,
              currentStepIndex: nextStep,
              usedIngredientIds: [...newUsed],
            });
          }

          if (action === 'back') {
            if (rs.currentGroupIndex === 0 && rs.currentStepIndex === 0) {
              // Go back to gathering
              return updateRecipe({ phase: 'gathering' });
            }

            let prevGroup = rs.currentGroupIndex;
            let prevStep = rs.currentStepIndex - 1;

            if (prevStep < 0) {
              prevGroup--;
              prevStep = (recipe.groups[prevGroup]?.steps.length ?? 1) - 1;
            }

            return updateRecipe({
              currentGroupIndex: prevGroup,
              currentStepIndex: prevStep,
            });
          }

          if (action === 'contextual') {
            // Start timer if step has timers
            const group = recipe.groups[rs.currentGroupIndex];
            const step = group?.steps[rs.currentStepIndex];
            if (step?.timers.length) {
              return { ...updateRecipe({}), pendingTimer: step.timers[0] };
            }
            return prev;
          }

          return prev;
        }

        case 'done': {
          if (action === 'contextual') {
            // Dismiss / remove recipe
            const newRecipes = { ...prev.recipes };
            delete newRecipes[activeId];

            // Find next active recipe
            const remaining = recipeIds.filter(id => id !== activeId);
            const nextActiveId = remaining[0] || '';

            // Ensure remaining recipes have state
            for (const id of remaining) {
              if (!(id in newRecipes)) {
                newRecipes[id] = makeInitialRecipeState();
              }
            }

            return {
              ...prev,
              activeRecipeId: nextActiveId,
              recipes: newRecipes,
            };
          }

          if (action === 'back') {
            // Go back to last step
            const lastGroup = recipe.groups.length - 1;
            const lastStep = (recipe.groups[lastGroup]?.steps.length ?? 1) - 1;
            return updateRecipe({
              phase: 'cooking',
              currentGroupIndex: lastGroup,
              currentStepIndex: lastStep,
            });
          }

          return prev;
        }
      }

      return prev;
    });
  }, [data]);

  return {
    activeRecipeId: state.activeRecipeId,
    activeRecipe,
    phase: recipeState.phase,
    currentGroupIndex: recipeState.currentGroupIndex,
    currentStepIndex: recipeState.currentStepIndex,
    gatherCursorIndex: recipeState.gatherCursorIndex,
    gatheredIds,
    usedIds,
    activeIngredientIds,
    allPhases,
    allStepProgress,
    pendingTimer: state.pendingTimer,
    clearPendingTimer,
    handleButton,
  };
}
