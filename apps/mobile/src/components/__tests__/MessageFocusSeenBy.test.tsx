import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { strings } from '@dologram/shared';
import type { ChatMessageItem } from '../../chat/query';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { MessageFocusOverlay } from '../MessageFocusOverlay';

jest.mock('../Icon', () => ({ Icon: () => null }));
jest.mock('../Toast', () => ({ ToastModalHost: () => null }));

const item: ChatMessageItem = {
  messageId: 'message-a', chatId: 'chat-a', senderId: 'account-a', senderName: 'Me',
  content: 'Hello', replyTo: null, attachmentCount: 0, attachments: [],
  createdAt: '2026-11-14T00:00:00Z', editedAt: null, deletedAt: null, seq: 1,
  reactions: [], pending: null,
};

const callbacks = {
  onClose: jest.fn(), onReact: jest.fn(), onReply: jest.fn(), onForward: jest.fn(),
  onCopy: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(), onRetry: jest.fn(), onDiscard: jest.fn(),
};

test('exposes the labeled Seen by action only when the eligible caller supplies it', () => {
  const onSeenBy = jest.fn();
  const screen = render(<ThemeProvider><MessageFocusOverlay visible item={item} own userId="account-a"
    online discardDisabled={false} {...callbacks} onSeenBy={onSeenBy} /></ThemeProvider>);
  fireEvent.press(screen.getByLabelText(strings.chat.more));
  fireEvent.press(screen.getByLabelText(strings.seenBy.action));
  expect(onSeenBy).toHaveBeenCalledTimes(1);

  screen.rerender(<ThemeProvider><MessageFocusOverlay visible item={item} own userId="account-a"
    online discardDisabled={false} {...callbacks} /></ThemeProvider>);
  fireEvent.press(screen.getByLabelText(strings.chat.more));
  expect(screen.queryByLabelText(strings.seenBy.action)).toBeNull();
});
