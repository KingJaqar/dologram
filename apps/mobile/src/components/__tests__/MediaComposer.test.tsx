import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatComposer } from '../ChatComposer';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { DraftAttachment } from '../../media/model';
import { strings } from '@dologram/shared';

jest.mock('../VoiceRecordButton', () => ({ VoiceRecordButton: () => null }));
jest.mock('../Icon', () => ({ Icon: () => null }));
const attachment: DraftAttachment = { id: 'photo', name: 'photo.jpg', uri: 'file:///photo.jpg', mediaType: 'photo', mime: 'image/jpeg', sizeBytes: 100 };
function wrapper({ children }: { children: React.ReactNode }) { return <ThemeProvider>{children}</ThemeProvider>; }
test('attachment-only send is enabled and selected items can be removed', () => {
  const send = jest.fn();
  const remove = jest.fn();
  const screen = render(<ChatComposer value="" onChangeText={jest.fn()} onSend={send} attachments={[attachment]} onRemoveAttachment={remove} />, { wrapper });
  fireEvent.press(screen.getByLabelText('Send'));
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Remove photo.jpg'));
  expect(remove).toHaveBeenCalledWith('photo');
  expect(screen.getByText('1 / 10')).toBeTruthy();
});
test('blank draft has no send action and exposes attachment entry points', () => {
  const attach = jest.fn();
  const gallery = jest.fn();
  const screen = render(<ChatComposer value="" onChangeText={jest.fn()} onSend={jest.fn()} onAttach={attach} onGallery={gallery} />, { wrapper });
  expect(screen.queryByLabelText('Send')).toBeNull();
  fireEvent.press(screen.getByLabelText('Attach'));
  fireEvent.press(screen.getByLabelText('Gallery'));
  expect(attach).toHaveBeenCalledTimes(1);
  expect(gallery).toHaveBeenCalledTimes(1);
});
test('editing cannot turn an attachment draft into an empty edit', () => {
  const screen = render(<ChatComposer value="" editing onChangeText={jest.fn()} onSend={jest.fn()} attachments={[attachment]} />, { wrapper });
  expect(screen.queryByLabelText('Send')).toBeNull();
  expect(screen.queryByLabelText('Selected attachments')).toBeNull();
});

test('gallery reflects the open tray and typing returns focus to the message field', () => {
  const onMessageFocus = jest.fn();
  const screen = render(<ChatComposer value="" onChangeText={jest.fn()} onSend={jest.fn()} onGallery={jest.fn()} galleryActive onMessageFocus={onMessageFocus} />, { wrapper });
  expect(screen.getByLabelText('Gallery').props.accessibilityState).toMatchObject({ expanded: true });
  fireEvent(screen.getByLabelText('Message'), 'focus');
  expect(onMessageFocus).toHaveBeenCalledTimes(1);
});

test('counter appears at 3,500 Unicode code points', () => {
  const screen = render(<ChatComposer value={'👍'.repeat(3499)} onChangeText={jest.fn()} onSend={jest.fn()} />, { wrapper });
  expect(screen.queryByText('3499 / 4096')).toBeNull();
  screen.rerender(<ChatComposer value={'👍'.repeat(3500)} onChangeText={jest.fn()} onSend={jest.fn()} />);
  expect(screen.getByText('3500 / 4096')).toBeTruthy();
});

test.each([false, true])('preserves pasted text and blocks oversized drafts (editing=%s)', (editing) => {
  const send = jest.fn();
  const pasted = '👍'.repeat(5000) + '\nKeep the end of this paste';
  function DraftComposer() {
    const [value, setValue] = React.useState('');
    return <ChatComposer value={value} onChangeText={setValue} onSend={send} editing={editing} attachments={[attachment]} />;
  }
  const screen = render(<DraftComposer />, { wrapper });
  fireEvent.changeText(screen.getByLabelText('Message'), pasted);
  expect(screen.getByLabelText('Message').props.value).toBe(pasted);
  expect(screen.getByText(strings.chat.messageTooLong(4096, Array.from(pasted).length - 4096))).toBeTruthy();
  const action = editing ? 'Save' : 'Send';
  expect(screen.getByRole('button', { name: action })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: action }));
  expect(send).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText('Message'), '👍'.repeat(4096));
  expect(screen.getByText('4096 / 4096')).toBeTruthy();
  expect(screen.queryByText(/Message limit is/)).toBeNull();
  expect(screen.getByRole('button', { name: action })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: action }));
  expect(send).toHaveBeenCalledTimes(1);
});

test('one character over the limit explains how to enable sending', () => {
  const screen = render(<ChatComposer value={'a'.repeat(4097)} onChangeText={jest.fn()} onSend={jest.fn()} />, { wrapper });
  expect(screen.getByText('Message limit is 4,096 characters. Remove 1 character to continue.')).toBeTruthy();
  expect(screen.getByLabelText('Send')).toBeDisabled();
});
