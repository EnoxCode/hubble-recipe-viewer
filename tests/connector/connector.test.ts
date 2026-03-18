import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProcessedGroup } from '../../connector/process-recipe';

const { mockProcessRecipeWithAI } = vi.hoisted(() => ({
  mockProcessRecipeWithAI: vi.fn(),
}));

vi.mock('../../connector/process-recipe', () => ({
  processRecipeWithAI: mockProcessRecipeWithAI,
}));

import connector from '../../connector/index';

const sampleGroups: ProcessedGroup[] = [
  {
    name: 'Instructions',
    ingredients: [
      { id: '0-0', text: '1 cup flour', isReference: false },
      { id: '0-1', text: '2 eggs', isReference: false },
    ],
    steps: [
      {
        text: 'Mix flour and eggs.',
        linkedIngredientIds: ['0-0', '0-1'],
        timers: [],
        temperature: null,
        equipment: ['bowl'],
        technique: null,
        goodToKnow: null,
      },
    ],
  },
];

const createMockSdk = () => ({
  emit: vi.fn(),
  emitEvent: vi.fn(),
  schedule: vi.fn((_interval: number, cb: () => void) => {
    cb();
    return { stop: vi.fn() };
  }),
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
  getConfig: vi.fn(() => ({
    anthropicApiKey: 'test-key',
    anthropicModel: 'claude-sonnet-4-6',
  })),
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    collection: vi.fn(),
  },
  oauth: {
    isAuthorized: vi.fn(() => false),
    getAccessToken: vi.fn(),
    getTokens: vi.fn(),
  },
  getConnectorState: vi.fn(),
  getDashboardState: vi.fn(),
  notify: vi.fn(),
  getWidgetConfigs: vi.fn(() => []),
  onApiCall: vi.fn(),
});

