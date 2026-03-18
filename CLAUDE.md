# HubbleRecipeViewer

A viewer for the mela recipe format

This is a Hubble module (type: **connector + visualization**). Hubble is an Electron-based kitchen dashboard that runs on a Raspberry Pi with a portrait 1920x1080 screen.

---

## Structure

```
hubble-recipe-viewer/
├── manifest.json                         # Module metadata, properties, dependencies
├── connector/
│   └── index.ts                          # Server-side: data fetching, scheduling, emit
├── visualizations/
│   └── default/
│       ├── index.tsx                     # React component rendered in widget container
│       ├── style.css                     # Widget styles (use --hubble-* CSS variables)
│       └── panels/
│           └── configure.tsx             # (optional) config panel component
└── README.md
```

**Connector modules** use only `connector/`. **Visualization modules** use only `visualizations/`. **Hybrid modules** use both.

---

## Commands

```bash
npm run validate         # Validate manifest.json schema
npm run dev              # Start Hubble in dev mode with this module loaded
npm run build            # Build module for distribution
npm run lint             # Run ESLint
npm run test             # Run tests (single pass)
npm run test:watch       # Run tests in watch mode
```

---

## Testing Strategy

Tests live in `tests/`. Run `npm test` before every commit.

### What to test

**Connector modules** — unit-test the data-processing logic, not the SDK calls:
- Extract pure transformation functions (parse, normalize, filter) from `connector/index.ts` and test them directly.
- Mock `sdk` with `vi.fn()` stubs to test that `sdk.emit` is called with the correct topic and shape after a successful fetch.
- Test error paths: assert `sdk.log.error` is called when the HTTP request rejects.
- Do **not** test polling intervals or timer behavior — that is Hubble core's responsibility.

**Visualization modules** — test rendering and interaction, not SDK internals:
- Use `@testing-library/react` with `jsdom` (already configured in `vitest.config.ts`).
- Render each visualization with representative data and assert the critical text/elements appear.
- Test user interaction (button clicks, input changes) that drives local `useWidgetState` updates.
- Mock `useConnectorData`, `useWidgetConfig`, and `useHubbleSDK` from `@hubble/sdk` — these are injected at runtime and should not be exercised in unit tests.

**Hybrid modules** — apply both strategies above to the connector and each visualization independently.

### Suggested test structure

```
tests/
├── setup.ts                    # @testing-library/jest-dom import (visualizations only)
├── connector.test.ts           # Connector logic
└── visualizations/
    └── default.test.tsx        # Default visualization rendering
```

### Mocking the SDK

```ts
// Connector mock
const mockSdk = {
  emit: vi.fn(),
  schedule: vi.fn((_, cb) => { cb(); return { stop: vi.fn() }; }),
  http: { get: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getConfig: vi.fn(() => ({})),
};

// Client SDK mock (in a vitest setup file or inline)
vi.mock('@hubble/sdk', () => ({
  useConnectorData: vi.fn(() => null),
  useWidgetConfig: vi.fn(() => ({})),
  useWidgetState: vi.fn((init) => [init, vi.fn()]),
  useHubbleSDK: vi.fn(() => ({ onButton: vi.fn(() => vi.fn()), callApi: vi.fn() })),
}));
```

---

## UI Styling Rules

- **No inline styles** — never use `style="..."` on HTML elements or the `style` prop in React/TSX.
- **Use stylesheet classes** — all styles go in `visualizations/<path>/style.css`. Use `--dash-*` CSS variables for dashboard visualizations (`hubble-dash-ui`) and `--hubble-*` for admin/edit UI (`hubble-ui`).
- **Use `hubble-ui` components** — always prefer components from `hubble-ui` over writing custom equivalents.

### hubble-dash-ui components (dashboard visualizations)

Dashboard visualizations use `hubble-dash-ui` — never `hubble-ui`.

```tsx
import {
  DashWidget, DashWidgetHeader, DashWidgetFooter,
  DashStatusDot, DashSkeleton, DashDivider,
  DashBadge, DashPill, DashCarouselDots, DashThumbnail,
} from 'hubble-dash-ui';
import 'hubble-dash-ui/styles/dash-base.css';
```

