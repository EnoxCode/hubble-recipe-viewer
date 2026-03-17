# Mela Recipe Viewer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-panel cooking companion widget that receives Mela recipes via API, processes them with Claude AI, and presents step-by-step cooking instructions navigated with hardware buttons.

**Architecture:** Hybrid Hubble module — connector handles API endpoint + AI processing, visualization renders the dashboard widget. Connector receives mela JSON, parses groups deterministically, sends to Claude for step extraction/enrichment, stores in-memory, and emits to the visualization. Visualization is a two-panel layout (ingredients left, steps right) with hardware button navigation through gather → cook → done phases.

**Tech Stack:** TypeScript, React, Anthropic SDK (`@anthropic-ai/sdk`), Vitest, @testing-library/react, Hubble SDK (`@hubble/sdk`), `hubble-dash-ui` CSS variables.

**Spec:** `docs/superpowers/specs/2026-03-17-mela-recipe-viewer-design.md`

---

## File Structure

```
hubble-mela-recipe-viewer/
├── manifest.json                          # MODIFY: add endpoints, hardwareButtons, config properties
├── connector/
│   ├── index.ts                           # MODIFY: API endpoint handler + AI orchestration
│   ├── parse-mela.ts                      # CREATE: deterministic mela format parser
│   └── process-recipe.ts                  # CREATE: Claude API call + prompt
├── visualizations/
│   └── default/
│       ├── index.tsx                      # MODIFY: main visualization component
│       ├── style.css                      # MODIFY: all rcp-* styles
│       ├── types.ts                       # CREATE: shared types (inlined, not imported from connector)
│       ├── components/
│       │   ├── RecipeImage.tsx             # CREATE: image with title overlay
│       │   ├── IngredientPanel.tsx         # CREATE: left panel - ingredients list
│       │   ├── StepPanel.tsx              # CREATE: right panel - step content
│       │   ├── OverviewPanel.tsx          # CREATE: right panel - overview/gather view
│       │   ├── DonePanel.tsx              # CREATE: right panel - completion card
│       │   ├── EmptyState.tsx             # CREATE: no recipes loaded state
│       │   ├── ProcessingState.tsx        # CREATE: AI processing in progress
│       │   ├── Callout.tsx               # CREATE: timer/technique/temp/equip/tip callouts
│       │   └── RecipeSwitcher.tsx         # CREATE: footer recipe switcher bar
│       └── hooks/
│           └── useRecipeNavigation.ts     # CREATE: state machine for gather/cook/done + button handling
├── tests/
│   ├── setup.ts                           # KEEP: existing
│   ├── connector/
│   │   ├── parse-mela.test.ts             # CREATE: mela parser tests
│   │   └── connector.test.ts              # CREATE: connector integration tests
│   └── visualizations/
│       ├── default.test.tsx               # MODIFY: main viz rendering tests
│       ├── ingredient-panel.test.tsx       # CREATE: ingredient states + gather/cook
│       ├── step-panel.test.tsx            # CREATE: step navigation + callouts
│       └── use-recipe-navigation.test.ts  # CREATE: state machine tests
└── package.json                           # MODIFY: add @anthropic-ai/sdk dependency
```

---

## Chunk 1: Foundation — Types, Parser, Manifest

### Task 1: Update manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Update manifest with endpoints, buttons, and config**

```json
{
  "name": "hubble-mela-recipe-viewer",
  "version": "0.1.0",
  "description": "A viewer for the mela recipe format",
  "minAppVersion": "0.1.0",
  "type": ["connector", "visualization"],
  "endpoints": [
    {
      "name": "receive",
      "method": "POST",
      "path": "/receive",
      "description": "Receive a recipe from Mela app"
    }
  ],
  "properties": [
    {
      "name": "anthropicApiKey",
      "type": "secret",
      "required": true,
      "description": "Anthropic API key for Claude AI recipe processing"
    },
    {
      "name": "anthropicModel",
      "type": "string",
      "required": false,
      "default": "claude-sonnet-4-6",
      "description": "Claude model to use for recipe processing"
    }
  ],
  "visualizations": [
    {
      "name": "default",
      "description": "Recipe viewer dashboard widget",
      "path": "default",
      "hardwareButtons": {
        "button1": "primary",
        "button2": "back",
        "button3": "contextual",
        "button4": "switch"
      },
      "properties": [
        {
          "name": "title",
          "type": "string",
          "required": false,
          "description": "Widget title (unused in dashboard mode)"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Validate manifest**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: update manifest with endpoints, buttons, and config"
```

---

### Task 2: Add Anthropic SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add @anthropic-ai/sdk**

