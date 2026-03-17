import React from 'react';
import type { ProcessedGroup, RecipePhase } from '../types';

interface IngredientPanelProps {
  groups: ProcessedGroup[];
  phase: RecipePhase;
  activeIngredientIds: string[];
  gatheredIds: Set<string>;
  usedIds: Set<string>;
  gatherCursorIndex: number;
}

export function IngredientPanel({
  groups,
  phase,
  activeIngredientIds,
  gatheredIds,
  usedIds,
  gatherCursorIndex,
}: IngredientPanelProps) {
  // Build flat list of non-reference ingredient IDs for gather cursor mapping
  const flatNonRefIds: string[] = [];
  for (const group of groups) {
    for (const ing of group.ingredients) {
      if (!ing.isReference) {
        flatNonRefIds.push(ing.id);
      }
    }
  }
  const focusedId = gatherCursorIndex >= 0 && gatherCursorIndex < flatNonRefIds.length
    ? flatNonRefIds[gatherCursorIndex]
    : null;

  const activeSet = new Set(activeIngredientIds);

  return (
    <div className="rcp-ingredients">
      {groups.map((group) => {
        const nonRefIngredients = group.ingredients.filter((i) => !i.isReference);
        const allUsed =
          nonRefIngredients.length > 0 &&
          nonRefIngredients.every((i) => usedIds.has(i.id));
        const isCollapsed = allUsed && (phase === 'cooking' || phase === 'done');

        if (isCollapsed) {
          return (
            <div key={group.name} className="rcp-group-collapsed">
              <span className="label-text">{group.name}</span>
              <span className="rcp-group-collapsed-count">
                {nonRefIngredients.length}/{nonRefIngredients.length} &#10003;
              </span>
            </div>
          );
        }

        return (
          <React.Fragment key={group.name}>
            <div className="rcp-group">
              <span className="label-text">{group.name}</span>
            </div>
            {group.ingredients.map((ing) => {
              if (ing.isReference) {
                return (
                  <div key={ing.id} className="rcp-row">
                    <span className="rcp-row-name"><em>{ing.text}</em></span>
                  </div>
                );
              }

              const isActive = activeSet.has(ing.id);
              const isChecked = usedIds.has(ing.id) && (phase === 'cooking' || phase === 'done');
              const isFocused = phase === 'gathering' && focusedId === ing.id;
              const isGathered = gatheredIds.has(ing.id);
              const isUsed = usedIds.has(ing.id);

              const rowClasses = [
                'rcp-row',
                isActive && 'rcp-row--active',
                isChecked && 'rcp-row--checked',
                isFocused && 'rcp-row--focused',
              ]
                .filter(Boolean)
                .join(' ');

              const checkClasses = [
                'rcp-check',
                phase === 'gathering' && isGathered && 'rcp-check--gathered',
                (phase === 'cooking' || phase === 'done') && isUsed && 'rcp-check--used',
              ]
                .filter(Boolean)
                .join(' ');

              const showGatheredIcon = phase === 'gathering' && isGathered;
              const showUsedIcon = (phase === 'cooking' || phase === 'done') && isUsed;

              return (
                <div key={ing.id} className={rowClasses}>
                  <div className={checkClasses}>
                    {showGatheredIcon && (
                      <span className="rcp-check-icon--gathered">&#10003;</span>
                    )}
                    {showUsedIcon && (
                      <span className="rcp-check-icon--used">&#10003;</span>
                    )}
                  </div>
                  <span className="rcp-row-name">{ing.text}</span>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
