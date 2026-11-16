import React, { useEffect, useLayoutEffect } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { color } from '@dologram/shared';
import { ThemeProvider, useTheme, type ThemeContextValue } from '../ThemeProvider';
import { ThemeSurface, THEME_TRANSITION_EASING } from '../ThemeSurface';
import { SwitchRow } from '../../components/SwitchRow';

let theme: ThemeContextValue;
const mounted = jest.fn();
const renders = jest.fn();
function Probe() {
  const value = useTheme();
  useLayoutEffect(() => { theme = value; renders(value.scheme); });
  useEffect(() => { mounted(); }, []);
  return <><Text testID="live-content">{value.scheme}</Text><SwitchRow label="Theme" value={value.scheme === 'dark'} onValueChange={(on) => value.setSetting(on ? 'dark' : 'light')} animationDuration={250} /></>;
}
async function mount(modal = false) {
  const screen = render(<ThemeProvider><Probe />{modal ? <ThemeSurface testID="modal"><Text>Modal content</Text></ThemeSurface> : null}</ThemeProvider>);
  await act(async () => {});
  return screen;
}
function styles(screen: Awaited<ReturnType<typeof mount>>) {
  return screen.UNSAFE_getAllByType(View).map((view) => StyleSheet.flatten(view.props.style) ?? {});
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('light');
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('a real toggle tap applies the palette immediately with one render and no global opacity animation', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const screen = await mount();
  renders.mockClear();
  fireEvent.press(screen.getByRole('switch', { name: 'Theme' }));
  expect(theme.setting).toBe('dark');
  expect(theme.scheme).toBe('dark');
  expect(screen.getByTestId('live-content')).toHaveTextContent('dark');
  expect(renders.mock.calls).toEqual([['dark']]);
  expect(timing).not.toHaveBeenCalled();
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('theme-fade-tint', { includeHiddenElements: true })).toBeNull();
  const root = styles(screen)[0];
  expect(root).toEqual(expect.objectContaining({ backgroundColor: color.dark.bg.app, transitionDuration: 250, transitionTimingFunction: THEME_TRANSITION_EASING }));
  expect(root.transitionProperty).toContain('backgroundColor');
  expect(root.transitionProperty).not.toContain('opacity');
  expect(root.transitionProperty).not.toContain('shadowColor');
  expect(root).not.toHaveProperty('opacity');
  act(() => jest.advanceTimersByTime(250));
  expect(renders).toHaveBeenCalledTimes(1);
});
test('rapid taps reverse the native color and thumb targets immediately without remounting', async () => {
  const screen = await mount();
  for (const scheme of ['dark', 'light', 'dark']) {
    fireEvent.press(screen.getByRole('switch', { name: 'Theme' }));
    expect(theme.scheme).toBe(scheme);
    const thumb = styles(screen).find((style) => style.transitionProperty?.includes('transform'));
    expect(thumb).toEqual(expect.objectContaining({ transitionDuration: 250, transitionTimingFunction: THEME_TRANSITION_EASING, transform: [{ translateX: scheme === 'dark' ? 20 : 0 }] }));
  }
  expect(mounted).toHaveBeenCalledTimes(1);
});
test('modal surfaces transition their own colors while content stays visible', async () => {
  const screen = await mount(true);
  act(() => theme.setSetting('dark'));
  expect(theme.scheme).toBe('dark');
  expect(StyleSheet.flatten(screen.getByTestId('modal').props.style)).toEqual(expect.objectContaining({ transitionDuration: 250, transitionTimingFunction: THEME_TRANSITION_EASING }));
  expect(screen.getByText('Modal content')).toBeTruthy();
});
test('theme setter and duration helper retain their identities across palette changes', async () => {
  await mount();
  const previous = theme;
  act(() => theme.setSetting('dark'));
  expect(theme.setSetting).toBe(previous.setSetting);
  expect(theme.duration).toBe(previous.duration);
  renders.mockClear();
  act(() => theme.setSetting('dark'));
  expect(renders).not.toHaveBeenCalled();
});
test('reduced motion applies immediately and disables color and thumb transitions', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  const screen = await mount();
  fireEvent.press(screen.getByRole('switch', { name: 'Theme' }));
  expect(theme.scheme).toBe('dark');
  expect(styles(screen).filter((style) => style.transitionProperty).every((style) => style.transitionDuration === 0)).toBe(true);
});
test('changing the motion preference preserves the selected palette and disables the active transitions', async () => {
  const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener');
  const screen = await mount();
  act(() => theme.setSetting('dark'));
  const calls = subscribe.mock.calls as unknown as [string, (enabled: boolean) => void][];
  act(() => calls.find(([event]) => event === 'reduceMotionChanged')![1](true));
  expect(theme.scheme).toBe('dark');
  expect(styles(screen)[0].transitionDuration).toBe(0);
});
test('a delayed accessibility query cannot overwrite a newer reduced-motion event', async () => {
  let resolvePreference!: (value: boolean) => void;
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise((resolve) => { resolvePreference = resolve; }));
  const subscribe = jest.spyOn(AccessibilityInfo, 'addEventListener');
  const screen = await mount();
  const calls = subscribe.mock.calls as unknown as [string, (enabled: boolean) => void][];
  act(() => calls.find(([event]) => event === 'reduceMotionChanged')![1](true));
  await act(async () => resolvePreference(false));
  expect(theme.reduceMotion).toBe(true);
  expect(styles(screen)[0].transitionDuration).toBe(0);
});
test('slow saved-setting reads cannot postpone or override a tap', async () => {
  let resolveStored!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValue(new Promise((resolve) => { resolveStored = resolve; }));
  await mount();
  act(() => theme.setSetting('dark'));
  expect(theme.scheme).toBe('dark');
  await act(async () => resolveStored('light'));
  expect(theme.setting).toBe('dark');
  expect(theme.scheme).toBe('dark');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('dg.theme', 'dark');
});
