import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { getThemeSetting, setThemeSetting, useResolvedTheme } from './useTheme';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; localStorage.clear(); });

test('theme changes update subscribers, storage and attributes; listeners clean up', () => {
  const media = new EventTarget();
  const remove = vi.spyOn(media, 'removeEventListener');
  const matchMedia = vi.fn(() => Object.assign(media, { matches: true }));
  vi.stubGlobal('matchMedia', matchMedia);
  function Consumer() { return <p>{useResolvedTheme()}</p>; }
  const { unmount } = render(<Consumer />);
  expect(screen.getByText('dark')).toBeVisible();
  act(() => { expect(setThemeSetting('light')).toBeNull(); });
  expect(screen.getByText('light')).toBeVisible();
  expect(getThemeSetting()).toBe('light');
  expect(localStorage.getItem('dg.theme')).toBe('light');
  act(() => { setThemeSetting('system'); });
  expect(document.documentElement).not.toHaveAttribute('data-theme');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'dg.theme', newValue: 'light' })); });
  expect(screen.getByText('light')).toBeVisible();
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })); });
  expect(screen.getByText('dark')).toBeVisible();
  unmount();
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
});

test('denied persistence leaves the choice applied and returns a safe error', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private details', 'QuotaExceededError'); });
  expect(setThemeSetting('dark')).toContain('could not be saved');
  expect(getThemeSetting()).toBe('dark');
});
