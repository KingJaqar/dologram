import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Keyboard, StyleSheet, type KeyboardEvent } from 'react-native';
import { color } from '@dologram/shared';
import { ToastModalHost, ToastProvider, useToast, type ToastOptions } from '../Toast';

let mockScheme: 'light' | 'dark' = 'light';
let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => { const { color, motion, radius, typeTokens, z } = jest.requireActual('@dologram/shared'); return { colors: color[mockScheme], motion, radius, typeTokens, z, reduceMotion: mockReduceMotion }; } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../Icon', () => ({ Icon: () => null }));
let api: ReturnType<typeof useToast>;
function Probe() {
  const value = useToast();
  React.useEffect(() => { api = value; }, [value]);
  return null;
}
function setup() { return render(<ToastProvider><Probe /></ToastProvider>); }
async function show(options: ToastOptions) { await act(async () => { api.showToast(options); }); }
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }

beforeEach(() => {
  jest.useFakeTimers();
  mockScheme = 'light';
  mockReduceMotion = false;
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('independent lanes, safe areas and navigation clearance', async () => {
  const screen = setup();
  await show({ message: 'Copied.', placement: 'top', variant: 'success' });
  await show({ message: 'Archived.', placement: 'bottom', variant: 'success' });
  expect(StyleSheet.flatten(screen.getByTestId('toast-top').props.style).top).toBe(88);
  expect(StyleSheet.flatten(screen.getByTestId('toast-bottom').props.style).bottom).toBe(114);
  expect(screen.getByText('Copied.').props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(2);
});

test('repeated messages refresh their lifetime without queuing', async () => {
  const screen = setup();
  await show({ message: 'Archived.', variant: 'success' });
  await advance(2100);
  await show({ message: 'Archived.', variant: 'success' });
  expect(screen.getAllByText('Archived.')).toHaveLength(1);
  await advance(1900);
  expect(screen.getByText('Archived.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Archived.')).toBeNull();
});

test('errors immediately replace successes and get their full 9 seconds', async () => {
  const screen = setup();
  await show({ message: 'Saved.', variant: 'success' });
  await advance(3999);
  expect(screen.getByText('Saved.')).toBeTruthy();
  await show({ message: 'Try again.', variant: 'error' });
  expect(screen.queryByText('Saved.')).toBeNull();
  expect(screen.getByText('Try again.')).toBeTruthy();
  await advance(8999);
  expect(screen.getByText('Try again.')).toBeTruthy();
  await advance(1);
  expect(screen.queryByText('Try again.')).toBeNull();
});

test('dismissing an old card cannot dismiss its replacement', async () => {
  const screen = setup();
  await show({ message: 'Old.', variant: 'success' });
  const oldDismiss = screen.UNSAFE_getByType(Animated.View).props.onAccessibilityEscape;
  await advance(3500);
  await show({ message: 'New.', variant: 'success' });
  act(() => oldDismiss());
  await advance(500);
  expect(screen.getByText('New.')).toBeTruthy();
  await advance(3499);
  expect(screen.getByText('New.')).toBeTruthy();
  await advance(1);
  expect(screen.queryByText('New.')).toBeNull();
});

test('rapid alternating actions always show the latest result and never replay older results', async () => {
  const screen = setup();
  for (let index = 0; index < 100; index++) {
    const message = index % 2 === 0 ? 'Added to starred' : 'Removed from starred';
    await show({ message, variant: 'success' });
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(index % 2 === 0 ? 'Removed from starred' : 'Added to starred')).toBeNull();
    await advance(10);
  }
  await advance(3989);
  expect(screen.getByText('Removed from starred')).toBeTruthy();
  await advance(1);
  expect(screen.queryByTestId('toast-bottom')).toBeNull();
  await advance(60000);
  expect(screen.queryByTestId('toast-bottom')).toBeNull();
});

test('a burst before rendering retains only the last result per placement', async () => {
  const screen = setup();
  await show({ message: 'Top result.', placement: 'top', durationMs: 0 });
  await act(async () => {
    for (let index = 0; index < 1000; index++) api.showToast({ message: `Result ${index}.` });
  });
  expect(screen.getByText('Top result.')).toBeTruthy();
  expect(screen.getByText('Result 999.')).toBeTruthy();
  fireEvent.press(screen.getAllByRole('button', { name: 'Dismiss notification' })[1]);
  expect(screen.queryByTestId('toast-bottom')).toBeNull();
  expect(screen.getByText('Top result.')).toBeTruthy();
});

test('new results replace persistent errors and actions without replaying them', async () => {
  const screen = setup();
  const onAction = jest.fn();
  await show({ message: 'Error.', variant: 'error', actionLabel: 'Retry', onAction });
  await show({ message: 'Saving.', loading: true, durationMs: 0 });
  await show({ message: 'Saved.', variant: 'success' });
  expect(screen.queryByText('Error.')).toBeNull();
  expect(screen.queryByText('Saving.')).toBeNull();
  expect(screen.getByText('Saved.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByTestId('toast-bottom')).toBeNull();
  expect(onAction).not.toHaveBeenCalled();
});

test('screen reader users retain notifications until explicitly dismissed', async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
  const screen = setup();
  await show({ message: 'Please try again.', variant: 'error' });
  await advance(60000);
  expect(screen.getByText('Please try again.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Please try again.')).toBeNull();
});

test('optional actions stay available and run once', async () => {
  const onAction = jest.fn();
  const screen = setup();
  await show({ message: 'Could not load.', actionLabel: 'Retry', onAction });
  await advance(60000);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Could not load.')).toBeNull();
});

test.each(['light', 'dark'] as const)('%s uses semantic colors and respects reduced motion', async (scheme) => {
  mockScheme = scheme;
  mockReduceMotion = true;
  const screen = setup();
  await show({ message: 'Failed.', variant: 'error' });
  expect(StyleSheet.flatten(screen.getByText('Failed.').props.style).color).toBe(color[scheme].error.text);
  expect(Animated.timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
});

test('keyboard movement clears the keyboard and composer', async () => {
  const listeners: Record<string, (event: KeyboardEvent) => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => { listeners[event] = listener; return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>; });
  const screen = setup();
  await show({ message: 'Saved.' });
  act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 200 } } as KeyboardEvent));
  expect(screen.queryByTestId('toast-bottom')).toBeNull();
  await act(async () => { listeners.keyboardDidHide({} as KeyboardEvent); });
  expect(screen.getByText('Saved.')).toBeTruthy();
});

