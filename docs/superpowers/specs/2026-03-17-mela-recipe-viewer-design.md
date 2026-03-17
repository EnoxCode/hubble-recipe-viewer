# Dashboard Component: Mela Recipe Viewer

**Date:** 2026-03-17
**Design system:** [Dashboard Design System](../../../docs/superpowers/specs/2026-03-14-dashboard-design-system.md)
**Visual companion:** `.superpowers/brainstorm/41279-1773742516/recipe-widget-v6.html`
**Module:** `hubble-mela-recipe-viewer` — connector + visualization (hybrid)

---

## Overview

A two-panel cooking companion widget that receives recipes from the Mela app via an API endpoint, processes them with Claude AI to extract structured steps, ingredient links, timers, and technique tips, then presents them as a step-by-step interactive cooking guide navigated with hardware buttons.

Designed for the top half of a portrait 1920×1080 Cooking page. Full width, half height (~540px). Timers and appliance widgets sit below.

---

## Architecture

### Data Flow

```
Mela app → POST /api/modules/hubble-mela-recipe-viewer/receive
         → Connector receives raw mela JSON
         → Strips image, sends to Claude API for processing
         → Stores processed recipe + original image via sdk.storage
         → Emits processed recipe to visualization
         → Visualization renders two-panel cooking UI
```

### Module Type

Hybrid — connector (API endpoint + AI processing) + visualization (React dashboard widget).

---

## Connector

### API Endpoint: `receive`

Receives mela recipe files via POST. Content-Type: `application/vnd.melarecipe`.

**Headers from Mela:**
```
Content-Type: application/vnd.melarecipe
```

**Body:** JSON object with mela recipe fields (`title`, `ingredients`, `instructions`, `cookTime`, `prepTime`, `totalTime`, `yield`, `images`, `notes`, `categories`, `nutrition`, `link`, `id`).

### Mela Format Parsing (Deterministic)

Before AI processing, parse the structured text patterns:

- `ingredients` field: split on lines starting with `# ` to get groups. Each non-empty line within a group is an ingredient.
- `instructions` field: split on lines starting with `# ` to get groups. Each group's text block is sent to AI for step extraction.
- `images` field: array of base64-encoded images. Store separately, do **not** send to AI.

### AI Processing (Claude API)

**When:** On receive. By the time the user walks to the Raspberry Pi, the recipe is processed and ready.

**Input:** Mela JSON with `images` field stripped to reduce tokens. Include `title`, `ingredients` (pre-parsed groups), `instructions` (pre-parsed groups), `notes`, `yield`, `prepTime`, `cookTime`, `totalTime`.

**Single prompt, structured output.** One API call returns the full processed recipe.

**AI tasks:**

1. **Break instruction blocks into individual steps** — each group's instruction text split into discrete, clearly-worded steps. Clean up language for readability.

2. **Link ingredients to steps** — for each step, identify which ingredients are referenced. Handle three cases:
   - **Explicit:** ingredient listed in the same group (e.g., "350g flank steak" in Marinade group).
   - **Implicit:** step references an ingredient not listed (e.g., "add the beef" in Stir-fry without "beef" in Stir-fry ingredients). AI creates a synthetic reference linking back to the source group.
   - **Whole-component reference:** step references the output of a previous group (e.g., "pour the dashi vinaigrette"). AI links to the group name, not individual ingredients.

3. **Extract timers** — duration in seconds + label. Handle ranges (e.g., "45–75 min" → `{ min: 2700, max: 4500, label: "Bake beets" }`). Timer label should be descriptive enough to identify on the timer widget.

4. **Extract temperatures** — oven preheats, stovetop heat levels. Both precise ("190–200°C") and descriptive ("high heat, wok must be smoking").

5. **Extract equipment** — tools needed for the step ("wok", "staafmixer", "siliconenmat").

6. **Generate technique tips** — short AI-generated insight when a technique is important. Marked with an AI icon in the UI. One sentence max.

7. **Generate "good to know" callouts** — surface relevant notes from the `notes` field on the steps they apply to. Also detect cross-group references (e.g., "save the beet skins" on a step that produces skins needed later).

### Processed Recipe Schema