| Component | Purpose |
|---|---|
| `DashWidget` | Glass panel shell — wraps all widget content |
| `DashWidgetHeader` | Label (left) + optional meta/custom slot (right) |
| `DashWidgetFooter` | Auto-formatted relative timestamp + status dot |
| `DashStatusDot` | 5px status dot (`ok` / `warn` / `error`) |
| `DashSkeleton` | Shimmer loading placeholder |
| `DashDivider` | Hairline section separator |
| `DashBadge` | Tinted state value chip — `positive`, `warning`, `critical`, `info`, `neutral` |
| `DashPill` | Event / status pill — `glass` (strip) or `full` (tinted bg); `DashPill.Dot` for compact dots |
| `DashCarouselDots` | Navigation dots — active expands to pill shape |
| `DashThumbnail` | Image container with `object-fit: cover` + auto empty-state |

### Shell variant quick reference

| Your visualization | Pattern |
|---|---|
| Title + live data that can go stale | `DashWidget` + `DashWidgetHeader` + `DashWidgetFooter` |
| Self-describing content (icons/images) | `DashWidget` only — no header |
| Floating indicator on page | No `DashWidget` — own backdrop-filter |
| Ambient (clock, large temperature) | No `DashWidget` — bare element |

### --dash-* CSS variables

Set automatically by `dash-base.css`. Override `--dash-tint-r/g/b` on the page wrapper for per-page glass tinting.

| Variable | Value | Description |
|---|---|---|
| `--dash-text-primary` | `rgba(255,255,255,0.85)` | Primary text |
| `--dash-text-secondary` | `rgba(255,255,255,0.52)` | Secondary text |
| `--dash-text-muted` | `rgba(255,255,255,0.25)` | Muted labels, meta |
| `--dash-divider` | `rgba(255,255,255,0.08)` | Hairline dividers |
| `--dash-state-positive` | `#4ade80` | Green — locked, on, ok |
| `--dash-state-info` | `#60a5fa` | Blue — informational |
| `--dash-state-warning` | `#fbbf24` | Yellow — warning |
| `--dash-state-critical` | `#f87171` | Red — error, unlocked, critical |
| `--dash-radius` | `11px` | Widget corner radius |
| `--dash-padding-lg` | `16px` | Inner padding (glance widgets) |
| `--dash-gap` | `8px` | Header/footer ↔ content margin |

### hubble-ui components

```tsx
import { Button, IconButton, Input, Select, Slider, Toggle, ColorPicker, StatusDot, Badge, Field, Collapsible } from 'hubble-ui';
```

| Component | Purpose |
|---|---|
| `Button` | Primary/secondary/ghost actions |
| `IconButton` | Icon-only action button |
| `Input` | Text input field |
| `Select` | Dropdown selector |
| `Slider` | Range slider |
| `Toggle` | Boolean on/off switch |
| `ColorPicker` | Color selection |
| `StatusDot` | Colored status indicator dot |
| `Badge` | Small status/count label |
| `Field` | Form field wrapper with label and validation |
| `Collapsible` | Expandable/collapsible section |

### CSS variables (Studio — used by hubble-ui components)

Config panels live in Studio, so they use `--studio-*` variables automatically via the `hubble-ui` components.
Only reference these directly when writing custom markup inside a panel.

| Variable | Dark value | Description |
|---|---|---|
| `--studio-bg` | `#0d1117` | Page/app background |
| `--studio-panel` | `#161b22` | Cards, sidebars, modals |
| `--studio-panel-hover` | `#1c2128` | Panel hover state, input addons |
| `--studio-border` | `#21262d` | Default border (inputs, cards) |
| `--studio-border-subtle` | `#30363d` | Secondary borders, button outlines |
| `--studio-text-primary` | `#e6edf3` | Body text, labels, headings |
| `--studio-text-secondary` | `#8b949e` | Descriptions, placeholders, meta |
| `--studio-text-tertiary` | `#484f58` | Disabled text, group headers, icons |
| `--studio-accent` | `#58a6ff` | Links, active state, focus ring, primary button |
| `--studio-danger` | `#f85149` | Error, destructive action |
| `--studio-success` | `#3fb950` | Success state |
| `--studio-warning` | `#d29922` | Warning state |
| `--studio-font` | system-ui | All UI text |
| `--studio-font-mono` | SF Mono / Fira Code | JSON editor, code, paths |
| `--studio-text-xs` | `11px` | Badges, metadata |
| `--studio-text-sm` | `12px` | Labels, input text |
| `--studio-text-base` | `13px` | Default body text |
| `--studio-radius` | `6px` | Inputs, buttons, cards |
| `--studio-radius-lg` | `8px` | Modals, panels |
| `--studio-gap` | `8px` | Default gap |
| `--studio-gap-lg` | `12px` | Section spacing |

