import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SearchResultRow } from '../SearchResultRow';
import { color } from '@dologram/shared';
import { Avatar } from '../../components/Avatar';

let mockMode: 'light' | 'dark' = 'light';
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => {
  const tokens = jest.requireActual('@dologram/shared');
  return { ...tokens, colors: tokens.color[mockMode] };
} }));
jest.mock('../../components/Avatar', () => ({ Avatar: jest.fn(() => null) }));

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

test('search rows pass the profile photo and distinguish group storage', () => {
  const screen = render(<SearchResultRow title="Ada" subtitle="" query="" onPress={() => {}} avatarId="ada" avatarUrl="ada/avatar" />);
  expect(jest.mocked(Avatar).mock.calls.at(-1)?.[0]).toMatchObject({ imageUrl: 'ada/avatar', imageBucket: 'avatars' });
  screen.rerender(<SearchResultRow title="Group" subtitle="" query="" onPress={() => {}} avatarId="group" avatarUrl="group/avatar" isGroup />);
  expect(jest.mocked(Avatar).mock.calls.at(-1)?.[0]).toMatchObject({ imageUrl: 'group/avatar', imageBucket: 'chat-avatars' });
});

test('does not rerender an unchanged row for an unrelated parent update', () => {
  const open = jest.fn();
  jest.mocked(Avatar).mockClear();
  function Probe({ tick }: { tick: number }) {
    return <SearchResultRow title="Ada" subtitle="Needle" query="needle" onPress={open} avatarId="ada" metadata={tick === 0 ? '1 matched message' : '1 matched message'} />;
  }

  const screen = render(<Probe tick={0} />);
  const firstRenderCalls = jest.mocked(Avatar).mock.calls.length;
  screen.rerender(<Probe tick={1} />);
  expect(jest.mocked(Avatar).mock.calls).toHaveLength(firstRenderCalls);
});