```ts
interface ProcessedRecipe {
  id: string;                    // from mela id field
  title: string;
  image: string;                 // base64, stored separately from AI payload
  servings: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  notes: string;                 // original notes text for overview display
  groups: ProcessedGroup[];
}

interface ProcessedGroup {
  name: string;                  // "Marinade", "Sauce", "Stir-fry"
  ingredients: ProcessedIngredient[];
  steps: ProcessedStep[];
}

interface ProcessedIngredient {
  id: string;                    // unique within recipe, e.g. "marinade-1"
  text: string;                  // "350g flank steak"
  isReference: boolean;          // true if this is a cross-group reference
  referencesGroup?: string;      // group name if whole-component reference
}

interface ProcessedStep {
  text: string;                  // the instruction
  linkedIngredientIds: string[]; // ingredients used in this step
  timers: ProcessedTimer[];
  temperature: string | null;    // "190–200°C" or "High heat"
  equipment: string[];           // ["wok", "mixing bowl"]
  technique: string | null;      // AI-generated tip
  goodToKnow: string | null;    // from notes or cross-group context
}

interface ProcessedTimer {
  label: string;                 // "Rest marinade", "Bake beets"
  durationSeconds: number;       // primary duration
  maxDurationSeconds?: number;   // for ranges: "45–75 min"
}
```

### Storage

- Processed recipes stored via `sdk.storage.collection('recipes')`.
- Each recipe keyed by its mela `id`.
- Not persistent across reboots (no `sdk.storage` persistence needed — recipes re-sent from Mela).
- Image stored alongside the processed data, not sent to AI.

### Emit

Connector emits to `hubble-mela-recipe-viewer:data` with the full list of processed recipes.

---

## Visualization

### Shell Variant

**Full — glass panel, no header (image replaces it), footer with recipe switcher.**

The widget uses a custom two-panel layout inside a single `.gw` glass panel. No `DashWidgetHeader` — the recipe image with overlaid title serves as the header. Footer is the recipe switcher bar.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ LEFT (300px)              │ RIGHT (flex: 1)                 │
│                           │                                 │
│ ┌─────────────────────┐   │ ┌─────────────────────────────┐ │
│ │ Recipe Image         │   │ │ Step Nav                    │ │
│ │ Title + meta overlay │   │ │ GROUP · 2 of 4    ● ● ● ●  │ │
│ └─────────────────────┘   │ ├─────────────────────────────┤ │
│                           │ │ ▁▁▁▁▁▁▁▁▁▁ progress bar    │ │
│ ┌─────────────────────┐   │ ├─────────────────────────────┤ │
│ │ MARINADE        6/6 ✓│   │ │ Previous step (dimmed)     │ │
│ │ SAUCE           5/5 ✓│   │ │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ │
│ │                     │   │ │                             │ │
│ │ STIR-FRY            │   │ │ Current step text (18px)   │ │
│ │ ☐ 2 tbsp oil    ◀──│───│─│                             │ │
│ │ ☐ 1 onion       ◀──│───│─│ ┌─ ⏱ Timer callout ───────┐│ │
│ │ ☐ 1 bell pepper ◀──│───│─│ ├─ 🔪 Technique callout ───┤│ │
│ │ ☐ beef strips       │   │ │ ├─ 💡 Good to know ────────┤│ │
│ │                     │   │ │ └──────────────────────────┘│ │
│ └─────────────────────┘   │ └─────────────────────────────┘ │
│                           │                                 │
├─────────────────────────────────────────────────────────────┤
│ FOOTER: ● Langoustine 12/18 · ● Beef 5/7 · ● Tiramisu     │
└─────────────────────────────────────────────────────────────┘
```

### Left Panel — Image + Ingredients

**Recipe image:** Dark overlay container (`rgba(0,0,0,0.30)`), `aspect-ratio: 16/7`, `object-fit: cover`. Title + meta (servings, prep/cook time) overlaid with gradient fade + text-shadow.

**Ingredient list:** Scrollable. Grouped by recipe component with `label-text` group headers.

#### Ingredient Row States

| State | Checkbox | Text | Background | Border-left |
|---|---|---|---|---|
| Default | Empty (15% border) | 12px, `--dash-text-secondary` | None | Transparent |
| Gathered (overview) | Blue check (`--dash-state-info`) | 12px, secondary | None | Transparent |
| Active (linked to step) | Empty or gathered | 12px, `--dash-text-primary` | `rgba(96,165,250,0.10)` | `--dash-state-info` |
| Used (cooking) | Green check (`--dash-state-positive`) | 12px, strikethrough | None | Transparent |
| Used + dimmed | Green check | Strikethrough, 25% opacity | None | Transparent |
| Reference (cross-group) | No checkbox | 12px, secondary, italic | None | Transparent |

**Single checkbox in front.** Same position, different meaning per phase:
- **Gather phase** (overview): blue check = "I have this on the counter." Cross-group references show but have no checkbox (can't gather "the marinade" — you make it).
- **Cook phase:** all checks reset. Green check = "used in the dish." Auto-checked when advancing past a step that uses it.

**Collapsed groups:** When all ingredients in a group are used, the group collapses to a single row: `label-text` group name + `"N/N ✓"` in `--dash-state-positive`. 35% opacity. Saves scroll space as you progress. Expands if user navigates back to that group's steps.

### Right Panel — Steps

**Step nav bar:** `label-text` group name + `muted-text` step counter ("2 of 4"). Carousel dots on the right — one per group. Active dot: 14px pill. Done dots: `--dash-state-positive` at 40%.

**Progress bar:** 2px track below step nav. `rgba(255,255,255,0.06)` track, `--dash-state-info` fill at 60% opacity. Width = current step / total steps across all groups.

**Previous step:** Shown dimmed above the current step. 13px/300 weight, `--dash-text-muted`. No callouts — just the instruction text for context. Separated from current step by `--dash-divider`. Not shown on the first step.

**Current step text:** 18px/300 weight, `--dash-text-primary`, line-height 1.6. Walk-up reading distance (1–1.5m).

#### Callout Types

Five callout types, following the HA notification card pattern: 3px left border + tinted background.

| Type | Border color | Background | Icon | Title color |
|---|---|---|---|---|
| Timer | `--dash-state-warning` | `rgba(251,191,36,0.09)` | ⏱ | `--dash-state-warning` |
| Technique | `--dash-state-info` | `rgba(96,165,250,0.08)` | 🔪 | `--dash-state-info` |
| Temperature | `--dash-state-critical` | `rgba(248,113,113,0.08)` | 🔥 | `--dash-state-critical` |
| Equipment | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.05)` | 🍳 | `--dash-text-secondary` |
| Good to know | `--dash-state-positive` | `rgba(74,222,128,0.07)` | 💡 | `--dash-state-positive` |