Run: `npm install --save @anthropic-ai/sdk`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add anthropic sdk dependency"
```

---

### Task 3: Create shared types

**Files:**
- Create: `visualizations/default/types.ts`

These types are inlined in the visualization directory because hybrid modules cannot import from `connector/`. The connector will have its own copy.

- [ ] **Step 1: Write types file**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add visualizations/default/types.ts
git commit -m "feat: add shared recipe types"
```

---

### Task 4: Mela format parser

**Files:**
- Create: `connector/parse-mela.ts`
- Create: `tests/connector/parse-mela.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/connector/parse-mela.test.ts
import { describe, it, expect } from 'vitest';
import { parseMelaIngredients, parseMelaInstructions, extractMelaImage } from '../../connector/parse-mela';

describe('parseMelaIngredients', () => {
  it('parses grouped ingredients with # headers', () => {
    const input = `# For the marinade
350 g flank steak
1 teaspoon cornstarch
# For the sauce
2 tbsp oyster sauce
1 tbsp dark soy sauce`;

    const result = parseMelaIngredients(input);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('For the marinade');
    expect(result[0].ingredients).toEqual(['350 g flank steak', '1 teaspoon cornstarch']);
    expect(result[1].name).toBe('For the sauce');
    expect(result[1].ingredients).toEqual(['2 tbsp oyster sauce', '1 tbsp dark soy sauce']);
  });

  it('handles ingredients without groups as a single unnamed group', () => {
    const input = `2 eggs
100g flour
pinch of salt`;

    const result = parseMelaIngredients(input);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ingredients');
    expect(result[0].ingredients).toHaveLength(3);
  });

  it('strips trailing colons from group names', () => {
    const input = `# Voor de salade van gele biet:
2 gele bieten`;

    const result = parseMelaIngredients(input);
    expect(result[0].name).toBe('Voor de salade van gele biet');
  });

  it('skips empty lines', () => {
    const input = `# Marinade
350g steak

1 tsp cornstarch

# Sauce
oyster sauce`;

    const result = parseMelaIngredients(input);
    expect(result[0].ingredients).toEqual(['350g steak', '1 tsp cornstarch']);
  });
});

describe('parseMelaInstructions', () => {
  it('parses grouped instructions with # headers', () => {
    const input = `# For the marinade
Slice the beef into strips.
Mix with the marinade ingredients.
# For the sauce
Mix all sauce ingredients.`;

    const result = parseMelaInstructions(input);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('For the marinade');
    expect(result[0].text).toContain('Slice the beef');
    expect(result[1].name).toBe('For the sauce');
  });

  it('handles instructions without groups', () => {
    const input = `Heat the oil.
Add the onion.
Stir-fry for 2 minutes.`;

    const result = parseMelaInstructions(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Instructions');
  });

  it('strips trailing colons from group names', () => {
    const input = `# Voor de salade van gele biet:
Verwarm de oven.`;

    const result = parseMelaInstructions(input);
    expect(result[0].name).toBe('Voor de salade van gele biet');
  });
});

describe('extractMelaImage', () => {
  it('returns first image from array', () => {
    const images = ['base64data1', 'base64data2'];
    expect(extractMelaImage(images)).toBe('base64data1');
  });

  it('returns empty string for empty array', () => {
    expect(extractMelaImage([])).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractMelaImage(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/connector/parse-mela.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the parser**

```ts
// connector/parse-mela.ts

export interface ParsedGroup {
  name: string;
  ingredients: string[];
}

export interface ParsedInstructionGroup {
  name: string;
  text: string;
}

export function parseMelaIngredients(raw: string): ParsedGroup[] {
  const lines = raw.split('\n');
  const groups: ParsedGroup[] = [];
  let current: ParsedGroup | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      current = {
        name: trimmed.slice(2).replace(/:$/, '').trim(),
        ingredients: [],
      };
      groups.push(current);
    } else {
      if (!current) {
        current = { name: 'Ingredients', ingredients: [] };
        groups.push(current);
      }
      current.ingredients.push(trimmed);
    }
  }

  return groups;
}

export function parseMelaInstructions(raw: string): ParsedInstructionGroup[] {
  const lines = raw.split('\n');
  const groups: ParsedInstructionGroup[] = [];
  let current: ParsedInstructionGroup | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      current = {
        name: trimmed.slice(2).replace(/:$/, '').trim(),
        text: '',
      };
      groups.push(current);
    } else {
      if (!current) {
        current = { name: 'Instructions', text: '' };
        groups.push(current);
      }
      current.text += (current.text ? '\n' : '') + trimmed;
    }
  }

  return groups;
}

export function extractMelaImage(images: string[] | undefined): string {
  if (!images || images.length === 0) return '';
  return images[0];
}

