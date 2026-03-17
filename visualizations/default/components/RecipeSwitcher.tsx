import React from 'react';
import type { ProcessedRecipe, RecipePhase } from '../types';

interface RecipeSwitcherProps {
  recipes: ProcessedRecipe[];
  activeId: string;
  phases: Record<string, RecipePhase>;
  stepProgress: Record<string, { current: number; total: number }>;
}

function getProgressLabel(phase: RecipePhase, progress?: { current: number; total: number }): string {
  switch (phase) {
    case 'waiting':
      return 'new';
    case 'gathering':
      return 'gather';
    case 'cooking':
      return progress ? `${progress.current}/${progress.total}` : '0/0';
    case 'done':
      return 'done';
  }
}

export function RecipeSwitcher({ recipes, activeId, phases, stepProgress }: RecipeSwitcherProps) {
  if (recipes.length < 2) {
    const phase = recipes.length === 1 ? (phases[recipes[0].id] ?? 'waiting') : 'waiting';
    return (
      <div className="rcp-footer">
        <div className="rcp-footer-single">
          <div className={`rcp-switch-status rcp-switch-status--${phase}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="rcp-footer">
      <div className="rcp-switcher">
        {recipes.map((recipe) => {
          const phase = phases[recipe.id] ?? 'waiting';
          const isActive = recipe.id === activeId;
          return (
            <div
              key={recipe.id}
              className={`rcp-switch-item${isActive ? ' rcp-switch-item--active' : ''}`}
            >
              <div className={`rcp-switch-status rcp-switch-status--${phase}`} />
              <span className="rcp-switch-name">{recipe.title}</span>
              <span className="rcp-switch-progress">
                {getProgressLabel(phase, stepProgress[recipe.id])}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