- Callout layout: `border-radius: 6px`, `padding: 7px 10px`, icon 14px + title 11px/500 + subtitle 9px/muted inline.
- **Technique tips** show an AI icon indicator (these are AI-generated, not from the recipe).
- **Good to know** sourced from the `notes` field or AI-detected cross-group references.

### Overview View

Shown when a recipe first arrives or when user presses B2 from step 1.

**Right panel content:**
- Component list: each group as a row with name (13px/400) and step count (10px/muted).
- Notes section below: `label-text` "NOTES" header + original notes text (11px/300, `--dash-text-secondary`). Separated by `--dash-divider`. Only shown if notes exist.

**Left panel:** All ingredients visible in gather mode.

### Done View

All carousel dots green. Progress at 100%. Right panel shows centered completion card:
- ✓ icon (32px, 60% opacity)
- "Eet smakelijk!" (16px/400, primary)
- "All N steps completed" (10px, muted)

All ingredient groups collapsed.

### Empty State

No recipes loaded. Single glass panel (no two-panel layout). Centered:
- 🍳 icon (28px, 15% opacity)
- "Waiting for recipe…" (11px, muted)
- "Send a recipe from Mela to get started" (8px, muted)

### Footer — Recipe Switcher

Full-width bar below both panels, separated by `--dash-divider`.

**Single recipe:** Just a status dot, right-aligned. No switcher.

**Multi-recipe (2+):** Horizontal row of recipe items, scrollable. Each item:
- Status dot (6px)
- Recipe name (9px, `--dash-text-muted` / `--dash-text-primary` + 500 weight when active)
- Progress label (7px, muted): "new", "gather", "12/18", "done"
- Active recipe: `rgba(255,255,255,0.08)` background, `border-radius: 5px`

**Status dot states:**

| State | Color | Glow |
|---|---|---|
| Waiting (new) | `rgba(255,255,255,0.20)` | — |
| Gathering | `--dash-state-info` | — |
| Cooking | `--dash-state-warning` | `box-shadow: 0 0 4px rgba(251,191,36,0.5)` |
| Done | `--dash-state-positive` | — |

