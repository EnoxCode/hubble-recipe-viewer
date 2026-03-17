import { vi } from 'vitest';
import React from 'react';

const mock = (name: string, render?: (p: Record<string, unknown>) => React.ReactElement | null) => {
  const c = vi.fn((props: Record<string, unknown>) =>
    render ? render(props) : React.createElement('div', { 'data-testid': name }, props.children as React.ReactNode));
  Object.defineProperty(c, 'name', { value: name });
  return c;
};

export const Button = mock('Button', (p) => React.createElement('button', { onClick: p.onClick }, p.children));
export const IconButton = mock('IconButton', (p) => React.createElement('button', { onClick: p.onClick, 'aria-label': p.label }, p.children));
export const Input = mock('Input', (p) => React.createElement('input', { value: p.value, placeholder: p.placeholder, onChange: p.onChange ? (e: React.ChangeEvent<HTMLInputElement>) => (p.onChange as (v: string) => void)(e.target.value) : undefined }));
export const Select = mock('Select', (p) => {
  const opts = (p.options || []) as Array<{ label: string; value: string }>;
  return React.createElement('div', { 'data-testid': 'Select' },
    p.label && React.createElement('span', null, p.label),
    opts.length > 0 && React.createElement('select', { value: p.value, onChange: p.onChange ? (e: React.ChangeEvent<HTMLSelectElement>) => (p.onChange as (v: string) => void)(e.target.value) : undefined },
      opts.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
    p.children);
});
export const Slider = mock('Slider', (p) => React.createElement('input', { type: 'range', value: p.value, min: p.min, max: p.max, step: p.step, onChange: p.onChange }));
export const Toggle = mock('Toggle', (p) => React.createElement('label', null, React.createElement('input', { type: 'checkbox', checked: p.checked, onChange: p.onChange }), p.label));
export const ColorPicker = mock('ColorPicker', (p) => React.createElement('input', { type: 'color', value: p.value, onChange: p.onChange, 'data-testid': 'ColorPicker' }));
export const StatusDot = mock('StatusDot', (p) => React.createElement('span', { 'data-testid': 'StatusDot', 'data-status': p.status }));
export const Badge = mock('Badge', (p) => React.createElement('span', { 'data-testid': 'Badge' }, p.children));
export const Field = mock('Field', (p) => React.createElement('div', { 'data-testid': 'Field' }, p.label && React.createElement('label', null, p.label), p.children));
export const Collapsible = mock('Collapsible', (p) => React.createElement('div', { 'data-testid': 'Collapsible' }, p.title && React.createElement('div', null, p.title), p.children));
