import React, { useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { FolderScreenTransition } from '../FolderScreenTransition';

let mockReduceMotion = false;
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => ({ reduceMotion: mockReduceMotion }) }));

function Screen({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return (
    <View testID={`screen-${label}`}>
      <Pressable onPress={() => setCount((value) => value + 1)}>
        <Text>{label} {count}</Text>
      </Pressable>
    </View>
  );
}

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  mockReduceMotion = false;
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

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('crossfades between sections while retaining the outgoing content', () => {
  const screen = render(
    <FolderScreenTransition viewKey="chat">
      <Screen label="Chat Folders" />
    </FolderScreenTransition>,
  );
  fireEvent.press(screen.getByText('Chat Folders 0'));

  screen.rerender(
    <FolderScreenTransition viewKey="manage">
      <Screen label="Manage Folders" />
    </FolderScreenTransition>,
  );

  expect(screen.getByText('Manage Folders 0')).toBeTruthy();
  expect(screen.getByText('Chat Folders 1', { includeHiddenElements: true })).toBeTruthy();
  advance(249);
  expect(screen.getByText('Chat Folders 1', { includeHiddenElements: true })).toBeTruthy();
  advance(1);
  expect(screen.queryByText('Chat Folders 1', { includeHiddenElements: true })).toBeNull();
});

test('reduced motion switches sections without retaining the outgoing content', () => {
  mockReduceMotion = true;
  const screen = render(
    <FolderScreenTransition viewKey="chat">
      <Screen label="Chat Folders" />
    </FolderScreenTransition>,
  );
  screen.rerender(
    <FolderScreenTransition viewKey="manage">
      <Screen label="Manage Folders" />
    </FolderScreenTransition>,
  );

  expect(screen.getByText('Manage Folders 0')).toBeTruthy();
  expect(screen.queryByText('Chat Folders 0', { includeHiddenElements: true })).toBeNull();
});

test('a rapid switch back reuses the fading scene and removes the other scenes on completion', () => {
  const section = (label: string) => (
    <FolderScreenTransition viewKey={label}>
      <Screen label={label} />
    </FolderScreenTransition>
  );
  const screen = render(section('All'));
  fireEvent.press(screen.getByText('All 0'));
  screen.rerender(section('People'));
  advance(50);
  screen.rerender(section('Groups'));
  advance(50);
  screen.rerender(section('All'));

  expect(screen.getByText('All 1')).toBeTruthy();
  expect(screen.queryByText('People 0')).toBeNull();
  expect(screen.getByText('People 0', { includeHiddenElements: true })).toBeTruthy();
  advance(249);
  expect(screen.getByText('Groups 0', { includeHiddenElements: true })).toBeTruthy();
  advance(1);
  expect(screen.queryByText('Groups 0', { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByText('People 0', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText('All 1')).toBeTruthy();
});
