# Fix: Dashboard renderer callApi returns 401 Unauthorized

## Problem

`sdk.callApi()` from dashboard visualizations always fails with 401 for non-public endpoints.

The dashboard renderer (Electron fullscreen window on the Pi) never goes through PIN authentication — only the studio (admin panel) does. So `localStorage` has no `hubble-session-token` or `hubble-api-key`. When a visualization calls `sdk.callApi()`, the SDK's `getAuthHeaders()` returns empty headers, and the server rejects the POST with 401.

This means any dashboard widget that needs to call its own connector API (e.g. starting a timer, toggling state) must mark those endpoints as `public: true` in the manifest — which defeats the purpose of auth.

## Root Cause

`/Users/luc/repos/hubble/src/renderer/hooks/authHeaders.ts`:
```ts
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = localStorage.getItem('hubble-api-key');
  if (apiKey) headers['x-api-key'] = apiKey;
  const sessionToken = localStorage.getItem('hubble-session-token');
  if (sessionToken) headers['x-session-token'] = sessionToken;
  return headers;
}
```

Both values are always null on the dashboard renderer because it never authenticates.

## Where callApi is used

`/Users/luc/repos/hubble/src/sdk/client.ts:156-176` — the `callApi` method builds a POST request with `getAuthHeaders()`.

## Server-side auth check

`/Users/luc/repos/hubble/src/api/server.ts:140-159` — the `onRequest` hook:
- GET requests are allowed without auth (dashboard is read-only display)
- POST/PUT/PATCH/DELETE require `x-api-key` or `x-session-token`
- Public module endpoints bypass auth

## Suggested Solutions

**Option A: Dashboard auto-authenticates at startup.** The Electron main process generates a dashboard-specific API key or session token and injects it into the renderer's localStorage via `webContents.executeJavaScript`. This is the cleanest — the dashboard has real credentials, all existing auth logic works unchanged.

**Option B: Trusted origin bypass.** The server recognizes requests from the dashboard renderer (e.g., by checking `Origin` header or a custom `x-hubble-dashboard` header set by the Electron renderer) and skips auth for those. Risk: any local process could spoof the header.

**Option C: WebSocket-based callApi.** Instead of HTTP POST, route `callApi` through the existing WebSocket connection (which has no auth). The server handles it the same way but trusts the WS connection. This avoids HTTP auth entirely for dashboard widgets.

I'd recommend **Option A** — it's the smallest change and doesn't weaken the auth model. The dashboard window is trusted by definition (Hubble controls it), so giving it credentials is correct.

## Files to modify

- `/Users/luc/repos/hubble/src/main/index.ts` or wherever the Electron BrowserWindow is created — inject auth token into dashboard renderer
- `/Users/luc/repos/hubble/src/renderer/hooks/authHeaders.ts` — may need to read from a different source (e.g., `window.__hubbleAuth`)
- `/Users/luc/repos/hubble/src/api/server.ts` — if using Option B, add trusted origin check

## Affected modules

Any module that uses `sdk.callApi()` from a dashboard visualization hits this. Currently worked around by marking endpoints as `public: true`:
- `hubble-recipe-viewer` — `start-timer` endpoint
- Potentially `hubble-timer` and others in the future