---

## SDK Quick Reference

### Server SDK (injected as `sdk` in connector/index.ts)

| Method | Signature | Purpose |
|---|---|---|
| `sdk.emit` | `(topic: string, data: unknown) => void` | Broadcast data to all subscribed clients |
| `sdk.schedule` | `(intervalMs: number, cb: () => void) => { stop }` | Run callback immediately then on interval; returns stop handle |
| `sdk.http.get/post/put/patch/delete` | `(url, body?, options?) => Promise<unknown>` | HTTP with auto-retry (3x exponential backoff) |
| `sdk.log.info/warn/error` | `(message: string) => void` | Structured logging; `.error()` also writes to error_logs DB |
| `sdk.logError` | `(message: string, stack?: string) => void` | Write directly to error_logs table |
| `sdk.getConfig` | `() => Record<string, unknown>` | Returns manifest defaults merged with user-configured values |
| `sdk.storage.get` | `(key: string) => unknown \| null` | Read from persistent key-value store |
| `sdk.storage.set` | `(key: string, value: unknown) => void` | Write to persistent key-value store |
| `sdk.storage.delete` | `(key: string) => void` | Remove a key from storage |
| `sdk.storage.collection` | `(name: string) => CollectionApi` | Ordered collection CRUD |
| `sdk.getConnectorState` | `(moduleName: string, topic?: string) => unknown \| null` | Read last emitted data from another connector |
| `sdk.getDashboardState` | `() => DashboardState` | Get active page, screen status, page list |
| `sdk.notify` | `(message: string, options?) => void` | Push notification to dashboard |
| `sdk.onApiCall` | `(handler: ({action, body}) => Promise<unknown>) => void` | Handle custom API endpoint calls |

**`sdk.notify` options:**
```ts
sdk.notify('Timer done!', { level: 'info', persistent: false });
// level: 'info' | 'warn' | 'error'  (default: 'info')
// persistent: stay until dismissed  (default: false)
```

**`sdk.onApiCall` — custom API endpoints:**
```ts
// Declare endpoints in manifest.json under "endpoints"
// Each endpoint path maps to an action string in the handler
sdk.onApiCall(async ({ action, body }) => {
  switch (action) {
    case 'play': {
      const { url } = body as { url: string };
      return { ok: true, url };
    }
    case 'stop':
      return { ok: true };
    default:
      return { error: `Unknown action: ${action}` };
  }
});
```

**`sdk.oauth` — OAuth token access:**
```ts
// Requires oauth: { provider: 'google', scopes: [...] } in manifest.json
if (!sdk.oauth.isAuthorized()) {
  sdk.emit('hubble-recipe-viewer:data', { error: 'Not authorized' });
  return;
}
const token = sdk.oauth.getAccessToken();   // string | null
const tokens = sdk.oauth.getTokens();       // full token object (access_token, refresh_token, ...)
```

### Client SDK (hooks — use in visualizations/*/index.tsx)

```tsx
import { useConnectorData, useWidgetConfig, useWidgetState, useHubbleSDK } from '@hubble/sdk';

// Subscribe to connector data — auto re-renders
// IMPORTANT: with no args, subscribes to '{module-name}:data' topic.
// Your connector MUST emit to that exact topic: sdk.emit('hubble-recipe-viewer:data', ...)
// If you emit to a different topic (e.g. ':state'), pass args explicitly:
//   useConnectorData<MyData>('hubble-recipe-viewer', 'hubble-recipe-viewer:state')
const data = useConnectorData<MyData>();

// Read widget config (from manifest properties)
const config = useWidgetConfig<{ title?: string }>();

// Per-widget-instance state
const [state, setState] = useWidgetState({ count: 0 });

// Raw SDK for buttons, presentation modes, API calls
const sdk = useHubbleSDK();
useEffect(() => sdk.onButton('button1', (action) => doSomething(action)), [sdk]);

// Call a module API endpoint (authenticated)
await sdk.callApi('start', { slug: 'timer-1' });
```

