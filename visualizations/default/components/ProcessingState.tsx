import React from 'react';

export function ProcessingState({ title }: { title: string }) {
  return (
    <div className="rcp-empty">
      <div className="rcp-processing-spinner">
        <svg className="rcp-spinner-svg" viewBox="0 0 40 40">
          <circle className="rcp-spinner-track" cx="20" cy="20" r="16" fill="none" strokeWidth="2" />
          <circle className="rcp-spinner-arc" cx="20" cy="20" r="16" fill="none" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="rcp-spinner-icon">🧠</span>
      </div>
      <div className="rcp-empty-text">AI is processing your recipe…</div>
      <div className="rcp-empty-sub">{title}</div>
    </div>
  );
}