/** Raw mela recipe shape */
export interface MelaRecipe {
  id: string;
  title: string;
  ingredients: string;
  instructions: string;
  images?: string[];
  notes?: string;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/connector/parse-mela.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add connector/parse-mela.ts tests/connector/parse-mela.test.ts
git commit -m "feat: add mela format parser with tests"
```

---

## Chunk 2: AI Processing — Claude API Integration

### Task 5: Recipe processor (Claude API)

**Files:**
- Create: `connector/process-recipe.ts`
- Create: `tests/connector/connector.test.ts`

The processor takes parsed mela data, calls Claude with a structured prompt, and returns a `ProcessedRecipe`. The prompt asks Claude to return JSON matching our schema.

- [ ] **Step 1: Write connector test for the onApiCall flow**

```ts
// tests/connector/connector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the processRecipe function in isolation — mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            groups: [{
              name: 'Marinade',
              ingredients: [
                { id: 'marinade-0', text: '350g flank steak', isReference: false },
                { id: 'marinade-1', text: '1 tsp cornstarch', isReference: false },
              ],
              steps: [{
                text: 'Slice the beef into strips against the grain. Mix with cornstarch.',
                linkedIngredientIds: ['marinade-0', 'marinade-1'],
                timers: [{ label: 'Rest marinade', durationSeconds: 600 }],
                temperature: null,
                equipment: ['mixing bowl'],
                technique: 'Cut against the grain for tender strips',
                goodToKnow: null,
              }],
            }],
          }),
        }],
      }),
    },
  })),
}));

import { processRecipeWithAI } from '../../connector/process-recipe';
import type { ParsedGroup, ParsedInstructionGroup } from '../../connector/parse-mela';

