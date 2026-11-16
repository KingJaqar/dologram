/**
 * CMP-09 chat row tests (AND-03, AND-04, D-92, D-95).
 *
 * The row renders the item the shared builder produced: name, preview, time, unread badge, mute
 * icon, Seen status, Saved Messages avatar, and one accessibility label for the whole row.
 */
import React from 'react';
import { Animated, Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { ChatListItem } from '@dologram/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ArchivedRow, ChatRow } from '../ChatRow';
import { Avatar } from '../Avatar';

let mockReduceMotion = false;
jest.mock('../../lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));
jest.mock('../../theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => {
    const { color, ...tokens } = jest.requireActual('@dologram/shared');
    return { ...tokens, colors: color.light, reduceMotion: mockReduceMotion };
  },
}));
beforeEach(() => { mockReduceMotion = false; });
afterEach(() => { jest.restoreAllMocks(); });

function item(overrides: Partial<ChatListItem> = {}): ChatListItem {
  return {
    chatId: 'chat-1',
    title: 'Grace Hopper',
    preview: 'hello there',
    timeLabel: '09:05',
    sortMs: 1,
    unreadCount: 0,
    muted: false,
    isGroup: false,
    pinned: false,
    savedMessages: false,
    avatarId: 'user-2',
    avatarName: 'Grace Hopper',
    ownStatus: null,
    archived: false,
    accessibilityLabel: 'Grace Hopper, hello there, 09:05',
    ...overrides,
  };
}

function renderWith(element: React.ReactElement) {
  return render(element, { wrapper: ThemeProvider });
}

describe('ChatRow (CMP-09)', () => {
  test('reduced motion applies star changes immediately without starting a fade', () => {
    mockReduceMotion = true;
    const timing = jest.spyOn(Animated, 'timing');
    const onPress = jest.fn();
    const screen = renderWith(<ChatRow item={item()} onPress={onPress} />);
    const opacity = screen.UNSAFE_getAllByType(Animated.View).find((view) => view.props.testID === 'chat-starred-icon')!.props.style.opacity;
    expect(opacity.__getValue()).toBe(0);
    screen.rerender(<ChatRow item={item({ pinned: true })} onPress={onPress} />);
    expect(opacity.__getValue()).toBe(1);
    screen.rerender(<ChatRow item={item()} onPress={onPress} />);
    expect(opacity.__getValue()).toBe(0);
    expect(timing).not.toHaveBeenCalled();
  });
  test('star changes reverse the same native fade and stop superseded animations', () => {
    const stop = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    const onPress = jest.fn();
    const screen = renderWith(<ChatRow item={item()} onPress={onPress} />);
    const opacity = screen.UNSAFE_getAllByType(Animated.View).find((view) => view.props.testID === 'chat-starred-icon')!.props.style.opacity;
    screen.rerender(<ChatRow item={item({ pinned: true })} onPress={onPress} />);
    expect(timing).toHaveBeenLastCalledWith(opacity, expect.objectContaining({ toValue: 1, duration: 100, useNativeDriver: true, isInteraction: false }));
    screen.rerender(<ChatRow item={item({ pinned: false })} onPress={onPress} />);
    expect(timing).toHaveBeenLastCalledWith(opacity, expect.objectContaining({ toValue: 0, duration: 100 }));
    expect(stop).toHaveBeenCalledTimes(2);
    timing.mockRestore();
  });
  test('does not prefix the time with a separator when there is no preview', () => {
    const screen = renderWith(<ChatRow item={item({ preview: '' })} onPress={() => {}} />);
    expect(screen.getByText('09:05')).toBeTruthy();
    expect(screen.queryByText(' · 09:05')).toBeNull();
  });
  test('shows the name, preview, time and one accessibility label', () => {
    const onPress = jest.fn();
    const screen = renderWith(<ChatRow item={item()} onPress={onPress} />);

    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByText(' · 09:05')).toBeTruthy();
    expect(screen.getByLabelText('Grace Hopper, hello there, 09:05')).toBeTruthy();
  });

  test('shows the unread badge and the muted icon', () => {
    const screen = renderWith(
      <ChatRow
        item={item({ unreadCount: 3, muted: true, accessibilityLabel: 'Grace Hopper, 3 unread, muted' })}
        onPress={() => {}}
      />,
    );

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Grace Hopper, 3 unread, muted')).toBeTruthy();
  });

  test('shows the Seen status on the own last message and the Archived count row', () => {
    const screen = renderWith(
      <ChatRow item={item({ ownStatus: 'seen', accessibilityLabel: 'Grace Hopper, seen' })} onPress={() => {}} />,
    );
    expect(screen.getByLabelText('Grace Hopper, seen')).toBeTruthy();

    const archived = renderWith(<ArchivedRow count={2} onPress={() => {}} />);
    expect(archived.getByText('Archived (2)')).toBeTruthy();
  });

  test('calls onPress with the chat id', () => {
    const onPress = jest.fn();
    const screen = renderWith(<ChatRow item={item()} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledWith('chat-1');
  });

  test('keeps the avatar and chat content when the row enters selection mode', () => {
    const screen = renderWith(<ChatRow item={item()} onPress={() => {}} selectionMode selected />);

    expect(screen.UNSAFE_getByType(Avatar)).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({ checked: true });
  });

  test('live message and read-state updates remain visible with the latest press handler', () => {
    const firstPress = jest.fn();
    const nextPress = jest.fn();
    const screen = renderWith(<ChatRow item={item({ unreadCount: 3 })} onPress={firstPress} />);
    expect(screen.getByText('3')).toBeTruthy();
    screen.rerender(<ChatRow item={item({ preview: 'new message', unreadCount: 0 })} onPress={nextPress} />);
    expect(screen.queryByText('3')).toBeNull();
    expect(screen.getByText('new message')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(firstPress).not.toHaveBeenCalled();
    expect(nextPress).toHaveBeenCalledWith('chat-1');
  });
});

test('chat row renders and updates the actual profile photo', () => {
  const screen = renderWith(<ChatRow item={item({ avatarUrl: 'https://example.com/first.jpg' })} onPress={() => {}} />);
  expect(screen.UNSAFE_getByType(Avatar).findByType(Image).props.source.uri).toBe('https://example.com/first.jpg');
  screen.rerender(<ChatRow item={item({ avatarUrl: 'https://example.com/second.jpg' })} onPress={() => {}} />);
  expect(screen.UNSAFE_getByType(Avatar).findByType(Image).props.source.uri).toBe('https://example.com/second.jpg');
});
