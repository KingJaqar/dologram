import React, { useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ChatListItem } from '@dologram/shared';
import { FolderListTransition } from '../FolderListTransition';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => ({ reduceMotion: mockReduceMotion }) }));
const rows = (title: string) => [{ chatId: title, title }] as ChatListItem[];
function List({ items }: { items: ChatListItem[] }) {
  const [count, setCount] = useState(0);
  return <View testID="list"><Pressable onPress={() => setCount((value) => value + 1)}><Text>{items[0]?.title ?? 'Empty'} {count}</Text></Pressable></View>;
}
const renderList = (items: ChatListItem[]) => <List items={items} />;
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
beforeEach(() => {
  jest.useFakeTimers();
  mockReduceMotion = false;
  // Native animations are otherwise completed immediately by Jest's RN mock.
  // Keep their actual duration so interrupted-folder tests exercise cancellation.
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      start: (callback) => {
        timer = setTimeout(() => {
          (value as Animated.Value).setValue(config.toValue as number);
          callback?.({ finished: true });
        }, config.duration ?? 0);
      },
      stop: () => clearTimeout(timer),
      reset: () => clearTimeout(timer),
    };
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

test('keeps the outgoing list mounted during the crossfade, including its local state', () => {
  const all = rows('All');
  const screen = render(<FolderListTransition folderId={null} items={all} renderList={renderList} />);
  fireEvent.press(screen.getByText('All 0'));
  screen.rerender(<FolderListTransition folderId="work" items={rows('Work')} renderList={renderList} />);
  expect(screen.getByText('Work 0')).toBeTruthy();
  expect(screen.getByText('All 1', { includeHiddenElements: true })).toBeTruthy();
  advance(50);
  screen.rerender(<FolderListTransition folderId={null} items={all} renderList={renderList} />);
  advance(1000);
  expect(screen.getByText('All 1')).toBeTruthy();
  expect(screen.queryByText('Work 0', { includeHiddenElements: true })).toBeNull();
});

test('rapid taps retain at most two lists and finish on the latest folder, including empty folders', () => {
  const screen = render(<FolderListTransition folderId={null} items={rows('All')} renderList={renderList} />);
  for (const folderId of ['work', 'friends', 'work', 'empty']) {
    screen.rerender(<FolderListTransition folderId={folderId} items={folderId === 'empty' ? [] : rows(folderId)} renderList={renderList} />);
    expect(screen.getAllByTestId('list', { includeHiddenElements: true })).toHaveLength(2);
    advance(50);
  }
  advance(1000);
  expect(screen.getByText('Empty 0')).toBeTruthy();
  expect(screen.getAllByTestId('list', { includeHiddenElements: true })).toHaveLength(1);
});

test('live updates within a folder update the existing list without creating an outgoing snapshot', () => {
  const screen = render(<FolderListTransition folderId="work" items={rows('Before')} renderList={renderList} />);
  fireEvent.press(screen.getByText('Before 0'));
  screen.rerender(<FolderListTransition folderId="work" items={rows('After')} renderList={renderList} />);
  expect(screen.getByText('After 1')).toBeTruthy();
  expect(screen.getAllByTestId('list', { includeHiddenElements: true })).toHaveLength(1);
});

test('reduced motion switches folders immediately without an outgoing layer', () => {
  mockReduceMotion = true;
  const screen = render(<FolderListTransition folderId={null} items={rows('All')} renderList={renderList} />);
  screen.rerender(<FolderListTransition folderId="work" items={rows('Work')} renderList={renderList} />);
  expect(screen.getByText('Work 0')).toBeTruthy();
  expect(screen.queryByText('All 0', { includeHiddenElements: true })).toBeNull();
});