describe('processRecipeWithAI', () => {
  it('returns processed groups from Claude response', async () => {
    const ingredientGroups: ParsedGroup[] = [
      { name: 'Marinade', ingredients: ['350g flank steak', '1 tsp cornstarch'] },
    ];
    const instructionGroups: ParsedInstructionGroup[] = [
      { name: 'Marinade', text: 'Slice the beef into strips. Mix with cornstarch.' },
    ];

    const result = await processRecipeWithAI({
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      title: 'Test Recipe',
      ingredientGroups,
      instructionGroups,
      notes: '',
      servings: '2',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Marinade');
    expect(result[0].steps).toHaveLength(1);
    expect(result[0].steps[0].timers).toHaveLength(1);
    expect(result[0].steps[0].timers[0].durationSeconds).toBe(600);
  });

  it('throws on invalid Claude response', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json' }],
        }),
      },
    }));

    await expect(processRecipeWithAI({
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      title: 'Test',
      ingredientGroups: [],
      instructionGroups: [],
      notes: '',
      servings: '2',
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/connector/connector.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the processor**

```ts
// connector/process-recipe.ts
import Anthropic from '@anthropic-ai/sdk';
import type { ParsedGroup, ParsedInstructionGroup } from './parse-mela';

export interface ProcessedGroup {
  name: string;
  ingredients: { id: string; text: string; isReference: boolean; referencesGroup?: string }[];
  steps: {
    text: string;
    linkedIngredientIds: string[];
    timers: { label: string; durationSeconds: number; maxDurationSeconds?: number }[];
    temperature: string | null;
    equipment: string[];
    technique: string | null;
    goodToKnow: string | null;
  }[];
}

interface ProcessRecipeInput {
  apiKey: string;
  model: string;
  title: string;
  ingredientGroups: ParsedGroup[];
  instructionGroups: ParsedInstructionGroup[];
  notes: string;
  servings: string;
}

const SYSTEM_PROMPT = `You are a recipe processing assistant. Given a recipe's ingredients and instructions (already split into groups), produce a structured JSON output.

For each group, you must:
1. Break the instruction text into individual, clearly-worded steps.
2. Assign each ingredient a unique ID formatted as "{group-index}-{ingredient-index}" (e.g., "0-0", "0-1", "1-0").
3. Link ingredients to steps by their IDs. Handle:
   - Explicit: ingredient in the same group.
   - Implicit: step references an ingredient from another group (e.g., "add the marinated beef"). Create a reference ingredient with isReference=true.
   - Whole-component: step references an entire previous group's output (e.g., "pour the vinaigrette"). Use isReference=true and set referencesGroup to the group name.
4. Extract timers with duration in seconds and a descriptive label. For ranges use durationSeconds for the minimum and maxDurationSeconds for the maximum.
5. Extract temperatures (oven, stovetop heat levels).
6. Extract equipment needed for the step.
7. Generate a one-sentence technique tip when the technique is important or tricky. Mark these as AI-generated.
8. Generate "good to know" callouts from the recipe notes or when a step produces something needed later by another group.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "groups": [
    {
      "name": "Group Name",
      "ingredients": [
        { "id": "0-0", "text": "350g flank steak", "isReference": false }
      ],
      "steps": [
        {
          "text": "Step instruction text",
          "linkedIngredientIds": ["0-0"],
          "timers": [{ "label": "Rest", "durationSeconds": 600 }],
          "temperature": null,
          "equipment": ["mixing bowl"],
          "technique": null,
          "goodToKnow": null
        }
      ]
    }
  ]
}`;

export async function processRecipeWithAI(input: ProcessRecipeInput): Promise<ProcessedGroup[]> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const userMessage = `Recipe: ${input.title}
Servings: ${input.servings}

INGREDIENT GROUPS:
${input.ingredientGroups.map((g, i) => `## Group ${i}: ${g.name}\n${g.ingredients.join('\n')}`).join('\n\n')}

INSTRUCTION GROUPS:
${input.instructionGroups.map((g, i) => `## Group ${i}: ${g.name}\n${g.text}`).join('\n\n')}

${input.notes ? `RECIPE NOTES:\n${input.notes}` : ''}`;

  const response = await client.messages.create({
    model: input.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const parsed = JSON.parse(textBlock.text);
  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    throw new Error('Invalid response structure: missing groups array');
  }

  return parsed.groups as ProcessedGroup[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/connector/connector.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add connector/process-recipe.ts tests/connector/connector.test.ts
git commit -m "feat: add Claude AI recipe processor with tests"
```

---

### Task 6: Wire up the connector

**Files:**
- Modify: `connector/index.ts`

- [ ] **Step 1: Implement the connector with onApiCall**

```ts
// connector/index.ts
import type { ServerSdk } from '../hubble-sdk';
import { parseMelaIngredients, parseMelaInstructions, extractMelaImage } from './parse-mela';
import type { MelaRecipe } from './parse-mela';
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

export default function connector(sdk: ServerSdk) {
  const config = sdk.getConfig() as { anthropicApiKey?: string; anthropicModel?: string };
  const recipes = new Map<string, ProcessedRecipe>();

  function emitAll() {
    sdk.emit('hubble-mela-recipe-viewer:data', {
      recipes: Object.fromEntries(recipes),
    });
  }

  sdk.onApiCall(async ({ action, body }) => {
    if (action !== 'receive') {
      return { error: `Unknown action: ${action}` };
    }

    const mela = body as MelaRecipe;
    if (!mela || !mela.title || !mela.ingredients || !mela.instructions) {
      return { error: 'Invalid mela recipe: missing required fields' };
    }

    const recipeId = mela.id || `recipe-${Date.now()}`;

    // Emit processing state immediately
    recipes.set(recipeId, {
      id: recipeId,
      status: 'processing',
      title: mela.title,
      image: extractMelaImage(mela.images),
      servings: mela.yield || '',
      prepTime: mela.prepTime || '',
      cookTime: mela.cookTime || '',
      totalTime: mela.totalTime || '',
      notes: mela.notes || '',
      groups: [],
    });
    emitAll();

    // Parse deterministically
    const ingredientGroups = parseMelaIngredients(mela.ingredients);
    const instructionGroups = parseMelaInstructions(mela.instructions);

    // Process with AI
    if (!config.anthropicApiKey) {
      const errorMsg = 'Anthropic API key not configured';
      sdk.log.error(errorMsg);
      recipes.set(recipeId, { ...recipes.get(recipeId)!, status: 'error', error: errorMsg });
      emitAll();
      return { error: errorMsg };
    }

    try {
      const groups = await processRecipeWithAI({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel || 'claude-sonnet-4-6',
        title: mela.title,
        ingredientGroups,
        instructionGroups,
        notes: mela.notes || '',
        servings: mela.yield || '',
      });

      recipes.set(recipeId, {
        ...recipes.get(recipeId)!,
        status: 'ready',
        groups,
      });
      emitAll();

      sdk.log.info(`Recipe processed: ${mela.title} (${groups.length} groups)`);
      return { ok: true, id: recipeId };
    } catch (err) {
      const errorMsg = `AI processing failed: ${err}`;
      sdk.log.error(errorMsg);
      recipes.set(recipeId, { ...recipes.get(recipeId)!, status: 'error', error: errorMsg });
      emitAll();
      return { error: errorMsg };
    }
  });
}
```

- [ ] **Step 2: Run all connector tests**

Run: `npx vitest run tests/connector/`
Expected: All PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add connector/index.ts
git commit -m "feat: wire up connector with API endpoint and AI processing"
```

---

## Chunk 3: Visualization — CSS + Core Components

### Task 7: CSS Styles

**Files:**
- Modify: `visualizations/default/style.css`

- [ ] **Step 1: Write all rcp-* styles**

Replace the entire contents of `style.css` with the dashboard design system styles from the spec. All CSS classes are documented in the spec's "CSS Classes" section. Use `--dash-*` variables throughout. Reference the mockup at `.superpowers/brainstorm/41279-1773742516/recipe-widget-v6.html` for exact values.

Key sections:
- Layout (`.rcp-layout`, `.rcp-left`, `.rcp-right`)
- Image (`.rcp-image-wrap`, overlay, title)
- Ingredients (`.rcp-group`, `.rcp-row` with all states, `.rcp-check` variants, `.rcp-group-collapsed`)
- Steps (`.rcp-step-nav`, `.rcp-progress`, `.rcp-prev-step`, `.rcp-step-text`)
- Callouts (`.rcp-callout` with 5 modifier classes)
- Footer (`.rcp-footer`, `.rcp-switcher`, `.rcp-switch-item`, `.rcp-switch-status` with 4 states)
- States (`.rcp-overview`, `.rcp-done`, `.rcp-empty`)

Exact values are in the spec and the v6 mockup HTML file.

- [ ] **Step 2: Commit**

```bash
git add visualizations/default/style.css
git commit -m "feat: add dashboard design system styles for recipe viewer"
```

---

### Task 8: Simple components (EmptyState, ProcessingState, DonePanel, Callout, RecipeImage)

**Files:**
- Create: `visualizations/default/components/EmptyState.tsx`
- Create: `visualizations/default/components/ProcessingState.tsx`
- Create: `visualizations/default/components/DonePanel.tsx`
- Create: `visualizations/default/components/Callout.tsx`
- Create: `visualizations/default/components/RecipeImage.tsx`
- Create: `visualizations/default/components/RecipeSwitcher.tsx`

These are presentational components with no complex state. Build them test-first.

- [ ] **Step 1: Write tests for simple components**

```ts
// tests/visualizations/default.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Import components as they are built — add tests incrementally

import { EmptyState } from '../../../visualizations/default/components/EmptyState';
import { DonePanel } from '../../../visualizations/default/components/DonePanel';
import { Callout } from '../../../visualizations/default/components/Callout';

describe('EmptyState', () => {
  it('renders waiting message', () => {
    render(<EmptyState />);
    expect(screen.getByText('Waiting for recipe…')).toBeInTheDocument();
  });
});

describe('DonePanel', () => {
  it('renders completion with step count', () => {
    render(<DonePanel totalSteps={7} />);
    expect(screen.getByText('Eet smakelijk!')).toBeInTheDocument();
    expect(screen.getByText('All 7 steps completed')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  it('renders timer callout', () => {
    render(<Callout type="timer" title="Rest 10 min" subtitle="Let marinade absorb" />);
    expect(screen.getByText('Rest 10 min')).toBeInTheDocument();
    expect(screen.getByText('Let marinade absorb')).toBeInTheDocument();
  });

  it('renders technique callout', () => {
    render(<Callout type="technique" title="Cut against the grain" />);
    expect(screen.getByText('Cut against the grain')).toBeInTheDocument();
  });

  it('renders all 5 types without errors', () => {
    const types = ['timer', 'technique', 'temp', 'equip', 'tip'] as const;
    types.forEach(type => {
      const { unmount } = render(<Callout type={type} title={`Test ${type}`} />);
      expect(screen.getByText(`Test ${type}`)).toBeInTheDocument();
      unmount();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/visualizations/default.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement EmptyState**

```tsx
// visualizations/default/components/EmptyState.tsx
import React from 'react';

export function EmptyState() {
  return (
    <div className="rcp-empty">
      <div className="rcp-empty-icon">🍳</div>
      <div className="rcp-empty-text">Waiting for recipe…</div>
      <div className="rcp-empty-sub">Send a recipe from Mela to get started</div>
    </div>
  );
}
```

- [ ] **Step 4: Implement ProcessingState**

```tsx
// visualizations/default/components/ProcessingState.tsx
import React from 'react';

export function ProcessingState({ title }: { title: string }) {
  return (
    <div className="rcp-empty">
      <div className="rcp-empty-icon">🔄</div>
      <div className="rcp-empty-text">Processing recipe…</div>
      <div className="rcp-empty-sub">{title}</div>
    </div>
  );
}
```

- [ ] **Step 5: Implement DonePanel**

```tsx
// visualizations/default/components/DonePanel.tsx
import React from 'react';

export function DonePanel({ totalSteps }: { totalSteps: number }) {
  return (
    <div className="rcp-done">
      <div className="rcp-done-icon">✓</div>
      <div className="rcp-done-title">Eet smakelijk!</div>
      <div className="rcp-done-sub">All {totalSteps} steps completed</div>
    </div>
  );
}
```

- [ ] **Step 6: Implement Callout**

```tsx
// visualizations/default/components/Callout.tsx
import React from 'react';

type CalloutType = 'timer' | 'technique' | 'temp' | 'equip' | 'tip';

const ICONS: Record<CalloutType, string> = {
  timer: '⏱',
  technique: '🔪',
  temp: '🔥',
  equip: '🍳',
  tip: '💡',
};

interface CalloutProps {
  type: CalloutType;
  title: string;
  subtitle?: string;
}

export function Callout({ type, title, subtitle }: CalloutProps) {
  return (
    <div className={`rcp-callout rcp-callout--${type}`}>
      <span className="rcp-callout-icon">{ICONS[type]}</span>
      <span className="rcp-callout-title">{title}</span>
      {subtitle && <span className="rcp-callout-sub">{subtitle}</span>}
    </div>
  );
}
```

- [ ] **Step 7: Implement RecipeImage**

```tsx
// visualizations/default/components/RecipeImage.tsx
import React from 'react';

interface RecipeImageProps {
  image: string;
  title: string;
  servings: string;
  prepTime: string;
  cookTime: string;
}

export function RecipeImage({ image, title, servings, prepTime, cookTime }: RecipeImageProps) {
  const metaParts = [servings, prepTime ? `${prepTime} prep` : '', cookTime ? `${cookTime} cook` : ''].filter(Boolean);

  return (
    <div className="rcp-image-wrap">
      {image && <img className="rcp-image" src={`data:image/jpeg;base64,${image}`} alt={title} />}
      <div className="rcp-image-overlay">
        <div className="rcp-image-title">{title}</div>
        {metaParts.length > 0 && (
          <div className="rcp-image-meta">
            {metaParts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>·</span>}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Implement RecipeSwitcher**

```tsx
// visualizations/default/components/RecipeSwitcher.tsx
import React from 'react';
import type { ProcessedRecipe, RecipePhase } from '../types';

interface RecipeSwitcherProps {
  recipes: ProcessedRecipe[];
  activeId: string;
  phases: Record<string, RecipePhase>;
  stepProgress: Record<string, { current: number; total: number }>;
}

function getStatusClass(phase: RecipePhase): string {
  switch (phase) {
    case 'waiting': return 'rcp-switch-status--waiting';
    case 'gathering': return 'rcp-switch-status--gathering';
    case 'cooking': return 'rcp-switch-status--cooking';
    case 'done': return 'rcp-switch-status--done';
  }
}

function getProgressLabel(phase: RecipePhase, progress?: { current: number; total: number }): string {
  switch (phase) {
    case 'waiting': return 'new';
    case 'gathering': return 'gather';
    case 'done': return 'done';
    case 'cooking': return progress ? `${progress.current}/${progress.total}` : '';
  }
}

export function RecipeSwitcher({ recipes, activeId, phases, stepProgress }: RecipeSwitcherProps) {
  if (recipes.length < 2) {
    return (
      <div className="rcp-footer">
        <div className="rcp-footer-single">
          <div className="status-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="rcp-footer">
      <div className="rcp-switcher">
        {recipes.map(recipe => (
          <div
            key={recipe.id}
            className={`rcp-switch-item${recipe.id === activeId ? ' rcp-switch-item--active' : ''}`}
          >
            <div className={`rcp-switch-status ${getStatusClass(phases[recipe.id] || 'waiting')}`} />
            <span className="rcp-switch-name">{recipe.title}</span>
            <span className="rcp-switch-progress">
              {getProgressLabel(phases[recipe.id] || 'waiting', stepProgress[recipe.id])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/visualizations/default.test.tsx`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add visualizations/default/components/
git commit -m "feat: add presentational components (empty, done, callout, image, switcher)"
```

---

## Chunk 4: Visualization — Complex Components + Navigation Hook

### Task 9: useRecipeNavigation hook

**Files:**
- Create: `visualizations/default/hooks/useRecipeNavigation.ts`
- Create: `tests/visualizations/use-recipe-navigation.test.ts`

This is the core state machine. It manages: active recipe, phase transitions (waiting→gathering→cooking→done), step navigation, gather cursor, ingredient checking, and button dispatch.

- [ ] **Step 1: Write failing tests for the navigation hook**

Test the state machine logic: phase transitions, step advancement, ingredient auto-checking, gather cursor. Use `@testing-library/react`'s `renderHook`.

Key test cases:
- Initial state is 'waiting' when recipe arrives
- B1 in waiting → transitions to 'gathering'
- B1 in gathering → advances gather cursor, B3 toggles check
- B1 when all gathered → transitions to 'cooking', resets checks
- B1 in cooking → advances step, auto-checks linked ingredients
- B2 in cooking → goes to prev step
- B2 on step 1 → returns to overview
- B1 on last step → transitions to 'done'
- B3 in cooking with timer → returns timer data
- B3 in done → dismisses recipe
- B4 → cycles active recipe

- [ ] **Step 2: Run to verify failures**

- [ ] **Step 3: Implement useRecipeNavigation**

The hook takes the recipe data from connector + button events from `useHubbleSDK().onButton()` and manages all state transitions. Returns current phase, step indices, ingredient states, and active recipe ID.

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git add visualizations/default/hooks/ tests/visualizations/use-recipe-navigation.test.ts
git commit -m "feat: add recipe navigation state machine hook with tests"
```

---

### Task 10: IngredientPanel component

**Files:**
- Create: `visualizations/default/components/IngredientPanel.tsx`
- Create: `tests/visualizations/ingredient-panel.test.tsx`

- [ ] **Step 1: Write failing tests**

Test: renders grouped ingredients, shows gather checks (blue) in gather phase, shows used checks (green) in cook phase, highlights active ingredients, collapses done groups, shows reference ingredients without checkbox.

- [ ] **Step 2: Implement IngredientPanel**

Renders: RecipeImage at top, then scrollable ingredient list with groups. Each row has a checkbox (state-dependent) and ingredient name. Collapsed groups show "N/N ✓". Active ingredients get blue border + tinted bg.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add visualizations/default/components/IngredientPanel.tsx tests/visualizations/ingredient-panel.test.tsx
git commit -m "feat: add ingredient panel with gather/cook states"
```

---

### Task 11: StepPanel and OverviewPanel components

**Files:**
- Create: `visualizations/default/components/StepPanel.tsx`
- Create: `visualizations/default/components/OverviewPanel.tsx`
- Create: `tests/visualizations/step-panel.test.tsx`

- [ ] **Step 1: Write failing tests**

Test StepPanel: renders step nav with group name + counter, carousel dots with done states, progress bar, previous step dimmed, current step text, callouts for all 5 types.
Test OverviewPanel: renders component list with step counts, notes section.

- [ ] **Step 2: Implement OverviewPanel**

Component list rows + notes section. Simple presentational component.

- [ ] **Step 3: Implement StepPanel**

Step nav bar with carousel dots, progress bar, optional previous step, current step text, callouts list.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add visualizations/default/components/StepPanel.tsx visualizations/default/components/OverviewPanel.tsx tests/visualizations/step-panel.test.tsx
git commit -m "feat: add step panel and overview panel components"
```

---

## Chunk 5: Visualization — Main Component + Integration

### Task 12: Wire up the main visualization

**Files:**
- Modify: `visualizations/default/index.tsx`

- [ ] **Step 1: Implement main visualization**

The main component:
1. Subscribes to connector data via `useConnectorData<RecipeViewerData>()`
2. Uses `useRecipeNavigation` hook for all state management
3. Wires up `useHubbleSDK().onButton()` for B1–B4
4. Renders: empty state if no recipes, processing state if active recipe is processing, error state if failed, otherwise the two-panel layout with IngredientPanel (left) + StepPanel/OverviewPanel/DonePanel (right) + RecipeSwitcher (footer)

```tsx
// visualizations/default/index.tsx
import React, { useEffect } from 'react';
import { useConnectorData, useHubbleSDK } from '@hubble/sdk';
import type { RecipeViewerData } from './types';
import { useRecipeNavigation } from './hooks/useRecipeNavigation';
import { EmptyState } from './components/EmptyState';
import { ProcessingState } from './components/ProcessingState';
import { RecipeImage } from './components/RecipeImage';
import { IngredientPanel } from './components/IngredientPanel';
import { StepPanel } from './components/StepPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { DonePanel } from './components/DonePanel';
import { RecipeSwitcher } from './components/RecipeSwitcher';
import './style.css';

export default function RecipeViewer() {
  const data = useConnectorData<RecipeViewerData>();
  const sdk = useHubbleSDK();
  const nav = useRecipeNavigation(data);

  // Wire hardware buttons
  useEffect(() => {
    const unsubs = [
      sdk.onButton('button1', () => nav.handleButton('primary')),
      sdk.onButton('button2', () => nav.handleButton('back')),
      sdk.onButton('button3', () => nav.handleButton('contextual')),
      sdk.onButton('button4', () => nav.handleButton('switch')),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [sdk, nav]);

  // Handle timer start via B3
  useEffect(() => {
    if (nav.pendingTimer) {
      sdk.callApi('start-available', {
        duration: nav.pendingTimer.durationSeconds,
        label: nav.pendingTimer.label,
      }).catch(() => {
        // Timer module unavailable — silently ignore
      });
      nav.clearPendingTimer();
    }
  }, [nav.pendingTimer, sdk, nav]);

  // No data yet or no recipes
  if (!data || Object.keys(data.recipes).length === 0) {
    return (
      <div className="dash-glass rcp-widget-single">
        <EmptyState />
      </div>
    );
  }

  const recipe = nav.activeRecipe;
  if (!recipe) return null;

  // Processing state
  if (recipe.status === 'processing') {
    return (
      <div className="dash-glass rcp-widget-single">
        <ProcessingState title={recipe.title} />
      </div>
    );
  }

  // Error state
  if (recipe.status === 'error') {
    return (
      <div className="dash-glass rcp-widget-single">
        <div className="rcp-empty">
          <div className="rcp-empty-icon">⚡</div>
          <div className="rcp-empty-text">Failed to process recipe</div>
          <div className="rcp-empty-sub">{recipe.error}</div>
        </div>
      </div>
    );
  }

  const recipes = Object.values(data.recipes).filter(r => r.status === 'ready');
  const totalSteps = recipe.groups.reduce((sum, g) => sum + g.steps.length, 0);

  return (
    <div className="dash-glass rcp-widget">
      <div className="rcp-layout">
        {/* Left panel */}
        <div className="rcp-left">
          <RecipeImage
            image={recipe.image}
            title={recipe.title}
            servings={recipe.servings}
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
          />
          <IngredientPanel
            groups={recipe.groups}
            phase={nav.phase}
            activeIngredientIds={nav.activeIngredientIds}
            gatheredIds={nav.gatheredIds}
            usedIds={nav.usedIds}
            gatherCursorIndex={nav.gatherCursorIndex}
          />
        </div>

        {/* Right panel */}
        <div className="rcp-right">
          {nav.phase === 'waiting' || nav.phase === 'gathering' ? (
            <OverviewPanel
              groups={recipe.groups}
              notes={recipe.notes}
              totalSteps={totalSteps}
            />
          ) : nav.phase === 'done' ? (
            <DonePanel totalSteps={totalSteps} />
          ) : (
            <StepPanel
              groups={recipe.groups}
              currentGroupIndex={nav.currentGroupIndex}
              currentStepIndex={nav.currentStepIndex}
              totalSteps={totalSteps}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <RecipeSwitcher
        recipes={recipes}
        activeId={nav.activeRecipeId}
        phases={nav.allPhases}
        stepProgress={nav.allStepProgress}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add visualizations/default/index.tsx
git commit -m "feat: wire up main visualization with all components and button handling"
```

---

### Task 13: Integration test with real recipe data

**Files:**
- Modify: `tests/visualizations/default.test.tsx`

- [ ] **Step 1: Add integration tests**

Test the full render with mock connector data matching a processed beef stir-fry recipe. Verify: image renders, ingredients show, overview panel shows group names, step counts.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Final commit**

```bash
git add tests/
git commit -m "feat: add integration tests with real recipe data"
```

---

## Chunk 6: Timer Module Change

### Task 14: Add `start-available` endpoint to hubble-timer

**Files:**
- Modify: `/Users/luc/repos/hubble-timer/connector/index.ts`
- Modify: `/Users/luc/repos/hubble-timer/manifest.json`

This is a separate module change. The recipe viewer depends on it for B3 timer functionality, but the recipe viewer works without it (B3 just becomes a no-op on timer steps if the timer module doesn't support `start-available`).

- [ ] **Step 1: Add `start-available` to timer manifest endpoints**

```json
{
  "name": "start-available",
  "method": "POST",
  "path": "/start-available",
  "description": "Start the first available idle timer",
  "body": {
    "type": "object",
    "required": ["duration", "label"],
    "properties": {
      "duration": { "type": "number", "description": "Duration in seconds" },
      "label": { "type": "string", "description": "Timer display label" }
    }
  }
}
```

- [ ] **Step 2: Add handler in timer connector**

In the `sdk.onApiCall` switch statement, add a `case 'start-available'` that:
1. Gets all widget configs via `sdk.getWidgetConfigs()`
2. Finds the first slug whose state is `'idle'` or doesn't exist yet
3. Calls the existing `start` logic with that slug + the provided duration/label
4. Returns `{ ok: true, slug }` or `{ ok: false, error: 'all-busy' }`

- [ ] **Step 3: Test manually**

- [ ] **Step 4: Commit in hubble-timer repo**

```bash
cd /Users/luc/repos/hubble-timer
git add connector/index.ts manifest.json
git commit -m "feat: add start-available endpoint for recipe module integration"
```

---

## Verification

After all tasks are complete:

1. **Unit tests:** `npm test` — all pass
2. **Lint:** `npm run lint` — no errors
3. **Manifest validation:** `npm run validate` — pass
4. **Manual test flow:**
   - Start Hubble in dev mode: `npm run dev`
   - Send a test recipe via curl:
     ```bash
     curl -X POST http://localhost:3000/api/modules/hubble-mela-recipe-viewer/receive \
       -H "Content-Type: application/vnd.melarecipe" \
       -d @"Black pepper beef stir-fry.melarecipe"
     ```
   - Verify: widget shows processing → overview with ingredients
   - Test B1 through gather → cook flow
   - Test B3 timer start on a timer step
   - Send a second recipe, verify switcher appears in footer
   - Complete recipe, verify done state + B3 dismiss
