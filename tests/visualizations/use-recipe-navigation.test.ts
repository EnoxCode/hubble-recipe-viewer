import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRecipeNavigation } from '../../visualizations/default/hooks/useRecipeNavigation';
import type { RecipeViewerData, ProcessedRecipe, ProcessedGroup } from '../../visualizations/default/types';

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

function makeData(...recipes: ProcessedRecipe[]): RecipeViewerData {
  const map: Record<string, ProcessedRecipe> = {};
  for (const r of recipes) map[r.id] = r;
  return { recipes: map };
}

describe('useRecipeNavigation', () => {
  it('returns null activeRecipe when no data', () => {
    const { result } = renderHook(() => useRecipeNavigation(null));
    expect(result.current.activeRecipe).toBeNull();
    expect(result.current.activeRecipeId).toBe('');
    expect(result.current.phase).toBe('waiting');
  });

  it('picks first recipe as active when data arrives', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));
    expect(result.current.activeRecipeId).toBe('r1');
    expect(result.current.activeRecipe).toEqual(recipe);
    expect(result.current.phase).toBe('waiting');
  });

  it('B1 in waiting transitions to gathering', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('gathering');
    expect(result.current.gatherCursorIndex).toBe(0);
  });

  it('B3 in gathering toggles ingredient check at cursor', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Move to gathering
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('gathering');
    expect(result.current.gatheredIds.size).toBe(0);

    // Toggle ingredient at cursor (index 0 = ing-1)
    act(() => result.current.handleButton('contextual'));
    expect(result.current.gatheredIds.has('ing-1')).toBe(true);

    // Toggle again to uncheck
    act(() => result.current.handleButton('contextual'));
    expect(result.current.gatheredIds.has('ing-1')).toBe(false);
  });

  it('B1 in gathering advances cursor to next unchecked', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    act(() => result.current.handleButton('primary')); // → gathering
    expect(result.current.gatherCursorIndex).toBe(0);

    // Check first ingredient, then advance
    act(() => result.current.handleButton('contextual')); // toggle ing-1
    act(() => result.current.handleButton('primary')); // advance cursor
    expect(result.current.gatherCursorIndex).toBe(1); // next unchecked
  });

  it('when all gathered, B1 transitions to cooking and resets checks', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    act(() => result.current.handleButton('primary')); // → gathering

    // Check both ingredients
    act(() => result.current.handleButton('contextual')); // check ing-1
    act(() => result.current.handleButton('primary')); // advance to ing-2
    act(() => result.current.handleButton('contextual')); // check ing-2

    // All gathered, B1 → cooking
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('cooking');
    expect(result.current.gatheredIds.size).toBe(0);
    expect(result.current.currentGroupIndex).toBe(0);
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('B1 in cooking advances step and auto-checks linked ingredients', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to cooking
    act(() => result.current.handleButton('primary')); // → gathering
    act(() => result.current.handleButton('contextual')); // check ing-1
    act(() => result.current.handleButton('primary')); // advance
    act(() => result.current.handleButton('contextual')); // check ing-2
    act(() => result.current.handleButton('primary')); // → cooking

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.activeIngredientIds).toEqual(['ing-1']);

    // Advance to next step
    act(() => result.current.handleButton('primary'));
    expect(result.current.currentStepIndex).toBe(1);
    // ing-1 should be auto-checked as used
    expect(result.current.usedIds.has('ing-1')).toBe(true);
    expect(result.current.activeIngredientIds).toEqual(['ing-2']);
  });

  it('B2 in cooking goes to prev step', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to cooking
    act(() => result.current.handleButton('primary')); // → gathering
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary')); // → cooking

    // Advance to step 1
    act(() => result.current.handleButton('primary'));
    expect(result.current.currentStepIndex).toBe(1);

    // Go back
    act(() => result.current.handleButton('back'));
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('B2 on first step goes back to gathering', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to cooking
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('cooking');
    expect(result.current.currentStepIndex).toBe(0);

    // B2 on first step → back to gathering
    act(() => result.current.handleButton('back'));
    expect(result.current.phase).toBe('gathering');
  });

  it('B1 on last step of last group transitions to done', () => {
    const recipe = makeRecipe('r1');
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to cooking
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('cooking');

    // Advance through all steps (2 steps in single group)
    act(() => result.current.handleButton('primary')); // step 0 → step 1
    act(() => result.current.handleButton('primary')); // step 1 → done
    expect(result.current.phase).toBe('done');
    // All linked ingredients should be used
    expect(result.current.usedIds.has('ing-2')).toBe(true);
  });

  it('B3 in cooking with timer sets pendingTimer', () => {
    const timer = { label: 'Boil', durationSeconds: 300 };
    const recipe = makeRecipe('r1', {
      groups: [makeGroup({
        steps: [makeStep({ timers: [timer], linkedIngredientIds: ['ing-1'] }), makeStep()],
      })],
    });
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to cooking
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));

    expect(result.current.pendingTimer).toBeNull();

    act(() => result.current.handleButton('contextual'));
    expect(result.current.pendingTimer).toEqual(timer);

    act(() => result.current.clearPendingTimer());
    expect(result.current.pendingTimer).toBeNull();
  });

  it('B3 in done removes recipe from state', () => {
    const r1 = makeRecipe('r1');
    const r2 = makeRecipe('r2');
    const { result } = renderHook(() => useRecipeNavigation(makeData(r1, r2)));

    // Move r1 to done
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('done');
    expect(result.current.activeRecipeId).toBe('r1');

    // B3 → dismiss
    act(() => result.current.handleButton('contextual'));
    // Should switch to r2
    expect(result.current.activeRecipeId).toBe('r2');
    expect(result.current.phase).toBe('waiting');
  });

  it('B4 cycles active recipe', () => {
    const r1 = makeRecipe('r1');
    const r2 = makeRecipe('r2');
    const r3 = makeRecipe('r3');
    const { result } = renderHook(() => useRecipeNavigation(makeData(r1, r2, r3)));

    expect(result.current.activeRecipeId).toBe('r1');

    act(() => result.current.handleButton('switch'));
    expect(result.current.activeRecipeId).toBe('r2');

    act(() => result.current.handleButton('switch'));
    expect(result.current.activeRecipeId).toBe('r3');

    act(() => result.current.handleButton('switch'));
    expect(result.current.activeRecipeId).toBe('r1'); // wraps around
  });

  it('tracks allPhases and allStepProgress across recipes', () => {
    const r1 = makeRecipe('r1');
    const r2 = makeRecipe('r2');
    const { result } = renderHook(() => useRecipeNavigation(makeData(r1, r2)));

    expect(result.current.allPhases['r1']).toBe('waiting');
    expect(result.current.allPhases['r2']).toBe('waiting');
    expect(result.current.allStepProgress['r1']).toEqual({ current: 0, total: 2 });

    // Move r1 to cooking
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    act(() => result.current.handleButton('contextual'));
    act(() => result.current.handleButton('primary'));
    expect(result.current.allPhases['r1']).toBe('cooking');

    // Advance one step
    act(() => result.current.handleButton('primary'));
    expect(result.current.allStepProgress['r1']).toEqual({ current: 1, total: 2 });
  });

  it('handles multi-group navigation linearly', () => {
    const group1: ProcessedGroup = {
      name: 'Sauce',
      ingredients: [makeIngredient('s1', 'tomato')],
      steps: [makeStep({ linkedIngredientIds: ['s1'] })],
    };
    const group2: ProcessedGroup = {
      name: 'Pasta',
      ingredients: [makeIngredient('p1', 'spaghetti')],
      steps: [makeStep({ linkedIngredientIds: ['p1'] })],
    };
    const recipe = makeRecipe('r1', { groups: [group1, group2] });
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    // Go to gathering
    act(() => result.current.handleButton('primary'));
    // Check both non-ref ingredients
    act(() => result.current.handleButton('contextual')); // s1
    act(() => result.current.handleButton('primary')); // advance to p1
    act(() => result.current.handleButton('contextual')); // p1
    act(() => result.current.handleButton('primary')); // → cooking

    expect(result.current.phase).toBe('cooking');
    expect(result.current.currentGroupIndex).toBe(0);
    expect(result.current.currentStepIndex).toBe(0);

    // Advance past group1's only step → group2
    act(() => result.current.handleButton('primary'));
    expect(result.current.currentGroupIndex).toBe(1);
    expect(result.current.currentStepIndex).toBe(0);

    // Advance past group2's only step → done
    act(() => result.current.handleButton('primary'));
    expect(result.current.phase).toBe('done');
  });

  it('skips reference ingredients in gather mode', () => {
    const group: ProcessedGroup = {
      name: 'Main',
      ingredients: [
        makeIngredient('ing-1', '1 cup flour'),
        makeIngredient('ref-1', 'See Sauce', true),
        makeIngredient('ing-2', '2 eggs'),
      ],
      steps: [makeStep()],
    };
    const recipe = makeRecipe('r1', { groups: [group] });
    const { result } = renderHook(() => useRecipeNavigation(makeData(recipe)));

    act(() => result.current.handleButton('primary')); // → gathering

    // Cursor at 0 → ing-1
    act(() => result.current.handleButton('contextual')); // check ing-1
    expect(result.current.gatheredIds.has('ing-1')).toBe(true);

    act(() => result.current.handleButton('primary')); // advance cursor
    // Should skip ref-1 and land on ing-2 (index 1 in flat non-ref list)
    expect(result.current.gatherCursorIndex).toBe(1);

    act(() => result.current.handleButton('contextual')); // check ing-2
    expect(result.current.gatheredIds.has('ing-2')).toBe(true);
    expect(result.current.gatheredIds.has('ref-1')).toBe(false);
  });
});
