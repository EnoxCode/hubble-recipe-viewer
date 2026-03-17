import React from 'react';
import { mdiCheckCircleOutline } from '@mdi/js';
import { Icon } from './Icon';

export function DonePanel({ totalSteps }: { totalSteps: number }) {
  return (
    <div className="rcp-done">
      <div className="rcp-done-icon"><Icon path={mdiCheckCircleOutline} /></div>
      <div className="rcp-done-title">Eet smakelijk!</div>
      <div className="rcp-done-sub">All {totalSteps} steps completed</div>
    </div>
  );
}
