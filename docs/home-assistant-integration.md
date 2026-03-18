# Home Assistant Custom Integration — hubble_recipe_viewer

## Goal

Build a Home Assistant custom integration (`custom_components/hubble_recipe_viewer`) that bridges the `hubble-recipe-viewer` Hubble module into Home Assistant. The integration should expose the active recipe and current cooking step as HA entities, and provide service calls to drive navigation — enabling automations, dashboard cards, and voice commands to control the recipe viewer running on the Hubble kitchen dashboard.

---

## Hubble API surface used

### Base URL
`http://<hubble-host>:<port>` — configurable via HA config entry. Default port TBD (check Hubble docs).

### Events (WebSocket subscription)
Hubble exposes a WebSocket at `/ws` (or similar — check Hubble docs). Subscribe to module events:

| Event name | When fired | Key payload fields |
|---|---|---|
| `recipe:active-changed` | Active recipe or phase changes | `recipeId`, `title`, `phase`, `image`, `servings`, `totalTime` |
| `recipe:step-changed` | Cooking step advances or retreats | `recipeId`, `title`, `groupName`, `groupIndex`, `stepIndex`, `stepText`, `timers`, `temperature`, `equipment` |
| `recipe:ready` | AI processing complete | `recipeId`, `title` |

Use these to push state updates to HA entities in real time. Fall back to polling `/api/hubble-recipe-viewer/data` (the connector's cached emit) if WebSocket is unavailable.

### REST endpoints (called from service actions)
All `POST` to `http://<host>/api/modules/hubble-recipe-viewer/<path>`:

| Path | Description |
|---|---|
| `POST /navigate/next` | Advance phase or step |
| `POST /navigate/previous` | Go back a step or phase |
| `POST /navigate/switch` | Cycle to the next recipe |
| `POST /navigate/toggle-ingredient` | Toggle ingredient at gather cursor |
| `POST /navigate/start-timer` | Start timer for current cooking step |
| `POST /navigate/dismiss` | Dismiss completed recipe |
| `GET /get-recipe?id=<recipeId>` | Fetch full recipe details |

---

## Module discovery

All entities and services below must only be created if `hubble-recipe-viewer` is present in the module list returned by Hubble's discovery call during integration setup. If the module is not installed on the Hubble device, skip registration entirely — no entities, no services. If the module is later removed, mark the existing entities as `unavailable` and unregister the services until the next discovery confirms its presence again.

---

## Entities to create

### 1. `sensor.recipe_viewer_active_recipe`
- **State:** Title of the active recipe, or `"none"` when no recipe is loaded
- **Attributes:**
  - `recipe_id` — internal recipe identifier
  - `phase` — `waiting` / `gathering` / `cooking` / `done`
  - `servings` — e.g. `"4 servings"`
  - `total_time` — e.g. `"45 min"`
  - `image` — base64 JPEG string (omit from state, include as attribute for Lovelace cards)
- **Icon:** `mdi:chef-hat`
- **Update trigger:** `recipe:active-changed` event

### 2. `sensor.recipe_viewer_current_step`
- **State:** Current step number as a 1-based integer (e.g. `3`), or `0` when not in cooking phase
- **Attributes:**
  - `text` — full instruction text of the current step
  - `group_name` — e.g. `"Sauce"` or `"Main"`
  - `group_index` — integer
  - `step_index` — integer
  - `timers` — list of `{ label, duration_seconds }` objects (empty list if none)
  - `temperature` — string e.g. `"180°C"`, or `null`
  - `equipment` — list of strings e.g. `["wok", "wooden spoon"]`
- **Icon:** `mdi:format-list-numbered`
- **Update trigger:** `recipe:step-changed` event; reset to `0` on `recipe:active-changed` when phase ≠ `cooking`

### 3. `sensor.recipe_viewer_step_progress`
- **State:** Human-readable progress string, e.g. `"3 / 8"`, or `"—"` when not cooking
- **Attributes:**
  - `current_step` — integer (0-based linear index)
  - `total_steps` — integer
  - `phase` — current navigation phase
- **Icon:** `mdi:progress-clock`
- **Update trigger:** both `recipe:active-changed` and `recipe:step-changed`

---

## Services

Register all services under the domain `hubble_recipe_viewer`.

### `hubble_recipe_viewer.navigate_next`
Advance through the current phase or step (same as the primary hardware button).
- No fields required.
- Calls `POST /navigate/next`.

### `hubble_recipe_viewer.navigate_previous`
Go back a step or phase.
- No fields required.
- Calls `POST /navigate/previous`.

### `hubble_recipe_viewer.navigate_switch`
Cycle to the next loaded recipe.
- No fields required.
- Calls `POST /navigate/switch`.

### `hubble_recipe_viewer.toggle_ingredient`
Toggle the ingredient at the current gather cursor (only meaningful during `gathering` phase).
- No fields required.
- Calls `POST /navigate/toggle-ingredient`.

### `hubble_recipe_viewer.start_timer`
Start the timer for the current cooking step. Returns the timer details.
- No fields required.
- Calls `POST /navigate/start-timer`.
- If the response contains `timer.duration_seconds`, fire a HA event `hubble_recipe_viewer_timer_started` with the timer data so other automations can react (e.g. start a timer helper).

### `hubble_recipe_viewer.dismiss`
Dismiss the completed recipe and remove it from the active list.
- No fields required.
- Calls `POST /navigate/dismiss`.

### `hubble_recipe_viewer.get_recipe`
Fetch full details of a processed recipe and store them in a response variable.
- **Field:** `recipe_id` (string, required) — the recipe identifier.
- Calls `GET /get-recipe?id=<recipe_id>`.
- Supports response data (HA 2023.7+) so automations can read the result.

---

## Config entry

Use a config flow with a single step:
- `host` — IP or hostname of the Hubble device (required)
- `port` — API port (required, default: fill in from Hubble docs)
- `name` — friendly name prefix for entities (optional, default `"Recipe Viewer"`)

Store credentials (if Hubble adds auth later) in `hass.data` using the entry ID.

---

## Implementation notes

- **Coordinator pattern:** Use `DataUpdateCoordinator` with a 30-second poll interval as a fallback. Primary updates come from WebSocket events to keep latency low.
- **Entity availability:** Mark all entities as `unavailable` if the Hubble host cannot be reached. Restore availability as soon as the connection comes back.
- **State persistence across HA restart:** On startup, fetch the current connector state via `GET /api/modules/hubble-recipe-viewer/data` (or the Hubble state endpoint) to populate entities immediately without waiting for the next event.
- **Image attribute:** The `image` attribute on `sensor.recipe_viewer_active_recipe` is a raw base64 JPEG. Lovelace picture-entity cards can render it via `data:image/jpeg;base64,<value>`. Omit from the sensor state string since HA state is limited to 255 characters.
---

## Example automation

```yaml
alias: "Announce current recipe step on kitchen speaker"
trigger:
  - platform: state
    entity_id: sensor.recipe_viewer_current_step
action:
  - service: tts.speak
    target:
      entity_id: media_player.kitchen_speaker
    data:
      message: "Step {{ states('sensor.recipe_viewer_current_step') }}: {{ state_attr('sensor.recipe_viewer_current_step', 'text') }}"
```

```yaml
alias: "Go to next step with kitchen button"
trigger:
  - platform: state
    entity_id: binary_sensor.kitchen_button
    to: "on"
action:
  - service: hubble_recipe_viewer.navigate_next
```
