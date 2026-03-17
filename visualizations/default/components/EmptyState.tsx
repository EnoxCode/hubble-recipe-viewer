import React from 'react';

export function EmptyState() {
  return (
    <div className="rcp-empty">
      <div className="rcp-empty-icon">🍳</div>
      <div className="rcp-empty-text">Waiting for recipe…</div>
      <div className="rcp-empty-sub">Send a recipe from Mela to get started</div>
    </div>
  );
}