test('frontmost modal owns a single viewport and returns it to root', async () => {
  const screen = render(<ToastProvider><Probe /><ToastModalHost visible /></ToastProvider>);
  await show({ message: 'Failed in modal.', variant: 'error' });
  expect(screen.getAllByText('Failed in modal.')).toHaveLength(1);
  await act(async () => { screen.rerender(<ToastProvider><Probe /><ToastModalHost visible={false} /></ToastProvider>); });
  expect(screen.getAllByText('Failed in modal.')).toHaveLength(1);
});

test('stable operation result IDs stay deduplicated after dismissal', async () => {
  const screen = setup();
  await show({ id: 'operation-1:success', message: 'Saved.' });
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  await advance(10000);
  await show({ id: 'operation-1:success', message: 'Saved.' });
  expect(screen.queryByText('Saved.')).toBeNull();
});

test('late operations from a previous account are suppressed while account transitions survive', async () => {
  const screen = setup();
  const oldShow = api.showToast;
  await act(async () => { api.setScope('other-account'); });
  await act(async () => { oldShow({ message: 'Old account result.' }); });
  expect(screen.queryByText('Old account result.')).toBeNull();
  await act(async () => { oldShow({ message: 'Account switched.', surviveAccountChange: true }); });
  expect(screen.getByText('Account switched.')).toBeTruthy();
});
