import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IngredientPanel } from '../../visualizations/default/components/IngredientPanel';
import type { ProcessedGroup, RecipePhase } from '../../visualizations/default/types';

function makeGroup(overrides: Partial<ProcessedGroup> & { name: string }): ProcessedGroup {
  return {
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

const defaultProps = {
  phase: 'waiting' as RecipePhase,
  activeIngredientIds: [] as string[],
  gatheredIds: new Set<string>(),
  usedIds: new Set<string>(),
  gatherCursorIndex: -1,
};

describe('IngredientPanel', () => {
  it('renders group labels', () => {
    const groups = [
      makeGroup({
        name: 'Sauce',
        ingredients: [{ id: 'i1', text: '2 tbsp soy sauce', isReference: false }],
      }),
      makeGroup({
        name: 'Noodles',
        ingredients: [{ id: 'i2', text: '200g noodles', isReference: false }],
      }),
    ];
    render(<IngredientPanel groups={groups} {...defaultProps} />);
    expect(screen.getByText('Sauce')).toBeInTheDocument();
    expect(screen.getByText('Noodles')).toBeInTheDocument();
  });

  it('renders ingredient names', () => {
    const groups = [
      makeGroup({
        name: 'Main',
        ingredients: [
          { id: 'i1', text: '2 tbsp soy sauce', isReference: false },
          { id: 'i2', text: '1 onion', isReference: false },
        ],
      }),
    ];
    render(<IngredientPanel groups={groups} {...defaultProps} />);
    expect(screen.getByText('2 tbsp soy sauce')).toBeInTheDocument();
    expect(screen.getByText('1 onion')).toBeInTheDocument();
  });

  it('shows collapsed group when all non-reference ingredients are used in cooking phase', () => {
    const groups = [
      makeGroup({
        name: 'Sauce',
        ingredients: [
          { id: 'i1', text: 'soy sauce', isReference: false },
          { id: 'i2', text: 'vinegar', isReference: false },
          { id: 'i3', text: 'see Noodles', isReference: true, referencesGroup: 'Noodles' },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel
        groups={groups}
        phase="cooking"
        activeIngredientIds={[]}
        gatheredIds={new Set<string>()}
        usedIds={new Set(['i1', 'i2'])}
        gatherCursorIndex={-1}
      />
    );
    expect(container.querySelector('.rcp-group-collapsed')).toBeInTheDocument();
    expect(screen.getByText('Sauce')).toBeInTheDocument();
  });

  it('highlights active ingredients', () => {
    const groups = [
      makeGroup({
        name: 'Main',
        ingredients: [
          { id: 'i1', text: 'garlic', isReference: false },
          { id: 'i2', text: 'ginger', isReference: false },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel
        groups={groups}
        {...defaultProps}
        phase="cooking"
        activeIngredientIds={['i1']}
      />
    );
    const rows = container.querySelectorAll('.rcp-row');
    expect(rows[0]?.classList.contains('rcp-row--active')).toBe(true);
    expect(rows[1]?.classList.contains('rcp-row--active')).toBe(false);
  });

  it('shows gathered checks (blue) in gather phase', () => {
    const groups = [
      makeGroup({
        name: 'Main',
        ingredients: [
          { id: 'i1', text: 'garlic', isReference: false },
          { id: 'i2', text: 'ginger', isReference: false },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel
        groups={groups}
        phase="gathering"
        activeIngredientIds={[]}
        gatheredIds={new Set(['i1'])}
        usedIds={new Set<string>()}
        gatherCursorIndex={0}
      />
    );
    const checks = container.querySelectorAll('.rcp-check');
    expect(checks[0]?.classList.contains('rcp-check--gathered')).toBe(true);
    expect(checks[1]?.classList.contains('rcp-check--gathered')).toBe(false);
  });

  it('shows used checks (green) in cook phase', () => {
    const groups = [
      makeGroup({
        name: 'Main',
        ingredients: [
          { id: 'i1', text: 'garlic', isReference: false },
          { id: 'i2', text: 'ginger', isReference: false },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel
        groups={groups}
        phase="cooking"
        activeIngredientIds={[]}
        gatheredIds={new Set<string>()}
        usedIds={new Set(['i2'])}
        gatherCursorIndex={-1}
      />
    );
    const checks = container.querySelectorAll('.rcp-check');
    expect(checks[0]?.classList.contains('rcp-check--used')).toBe(false);
    expect(checks[1]?.classList.contains('rcp-check--used')).toBe(true);
  });

  it('reference ingredients have no checkbox', () => {
    const groups = [
      makeGroup({
        name: 'Main',
        ingredients: [
          { id: 'i1', text: 'garlic', isReference: false },
          { id: 'ref1', text: 'see Sauce', isReference: true, referencesGroup: 'Sauce' },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel groups={groups} {...defaultProps} />
    );
    const checks = container.querySelectorAll('.rcp-check');
    expect(checks).toHaveLength(1);
  });

  it('applies focused class to gather cursor position', () => {
    const groups = [
      makeGroup({
        name: 'Group A',
        ingredients: [
          { id: 'i1', text: 'salt', isReference: false },
          { id: 'ref1', text: 'see B', isReference: true },
        ],
      }),
      makeGroup({
        name: 'Group B',
        ingredients: [
          { id: 'i2', text: 'pepper', isReference: false },
        ],
      }),
    ];
    const { container } = render(
      <IngredientPanel
        groups={groups}
        phase="gathering"
        activeIngredientIds={[]}
        gatheredIds={new Set<string>()}
        usedIds={new Set<string>()}
        gatherCursorIndex={1}
      />
    );
    // Flat non-ref list: [i1, i2]. Index 1 = i2 (pepper)
    const rows = container.querySelectorAll('.rcp-row');
    // rows: i1, ref1, i2
    expect(rows[2]?.classList.contains('rcp-row--focused')).toBe(true);
    expect(rows[0]?.classList.contains('rcp-row--focused')).toBe(false);
  });
});
