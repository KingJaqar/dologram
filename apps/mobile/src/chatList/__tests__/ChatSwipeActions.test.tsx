import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import type { ChatListItem } from '@dologram/shared';
import { actionsForChat, ChatListModeHeader, ChatSwipeableRow } from '../ChatSwipeActions';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn() }));
jest.mock('../../components/ChatRow', () => ({ ChatRow: () => null }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: jest.requireActual('@dologram/shared').color.light, reduceMotion: false }),
}));

test('covered swipe controls stay invisible during screen fades and appear only in their swipe direction', () => {
  const props = {
    item: {
      chatId: 'chat', title: 'Chat', preview: '', timeLabel: '', sortMs: 0,
      unreadCount: 0, muted: false, archived: false, isGroup: false, pinned: false,
      savedMessages: false, avatarId: 'user', avatarName: 'User', ownStatus: null, accessibilityLabel: 'Chat',
    } satisfies ChatListItem,
    section: 'chats' as const,
    onPress: jest.fn(),
    onAction: jest.fn(),
  };
  const screen = render(<ChatSwipeableRow {...props} />);
  const opacities = () => screen.UNSAFE_getAllByType(Animated.View)
    .map((view) => StyleSheet.flatten(view.props.style).opacity)
    .filter((opacity) => opacity !== undefined);
  expect(opacities()).toEqual([0, 0]);

  const gesture = screen.UNSAFE_getByType(GestureDetector).props.gesture as ReturnType<typeof Gesture.Pan>;
  type PanEvent = Parameters<NonNullable<typeof gesture.handlers.onUpdate>>[0];
  for (const [translationX, expected] of [
    [-100, [0, 1]], [40, [1, 0]], [0, [0, 0]],
  ] as const) {
    act(() => gesture.handlers.onUpdate!({ translationX } as PanEvent));
    // The workspace Reanimated mock evaluates animated styles on render.
    screen.rerender(<ChatSwipeableRow {...props} />);
    expect(opacities()).toEqual(expected);
  }
});

test('blocked chats expose Unblock in their swipe actions', () => {
  const item = {
    chatId: 'blocked', title: 'Blocked chat', preview: '', timeLabel: '', sortMs: 0,
    unreadCount: 0, muted: false, archived: false, isGroup: false, pinned: false,
    savedMessages: false, avatarId: 'user', avatarName: 'User', ownStatus: null, accessibilityLabel: 'Blocked chat',
  } satisfies ChatListItem;
  expect(actionsForChat(item, 'blocked', jest.fn()).map((action) => action.label)).toContain('Unblock');
});

test('selection mode keeps the 56 point rail open while preserving the row position reached by the swipe', () => {
  const props = {
    item: {
      chatId: 'chat', title: 'Chat', preview: '', timeLabel: '', sortMs: 0,
      unreadCount: 0, muted: false, archived: false, isGroup: false, pinned: false,
      savedMessages: false, avatarId: 'user', avatarName: 'User', ownStatus: null, accessibilityLabel: 'Chat',
    } satisfies ChatListItem,
    section: 'chats' as const,
    onPress: jest.fn(),
    onSelect: jest.fn(),
    onAction: jest.fn(),
  };
  const screen = render(<ChatSwipeableRow {...props} />);
  const gesture = screen.UNSAFE_getByType(GestureDetector).props.gesture as ReturnType<typeof Gesture.Pan>;
  type PanEvent = Parameters<NonNullable<typeof gesture.handlers.onUpdate>>[0];
  act(() => gesture.handlers.onUpdate!({ translationX: 80 } as PanEvent));
  screen.rerender(<ChatSwipeableRow {...props} />);
  expect(StyleSheet.flatten(screen.getByTestId('chat-selection-rail').props.style).width).toBe(56);
  const foreground = screen.UNSAFE_getAllByType(Animated.View).find((view) => (
    StyleSheet.flatten(view.props.style).transform?.[0]?.translateX === 56
  ));
  expect(foreground).toBeTruthy();

  screen.rerender(<ChatSwipeableRow {...props} selectionMode selected selectionPhase="entering" />);
  const selectedForeground = screen.UNSAFE_getAllByType(Animated.View).find((view) => (
    StyleSheet.flatten(view.props.style).transform?.[0]?.translateX === 56
  ));
  expect(selectedForeground).toBeTruthy();
});

test('a contextual selection toolbar collapses fully after its exit transition', () => {
  const onEntered = jest.fn();
  const onExited = jest.fn();
  const props = {
    defaultContent: null,
    selectionContent: null,
    onEntered,
    onExited,
    collapseWhenIdle: true,
  };
  const screen = render(<ChatListModeHeader {...props} phase="idle" />);
  const height = () => StyleSheet.flatten(screen.getByTestId('chat-list-mode-header').props.style).height;
  expect(height()).toBe(0);

  screen.rerender(<ChatListModeHeader {...props} phase="entering" />);
  screen.rerender(<ChatListModeHeader {...props} phase="entering" />);
  expect(height()).toBe(44);
  expect(onEntered).toHaveBeenCalledTimes(1);

  screen.rerender(<ChatListModeHeader {...props} phase="exiting" />);
  screen.rerender(<ChatListModeHeader {...props} phase="exiting" />);
  expect(height()).toBe(0);
  expect(onExited).toHaveBeenCalledTimes(1);
});
