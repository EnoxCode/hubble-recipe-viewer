import type { ServerSdk } from '../hubble-sdk';
import { parseMelaIngredients, parseMelaInstructions, extractMelaImage } from './parse-mela';
import { processRecipeWithAI } from './process-recipe';

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
  groups: unknown[];
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

export default function connector(sdk: ServerSdk) {
  const recipes = new Map<string, ProcessedRecipe>();

  function emitAll() {
    sdk.emit('hubble-recipe-viewer:data', {
      recipes: Object.fromEntries(recipes),
    });
  }

  // Emit initial empty state
  emitAll();

  sdk.onApiCall(async ({ action, body }) => {
    switch (action) {
      case 'receive': {
        const mela = body as MelaBody;

        if (!mela || !mela.title || !mela.ingredients || !mela.instructions) {
          return { error: 'Missing required fields: title, ingredients, instructions' };
        }

        const id = mela.id || `recipe-${Date.now()}`;

        // Store as processing and emit immediately
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
        emitAll();

        // Parse ingredients and instructions deterministically
        const ingredientGroups = parseMelaIngredients(mela.ingredients);
        const instructionGroups = parseMelaInstructions(mela.instructions);

        // Check for API key
        const config = sdk.getConfig();
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

        // Process with AI (async, don't block the response)
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
            recipe.groups = groups;
            recipes.set(id, recipe);
            emitAll();
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

      case 'start-timer': {
        const timerBody = body as { duration?: number; label?: string };
        if (!timerBody?.duration || !timerBody?.label) {
          return { error: 'Missing duration or label' };
        }
        try {
          const result = await sdk.http.post(
            'http://localhost:3000/api/module/hubble-timer/api/start-available',
            { duration: timerBody.duration, label: timerBody.label },
          );
          return result;
        } catch (err) {
          sdk.log.warn(`Timer start failed: ${err}`);
          sdk.notify('All timers are busy', { level: 'warn' });
          return { ok: false, error: 'Timer unavailable' };
        }
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  });
}
