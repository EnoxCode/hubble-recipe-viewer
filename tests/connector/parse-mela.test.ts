import { describe, it, expect } from 'vitest';
import {
  parseMelaIngredients,
  parseMelaInstructions,
  extractMelaImage,
  type ParsedGroup,
  type ParsedInstructionGroup,
} from '../../connector/parse-mela';

describe('parseMelaIngredients', () => {
  it('parses ingredients without groups into a single "Ingredients" group', () => {
    const raw = '1 cup flour\n2 eggs\n1 tsp salt';
    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      {
        name: 'Ingredients',
        ingredients: ['1 cup flour', '2 eggs', '1 tsp salt'],
      },
    ]);
  });

  it('skips empty lines', () => {
    const raw = '1 cup flour\n\n2 eggs\n\n';
    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      {
        name: 'Ingredients',
        ingredients: ['1 cup flour', '2 eggs'],
      },
    ]);
  });

  it('splits on # headers into multiple groups', () => {
    const raw = `# Group A
item 1
item 2
# Group B
item 3`;
    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      { name: 'Group A', ingredients: ['item 1', 'item 2'] },
      { name: 'Group B', ingredients: ['item 3'] },
    ]);
  });

  it('strips trailing colons from group names', () => {
    const raw = `# Voor de salade:
1 biet
# Voor de saus:
2 el olie`;
    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      { name: 'Voor de salade', ingredients: ['1 biet'] },
      { name: 'Voor de saus', ingredients: ['2 el olie'] },
    ]);
  });

  it('parses real beef stir-fry ingredients', () => {
    const raw = `# For the marinade
350 g flank or skirt steak - (12oz (see note 1 & 2))
1 teaspoon cornstarch
1 teaspoon Shaoxing rice wine
1 teaspoon light soy sauce
1 teaspoon sesame oil
1 teaspoon ginger - (julienned)
# For the sauce
2 tablespoons oyster sauce
1 tablespoon dark soy sauce`;

    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      {
        name: 'For the marinade',
        ingredients: [
          '350 g flank or skirt steak - (12oz (see note 1 & 2))',
          '1 teaspoon cornstarch',
          '1 teaspoon Shaoxing rice wine',
          '1 teaspoon light soy sauce',
          '1 teaspoon sesame oil',
          '1 teaspoon ginger - (julienned)',
        ],
      },
      {
        name: 'For the sauce',
        ingredients: [
          '2 tablespoons oyster sauce',
          '1 tablespoon dark soy sauce',
        ],
      },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseMelaIngredients('')).toEqual([]);
  });

  it('handles items before the first group header', () => {
    const raw = `ungrouped item
# Group A
item 1`;
    const result = parseMelaIngredients(raw);
    expect(result).toEqual<ParsedGroup[]>([
      { name: 'Ingredients', ingredients: ['ungrouped item'] },
      { name: 'Group A', ingredients: ['item 1'] },
    ]);
  });
});

describe('parseMelaInstructions', () => {
  it('parses instructions without groups into a single "Instructions" group', () => {
    const raw = 'Step one.\nStep two.\nStep three.';
    const result = parseMelaInstructions(raw);
    expect(result).toEqual<ParsedInstructionGroup[]>([
      { name: 'Instructions', text: 'Step one.\nStep two.\nStep three.' },
    ]);
  });

  it('splits on # headers into multiple groups', () => {
    const raw = `# Phase 1
Do thing A.
Do thing B.
# Phase 2
Do thing C.`;
    const result = parseMelaInstructions(raw);
    expect(result).toEqual<ParsedInstructionGroup[]>([
      { name: 'Phase 1', text: 'Do thing A.\nDo thing B.' },
      { name: 'Phase 2', text: 'Do thing C.' },
    ]);
  });

  it('strips trailing colons from group names', () => {
    const raw = `# Voor de salade van gele biet:
Verwarm de oven voor op 190\u2013200\u00B0C.
Meng grof zeezout met een beetje eiwit tot een nat-zanderige massa.
# Voor de tuile van gele biet:
Maal in een koffiemolentje de schillen tot fijn poeder.
Meng boter, eiwit, suiker en zout glad.`;

    const result = parseMelaInstructions(raw);
    expect(result).toEqual<ParsedInstructionGroup[]>([
      {
        name: 'Voor de salade van gele biet',
        text: 'Verwarm de oven voor op 190\u2013200\u00B0C.\nMeng grof zeezout met een beetje eiwit tot een nat-zanderige massa.',
      },
      {
        name: 'Voor de tuile van gele biet',
        text: 'Maal in een koffiemolentje de schillen tot fijn poeder.\nMeng boter, eiwit, suiker en zout glad.',
      },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseMelaInstructions('')).toEqual([]);
  });

  it('skips empty lines within groups', () => {
    const raw = 'Line one.\n\nLine two.';
    const result = parseMelaInstructions(raw);
    expect(result).toEqual<ParsedInstructionGroup[]>([
      { name: 'Instructions', text: 'Line one.\nLine two.' },
    ]);
  });

  it('handles text before the first group header', () => {
    const raw = `Preheat oven.
# Main steps
Cook the food.`;
    const result = parseMelaInstructions(raw);
    expect(result).toEqual<ParsedInstructionGroup[]>([
      { name: 'Instructions', text: 'Preheat oven.' },
      { name: 'Main steps', text: 'Cook the food.' },
    ]);
  });
});

describe('extractMelaImage', () => {
  it('returns the first image from the array', () => {
    expect(extractMelaImage(['img1.jpg', 'img2.jpg'])).toBe('img1.jpg');
  });

  it('returns empty string for undefined', () => {
    expect(extractMelaImage(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(extractMelaImage([])).toBe('');
  });
});
