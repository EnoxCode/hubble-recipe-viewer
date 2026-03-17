import React from 'react';

export function DonePanel({ totalSteps }: { totalSteps: number }) {
  return (
    <div className="rcp-done">
      <div className="rcp-done-icon">✓</div>
      <div className="rcp-done-title">Eet smakelijk!</div>
      <div className="rcp-done-sub">All {totalSteps} steps completed</div>
    </div>
  );
}
