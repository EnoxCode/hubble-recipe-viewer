import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EmptyState } from '../../visualizations/default/components/EmptyState';
import { ProcessingState } from '../../visualizations/default/components/ProcessingState';
import { DonePanel } from '../../visualizations/default/components/DonePanel';
import { Callout } from '../../visualizations/default/components/Callout';
import { RecipeImage } from '../../visualizations/default/components/RecipeImage';
import { RecipeSwitcher } from '../../visualizations/default/components/RecipeSwitcher';
import type { ProcessedRecipe, RecipePhase } from '../../visualizations/default/types';
import { useConnectorData, useHubbleSDK } from '@hubble/sdk';
import HubbleMelaRecipeViewerViz from '../../visualizations/default/index';

function makeRecipe(overrides: Partial<ProcessedRecipe> & { id: string; title: string }): ProcessedRecipe {
  return {
    status: 'ready',
    image: '',
    servings: '',
    prepTime: '',
    cookTime: '',
    totalTime: '',
    notes: '',
    groups: [],
    ...overrides,
  };
}

describe('EmptyState', () => {
  it('renders waiting message', () => {
    render(<EmptyState />);
    expect(screen.getByText('Waiting for recipe…')).toBeInTheDocument();
    expect(screen.getByText('Send a recipe from Mela to get started')).toBeInTheDocument();
  });
});

describe('ProcessingState', () => {
  it('renders the recipe title', () => {
    render(<ProcessingState title="Beef Stir-Fry" />);
    expect(screen.getByText('Processing recipe…')).toBeInTheDocument();
    expect(screen.getByText('Beef Stir-Fry')).toBeInTheDocument();
  });
});

