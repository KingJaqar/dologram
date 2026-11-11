import React, { useEffect } from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { config } from '@dologram/shared';
import { ChatListLoadingTransition } from '../ChatListLoadingTransition';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => ({
    reduceMotion: mockReduceMotion,
    colors: jest.requireActual('@dologram/shared').color.light,
  }),
}));
jest.mock('../../components/ChatRow', () => ({
  ChatListSkeleton: () => jest.requireActual('react').createElement(
    jest.requireActual('react-native').View, { testID: 'placeholder' },
  ),
}));

beforeEach(() => { jest.useFakeTimers(); mockReduceMotion = false; });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

test('fast cache reads skip the skeleton and preserve the mounted list', () => {
  const mount = jest.fn();
  const unmount = jest.fn();
  function List() {
    useEffect(() => { mount(); return unmount; }, []);
    return <View testID="list" />;
  }
  const screen = render(<ChatListLoadingTransition loading><List /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs - 1);
  expect(screen.queryByTestId('placeholder')).toBeNull();
  screen.rerender(<ChatListLoadingTransition loading={false}><List /></ChatListLoadingTransition>);
  advance(1000);
  expect(screen.queryByTestId('placeholder')).toBeNull();
  expect(screen.getByTestId('list')).toBeTruthy();
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
});

test('a slow read holds the skeleton briefly, then removes it after the reveal', () => {
  const screen = render(<ChatListLoadingTransition loading><View /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs);
  expect(screen.getByTestId('placeholder')).toBeTruthy();
  screen.rerender(<ChatListLoadingTransition loading={false}><View /></ChatListLoadingTransition>);
  advance(199);
  expect(screen.getByTestId('placeholder')).toBeTruthy();
  advance(1000);
  expect(screen.queryByTestId('placeholder')).toBeNull();
});

test('reduced motion reveals ready content immediately without a minimum hold', () => {
  mockReduceMotion = true;
  const screen = render(<ChatListLoadingTransition loading><View /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs);
  expect(screen.getByTestId('placeholder')).toBeTruthy();
  screen.rerender(<ChatListLoadingTransition loading={false}><View /></ChatListLoadingTransition>);
  advance(0);
  expect(screen.queryByTestId('placeholder')).toBeNull();
});

test('a new load cancels a pending reveal and unmount clears the delay', () => {
  const screen = render(<ChatListLoadingTransition loading><View /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs);
  screen.rerender(<ChatListLoadingTransition loading={false}><View /></ChatListLoadingTransition>);
  advance(100);
  screen.rerender(<ChatListLoadingTransition loading><View /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs);
  expect(screen.getByTestId('placeholder')).toBeTruthy();
  screen.unmount();
  advance(1000);
});
