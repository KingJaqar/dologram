/**
 * CMP-09 chat row tests (AND-03, AND-04, D-92, D-95).
 *
 * The row renders the item the shared builder produced: name, preview, time, unread badge, mute
 * icon, Seen status, Saved Messages avatar, and one accessibility label for the whole row.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { ChatListItem } from '@dologram/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ArchivedRow, ChatRow } from '../ChatRow';

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
