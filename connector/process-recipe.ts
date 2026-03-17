import Anthropic from '@anthropic-ai/sdk';
import type { ParsedGroup, ParsedInstructionGroup } from './parse-mela';

export interface ProcessRecipeInput {
  apiKey: string;
  model: string;
  title: string;
  ingredientGroups: ParsedGroup[];
  instructionGroups: ParsedInstructionGroup[];
  notes: string;
  servings: string;
}

export interface ProcessedIngredient {
  id: string;
  text: string;
  isReference: boolean;
  referencesGroup?: string;
}

export interface ProcessedTimer {
  label: string;
  durationSeconds: number;
  maxDurationSeconds?: number;
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

export interface ProcessedGroup {
  name: string;
  ingredients: ProcessedIngredient[];
  steps: ProcessedStep[];
}

const SYSTEM_PROMPT = `You are a recipe processing assistant. Given a recipe's ingredients and instructions, you must return structured JSON.

IMPORTANT — GROUPING:
- If the recipe already has named groups (provided as separate ingredient/instruction groups), preserve those groups.
- If the recipe has only ONE group with all ingredients and all instructions lumped together, you MUST analyze the recipe and split it into logical component groups (e.g., "Marinade", "Sauce", "Glaze", "Stir-fry", "Assembly"). Only create a group if you are 80% or more confident it is a distinct component. Common patterns: marinades, sauces, doughs, fillings, toppings, glazes, garnishes, assembly/plating. Each group gets its own subset of ingredients and steps.
- Redistribute the ingredients to their correct groups. For example, if the recipe lists all ingredients in one block but has a marinade phase, move the marinade ingredients into a "Marinade" group.

Your tasks:
1. Break instruction blocks into individual, clearly-worded steps. Each step should be one concrete action.
2. Assign each ingredient a unique ID using the format "{groupIndex}-{ingredientIndex}" (e.g., "0-0" for the first ingredient of the first group, "1-2" for the third ingredient of the second group). Group indices must match the output group order.
3. Link ingredients to steps:
   - Explicit: when a step directly uses an ingredient from its own group, link by ID.
   - Implicit cross-group reference: when a step references an ingredient from another group, create a reference ingredient with isReference=true in the current group.
   - Whole-component reference: when a step uses an entire sub-recipe/component (e.g., "add the marinade"), create a reference ingredient with isReference=true and referencesGroup set to the referenced group's name.
4. Extract timers with durationSeconds. For time ranges (e.g., "5-7 minutes"), set durationSeconds to the minimum and maxDurationSeconds to the maximum.
5. Extract temperatures (e.g., "180°C", "350°F") into the temperature field.
6. Extract equipment mentioned in each step (e.g., "wok", "oven", "bowl").
7. Generate a one-sentence technique tip when a step involves a specific cooking technique. Set to null if none.
8. Generate a brief "good to know" callout when relevant context from notes or cross-group information would help the cook. Set to null if none.

Return ONLY valid JSON with this exact structure:
{
  "groups": [
    {
      "name": "Group Name",
      "ingredients": [
        { "id": "0-0", "text": "1 cup flour", "isReference": false }
      ],
      "steps": [
        {
          "text": "Step description",
          "linkedIngredientIds": ["0-0"],
          "timers": [{ "label": "Bake", "durationSeconds": 1800, "maxDurationSeconds": 2100 }],
          "temperature": "180°C",
          "equipment": ["oven"],
          "technique": "A brief technique tip.",
          "goodToKnow": "A helpful note."
        }
      ]
    }
  ]
}

Do not include any text outside the JSON object. Do not wrap it in markdown code fences.`;

export async function processRecipeWithAI(input: ProcessRecipeInput): Promise<ProcessedGroup[]> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model: input.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response contained no text block');
  }

  // Strip markdown code fences if Claude wraps the JSON in ```json ... ```
  let jsonText = textBlock.text.trim();
  const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${jsonText.slice(0, 200)}`);
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('groups' in parsed) ||
    !Array.isArray((parsed as { groups: unknown }).groups)
  ) {
    throw new Error('Claude response JSON does not contain a valid "groups" array');
  }

  return (parsed as { groups: ProcessedGroup[] }).groups;
}

function buildUserMessage(input: ProcessRecipeInput): string {
  const parts: string[] = [];

  parts.push(`Recipe: ${input.title}`);

  if (input.servings) {
    parts.push(`Servings: ${input.servings}`);
  }

  parts.push('');
  parts.push('## Ingredient Groups');
  for (let gi = 0; gi < input.ingredientGroups.length; gi++) {
    const group = input.ingredientGroups[gi];
    parts.push(`### ${group.name} (groupIndex: ${gi})`);
    for (let ii = 0; ii < group.ingredients.length; ii++) {
      parts.push(`- [${gi}-${ii}] ${group.ingredients[ii]}`);
    }
  }

  parts.push('');
  parts.push('## Instruction Groups');
  for (const group of input.instructionGroups) {
    parts.push(`### ${group.name}`);
    parts.push(group.text);
  }

  if (input.notes) {
    parts.push('');
    parts.push('## Notes');
    parts.push(input.notes);
  }

  return parts.join('\n');
}