---

## Manifest

### Property types

`string`, `text` (multiline), `number`, `range` (slider), `boolean`, `choice` (dropdown), `datetime`, `json` (code editor), `color`, `url`, `secret` (masked input).

Extra fields by type:
- `choice`: `choices: [{label, value}]`
- `text`: `rows`, `maxLength`
- `number` / `range`: `min`, `max`, `step`

### Config Panels

Visualizations can declare `configPanels` for custom configuration UI:

```json
"visualizations": [{
  "name": "Default",
  "path": "default",
  "configPanels": [
    { "label": "Configure", "panel": "configure" }
  ]
}]
```

Panel source: `visualizations/{vizPath}/panels/{panel}.tsx`
Panel components receive `{ config, onConfigChange, moduleId, moduleName }` props (typed as `ConfigPanelProps` from `hubble-sdk.d.ts`).

---

## Architecture

### Module types

- **Connector**: Server-only. Fetches external data and emits events via `sdk.emit()`.
- **Visualization**: Client-only. Renders React component inside widget container. Subscribes via `useConnectorData()`.
- **Hybrid**: Has both a `connector/` and `visualizations/`.

> **IMPORTANT — Hybrid modules:** Visualization files **cannot import from `connector/`**. The client bundler only bundles files within the visualization's own directory tree. `connector/` is server-side only. Any types or utilities needed by both sides must be **inlined** (copy-pasted) into the visualization file.

### Widget Lifecycle

#### Server side (connector/index.ts)

1. **Load**: Hubble imports `connector/index.ts` and calls the default export with `sdk`.
2. **Initialize**: Module calls `sdk.schedule()` to set up polling or `sdk.emit()` for one-time data.
3. **Run**: Scheduled callbacks fire, fetching data and emitting to topics.
4. **Cleanup**: On unload, Hubble clears all scheduled timers.

#### Client side (visualizations/*/index.tsx)

1. **Mount**: React component renders inside `WidgetContainer`.
2. **Subscribe**: `useConnectorData()` hook subscribes automatically.
3. **Render**: Component re-renders when new data arrives.

---

## Error Handling

```ts
sdk.log.info("Fetched 42 items");
sdk.log.warn("API rate limit near");
sdk.log.error("API request failed");  // also writes to error_logs DB
```

---

## Hardware Buttons

```json
"hardwareButtons": { "button1": "play", "button2": "pause" }
```

**Hybrid modules (with connector):** Button logic goes in the connector's `onApiCall` handler. Hubble calls it server-side automatically. Use `onButton` only for optional client-side UI reactions (animations, sounds).

**Visualization-only modules:** `onButton` is the primary handler for all button logic.

```tsx
const sdk = useHubbleSDK();
useEffect(() => {
  const unsub = sdk.onButton('button1', (action) => handleAction(action));
  return unsub;
}, [sdk]);
```

---

## Widget Presentation Modes

Visualizations can change how they are displayed via the Client SDK:

```tsx
const sdk = useHubbleSDK();

sdk.expandWidget();          // Expand to full-page overlay
sdk.dismissWidget();         // Return to default contained state
sdk.pinWidget();             // Permanent full-page (never auto-dismisses)
sdk.timedExpand(5000);       // Full-page for 5 seconds, then auto-dismiss
sdk.requestAcknowledge();    // Full-page until user presses a hardware button
```

Use `requestAcknowledge()` for alerts that require attention (e.g., timer done, security alert). Use `timedExpand()` for brief notifications.

---

## Examples

See `EXAMPLES.md` in this directory for 6 complete working module patterns:
- Weather Connector (scheduled HTTP + emit)
- Cooking Timer (local widget state + hardware buttons)
- Shopping List Hybrid (collection storage + connector/viz)
- Google Calendar OAuth (oauth flow + googleapis)
- Lyrics (cross-module `getConnectorState` + storage cache)
- YouTube API pass-through (`onApiCall` custom endpoints)
