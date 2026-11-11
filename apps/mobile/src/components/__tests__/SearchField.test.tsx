import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SearchField } from '../SearchField';

jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => {
  const tokens = jest.requireActual('@dologram/shared');
  return { ...tokens, colors: tokens.color.light };
} }));
jest.mock('../Icon', () => ({ Icon: () => null }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('uncontrolled prefill, default forwarding debounce, immediate deletion/clear, timer cleanup', () => {
  const onSearch = jest.fn();
  const screen = render(<SearchField defaultValue="prefill" onSearch={onSearch} />);
  const input = screen.getByRole('search');
  expect(input.props.value).toBe('prefill');
  fireEvent.changeText(input, 'new');
  expect(input.props.value).toBe('new');
  act(() => jest.advanceTimersByTime(149)); expect(onSearch).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1)); expect(onSearch).toHaveBeenLastCalledWith('new');
  fireEvent.changeText(input, 'pending');
  fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(onSearch).toHaveBeenLastCalledWith(''); expect(input.props.value).toBe('');
  expect(screen.queryByRole('button')).toBeNull();
  act(() => jest.advanceTimersByTime(200)); expect(onSearch).toHaveBeenCalledTimes(2);
  fireEvent.changeText(input, 'more'); fireEvent.changeText(input, '');
  expect(onSearch).toHaveBeenLastCalledWith('');
  fireEvent.changeText(input, 'unmount'); screen.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('controlled immediate updates preserve debounce; external prefill cancels stale callbacks', () => {
  const onSearch = jest.fn();
  function Controlled() {
    const [value, setValue] = useState('initial');
    return <SearchField value={value} onChangeText={setValue} onSearch={onSearch} />;
  }
  const screen = render(<Controlled />);
  fireEvent.changeText(screen.getByRole('search'), 'typed');
  expect(screen.getByRole('search').props.value).toBe('typed');
  act(() => jest.advanceTimersByTime(150)); expect(onSearch).toHaveBeenLastCalledWith('typed');
  fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('search').props.value).toBe('');
  screen.unmount();
  const external = render(<SearchField value="external" onSearch={onSearch} />);
  fireEvent.changeText(external.getByRole('search'), 'stale');
  external.rerender(<SearchField value="replacement" onSearch={onSearch} />);
  act(() => jest.advanceTimersByTime(150));
  expect(onSearch).not.toHaveBeenCalledWith('stale');
  expect(external.getByRole('search').props.value).toBe('replacement');
});

test('submit flushes current text once and clear has a 44px target without horizontal overlap', () => {
  const onSearch = jest.fn(); const onSubmitEditing = jest.fn();
  const screen = render(<SearchField onSearch={onSearch} onSubmitEditing={onSubmitEditing} />);
  fireEvent.changeText(screen.getByRole('search'), 'latest');
  fireEvent(screen.getByRole('search'), 'submitEditing', { nativeEvent: { text: 'latest' } });
  expect(onSearch).toHaveBeenCalledWith('latest'); expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(150)); expect(onSearch).toHaveBeenCalledTimes(1);
  const button = screen.getByRole('button');
  expect(StyleSheet.flatten(button.props.style).width).toBe(44);
  expect(StyleSheet.flatten(button.props.style).height).toBe(44);
});
