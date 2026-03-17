import React, { useEffect } from 'react';
import { useConnectorData, useHubbleSDK } from '@hubble/sdk';
import type { RecipeViewerData } from './types';
import { useRecipeNavigation } from './hooks/useRecipeNavigation';
import { EmptyState } from './components/EmptyState';
import { ProcessingState } from './components/ProcessingState';
import { RecipeImage } from './components/RecipeImage';
import { IngredientPanel } from './components/IngredientPanel';
import { StepPanel } from './components/StepPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { DonePanel } from './components/DonePanel';
import { RecipeSwitcher } from './components/RecipeSwitcher';
import './style.css';

const HubbleMelaRecipeViewerViz = () => {
  const data = useConnectorData<RecipeViewerData>();
  const sdk = useHubbleSDK();
  const nav = useRecipeNavigation(data);

  // Wire hardware buttons
  useEffect(() => {
    const unsub1 = sdk.onButton('button1', () => nav.handleButton('primary'));
    const unsub2 = sdk.onButton('button2', () => nav.handleButton('back'));
    const unsub3 = sdk.onButton('button3', () => nav.handleButton('contextual'));
    const unsub4 = sdk.onButton('button4', () => nav.handleButton('switch'));
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [sdk, nav.handleButton]);

  // Handle pending timer
  useEffect(() => {
    if (nav.pendingTimer) {
      sdk.callApi('start-available', {
        duration: nav.pendingTimer.durationSeconds,
        label: nav.pendingTimer.label,
      });
      nav.clearPendingTimer();
    }
  }, [nav.pendingTimer, nav.clearPendingTimer, sdk]);

  // No data or no recipes
  if (!data || !data.recipes || Object.keys(data.recipes).length === 0) {
    return (
      <div className="rcp-widget-single">
        <EmptyState />
      </div>
    );
  }

  const { activeRecipe } = nav;

  // No active recipe (shouldn't happen but guard)
  if (!activeRecipe) {
    return (
      <div className="rcp-widget-single">
        <EmptyState />
      </div>
    );
  }

  // Processing state
  if (activeRecipe.status === 'processing') {
    return (
      <div className="rcp-widget-single">
        <ProcessingState title={activeRecipe.title} />
      </div>
    );
  }

  // Error state
  if (activeRecipe.status === 'error') {
    return (
      <div className="rcp-widget-single">
        <div className="rcp-empty">
          <div className="rcp-empty-icon">&#9889;</div>
          <div className="rcp-empty-text">{activeRecipe.error || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  // Ready recipe — full two-panel layout
  const recipes = Object.values(data.recipes);
  const totalSteps = activeRecipe.groups.reduce((sum, g) => sum + g.steps.length, 0);

  return (
    <div className="dash-glass rcp-widget">
      <div className="rcp-layout">
        <div className="rcp-left">
          <RecipeImage
            image={activeRecipe.image}
            title={activeRecipe.title}
            servings={activeRecipe.servings}
            prepTime={activeRecipe.prepTime}
            cookTime={activeRecipe.cookTime}
          />
          <IngredientPanel
            groups={activeRecipe.groups}
            phase={nav.phase}
            activeIngredientIds={nav.activeIngredientIds}
            gatheredIds={nav.gatheredIds}
            usedIds={nav.usedIds}
            gatherCursorIndex={nav.gatherCursorIndex}
          />
        </div>
        <div className="rcp-right">
          {(nav.phase === 'waiting' || nav.phase === 'gathering') && (
            <OverviewPanel
              groups={activeRecipe.groups}
              notes={activeRecipe.notes}
              totalSteps={totalSteps}
            />
          )}
          {nav.phase === 'cooking' && (
            <StepPanel
              groups={activeRecipe.groups}
              currentGroupIndex={nav.currentGroupIndex}
              currentStepIndex={nav.currentStepIndex}
              totalSteps={totalSteps}
            />
          )}
          {nav.phase === 'done' && (
            <DonePanel totalSteps={totalSteps} />
          )}
        </div>
      </div>
      <RecipeSwitcher
        recipes={recipes}
        activeId={nav.activeRecipeId}
        phases={nav.allPhases}
        stepProgress={nav.allStepProgress}
      />
    </div>
  );
};

export default HubbleMelaRecipeViewerViz;
