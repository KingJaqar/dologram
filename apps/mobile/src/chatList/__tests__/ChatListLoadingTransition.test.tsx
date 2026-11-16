import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { config } from '@dologram/shared';
import { ChatListLoadingTransition } from '../ChatListLoadingTransition';
import { chatListLaunches } from '../startupSnapshot';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => ({
    reduceMotion: mockReduceMotion,
    colors: jest.requireActual('@dologram/shared').color.light,
  }),
}));
jest.mock('../DoloGramLoadingLogo', () => ({
  DoloGramLoadingLogo: () => jest.requireActual('react').createElement(
    jest.requireActual('react-native').View, { testID: 'placeholder' },
  ),
}));

beforeEach(() => { jest.useFakeTimers(); mockReduceMotion = false; chatListLaunches.clear(); });
afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

test('fresh app launch shows the logo even with ready cached rows, then returning skips it', () => {
  const first = render(<ChatListLoadingTransition loading={false} launchKey="account-a"><View testID="list" /></ChatListLoadingTransition>);
  expect(first.getByTestId('chat-list-loader')).toBeTruthy();
  advance(599);
  expect(first.getByTestId('chat-list-loader')).toBeTruthy();
  advance(1);
  advance(1000);
  expect(first.queryByTestId('chat-list-loader')).toBeNull();
  first.unmount();
  const timing = jest.spyOn(Animated, 'timing');
  const returning = render(<ChatListLoadingTransition loading={false} launchKey="account-a"><View /></ChatListLoadingTransition>);
  expect(returning.queryByTestId('chat-list-loader')).toBeNull();
  expect(timing).not.toHaveBeenCalled();
});

test('a real cold load continues after the brief launch hold until rows are ready', () => {
  const screen = render(<ChatListLoadingTransition loading launchKey="account-a"><View /></ChatListLoadingTransition>);
  advance(6000);
  expect(screen.getByTestId('chat-list-loader')).toBeTruthy();
  screen.rerender(<ChatListLoadingTransition loading={false} launchKey="account-a"><View /></ChatListLoadingTransition>);
  advance(1000);
  expect(screen.queryByTestId('chat-list-loader')).toBeNull();
});

test('the first-launch marker is account scoped and reduced motion has no launch delay', () => {
  chatListLaunches.add('account-a');
  mockReduceMotion = true;
  const screen = render(<ChatListLoadingTransition loading={false} launchKey="account-b"><View /></ChatListLoadingTransition>);
  expect(screen.getByTestId('chat-list-loader')).toBeTruthy();
  advance(0);
  expect(screen.queryByTestId('chat-list-loader')).toBeNull();
  expect(chatListLaunches.has('account-b')).toBe(true);
});

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
  const content = screen.UNSAFE_getByType(Animated.View);
  const opacity = StyleSheet.flatten(content.props.style).opacity as unknown as { __getValue: () => number };
  expect(opacity.__getValue()).toBe(1);
  advance(1000);
  expect(screen.queryByTestId('placeholder')).toBeNull();
  expect(screen.getByTestId('list')).toBeTruthy();
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
});

test('an already cached list renders fully visible without starting a reveal animation', () => {
  const timing = jest.spyOn(Animated, 'timing');
  render(<ChatListLoadingTransition loading={false}><View /></ChatListLoadingTransition>);
  expect(timing).not.toHaveBeenCalled();
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

test('ready content stays transparent during the skeleton hold and shares the reveal progress', () => {
  // Native-driver values aren't advanced by Jest's animation mock.
  const timing = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      start: (callback) => {
        timer = setTimeout(() => {
          (value as Animated.Value).setValue(config.toValue as number);
          callback?.({ finished: true });
        }, config.duration);
      },
      stop: () => clearTimeout(timer),
      reset: () => clearTimeout(timer),
    };
  });
  const screen = render(<ChatListLoadingTransition loading><View /></ChatListLoadingTransition>);
  advance(config.ui.loadingDelayMs);
  screen.rerender(<ChatListLoadingTransition loading={false}><View /></ChatListLoadingTransition>);
  const [content, placeholder] = screen.UNSAFE_getAllByType(Animated.View);
  const opacity = StyleSheet.flatten(content.props.style).opacity as unknown as { __getValue: () => number };
  expect(opacity.__getValue()).toBe(0);
  expect(content.props.needsOffscreenAlphaCompositing).toBe(true);
  expect(placeholder.props.needsOffscreenAlphaCompositing).toBe(true);
  advance(199);
  expect(opacity.__getValue()).toBe(0);
  advance(1000);
  expect(opacity.__getValue()).toBe(1);
  expect(timing).toHaveBeenCalledWith(opacity, expect.objectContaining({ duration: 250, useNativeDriver: true }));
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
