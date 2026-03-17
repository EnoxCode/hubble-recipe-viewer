# Mela Recipe Viewer for Hubble

A step-by-step cooking companion for your Hubble kitchen dashboard. Send a recipe from the Mela app on your phone, and it appears on your Raspberry Pi screen as an interactive two-panel guide: ingredients on the left, AI-extracted instructions on the right. Navigate entirely with hardware buttons -- no touching the screen with messy hands.

Claude AI processes each recipe to extract individual steps, link ingredients to the steps that use them, detect timers and temperatures, and surface technique tips. The result is a guided cooking experience that keeps you on track without scrolling through a recipe blog post.

## Prerequisites

- **Hubble dashboard** running on your Raspberry Pi
- **Mela app** (iOS) with Shortcuts support
- **Anthropic API key** for Claude AI recipe processing -- get one at [console.anthropic.com](https://console.anthropic.com)
- **hubble-timer module** (optional) -- install it if you want one-button timer starts from recipe steps

## Setup

1. Install the `hubble-mela-recipe-viewer` module in Hubble.
2. Open the module settings and enter your Anthropic API key in the **anthropicApiKey** field.
3. Optionally change the **anthropicModel** (defaults to `claude-sonnet-4-6`).
4. Add the Recipe Viewer widget to your Cooking page.

## Sending recipes from Mela

The module exposes a POST endpoint that accepts Mela recipe files:

```
POST http://<hubble-ip>:3000/api/modules/hubble-mela-recipe-viewer/receive
Content-Type: application/vnd.melarecipe
```

### Using curl

```bash
curl -X POST \
  http://<hubble-ip>:3000/api/modules/hubble-mela-recipe-viewer/receive \
  -H "Content-Type: application/vnd.melarecipe" \
  -d @"Black pepper beef stir-fry.melarecipe"
```

### Setting up an iOS Shortcut

Mela can share recipes via the iOS share sheet, which can trigger Shortcuts. To set up automatic sending:

1. Open the **Shortcuts** app on your iPhone.
2. Create a new shortcut and name it something like "Send to Hubble."
3. Add a **Get Contents of URL** action:
   - **URL:** `http://<hubble-ip>:3000/api/modules/hubble-mela-recipe-viewer/receive`
   - **Method:** POST
   - **Headers:** add `Content-Type` = `application/vnd.melarecipe`
   - **Request Body:** set to **File** and use the **Shortcut Input** variable
4. Save the shortcut.
5. In Mela, open any recipe, tap the share button, and select your shortcut.

The recipe is sent to Hubble immediately. By the time you walk over to your Raspberry Pi, AI processing is typically finished and the recipe is ready to go.

## How to use

### Cooking workflow

The widget guides you through four phases:

1. **Overview** -- See the full recipe: component groups (Marinade, Sauce, Stir-fry, etc.), ingredient list, and notes. Use this to get a sense of what you are making.
2. **Gather ingredients** -- Walk through the ingredient list and check off items as you pull them out. The widget highlights each ingredient in turn.
3. **Cook** -- Step-by-step instructions with linked ingredients, timer callouts, temperature notes, and technique tips. The left panel highlights which ingredients you need for the current step.
4. **Done** -- All steps completed. Dismiss the recipe or switch to another one.

### Hardware buttons

| Button | Action |
|---|---|
| **B1** (Primary) | Start gathering / next ingredient / next step |
| **B2** (Back) | Previous step (or back to overview from step 1) |
| **B3** (Contextual) | Toggle ingredient check (gathering) / start timer (cooking) / dismiss recipe (done) |
| **B4** (Switch) | Cycle through loaded recipes |

During the **gather** phase, B1 moves the focus cursor to the next unchecked ingredient and B3 toggles the check on the focused ingredient. Once everything is checked off, B1 transitions to cooking mode.

### Multiple recipes

Send as many recipes as you want -- they all load into the widget. Use B4 to switch between them. Each recipe tracks its own progress independently. The footer bar shows all loaded recipes with status indicators:

- White dot: new, not started
- Blue dot: gathering ingredients
- Yellow dot (glowing): actively cooking
- Green dot: done

## Features

- **AI-extracted steps** -- Raw instruction blocks are broken into clear, individual steps grouped by recipe component.
- **Ingredient-to-step linking** -- The left panel highlights exactly which ingredients are used in the current step, including cross-group references (e.g., "add the marinade" links back to the Marinade group).
- **Timer detection** -- Timers are extracted from step text with duration and label. Press B3 to start one on your timer widget (requires hubble-timer).
- **Temperature callouts** -- Oven preheats, stovetop heat levels, and precise temperatures are called out visually.
- **Technique tips** -- Short AI-generated cooking advice when a technique matters (e.g., "Pat the steak dry for a better sear"). Marked with an AI indicator.
- **Equipment callouts** -- Tools needed for the current step.
- **"Good to know" tips** -- Relevant notes from the recipe's notes field, surfaced on the steps they apply to.
- **Ingredient gathering mode** -- Check off ingredients as you pull them out before you start cooking.
- **Multi-recipe management** -- Load multiple recipes, switch between them, each with independent progress tracking.

## API Reference

### POST `/receive`

Receives a recipe from the Mela app.

**URL:** `http://<hubble-ip>:3000/api/modules/hubble-mela-recipe-viewer/receive`

**Content-Type:** `application/vnd.melarecipe`

**Body:** JSON object with Mela recipe fields:

| Field | Type | Description |
|---|---|---|
| `title` | string | Recipe name |
| `ingredients` | string | Ingredients text (groups separated by `# Group Name` lines) |
| `instructions` | string | Instructions text (groups separated by `# Group Name` lines) |
| `images` | string[] | Base64-encoded images |
| `notes` | string | Recipe notes |
| `yield` | string | Servings |
| `prepTime` | string | Prep time |
| `cookTime` | string | Cook time |
| `totalTime` | string | Total time |
| `id` | string | Mela recipe ID |

The connector processes the recipe with Claude AI and emits the result to the visualization. Processing typically takes a few seconds.

## Timer Integration

When a step has a timer callout, pressing B3 starts the timer automatically via the `hubble-timer` module's `start-available` endpoint. This finds the first idle timer widget and starts it with the correct duration and label.

If all timer widgets are busy, you will see a notification letting you know.

To use this feature:

1. Install the `hubble-timer` module.
2. Add one or more timer widgets to your Cooking page.
3. Make sure the timer module has the `start-available` endpoint enabled.

No additional configuration is needed -- the recipe viewer finds available timers automatically.
