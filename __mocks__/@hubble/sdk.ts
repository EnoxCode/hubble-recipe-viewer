import { vi } from 'vitest';

export const useWidgetConfig = vi.fn(() => ({}));
export const useConnectorData = vi.fn(() => null);
export const useWidgetState = vi.fn((init: unknown) => [init, vi.fn()]);
export const useHubbleSDK = vi.fn(() => ({ onButton: vi.fn(() => vi.fn()), callApi: vi.fn(), requestAcknowledge: vi.fn() }));
