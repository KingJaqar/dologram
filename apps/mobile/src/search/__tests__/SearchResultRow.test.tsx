import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SearchResultRow } from '../SearchResultRow';
import { color } from '@dologram/shared';

let mockMode: 'light' | 'dark' = 'light';
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => {
  const tokens = jest.requireActual('@dologram/shared');
  return { ...tokens, colors: tokens.color[mockMode] };
} }));
jest.mock('../../components/Avatar', () => ({ Avatar: () => null }));

test.each(['light', 'dark'] as const)('rows expose labels, disabled state, growing layout and theme highlights in %s mode', (mode) => {
  mockMode = mode;
  const open = jest.fn();
  const screen = render(<SearchResultRow title="Ada" subtitle="needle text" metadata="2026" query="needle" onPress={open} avatarId="ada" />);
  const button = screen.getByRole('button', { name: 'Ada, 2026, needle text' });
  expect(StyleSheet.flatten(button.props.style).minHeight).toBe(72);
  fireEvent.press(button); expect(open).toHaveBeenCalledTimes(1);
  const highlight = screen.UNSAFE_getAllByType(Text).find((node) => node.props.children === 'needle');
  expect(StyleSheet.flatten(highlight?.props.style)).toMatchObject({ backgroundColor: color[mode].brand.primary, color: color[mode].text.inverse });
  screen.rerender(<SearchResultRow title="Ada" subtitle="needle text" query="needle" onPress={open} disabled />);
  expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button')); expect(open).toHaveBeenCalledTimes(1);
});
