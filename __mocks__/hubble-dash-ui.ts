import { vi } from 'vitest';
import React from 'react';

const mock = (name: string, render?: (p: Record<string, unknown>) => React.ReactElement | null) => {
  const c = vi.fn((props: Record<string, unknown>) =>
    render ? render(props) : React.createElement('div', { 'data-testid': name }, props.children as React.ReactNode));
  Object.defineProperty(c, 'name', { value: name });
  return c;
};

export const DashWidget = mock('DashWidget', (p) => React.createElement('div', { 'data-testid': 'DashWidget', className: p.className }, p.children));
export const DashWidgetHeader = mock('DashWidgetHeader', (p) => React.createElement('div', { 'data-testid': 'DashWidgetHeader' }, p.label && React.createElement('span', null, p.label), p.children));
export const DashWidgetFooter = mock('DashWidgetFooter', (p) => React.createElement('div', { 'data-testid': 'DashWidgetFooter' }, p.timestamp && React.createElement('span', null, String(p.timestamp)), p.children));
export const DashStatusDot = mock('DashStatusDot', (p) => React.createElement('span', { 'data-testid': 'DashStatusDot', 'data-status': p.status }));
export const DashSkeleton = mock('DashSkeleton', () => React.createElement('div', { 'data-testid': 'DashSkeleton' }));
export const DashDivider = mock('DashDivider', () => React.createElement('hr', { 'data-testid': 'DashDivider' }));
export const DashBadge = mock('DashBadge', (p) => React.createElement('span', { 'data-testid': 'DashBadge', 'data-variant': p.variant }, p.children));
export const DashPill = Object.assign(
  mock('DashPill', (p) => React.createElement('div', { 'data-testid': 'DashPill', 'data-variant': p.variant }, p.label && React.createElement('span', null, String(p.label)), p.children)),
  { Dot: mock('DashPill.Dot', (p) => React.createElement('span', { 'data-testid': 'DashPillDot', 'data-color': p.color })) },
);
export const DashCarouselDots = mock('DashCarouselDots', () => React.createElement('div', { 'data-testid': 'DashCarouselDots' }));
export const DashThumbnail = mock('DashThumbnail', (p) => React.createElement('div', { 'data-testid': 'DashThumbnail' }, p.children));
