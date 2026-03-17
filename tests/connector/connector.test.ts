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

  it('emits initial empty recipes on load', () => {
    connector(mockSdk as never);
    expect(mockSdk.emit).toHaveBeenCalledWith('hubble-recipe-viewer:data', {
      recipes: {},
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
  });
});