describe('connector/index', () => {
  let mockSdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSdk = createMockSdk();
  });

  it('registers an onApiCall handler', () => {
    connector(mockSdk as never);
    expect(mockSdk.onApiCall).toHaveBeenCalledOnce();
  });

  it('emits initial empty state on load', () => {
    connector(mockSdk as never);
    expect(mockSdk.emit).toHaveBeenCalledWith('hubble-recipe-viewer:data', {
      recipes: {},
      navigation: {
        activeRecipeId: '',
        recipes: {},
        pendingTimer: null,
      },
    });
  });

  describe('receive action', () => {
    let handler: (payload: { action: string; params: Record<string, string>; body: unknown }) => Promise<unknown>;

    beforeEach(() => {
      connector(mockSdk as never);
      handler = mockSdk.onApiCall.mock.calls[0][0];
    });

    it('returns error when body is missing required fields', async () => {
      const result = await handler({
        action: 'receive',
        params: {},
        body: { title: 'Test' },
      });
      expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('returns ok and processes a valid recipe', async () => {
      mockProcessRecipeWithAI.mockResolvedValue(sampleGroups);

      const body = {
        id: 'recipe-123',
        title: 'Test Recipe',
        ingredients: '1 cup flour\n2 eggs',
        instructions: 'Mix and bake.',
        notes: '',
        yield: '4',
        prepTime: '10 min',
        cookTime: '30 min',
        totalTime: '40 min',
      };

      const result = await handler({ action: 'receive', params: {}, body });
      expect(result).toEqual({ ok: true, id: 'recipe-123' });

      // Wait for async processing to complete
      await vi.waitFor(() => {
        const emitCalls = mockSdk.emit.mock.calls.filter(
          (c: unknown[]) => c[0] === 'hubble-recipe-viewer:data',
        );
        expect(emitCalls.length).toBeGreaterThanOrEqual(3);

        const lastEmit = emitCalls[emitCalls.length - 1][1] as { recipes: Record<string, { status: string }> };
        expect(lastEmit.recipes['recipe-123'].status).toBe('ready');
      });

      // recipe:ready event should have fired
      expect(mockSdk.emitEvent).toHaveBeenCalledWith('recipe:ready', {
        recipeId: 'recipe-123',
        title: 'Test Recipe',
      });
    });

    it('emits error status when API key is missing', async () => {
      mockSdk.getConfig.mockReturnValue({});

      // Re-init connector with no API key
      mockSdk.onApiCall.mockClear();
      mockSdk.emit.mockClear();
      connector(mockSdk as never);
      handler = mockSdk.onApiCall.mock.calls[0][0];

      const body = {
        id: 'recipe-456',
        title: 'Test',
        ingredients: 'flour',
        instructions: 'mix',
      };

      const result = await handler({ action: 'receive', params: {}, body });
      expect(result).toEqual({ ok: true, id: 'recipe-456' });

      const emitCalls = mockSdk.emit.mock.calls.filter(
        (c: unknown[]) => c[0] === 'hubble-recipe-viewer:data',
      );
      const lastEmit = emitCalls[emitCalls.length - 1][1] as { recipes: Record<string, { status: string; error?: string }> };
      expect(lastEmit.recipes['recipe-456'].status).toBe('error');
      expect(lastEmit.recipes['recipe-456'].error).toBeDefined();
    });

    it('emits error status when processRecipeWithAI throws', async () => {
      mockProcessRecipeWithAI.mockRejectedValue(new Error('API failure'));

      const body = {
        id: 'recipe-789',
        title: 'Test',
        ingredients: 'flour',
        instructions: 'mix',
      };

      const result = await handler({ action: 'receive', params: {}, body });
      expect(result).toEqual({ ok: true, id: 'recipe-789' });

      await vi.waitFor(() => {
        const emitCalls = mockSdk.emit.mock.calls.filter(
          (c: unknown[]) => c[0] === 'hubble-recipe-viewer:data',
        );
        const lastEmit = emitCalls[emitCalls.length - 1][1] as { recipes: Record<string, { status: string }> };
        expect(lastEmit.recipes['recipe-789'].status).toBe('error');
      });
    });

    it('returns error for unknown actions', async () => {
      const result = await handler({ action: 'unknown', params: {}, body: {} });
      expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('generates an ID when mela.id is not provided', async () => {
      mockProcessRecipeWithAI.mockResolvedValue([]);

      const body = {
        title: 'No ID Recipe',
        ingredients: 'flour',
        instructions: 'mix',
      };

      const result = (await handler({ action: 'receive', params: {}, body })) as { ok: boolean; id: string };
      expect(result.ok).toBe(true);
      expect(result.id).toMatch(/^recipe-\d+$/);
    });

    it('sets first received recipe as active', async () => {
      mockProcessRecipeWithAI.mockResolvedValue([]);
      const body = { id: 'r1', title: 'First', ingredients: 'flour', instructions: 'mix' };
      await handler({ action: 'receive', params: {}, body });

      const lastEmit = mockSdk.emit.mock.calls.filter(
        (c: unknown[]) => c[0] === 'hubble-recipe-viewer:data',
      ).at(-1)![1] as { navigation: { activeRecipeId: string } };
      expect(lastEmit.navigation.activeRecipeId).toBe('r1');
    });
  });

  describe('navigation actions', () => {
    let handler: (payload: { action: string; params: Record<string, string>; body: unknown }) => Promise<unknown>;

    const receiveReadyRecipe = async (id: string) => {
      mockProcessRecipeWithAI.mockResolvedValue(sampleGroups);
      await handler({ action: 'receive', params: {}, body: { id, title: 'Test', ingredients: 'flour', instructions: 'mix' } });
      await vi.waitFor(() => {
        const calls = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data');
        const last = calls.at(-1)![1] as { recipes: Record<string, { status: string }> };
        expect(last.recipes[id].status).toBe('ready');
      });
    };

    beforeEach(() => {
      connector(mockSdk as never);
      handler = mockSdk.onApiCall.mock.calls[0][0];
    });

    it('navigate/next advances from waiting to gathering', async () => {
      await receiveReadyRecipe('r1');
      await handler({ action: 'navigate/next', params: {}, body: {} });

      const last = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data').at(-1)![1] as {
        navigation: { recipes: Record<string, { phase: string }> };
      };
      expect(last.navigation.recipes['r1'].phase).toBe('gathering');
    });

    it('navigate/previous from gathering skips to cooking', async () => {
      await receiveReadyRecipe('r1');
      await handler({ action: 'navigate/next', params: {}, body: {} }); // waiting → gathering
      await handler({ action: 'navigate/previous', params: {}, body: {} }); // gathering → cooking

      const last = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data').at(-1)![1] as {
        navigation: { recipes: Record<string, { phase: string }> };
      };
      expect(last.navigation.recipes['r1'].phase).toBe('cooking');
    });

    it('navigate/switch cycles active recipe', async () => {
      mockProcessRecipeWithAI.mockResolvedValue([]);
      await handler({ action: 'receive', params: {}, body: { id: 'r1', title: 'A', ingredients: 'x', instructions: 'y' } });
      await handler({ action: 'receive', params: {}, body: { id: 'r2', title: 'B', ingredients: 'x', instructions: 'y' } });

      await handler({ action: 'navigate/switch', params: {}, body: {} });

      const last = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data').at(-1)![1] as {
        navigation: { activeRecipeId: string };
      };
      expect(last.navigation.activeRecipeId).toBe('r2');
    });

    it('navigate/start-timer returns timer details and sets pendingTimer', async () => {
      const groupWithTimer: ProcessedGroup[] = [{
        name: 'Main',
        ingredients: [{ id: '0-0', text: 'flour', isReference: false }],
        steps: [{
          text: 'Boil water',
          linkedIngredientIds: [],
          timers: [{ label: 'Boil', durationSeconds: 300 }],
          temperature: null,
          equipment: [],
          technique: null,
          goodToKnow: null,
        }],
      }];

      // Send recipe and wait until it's ready with the timer group
      mockProcessRecipeWithAI.mockResolvedValue(groupWithTimer);
      await handler({ action: 'receive', params: {}, body: { id: 'r1', title: 'Test', ingredients: 'flour', instructions: 'mix' } });
      await vi.waitFor(() => {
        const calls = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data');
        const last = calls.at(-1)![1] as { recipes: Record<string, { status: string }> };
        expect(last.recipes['r1'].status).toBe('ready');
      });

      // Advance to cooking (waiting → gathering → cooking via previous)
      await handler({ action: 'navigate/next', params: {}, body: {} });
      await handler({ action: 'navigate/previous', params: {}, body: {} });

      const result = await handler({ action: 'navigate/start-timer', params: {}, body: {} }) as { ok: boolean; timer: { label: string; durationSeconds: number } };
      expect(result.ok).toBe(true);
      expect(result.timer).toEqual({ label: 'Boil', durationSeconds: 300 });

      const last = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data').at(-1)![1] as {
        navigation: { pendingTimer: { label: string } | null };
      };
      expect(last.navigation.pendingTimer?.label).toBe('Boil');
    });

    it('clear-pending-timer clears the pending timer', async () => {
      mockProcessRecipeWithAI.mockResolvedValue([]);
      await handler({ action: 'receive', params: {}, body: { id: 'r1', title: 'T', ingredients: 'x', instructions: 'y' } });

      await handler({ action: 'clear-pending-timer', params: {}, body: {} });

      const last = mockSdk.emit.mock.calls.filter((c: unknown[]) => c[0] === 'hubble-recipe-viewer:data').at(-1)![1] as {
        navigation: { pendingTimer: null };
      };
      expect(last.navigation.pendingTimer).toBeNull();
    });

    it('get-recipe returns recipe data including image', async () => {
      mockProcessRecipeWithAI.mockResolvedValue(sampleGroups);
      await handler({
        action: 'receive', params: {}, body: {
          id: 'r1', title: 'Pasta', ingredients: 'flour', instructions: 'mix',
          images: ['base64imagedata'],
        },
      });
      await vi.waitFor(async () => {
        const result = await handler({ action: 'get-recipe', params: {}, body: { id: 'r1' } }) as { status: string };
        expect(result.status).toBe('ready');
      });

      const result = await handler({ action: 'get-recipe', params: {}, body: { id: 'r1' } }) as {
        id: string; title: string; image: string; groups: unknown[];
      };
      expect(result.id).toBe('r1');
      expect(result.title).toBe('Pasta');
      expect(result.image).toBe('base64imagedata');
      expect(result.groups).toHaveLength(1);
    });

    it('get-recipe returns error for unknown id', async () => {
      const result = await handler({ action: 'get-recipe', params: {}, body: { id: 'nope' } });
      expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});
