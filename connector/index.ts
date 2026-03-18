import type { ServerSdk } from '../hubble-sdk';
import { parseMelaIngredients, parseMelaInstructions, extractMelaImage } from './parse-mela';
import { processRecipeWithAI } from './process-recipe';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProcessedIngredient {
  id: string;
  text: string;
  isReference: boolean;
  referencesGroup?: string;
}

interface ProcessedTimer {
  label: string;
  durationSeconds: number;
  maxDurationSeconds?: number;
}

interface ProcessedStep {
  text: string;
  linkedIngredientIds: string[];
  timers: ProcessedTimer[];
  temperature: string | null;
  equipment: string[];
  technique: string | null;
  goodToKnow: string | null;
}

interface ProcessedGroup {
  name: string;
  ingredients: ProcessedIngredient[];
  steps: ProcessedStep[];
}

interface ProcessedRecipe {
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

interface MelaBody {
  id?: string;
  title?: string;
  ingredients?: string;
  instructions?: string;
  images?: string[];
  notes?: string;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
}

type RecipePhase = 'waiting' | 'gathering' | 'cooking' | 'done';

interface RecipeNavState {
  phase: RecipePhase;
  currentGroupIndex: number;
  currentStepIndex: number;
  gatherCursorIndex: number;
  gatheredIngredientIds: string[];
  usedIngredientIds: string[];
}

interface NavigationState {
  activeRecipeId: string;
  recipes: Record<string, RecipeNavState>;
  pendingTimer: ProcessedTimer | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInitialNavState(): RecipeNavState {
  return {
    phase: 'waiting',
    currentGroupIndex: 0,
    currentStepIndex: 0,
    gatherCursorIndex: 0,
    gatheredIngredientIds: [],
    usedIngredientIds: [],
  };
}

function getNonRefIngredients(recipe: ProcessedRecipe): ProcessedIngredient[] {
  const result: ProcessedIngredient[] = [];
  for (const group of recipe.groups) {
    for (const ing of group.ingredients) {
      if (!ing.isReference) result.push(ing);
    }
  }
  return result;
}

// ── Connector ────────────────────────────────────────────────────────────────

export default function connector(sdk: ServerSdk) {
  const recipes = new Map<string, ProcessedRecipe>();
  let navigation: NavigationState = {
    activeRecipeId: '',
    recipes: {},
    pendingTimer: null,
  };

  function emitAll() {
    sdk.emit('hubble-recipe-viewer:data', {
      recipes: Object.fromEntries(recipes),
      navigation,
    });
  }

  function updateNav(id: string, updates: Partial<RecipeNavState>) {
    const existing = navigation.recipes[id] ?? makeInitialNavState();
    navigation = {
      ...navigation,
      recipes: { ...navigation.recipes, [id]: { ...existing, ...updates } },
    };
  }

  function emitActiveChanged() {
    const { activeRecipeId } = navigation;
    const recipe = recipes.get(activeRecipeId);
    if (!recipe) return;
    const rs = navigation.recipes[activeRecipeId];
    sdk.emitEvent('recipe:active-changed', {
      recipeId: activeRecipeId,
      title: recipe.title,
      phase: rs?.phase ?? 'waiting',
      image: recipe.image,
      servings: recipe.servings,
      totalTime: recipe.totalTime,
    });
  }

  function emitStepChanged() {
    const { activeRecipeId } = navigation;
    const recipe = recipes.get(activeRecipeId);
    const rs = navigation.recipes[activeRecipeId];
    if (!recipe || !rs || rs.phase !== 'cooking') return;
    const group = recipe.groups[rs.currentGroupIndex];
    const step = group?.steps[rs.currentStepIndex];
    if (!step) return;
    sdk.emitEvent('recipe:step-changed', {
      recipeId: activeRecipeId,
      title: recipe.title,
      groupName: group.name,
      groupIndex: rs.currentGroupIndex,
      stepIndex: rs.currentStepIndex,
      stepText: step.text,
      timers: step.timers as unknown as Record<string, unknown>,
      temperature: step.temperature,
      equipment: step.equipment as unknown as Record<string, unknown>,
    });
  }

  // ── Navigation handlers ───────────────────────────────────────────────────

  function handleNext() {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    const recipe = recipes.get(activeRecipeId);
    if (!rs || !recipe || recipe.status !== 'ready') return;

    switch (rs.phase) {
      case 'waiting': {
        updateNav(activeRecipeId, { phase: 'gathering', gatherCursorIndex: 0 });
        emitActiveChanged();
        break;
      }

      case 'gathering': {
        const nonRef = getNonRefIngredients(recipe);
        const gathered = new Set(rs.gatheredIngredientIds);
        const allGathered = nonRef.every(ing => gathered.has(ing.id));
        if (allGathered) {
          updateNav(activeRecipeId, {
            phase: 'cooking',
            gatheredIngredientIds: [],
            currentGroupIndex: 0,
            currentStepIndex: 0,
            gatherCursorIndex: 0,
          });
          emitActiveChanged();
          emitStepChanged();
        } else {
          let nextCursor = rs.gatherCursorIndex + 1;
          while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) nextCursor++;
          if (nextCursor >= nonRef.length) {
            nextCursor = 0;
            while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) nextCursor++;
          }
          updateNav(activeRecipeId, { gatherCursorIndex: nextCursor });
        }
        break;
      }

      case 'cooking': {
        const group = recipe.groups[rs.currentGroupIndex];
        const step = group?.steps[rs.currentStepIndex];
        const newUsed = new Set(rs.usedIngredientIds);
        if (step) for (const id of step.linkedIngredientIds) newUsed.add(id);

        let nextGroup = rs.currentGroupIndex;
        let nextStep = rs.currentStepIndex + 1;
        if (nextStep >= (recipe.groups[nextGroup]?.steps.length ?? 0)) {
          nextGroup++;
          nextStep = 0;
        }
        if (nextGroup >= recipe.groups.length) {
          updateNav(activeRecipeId, { phase: 'done', usedIngredientIds: [...newUsed] });
          emitActiveChanged();
        } else {
          updateNav(activeRecipeId, {
            currentGroupIndex: nextGroup,
            currentStepIndex: nextStep,
            usedIngredientIds: [...newUsed],
          });
          emitStepChanged();
        }
        break;
      }

      case 'done':
        break;
    }
  }