Each recipe maintains independent state (current step, checked ingredients, phase). Switching recipes swaps the entire widget content.

---

## Hardware Button Mapping

| State | B1 (Primary) | B2 (Back) | B3 (Contextual) | B4 (Switch) |
|---|---|---|---|---|
| **Waiting** | Start gather | — | — | Switch recipe |
| **Gathering** | Start cooking | — | Toggle gather check | Switch recipe |
| **Cooking** | Next step | Prev step | — | Switch recipe |
| **Cooking + timer** | Next step | Prev step | Start timer | Switch recipe |
| **Cooking step 1** | Next step | Back to overview | — | Switch recipe |
| **Done** | — | Back to last step | Dismiss recipe | Switch recipe |

**B1** is always the primary forward action. **B2** goes back (disabled when there's nothing to go back to). **B3** is contextual: gather check during overview, start timer during cooking when a timer callout is present, dismiss recipe when done. **B4** cycles through loaded recipes (no-op with single recipe).

**Manifest `hardwareButtons`:**
```json
{
  "button1": "primary",
  "button2": "back",
  "button3": "contextual",
  "button4": "switch"
}
```

---

## Timer Integration

### Current Timer Module API

The `hubble-timer` module exposes `start`, `pause`, `resume`, `reset` actions via `sdk.onApiCall`. Each timer widget has a unique `slug` property (e.g., "timer-1", "timer-2").

### Required Change: `start-available` Endpoint

**New action on the timer module:** `start-available`

```ts
// Request
{ action: 'start-available', body: { duration: 600, label: 'Rest marinade' } }

// Response (success)
{ ok: true, slug: 'timer-2' }

// Response (all timers busy)
{ ok: false, error: 'all-busy' }
```

The timer module finds the first idle timer and starts it. The recipe module doesn't need to know about slugs or track timer state. If all timers are busy, the recipe module can show a brief notification or mark the callout as "timers full."

**Why not use existing `start`?** The recipe module would need to know which slugs exist and which are idle — that's timer state management leaking into the recipe module. `start-available` keeps the separation clean.

---

## Config Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `anthropicApiKey` | secret | — | API key for Claude (AI processing) |
| `anthropicModel` | string | `claude-sonnet-4-6` | Model for recipe processing |

---

## CSS Classes

All classes prefixed with `rcp-` to avoid collisions.

```css
/* Layout */
.rcp-layout          /* Two-panel flex container */
.rcp-left            /* Left panel: 300px, ingredients */
.rcp-right           /* Right panel: flex 1, steps */

/* Image */
.rcp-image-wrap      /* Dark overlay container, aspect-ratio 16/7 */
.rcp-image           /* object-fit: cover */
.rcp-image-overlay   /* Gradient fade for title */
.rcp-image-title     /* 14px/500, text-shadow */

/* Ingredients */
.rcp-group           /* Group label wrapper */
.rcp-group-collapsed /* Collapsed done group */
.rcp-row             /* Ingredient row */
.rcp-row--active     /* Linked to current step */
.rcp-row--checked    /* Used/gathered */
.rcp-check           /* 13px checkbox */
.rcp-check--gathered /* Blue check state */
.rcp-check--used     /* Green check state */

/* Steps */
.rcp-step-nav        /* Group name + dots bar */
.rcp-progress        /* 2px progress track */
.rcp-prev-step       /* Dimmed previous step */
.rcp-step-text       /* 18px current step */
.rcp-callout         /* Notification card pattern */
.rcp-callout--timer / --technique / --temp / --equip / --tip

/* Footer */
.rcp-footer          /* Full-width footer */
.rcp-switcher        /* Recipe switcher row */
.rcp-switch-item     /* Individual recipe tab */
.rcp-switch-status   /* 6px status dot */

/* States */
.rcp-overview        /* Component list view */
.rcp-done            /* Completion card */
.rcp-empty           /* Waiting for recipe */
```

---

## Component Index Entry

Add to `2026-03-14-dashboard-design-system.md` component index:

| Component | Spec file | Shell variant |
|---|---|---|
| Mela Recipe Viewer | [2026-03-17-mela-recipe-viewer-design.md](2026-03-17-mela-recipe-viewer-design.md) | Full (image header + footer switcher) |

---

*See brainstorm visualizations in `.superpowers/brainstorm/41279-1773742516/` for the visual companion files used during design.*
