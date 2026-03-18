import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRecipeNavigation } from '../../visualizations/default/hooks/useRecipeNavigation';
import type { RecipeViewerData, ProcessedRecipe, ProcessedGroup, RecipeNavState } from '../../visualizations/default/types';

function makeStep(overrides: Partial<ProcessedRecipe['groups'][0]['steps'][0]> = {}) {
  return {
    text: 'Do something',
    linkedIngredientIds: [] as string[],
    timers: [],
    temperature: null,
    equipment: [],
    technique: null,
    goodToKnow: null,
    ...overrides,
  };
}

function makeIngredient(id: string, text: string, isReference = false) {
  return { id, text, isReference, ...(isReference ? { referencesGroup: 'Other' } : {}) };
}

function makeGroup(overrides: Partial<ProcessedGroup> = {}): ProcessedGroup {
  return {
    name: 'Main',
    ingredients: [
      makeIngredient('ing-1', '1 cup flour'),
      makeIngredient('ing-2', '2 eggs'),
    ],
    steps: [makeStep({ linkedIngredientIds: ['ing-1'] }), makeStep({ linkedIngredientIds: ['ing-2'] })],
    ...overrides,
  };
}

function makeRecipe(id: string, overrides: Partial<ProcessedRecipe> = {}): ProcessedRecipe {
  return {
    id,
    status: 'ready',
    title: `Recipe ${id}`,
    image: '',
    servings: '4',
    prepTime: '10 min',
    cookTime: '20 min',
    totalTime: '30 min',
    notes: '',
    groups: [makeGroup()],
    ...overrides,
  };
}

function makeNavState(overrides: Partial<RecipeNavState> = {}): RecipeNavState {
  return {
    phase: 'waiting',
    currentGroupIndex: 0,
    currentStepIndex: 0,
    gatherCursorIndex: 0,
    gatheredIngredientIds: [],
    usedIngredientIds: [],
    ...overrides,
  };
}

function makeData(recipes: ProcessedRecipe[], navOverrides: Partial<RecipeViewerData['navigation']> = {}): RecipeViewerData {
  const recipeMap: Record<string, ProcessedRecipe> = {};
  const navRecipes: Record<string, RecipeNavState> = {};
  for (const r of recipes) {
    recipeMap[r.id] = r;
    navRecipes[r.id] = makeNavState();
  }
  return {
    recipes: recipeMap,
    navigation: {
      activeRecipeId: recipes[0]?.id ?? '',
      recipes: navRecipes,
      pendingTimer: null,
      ...navOverrides,
    },
  };
}

describe('useRecipeNavigation', () => {
  it('returns null activeRecipe and empty string id when no data', () => {
    const { result } = renderHook(() => useRecipeNavigation(null));
    expect(result.current.activeRecipe).toBeNull();
    expect(result.current.activeRecipeId).toBe('');
    expect(result.current.phase).toBe('waiting');
  });

  it('reads activeRecipeId from navigation state', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData([recipe])));
    expect(result.current.activeRecipeId).toBe('r1');
    expect(result.current.activeRecipe).toEqual(recipe);
    expect(result.current.phase).toBe('waiting');
  });

  it('reads the correct phase from navigation', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], { recipes: { r1: makeNavState({ phase: 'cooking' }) } });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.phase).toBe('cooking');
  });

  it('converts gatheredIngredientIds array to Set', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], {
      recipes: { r1: makeNavState({ phase: 'gathering', gatheredIngredientIds: ['ing-1'] }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.gatheredIds.has('ing-1')).toBe(true);
    expect(result.current.gatheredIds.has('ing-2')).toBe(false);
  });

  it('converts usedIngredientIds array to Set', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], {
      recipes: { r1: makeNavState({ phase: 'cooking', usedIngredientIds: ['ing-1'] }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.usedIds.has('ing-1')).toBe(true);
    expect(result.current.usedIds.has('ing-2')).toBe(false);
  });

  it('derives activeIngredientIds for current cooking step', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], {
      recipes: { r1: makeNavState({ phase: 'cooking', currentGroupIndex: 0, currentStepIndex: 0 }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.activeIngredientIds).toEqual(['ing-1']);
  });

  it('returns empty activeIngredientIds outside cooking phase', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], { recipes: { r1: makeNavState({ phase: 'gathering' }) } });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.activeIngredientIds).toEqual([]);
  });

  it('builds allPhases map from all recipe nav states', () => {
    const r1 = makeRecipe('r1');
    const r2 = makeRecipe('r2');
    const data = makeData([r1, r2], {
      recipes: {
        r1: makeNavState({ phase: 'cooking' }),
        r2: makeNavState({ phase: 'done' }),
      },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.allPhases['r1']).toBe('cooking');
    expect(result.current.allPhases['r2']).toBe('done');
  });

  it('builds allStepProgress using linear step index', () => {
    const r1 = makeRecipe('r1'); // 2 steps in single group
    const data = makeData([r1], {
      recipes: { r1: makeNavState({ phase: 'cooking', currentGroupIndex: 0, currentStepIndex: 1 }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.allStepProgress['r1']).toEqual({ current: 1, total: 2 });
  });

  it('handles multi-group step progress correctly', () => {
    const group1: ProcessedGroup = {
      name: 'Sauce',
      ingredients: [],
      steps: [makeStep(), makeStep()],
    };
    const group2: ProcessedGroup = {
      name: 'Pasta',
      ingredients: [],
      steps: [makeStep()],
    };
    const recipe = makeRecipe('r1', { groups: [group1, group2] });
    // At group 1, step 0 → linear index = 2 (past group1's 2 steps)
    const data = makeData([recipe], {
      recipes: { r1: makeNavState({ phase: 'cooking', currentGroupIndex: 1, currentStepIndex: 0 }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.allStepProgress['r1']).toEqual({ current: 2, total: 3 });
  });

  it('returns null activeRecipe when activeRecipeId is not in recipes', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], { activeRecipeId: 'missing' });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.activeRecipe).toBeNull();
  });

  it('passes gatherCursorIndex through', () => {
    const recipe = makeRecipe('r1');
    const data = makeData([recipe], {
      recipes: { r1: makeNavState({ phase: 'gathering', gatherCursorIndex: 1 }) },
    });
    const { result } = renderHook(() => useRecipeNavigation(data));
    expect(result.current.gatherCursorIndex).toBe(1);
  });
});
