import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParsedGroup, ParsedInstructionGroup } from '../../connector/parse-mela';
import type { ProcessedGroup } from '../../connector/process-recipe';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return { default: MockAnthropic };
});

import { processRecipeWithAI } from '../../connector/process-recipe';

const sampleInput = {
  apiKey: 'test-key',
  model: 'claude-sonnet-4-6',
  title: 'Test Recipe',
  ingredientGroups: [
    { name: 'Ingredients', ingredients: ['1 cup flour', '2 eggs'] },
  ] as ParsedGroup[],
  instructionGroups: [
    { name: 'Instructions', text: 'Mix flour and eggs. Bake at 180°C for 30 minutes.' },
  ] as ParsedInstructionGroup[],
  notes: 'Can substitute almond flour.',
  servings: '4',
};

const sampleResponseGroups: ProcessedGroup[] = [
  {
    name: 'Instructions',
    ingredients: [
      { id: '0-0', text: '1 cup flour', isReference: false },
      { id: '0-1', text: '2 eggs', isReference: false },
    ],
    steps: [
      {
        text: 'Mix flour and eggs together in a bowl.',
        linkedIngredientIds: ['0-0', '0-1'],
        timers: [],
        temperature: null,
        equipment: ['bowl'],
        technique: 'Fold gently to keep air in the batter.',
        goodToKnow: null,
      },
      {
        text: 'Bake at 180°C for 30 minutes.',
        linkedIngredientIds: [],
        timers: [{ label: 'Bake', durationSeconds: 1800 }],
        temperature: '180°C',
        equipment: ['oven'],
        technique: null,
        goodToKnow: 'Can substitute almond flour for a gluten-free version.',
      },
    ],
  },
];

describe('processRecipeWithAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns processed groups from a mocked Claude response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ groups: sampleResponseGroups }) }],
    });

    const result = await processRecipeWithAI(sampleInput);

    expect(result).toEqual(sampleResponseGroups);
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-6');
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
  });

  it('throws on non-JSON Claude response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all' }],
    });

    await expect(processRecipeWithAI(sampleInput)).rejects.toThrow('Failed to parse Claude response as JSON');
  });

  it('throws when Claude returns no text block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'x', name: 'foo', input: {} }],
    });

    await expect(processRecipeWithAI(sampleInput)).rejects.toThrow('no text block');
  });

  it('throws when response JSON lacks groups array', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ data: 'wrong shape' }) }],
    });

    await expect(processRecipeWithAI(sampleInput)).rejects.toThrow('does not contain a valid "groups" array');
  });
});
