import React from 'react';
import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { color } from '@dologram/shared';
import { ProfileConnectionStroke } from '../ProfileConnectionStroke';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => ({ reduceMotion: mockReduceMotion }) }));

afterEach(() => {
  mockReduceMotion = false;
  jest.restoreAllMocks();
});

test('starts one 3-second revolution per new color, including interrupted transitions', () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const ring = (value: string) => <ProfileConnectionStroke color={value}>{null}</ProfileConnectionStroke>;
  const screen = render(ring(color.light.connection.stable));
  expect(timing).not.toHaveBeenCalled();
  expect(screen.getByTestId('profile-connection-roll')).toHaveStyle({ opacity: 0 });

  for (const value of [color.light.connection.unstable, color.light.connection.offline, color.light.connection.free]) {
    timing.mockClear();
    screen.rerender(ring(value));
    expect(timing).toHaveBeenNthCalledWith(1, value, expect.objectContaining({ duration: 3000 }));
    expect(timing).toHaveBeenNthCalledWith(2, 1, expect.objectContaining({ duration: 3000 }));
    expect(timing).toHaveBeenCalledTimes(2);
    screen.rerender(ring(value));
    expect(timing).toHaveBeenCalledTimes(2);
  }
});

test('reduced motion stops the roll and applies the current color directly', () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  const screen = render(<ProfileConnectionStroke color={color.light.connection.stable}>{null}</ProfileConnectionStroke>);
  screen.rerender(<ProfileConnectionStroke color={color.light.connection.offline}>{null}</ProfileConnectionStroke>);
  timing.mockClear();
  cancel.mockClear();
  mockReduceMotion = true;
  screen.rerender(<ProfileConnectionStroke color={color.light.connection.free}>{null}</ProfileConnectionStroke>);
  expect(timing).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledTimes(2);
  // The lightweight test mock reads shared values during render, so render once
  // more after the layout effect to inspect its final, non-animated state.
  screen.rerender(<ProfileConnectionStroke color={color.light.connection.free}>{null}</ProfileConnectionStroke>);
  expect(screen.getByTestId('profile-connection-roll')).toHaveStyle({ opacity: 0 });
  expect(screen.getByTestId('profile-connection-ring')).toHaveStyle({ borderColor: color.light.connection.free });
});
