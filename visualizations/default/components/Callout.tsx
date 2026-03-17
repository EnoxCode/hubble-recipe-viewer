import React from 'react';

type CalloutType = 'timer' | 'technique' | 'temp' | 'equip' | 'tip';

const ICONS: Record<CalloutType, string> = {
  timer: '⏱',
  technique: '🔪',
  temp: '🔥',
  equip: '🍳',
  tip: '💡',
};

export function Callout({ type, title, subtitle }: { type: CalloutType; title: string; subtitle?: string }) {
  return (
    <div className={`rcp-callout rcp-callout--${type}`}>
      <span className="rcp-callout-icon">{ICONS[type]}</span>
      <div>
        <div className="rcp-callout-title">{title}</div>
        {subtitle && <div className="rcp-callout-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
