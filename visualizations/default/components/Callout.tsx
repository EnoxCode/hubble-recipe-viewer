import React from 'react';
import { mdiTimerOutline, mdiKnife, mdiFire, mdiPotSteamOutline, mdiLightbulbOnOutline } from '@mdi/js';
import { Icon } from './Icon';

type CalloutType = 'timer' | 'technique' | 'temp' | 'equip' | 'tip';

const ICONS: Record<CalloutType, string> = {
  timer: mdiTimerOutline,
  technique: mdiKnife,
  temp: mdiFire,
  equip: mdiPotSteamOutline,
  tip: mdiLightbulbOnOutline,
};

interface CalloutProps {
  type: CalloutType;
  title: string;
  subtitle?: string;
  actionHint?: string;
}

export function Callout({ type, title, subtitle, actionHint }: CalloutProps) {
  return (
    <div className={`rcp-callout rcp-callout--${type}`}>
      <span className="rcp-callout-icon"><Icon path={ICONS[type]} /></span>
      <div className="rcp-callout-body">
        <div className="rcp-callout-title">{title}</div>
        {subtitle && <div className="rcp-callout-sub">{subtitle}</div>}
      </div>
      {actionHint && <span className="rcp-callout-action">{actionHint}</span>}
    </div>
  );
}