  function handlePrevious() {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    const recipe = recipes.get(activeRecipeId);
    if (!rs || !recipe || recipe.status !== 'ready') return;

    switch (rs.phase) {
      case 'gathering': {
        updateNav(activeRecipeId, {
          phase: 'cooking',
          gatheredIngredientIds: [],
          currentGroupIndex: 0,
          currentStepIndex: 0,
          gatherCursorIndex: 0,
        });
        emitActiveChanged();
        emitStepChanged();
        break;
      }

      case 'cooking': {
        if (rs.currentGroupIndex === 0 && rs.currentStepIndex === 0) {
          updateNav(activeRecipeId, { phase: 'gathering' });
          emitActiveChanged();
          break;
        }
        let prevGroup = rs.currentGroupIndex;
        let prevStep = rs.currentStepIndex - 1;
        if (prevStep < 0) {
          prevGroup--;
          prevStep = (recipe.groups[prevGroup]?.steps.length ?? 1) - 1;
        }
        updateNav(activeRecipeId, { currentGroupIndex: prevGroup, currentStepIndex: prevStep });
        emitStepChanged();
        break;
      }

      case 'done': {
        const lastGroup = recipe.groups.length - 1;
        const lastStep = (recipe.groups[lastGroup]?.steps.length ?? 1) - 1;
        updateNav(activeRecipeId, {
          phase: 'cooking',
          currentGroupIndex: lastGroup,
          currentStepIndex: lastStep,
        });
        emitActiveChanged();
        emitStepChanged();
        break;
      }

      case 'waiting':
        break;
    }
  }

  function handleSwitch() {
    const recipeIds = [...recipes.keys()];
    if (recipeIds.length === 0) return;
    const idx = recipeIds.indexOf(navigation.activeRecipeId);
    const nextIdx = (idx + 1) % recipeIds.length;
    navigation = { ...navigation, activeRecipeId: recipeIds[nextIdx] };
    emitActiveChanged();
  }

  function handleToggleIngredient() {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    const recipe = recipes.get(activeRecipeId);
    if (!rs || !recipe || rs.phase !== 'gathering') return;

    const nonRef = getNonRefIngredients(recipe);
    const ing = nonRef[rs.gatherCursorIndex];
    if (!ing) return;

    const gathered = new Set(rs.gatheredIngredientIds);
    if (gathered.has(ing.id)) {
      gathered.delete(ing.id);
    } else {
      gathered.add(ing.id);
    }

    let nextCursor = rs.gatherCursorIndex + 1;
    while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) nextCursor++;
    if (nextCursor >= nonRef.length) {
      nextCursor = 0;
      while (nextCursor < nonRef.length && gathered.has(nonRef[nextCursor].id)) nextCursor++;
    }
    if (nextCursor >= nonRef.length) nextCursor = rs.gatherCursorIndex;

