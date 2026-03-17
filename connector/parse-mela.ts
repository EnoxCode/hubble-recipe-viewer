export interface ParsedGroup {
  name: string;
  ingredients: string[];
}

export interface ParsedInstructionGroup {
  name: string;
  text: string;
}

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

interface RawGroup {
  name: string;
  lines: string[];
}

function splitIntoGroups(raw: string, defaultName: string): RawGroup[] {
  const lines = raw.split('\n');
  const groups: RawGroup[] = [];
  let current: RawGroup | null = null;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      const name = line.slice(2).replace(/:$/, '').trim();
      current = { name, lines: [] };
      groups.push(current);
    } else {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (!current) {
        current = { name: defaultName, lines: [] };
        groups.push(current);
      }
      current.lines.push(trimmed);
    }
  }

  return groups;
}

export function parseMelaIngredients(raw: string): ParsedGroup[] {
  if (raw.trim() === '') return [];

  const groups = splitIntoGroups(raw, 'Ingredients');
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g) => ({
      name: g.name,
      ingredients: g.lines,
    }));
}

export function parseMelaInstructions(raw: string): ParsedInstructionGroup[] {
  if (raw.trim() === '') return [];

  const groups = splitIntoGroups(raw, 'Instructions');
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g) => ({
      name: g.name,
      text: g.lines.join('\n'),
    }));
}

export function extractMelaImage(images: string[] | undefined): string {
  if (!images || images.length === 0) return '';
  return images[0];
}
