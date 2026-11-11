import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { ChatListItem } from '@dologram/shared';
import { ChatOrganizationSheet } from '../ChatOrganizationSheet';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('../Icon', () => ({ Icon: () => null }));
jest.mock('../BottomSheet', () => ({ BottomSheet: ({ children }: { children: React.ReactNode }) => children }));

const item: ChatListItem = {
  chatId: 'chat', title: 'Chat', preview: '', timeLabel: '', sortMs: 0,
  unreadCount: 0, muted: false, archived: false, isGroup: false, pinned: false,
  savedMessages: false, avatarId: 'user', avatarName: 'User', ownStatus: null,
  accessibilityLabel: 'Chat',
};

function setup(offline = false) {
  const callbacks = {
    onClose: jest.fn(), onArchive: jest.fn(), onUnarchive: jest.fn(), onMute: jest.fn(),
    onUnmute: jest.fn(), onToggleFolder: jest.fn(),
  };
  const screen = render(<ThemeProvider><ChatOrganizationSheet visible item={item}
    folders={[{ folderId: 'folder', name: 'Work', containsChat: true }]}
    offline={offline} busy={false} {...callbacks} /></ThemeProvider>);
  return { screen, ...callbacks };
}

test('existing screens can use organization actions without supplying newer callbacks', () => {
  const { screen, onArchive } = setup();
  expect(screen.queryByLabelText('Pin')).toBeNull();
  expect(screen.queryByLabelText('Delete')).toBeNull();
  fireEvent.press(screen.getByLabelText('Archive'));
  expect(onArchive).toHaveBeenCalledTimes(1);
});

test('mute and folder callbacks remain connected', () => {
  const { screen, onMute, onToggleFolder } = setup();
  fireEvent.press(screen.getByLabelText('Mute'));
  fireEvent.press(screen.getByLabelText('1 hour'));
  expect(onMute).toHaveBeenCalledWith('oneHour');
  fireEvent.press(screen.getByLabelText('Back'));
  fireEvent.press(screen.getByLabelText('Add to folder'));
  fireEvent.press(screen.getByLabelText('Work'));
  expect(onToggleFolder).toHaveBeenCalledWith('folder', true);
});

test('network actions stay disabled offline', () => {
  const { screen, onArchive } = setup(true);
  fireEvent.press(screen.getByLabelText('Archive'));
  expect(onArchive).not.toHaveBeenCalled();
});