    updateNav(activeRecipeId, {
      gatheredIngredientIds: [...gathered],
      gatherCursorIndex: nextCursor,
    });
  }

  function handleStartTimer(): { ok: boolean; timer?: ProcessedTimer; error?: string } {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    const recipe = recipes.get(activeRecipeId);
    if (!rs || !recipe || rs.phase !== 'cooking') {
      return { ok: false, error: 'Not in cooking phase' };
    }

    const group = recipe.groups[rs.currentGroupIndex];
    const step = group?.steps[rs.currentStepIndex];
    if (!step?.timers.length) {
      return { ok: false, error: 'No timer for current step' };
    }

    const timer = step.timers[0];
    navigation = { ...navigation, pendingTimer: timer };
    return { ok: true, timer };
  }

  function handleDismiss() {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    if (!rs || rs.phase !== 'done') return;

    recipes.delete(activeRecipeId);

    const newNavRecipes = { ...navigation.recipes };
    delete newNavRecipes[activeRecipeId];
    const remaining = [...recipes.keys()];
    const nextActiveId = remaining[0] || '';

    navigation = { ...navigation, activeRecipeId: nextActiveId, recipes: newNavRecipes };
  }

  function handleContextual() {
    const { activeRecipeId } = navigation;
    const rs = navigation.recipes[activeRecipeId];
    if (!rs) return;

    switch (rs.phase) {
      case 'gathering':
        handleToggleIngredient();
        break;
      case 'cooking':
        handleStartTimer();
        break;
      case 'done':
        handleDismiss();
        break;
      default:
        break;
    }
  }

  // ── Initial emit ─────────────────────────────────────────────────────────

  emitAll();

  // ── API call handler ──────────────────────────────────────────────────────

  sdk.onApiCall(async ({ action, body }) => {
    switch (action) {
      case 'receive': {
        const mela = body as MelaBody;

        if (!mela || !mela.title || !mela.ingredients || !mela.instructions) {
          return { error: 'Missing required fields: title, ingredients, instructions' };
        }

        const id = mela.id || `recipe-${Date.now()}`;

        const recipe: ProcessedRecipe = {
          id,
          status: 'processing',
          title: mela.title,
          image: extractMelaImage(mela.images),
          servings: mela.yield || '',
          prepTime: mela.prepTime || '',
          cookTime: mela.cookTime || '',
          totalTime: mela.totalTime || '',
          notes: mela.notes || '',
          groups: [],
        };

        recipes.set(id, recipe);
        navigation = {
          ...navigation,
          recipes: { ...navigation.recipes, [id]: makeInitialNavState() },
        };

        // Set as active recipe if none is currently active
        if (!navigation.activeRecipeId) {
          navigation = { ...navigation, activeRecipeId: id };
          emitActiveChanged();
        }

        emitAll();

        const widgetConfig = sdk.getWidgetConfigs().find((c) => c['autoSelectOnReceipt'] === true);
        if (widgetConfig) {
          sdk.selectWidget(widgetConfig.id);
        }

        const ingredientGroups = parseMelaIngredients(mela.ingredients);
        const instructionGroups = parseMelaInstructions(mela.instructions);

        const apiKey = config.anthropicApiKey as string | undefined;

        if (!apiKey) {
          recipe.status = 'error';
          recipe.error = 'Anthropic API key not configured';
          sdk.log.error('Cannot process recipe: Anthropic API key not configured');
          recipes.set(id, recipe);
          emitAll();
          return { ok: true, id };
        }

        const model = (config.anthropicModel as string) || 'claude-sonnet-4-6';

        processRecipeWithAI({
          apiKey,
          model,
          title: mela.title,
          ingredientGroups,
          instructionGroups,
          notes: mela.notes || '',
          servings: mela.yield || '',
        })
          .then((groups) => {
            recipe.status = 'ready';
            recipe.groups = groups as ProcessedGroup[];
            recipes.set(id, recipe);
            emitAll();
            sdk.emitEvent('recipe:ready', { recipeId: id, title: recipe.title });
            sdk.log.info(`Recipe "${mela.title}" processed successfully`);
          })
          .catch((err) => {
            recipe.status = 'error';
            recipe.error = err instanceof Error ? err.message : String(err);
            recipes.set(id, recipe);
            emitAll();
            sdk.log.error(`Failed to process recipe "${mela.title}": ${recipe.error}`);
          });

        return { ok: true, id };
      }

      case 'navigate/next':
        handleNext();
        emitAll();
        return { ok: true };

      case 'navigate/previous':
        handlePrevious();
        emitAll();
        return { ok: true };

      case 'navigate/switch':
        handleSwitch();
        emitAll();
        return { ok: true };

      case 'navigate/toggle-ingredient':
        handleToggleIngredient();
        emitAll();
        return { ok: true };

      case 'navigate/start-timer': {
        const result = handleStartTimer();
        emitAll();
        return result;
      }

      case 'navigate/dismiss':
        handleDismiss();
        emitAll();
        return { ok: true };

      case 'navigate/contextual':
        handleContextual();
        emitAll();
        return { ok: true };

      case 'clear-pending-timer':
        navigation = { ...navigation, pendingTimer: null };
        emitAll();
        return { ok: true };

      case 'get-recipe': {
        const b = body as { id?: string } | null;
        const id = b?.id;
        if (!id) return { error: 'Missing id parameter' };
        const recipe = recipes.get(id);
        if (!recipe) return { error: 'Recipe not found' };
        return recipe;
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  });
}
