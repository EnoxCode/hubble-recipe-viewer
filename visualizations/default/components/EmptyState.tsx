import React from 'react';
import { mdiPotSteamOutline } from '@mdi/js';
import { Icon } from './Icon';

export function EmptyState() {
  return (
    <div className="rcp-empty">
      <div className="rcp-empty-icon"><Icon path={mdiPotSteamOutline} /></div>
      <div className="rcp-empty-text">Waiting for recipe…</div>
      <div className="rcp-empty-sub">Send a recipe from Mela to get started</div>
    </div>
  );
}
