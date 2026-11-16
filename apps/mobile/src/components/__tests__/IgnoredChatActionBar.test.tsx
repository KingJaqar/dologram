import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { IgnoredChatActionBar } from '../IgnoredChatActionBar';

test('shows the ignored-chat explanation and invokes all actions', () => {
  const onUnignore = jest.fn();
  const onBlock = jest.fn();
  const onDelete = jest.fn();
  const screen = render(
    <ThemeProvider>
      <IgnoredChatActionBar onUnignore={onUnignore} onBlock={onBlock} onDelete={onDelete} />
    </ThemeProvider>,
  );

  expect(screen.getByText(/without messages being marked as seen/i)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Block' }));
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.press(screen.getByRole('button', { name: 'Unignore' }));

  expect(onBlock).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onUnignore).toHaveBeenCalledTimes(1);
});

test('disables actions while a mutation is running', () => {
  const onUnignore = jest.fn();
  const screen = render(
    <ThemeProvider>
      <IgnoredChatActionBar busy onUnignore={onUnignore} onBlock={jest.fn()} onDelete={jest.fn()} />
    </ThemeProvider>,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Unignore' }));
  expect(onUnignore).not.toHaveBeenCalled();
});

test('supports memo chats without showing a participant-only block action', () => {
  const screen = render(
    <ThemeProvider>
      <IgnoredChatActionBar
        message="Memo ignored"
        onUnignore={jest.fn()}
        onDelete={jest.fn()}
      />
    </ThemeProvider>,
  );

  expect(screen.getByText('Memo ignored')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Block' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Unignore' })).toBeTruthy();
});

test('supports the archived-chat copy and restore label', () => {
  const onUnarchive = jest.fn();
  const screen = render(
    <ThemeProvider>
      <IgnoredChatActionBar
        accessibilityLabel="Archived chat actions"
        message="Chat archived"
        restoreLabel="Unarchive"
        onUnignore={onUnarchive}
        onBlock={jest.fn()}
        onDelete={jest.fn()}
      />
    </ThemeProvider>,
  );

  expect(screen.getByLabelText('Archived chat actions')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Unarchive' }));
  expect(onUnarchive).toHaveBeenCalledTimes(1);
});
