import React from 'react';

export function ProcessingState({ title }: { title: string }) {
  return (
    <div className="rcp-empty">
      <div className="rcp-empty-icon">🔄</div>
      <div className="rcp-empty-text">Processing recipe…</div>
      <div className="rcp-empty-sub">{title}</div>
    </div>
  );
}
