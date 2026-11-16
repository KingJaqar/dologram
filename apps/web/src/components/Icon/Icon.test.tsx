import { render, screen, cleanup } from '@testing-library/react';
import { expect, test } from 'vitest';
import { iconNames, iconSizes, type IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from './Icon';

test('every shared semantic name resolves to a browser SVG', () => {
  for (const name of Object.keys(iconNames) as IconName[]) {
    render(<Icon name={name} label={name} />);
    expect(screen.getByRole('img', { name }).tagName.toLowerCase()).toBe('svg');
    cleanup();
  }
});

test('browser-only theme names resolve without changing the shared semantic map', () => {
  for (const name of ['theme.system', 'theme.light', 'theme.dark'] as const) {
    render(<Icon name={name} label={name} />);
    expect(screen.getByRole('img', { name }).tagName.toLowerCase()).toBe('svg');
    cleanup();
  }
  expect(Object.keys(iconNames).some((name) => name.startsWith('theme.'))).toBe(false);
});

test('sizes, strokes, accessibility and optional spin follow the contract', () => {
  for (const [size, { size: pixels, stroke }] of Object.entries(iconSizes)) {
    const { container, unmount } = render(<Icon name="ui.loading" size={size as keyof typeof iconSizes} spin />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', String(pixels));
    expect(svg).toHaveAttribute('stroke-width', String(stroke));
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.getAttribute('class')).toMatch(/spin/);
    unmount();
  }
});
