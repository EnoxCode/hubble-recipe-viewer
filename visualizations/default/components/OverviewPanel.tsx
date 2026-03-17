import React from 'react';
import type { ProcessedGroup } from '../types';

interface OverviewPanelProps {
  groups: ProcessedGroup[];
  notes: string;
  totalSteps: number;
}

export function OverviewPanel({ groups, notes, totalSteps }: OverviewPanelProps) {
  return (
    <>
      <div className="rcp-step-nav">
        <div className="rcp-step-nav-left">
          <span className="label-text">Overview</span>
          <span className="muted-text">
            {groups.length} {groups.length === 1 ? 'component' : 'components'} &middot; {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
          </span>
        </div>
        <div className="rcp-dots">
          {groups.map((group) => (
            <div key={group.name} className="rcp-dot" />
          ))}
        </div>
      </div>

      <div className="rcp-progress">
        <div className="rcp-progress-fill" style={{ width: '0%' }} />
      </div>

      <div className="rcp-overview">
        {groups.map((group) => (
          <div key={group.name} className="rcp-overview-row">
            <span className="rcp-overview-name">{group.name}</span>
            <span className="rcp-overview-steps">
              {group.steps.length} {group.steps.length === 1 ? 'step' : 'steps'}
            </span>
          </div>
        ))}
      </div>

      {notes && (
        <div className="rcp-notes">
          <div className="label-text">NOTES</div>
          <div className="rcp-notes-text">{notes}</div>
        </div>
      )}
    </>
  );
}
