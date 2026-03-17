import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StepPanel } from '../../visualizations/default/components/StepPanel';
import { OverviewPanel } from '../../visualizations/default/components/OverviewPanel';
import type { ProcessedGroup, ProcessedStep } from '../../visualizations/default/types';

function makeStep(overrides: Partial<ProcessedStep> = {}): ProcessedStep {
  return {
    text: 'Do something.',
    linkedIngredientIds: [],
    timers: [],
    temperature: null,
    equipment: [],
    technique: null,
    goodToKnow: null,
    ...overrides,
  };
}

function makeGroup(name: string, steps: ProcessedStep[]): ProcessedGroup {
  return { name, ingredients: [], steps };
}

describe('StepPanel', () => {
  it('renders current step text', () => {
    const groups = [makeGroup('Sauce', [makeStep({ text: 'Heat oil in a pan.' })])];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('Heat oil in a pan.')).toBeInTheDocument();
  });

  it('renders previous step dimmed', () => {
    const groups = [
      makeGroup('Sauce', [
        makeStep({ text: 'Heat oil.' }),
        makeStep({ text: 'Add garlic.' }),
      ]),
    ];
    const { container } = render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={1} totalSteps={2} />
    );
    const prev = container.querySelector('.rcp-prev-step');
    expect(prev).toBeInTheDocument();
    expect(prev?.textContent).toBe('Heat oil.');
  });

  it('renders previous step from previous group when at first step of non-first group', () => {
    const groups = [
      makeGroup('Sauce', [makeStep({ text: 'Last sauce step.' })]),
      makeGroup('Noodles', [makeStep({ text: 'Boil noodles.' })]),
    ];
    const { container } = render(
      <StepPanel groups={groups} currentGroupIndex={1} currentStepIndex={0} totalSteps={2} />
    );
    const prev = container.querySelector('.rcp-prev-step');
    expect(prev).toBeInTheDocument();
    expect(prev?.textContent).toBe('Last sauce step.');
  });

  it('does not render previous step for first step of first group', () => {
    const groups = [makeGroup('Sauce', [makeStep({ text: 'First step.' })])];
    const { container } = render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(container.querySelector('.rcp-prev-step')).toBeNull();
  });

  it('renders callouts for timer', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({
          text: 'Cook for 10 minutes.',
          timers: [{ label: 'Cook', durationSeconds: 600 }],
        }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.getByText('10 min')).toBeInTheDocument();
  });

  it('renders callout for timer with range', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({
          text: 'Simmer.',
          timers: [{ label: 'Simmer', durationSeconds: 2700, maxDurationSeconds: 4500 }],
        }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('Simmer')).toBeInTheDocument();
    expect(screen.getByText('45-75 min')).toBeInTheDocument();
  });

  it('renders callout for technique', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({ text: 'Sear the beef.', technique: 'Searing' }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('Searing')).toBeInTheDocument();
  });

  it('renders callout for temperature', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({ text: 'Preheat oven.', temperature: '180\u00b0C' }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('180\u00b0C')).toBeInTheDocument();
  });

  it('renders callout for equipment', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({ text: 'Use a wok.', equipment: ['wok', 'spatula'] }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('wok, spatula')).toBeInTheDocument();
  });

  it('renders callout for tip', () => {
    const groups = [
      makeGroup('Main', [
        makeStep({ text: 'Season.', goodToKnow: 'Taste as you go' }),
      ]),
    ];
    render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={0} totalSteps={1} />
    );
    expect(screen.getByText('Taste as you go')).toBeInTheDocument();
  });

  it('shows correct carousel dot states (active, done)', () => {
    const groups = [
      makeGroup('Sauce', [makeStep()]),
      makeGroup('Noodles', [makeStep()]),
      makeGroup('Garnish', [makeStep()]),
    ];
    const { container } = render(
      <StepPanel groups={groups} currentGroupIndex={1} currentStepIndex={0} totalSteps={3} />
    );
    const dots = container.querySelectorAll('.rcp-dot');
    expect(dots).toHaveLength(3);
    expect(dots[0]?.classList.contains('rcp-dot--done')).toBe(true);
    expect(dots[1]?.classList.contains('rcp-dot--active')).toBe(true);
    expect(dots[2]?.classList.contains('rcp-dot--done')).toBe(false);
    expect(dots[2]?.classList.contains('rcp-dot--active')).toBe(false);
  });

  it('shows progress bar', () => {
    const groups = [
      makeGroup('A', [makeStep(), makeStep()]),
      makeGroup('B', [makeStep()]),
    ];
    const { container } = render(
      <StepPanel groups={groups} currentGroupIndex={0} currentStepIndex={1} totalSteps={3} />
    );
    const fill = container.querySelector('.rcp-progress-fill') as HTMLElement;
    expect(fill).toBeInTheDocument();
    // globalStepIndex = 0 + 1 + 1 = 2. width = 2/3*100 ≈ 66.67%
    const width = fill.style.width;
    expect(width).toMatch(/66\.6/);
  });
});

describe('OverviewPanel', () => {
  it('renders group names with step counts', () => {
    const groups = [
      makeGroup('Sauce', [makeStep(), makeStep(), makeStep()]),
      makeGroup('Noodles', [makeStep(), makeStep()]),
    ];
    render(<OverviewPanel groups={groups} notes="" totalSteps={5} />);
    expect(screen.getByText('Sauce')).toBeInTheDocument();
    expect(screen.getByText('3 steps')).toBeInTheDocument();
    expect(screen.getByText('Noodles')).toBeInTheDocument();
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('renders notes section when notes exist', () => {
    const groups = [makeGroup('Main', [makeStep()])];
    render(<OverviewPanel groups={groups} notes="Use fresh basil." totalSteps={1} />);
    expect(screen.getByText('NOTES')).toBeInTheDocument();
    expect(screen.getByText('Use fresh basil.')).toBeInTheDocument();
  });

  it('hides notes section when empty', () => {
    const groups = [makeGroup('Main', [makeStep()])];
    const { container } = render(
      <OverviewPanel groups={groups} notes="" totalSteps={1} />
    );
    expect(container.querySelector('.rcp-notes')).toBeNull();
  });

  it('renders overview meta text', () => {
    const groups = [
      makeGroup('Sauce', [makeStep()]),
      makeGroup('Noodles', [makeStep(), makeStep()]),
    ];
    render(<OverviewPanel groups={groups} notes="" totalSteps={3} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});
