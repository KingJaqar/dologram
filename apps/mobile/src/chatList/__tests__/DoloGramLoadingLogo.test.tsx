import React from 'react';
import { AppState } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { cancelAnimation, withRepeat } from 'react-native-reanimated';
import { DoloGramLoadingLogo } from '../DoloGramLoadingLogo';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => ({ reduceMotion: mockReduceMotion }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => {
  jest.requireActual('react').useEffect(callback, [callback]);
} }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: number) => jest.requireActual('react').useState(() => ({ value }))[0],
  useAnimatedProps: (factory: () => unknown) => factory(),
  Easing: { linear: (value: number) => value },
  withTiming: jest.fn((value: number) => value),
  withRepeat: jest.fn((value: number) => value),
  cancelAnimation: jest.fn(),
  interpolateColor: () => jest.requireActual('@dologram/shared').dologramLogoColors.paper,
}));

const initialAppState = AppState.currentState;
beforeEach(() => { jest.clearAllMocks(); mockReduceMotion = false; AppState.currentState = 'active'; });
afterEach(() => { jest.restoreAllMocks(); AppState.currentState = initialAppState; });

test('pauses the UI-thread loop in the background and cleans up on unmount', () => {
  let change!: (state: 'active' | 'background') => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    change = callback;
    return { remove };
  });
  const screen = render(<DoloGramLoadingLogo />);
  expect(withRepeat).toHaveBeenCalledWith(5400, -1, false);
  jest.mocked(cancelAnimation).mockClear();
  act(() => change('background'));
  expect(cancelAnimation).toHaveBeenCalled();
  jest.mocked(withRepeat).mockClear();
  act(() => change('active'));
  expect(withRepeat).toHaveBeenCalledTimes(1);
  screen.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('reduced motion uses static artwork and never starts a loop', () => {
  mockReduceMotion = true;
  const screen = render(<DoloGramLoadingLogo />);
  expect(withRepeat).not.toHaveBeenCalled();
  screen.unmount();
});