describe('DonePanel', () => {
  it('renders step count', () => {
    render(<DonePanel totalSteps={7} />);
    expect(screen.getByText('Eet smakelijk!')).toBeInTheDocument();
    expect(screen.getByText('All 7 steps completed')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  const types = [
    { type: 'timer' as const, icon: '⏱' },
    { type: 'technique' as const, icon: '🔪' },
    { type: 'temp' as const, icon: '🔥' },
    { type: 'equip' as const, icon: '🍳' },
    { type: 'tip' as const, icon: '💡' },
  ];

  it.each(types)('renders $type callout with correct icon and text', ({ type, icon }) => {
    const { container } = render(<Callout type={type} title={`${type} title`} />);
    expect(screen.getByText(`${type} title`)).toBeInTheDocument();
    expect(screen.getByText(icon)).toBeInTheDocument();
    expect(container.querySelector(`.rcp-callout--${type}`)).toBeInTheDocument();
  });

  it('renders optional subtitle', () => {
    render(<Callout type="tip" title="Pro tip" subtitle="Use fresh herbs" />);
    expect(screen.getByText('Pro tip')).toBeInTheDocument();
    expect(screen.getByText('Use fresh herbs')).toBeInTheDocument();
  });

  it('omits subtitle element when not provided', () => {
    const { container } = render(<Callout type="timer" title="5 minutes" />);
    expect(container.querySelector('.rcp-callout-sub')).toBeNull();
  });
});

describe('RecipeImage', () => {
  it('renders title and meta joined with separator', () => {
    render(
      <RecipeImage
        image="abc123"
        title="Pasta Carbonara"
        servings="4 servings"
        prepTime="10 min"
        cookTime="20 min"
      />
    );
    expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
    expect(screen.getByText('4 servings · 10 min · 20 min')).toBeInTheDocument();
  });

  it('renders image tag with base64 src when image is provided', () => {
    render(
      <RecipeImage image="abc123" title="Test" servings="" prepTime="" cookTime="" />
    );
    const img = screen.getByAltText('Test') as HTMLImageElement;
    expect(img.src).toBe('data:image/jpeg;base64,abc123');
  });

  it('does not render image tag when image is empty', () => {
    const { container } = render(
      <RecipeImage image="" title="No Image" servings="2" prepTime="" cookTime="" />
    );
    expect(container.querySelector('.rcp-image')).toBeNull();
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('filters out empty meta parts', () => {
    render(
      <RecipeImage image="" title="Test" servings="2 servings" prepTime="" cookTime="15 min" />
    );
    expect(screen.getByText('2 servings · 15 min')).toBeInTheDocument();
  });
});

describe('RecipeSwitcher', () => {
  it('renders single recipe with just a status dot', () => {
    const recipes = [makeRecipe({ id: 'r1', title: 'Soup' })];
    const { container } = render(
      <RecipeSwitcher
        recipes={recipes}
        activeId="r1"
        phases={{ r1: 'cooking' }}
        stepProgress={{ r1: { current: 2, total: 5 } }}
      />
    );
    expect(container.querySelector('.rcp-footer-single')).toBeInTheDocument();
    expect(container.querySelector('.rcp-switch-status--cooking')).toBeInTheDocument();
    expect(container.querySelector('.rcp-switcher')).toBeNull();
  });

  it('renders multiple recipes with names and progress', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'Soup' }),
      makeRecipe({ id: 'r2', title: 'Salad' }),
      makeRecipe({ id: 'r3', title: 'Bread' }),
    ];
    const phases: Record<string, RecipePhase> = {
      r1: 'cooking',
      r2: 'waiting',
      r3: 'done',
    };
    const stepProgress = {
      r1: { current: 3, total: 6 },
      r2: { current: 0, total: 4 },
      r3: { current: 4, total: 4 },
    };

    const { container } = render(
      <RecipeSwitcher
        recipes={recipes}
        activeId="r1"
        phases={phases}
        stepProgress={stepProgress}
      />
    );

    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();

    expect(screen.getByText('3/6')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();

    const activeItem = container.querySelector('.rcp-switch-item--active');
    expect(activeItem).toBeInTheDocument();
    expect(activeItem?.textContent).toContain('Soup');
  });
});

// --- Integration tests for the main visualization component ---

function makeTestRecipe(overrides: Partial<ProcessedRecipe> = {}): ProcessedRecipe {
  return {
    id: 'test-1',
    status: 'ready',
    title: 'Test Beef Stir-fry',
    image: '',
    servings: '2',
    prepTime: '15min',
    cookTime: '5min',
    totalTime: '20min',
    notes: 'Cut against the grain.',
    groups: [{
      name: 'Marinade',
      ingredients: [
        { id: '0-0', text: '350g flank steak', isReference: false },
        { id: '0-1', text: '1 tsp cornstarch', isReference: false },
      ],
      steps: [{
        text: 'Slice the beef into strips.',
        linkedIngredientIds: ['0-0', '0-1'],
        timers: [{ label: 'Rest marinade', durationSeconds: 600 }],
        temperature: null,
        equipment: ['mixing bowl'],
        technique: 'Cut against the grain',
        goodToKnow: null,
      }],
    }],
    ...overrides,
  };
}

describe('HubbleMelaRecipeViewerViz (integration)', () => {
  beforeEach(() => {
    vi.mocked(useHubbleSDK).mockReturnValue({
      onButton: vi.fn(() => vi.fn()),
      callApi: vi.fn(),
      requestAcknowledge: vi.fn(),
    } as any);
    vi.mocked(useConnectorData).mockReturnValue(null);
  });

  it('renders empty state when no data', () => {
    vi.mocked(useConnectorData).mockReturnValue(null);
    render(<HubbleMelaRecipeViewerViz />);
    expect(screen.getByText('Waiting for recipe…')).toBeInTheDocument();
  });

  it('renders empty state when data has no recipes', () => {
    vi.mocked(useConnectorData).mockReturnValue({ recipes: {} });
    render(<HubbleMelaRecipeViewerViz />);
    expect(screen.getByText('Waiting for recipe…')).toBeInTheDocument();
  });

  it('renders processing state for processing recipe', () => {
    const recipe = makeTestRecipe({ id: 'p1', status: 'processing', title: 'Slow Cooker Chili' });
    vi.mocked(useConnectorData).mockReturnValue({ recipes: { p1: recipe } });
    render(<HubbleMelaRecipeViewerViz />);
    expect(screen.getByText('Processing recipe…')).toBeInTheDocument();
    expect(screen.getByText('Slow Cooker Chili')).toBeInTheDocument();
  });

  it('renders error state for failed recipe', () => {
    const recipe = makeTestRecipe({
      id: 'e1',
      status: 'error',
      title: 'Bad Recipe',
      error: 'Failed to parse ingredients',
    });
    vi.mocked(useConnectorData).mockReturnValue({ recipes: { e1: recipe } });
    render(<HubbleMelaRecipeViewerViz />);
    expect(screen.getByText('Failed to parse ingredients')).toBeInTheDocument();
  });

  it('renders recipe title and ingredients for ready recipe', () => {
    const recipe = makeTestRecipe();
    vi.mocked(useConnectorData).mockReturnValue({ recipes: { 'test-1': recipe } });
    render(<HubbleMelaRecipeViewerViz />);
    expect(screen.getByText('Test Beef Stir-fry')).toBeInTheDocument();
    expect(screen.getByText('350g flank steak')).toBeInTheDocument();
    expect(screen.getByText('1 tsp cornstarch')).toBeInTheDocument();
  });

  it('renders overview with group names', () => {
    const recipe = makeTestRecipe({
      groups: [
        {
          name: 'Marinade',
          ingredients: [{ id: '0-0', text: '350g flank steak', isReference: false }],
          steps: [{
            text: 'Mix the marinade.',
            linkedIngredientIds: ['0-0'],
            timers: [],
            temperature: null,
            equipment: [],
            technique: null,
            goodToKnow: null,
          }],
        },
        {
          name: 'Stir-fry',
          ingredients: [{ id: '1-0', text: '2 tbsp oil', isReference: false }],
          steps: [
            {
              text: 'Heat the wok.',
              linkedIngredientIds: ['1-0'],
              timers: [],
              temperature: null,
              equipment: ['wok'],
              technique: null,
              goodToKnow: null,
            },
            {
              text: 'Stir-fry the beef.',
              linkedIngredientIds: ['1-0'],
              timers: [],
              temperature: null,
              equipment: [],
              technique: null,
              goodToKnow: null,
            },
          ],
        },
      ],
    });
    vi.mocked(useConnectorData).mockReturnValue({ recipes: { 'test-1': recipe } });
    render(<HubbleMelaRecipeViewerViz />);

    // Overview panel shows group names (also appear in ingredient panel, so use getAllByText)
    expect(screen.getAllByText('Marinade').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Stir-fry').length).toBeGreaterThanOrEqual(1);
    // Shows component and step counts
    expect(screen.getByText(/2 components/)).toBeInTheDocument();
    expect(screen.getByText(/3 steps/)).toBeInTheDocument();
  });
});
