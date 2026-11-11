import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { strings, removeMember, updateOwnMember, type ChatListItem } from '@dologram/shared';
import { actionToast, type ToastAction } from '../../notifications/toastCopy';
import { ChatOrganizationActions } from '../ChatOrganizationActions';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { setChatListPreference } from '../preferences';
import { deleteChatFromDevice } from '../deleteChat';
import { cacheMembers } from '../../chat/readState';
import { deleteCachedChat } from '../../sync/localCache';
import type { FolderState } from '../../folders/useFolders';

const mockPush = jest.fn();
const mockToast = jest.fn();
const mockSetChats = jest.fn().mockResolvedValue(null);
let mockOnline = true;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: mockOnline }) }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../chat/readState', () => ({ cacheMembers: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../sync/localCache', () => ({ deleteCachedChat: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../preferences', () => ({ setChatListPreference: jest.fn().mockResolvedValue({}) }));
jest.mock('../deleteChat', () => ({ deleteChatFromDevice: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }), ToastModalHost: () => null }));
jest.mock('../../folders/useFolders', () => ({ useFolders: () => ({
  folders: [{ folder_id: 'work', name: 'Work', chatIds: [] }], setChats: mockSetChats,
}) }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/BottomSheet', () => ({ BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));
jest.mock('@dologram/shared', () => ({
  ...jest.requireActual('@dologram/shared'),
  updateOwnMember: jest.fn(), removeMember: jest.fn(),
}));

const item: ChatListItem = {
  chatId: 'chat', title: 'Chat', preview: '', timeLabel: '', sortMs: 0,
  unreadCount: 0, muted: false, archived: false, isGroup: false, pinned: false,
  savedMessages: false, avatarId: 'user', avatarName: 'User', ownStatus: null, accessibilityLabel: 'Chat',
};

function setup(patch: Partial<ChatListItem> = {}, ignored = false) {
  const onClose = jest.fn();
  const folders = { folders: [{ folder_id: 'work', name: 'Work', chatIds: [] }], setChats: mockSetChats } as unknown as FolderState;
  const screen = render(<ThemeProvider><ChatOrganizationActions item={{ ...item, ...patch }} folders={folders} ignored={ignored} onClose={onClose} /></ThemeProvider>);
  return { screen, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  jest.mocked(updateOwnMember).mockResolvedValue({ data: { chat_id: 'chat' } as never, error: null });
  jest.mocked(removeMember).mockResolvedValue({ data: true, error: null });
});

test.each([
  ['Add to starred', {}, false, 'pinned', true],
  ['Remove from starred', { pinned: true }, false, 'pinned', false],
  ['Ignore', {}, false, 'ignored', true],
  ['Stop ignoring', {}, true, 'ignored', false],
  ['Mark as unread', { savedMessages: true }, false, 'unread', true],
] as const)('%s persists and closes', async (label, patch, ignored, key, enabled) => {
  mockOnline = false;
  const { screen, onClose } = setup(patch, ignored);
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(setChatListPreference).toHaveBeenCalledWith('me', 'chat', key, enabled);
});

test.each([
  ['Archive', {}, { archived: true }],
  ['Unarchive', { archived: true }, { archived: false }],
  ['Unmute', { muted: true }, { muted_until: null }],
] as const)('%s updates the server and cache', async (label, patch, expected) => {
  const { screen, onClose } = setup(patch);
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(updateOwnMember).toHaveBeenCalledWith({}, 'chat', 'me', expected);
  expect(cacheMembers).toHaveBeenCalled();
});

test.each(['1 hour', '8 hours', '1 week', 'Until I unmute'])('mute option %s persists', async (label) => {
  const { screen, onClose } = setup();
  fireEvent.press(screen.getByLabelText('Mute'));
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(updateOwnMember).toHaveBeenCalledWith({}, 'chat', 'me', { muted_until: label === 'Until I unmute' ? 'infinity' : expect.any(String) });
});

test('Add members opens the member picker directly and chat head is absent', () => {
  const { screen } = setup({ isGroup: true, canAddMembers: true });
  expect(screen.queryByLabelText('Open chat head')).toBeNull();
  fireEvent.press(screen.getByLabelText('Add members'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/chat/[chatId]/info', params: { chatId: 'chat', action: 'add-members' } });
});

test('folder changes stay open so more folders can be selected', async () => {
  const { screen, onClose } = setup();
  fireEvent.press(screen.getByLabelText('Add to folder'));
  fireEvent.press(screen.getByLabelText('Work'));
  await waitFor(() => expect(mockSetChats).toHaveBeenCalledWith('work', ['chat']));
  expect(onClose).not.toHaveBeenCalled();
});

test('delete requires confirmation and does not ignore or leave the chat', async () => {
  const { screen, onClose } = setup();
  fireEvent.press(screen.getByLabelText('Delete'));
  expect(deleteChatFromDevice).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(deleteChatFromDevice).toHaveBeenCalledWith('me', 'chat');
  expect(setChatListPreference).not.toHaveBeenCalled();
  expect(removeMember).not.toHaveBeenCalled();
});

test('leaving a group removes membership only after confirmation', async () => {
  const { screen, onClose } = setup({ isGroup: true });
  fireEvent.press(screen.getByLabelText('Leave group'));
  expect(removeMember).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Leave'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(removeMember).toHaveBeenCalledWith({}, 'chat', 'me');
  expect(deleteCachedChat).toHaveBeenCalledWith({}, 'chat');
});

test('server failure is visible and does not close or remove cached data', async () => {
  jest.mocked(updateOwnMember).mockResolvedValueOnce({ data: null, error: { kind: 'network' } });
  const { screen, onClose } = setup();
  fireEvent.press(screen.getByLabelText('Archive'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: strings.toasts.actions.archiveChat.error, variant: 'error', placement: 'bottom' }));
  expect(onClose).not.toHaveBeenCalled();
  expect(cacheMembers).not.toHaveBeenCalled();
});

test('offline server actions cannot run', () => {
  mockOnline = false;
  const { screen } = setup({ isGroup: true, canAddMembers: true });
  for (const label of ['Archive', 'Mute', 'Add members', 'Leave group', 'Add to folder']) fireEvent.press(screen.getByLabelText(label));
  expect(updateOwnMember).not.toHaveBeenCalled();
  expect(removeMember).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

const localCases: [string, Partial<ChatListItem>, boolean, ToastAction][] = [
  ['Add to starred', {}, false, 'starChat'], ['Remove from starred', { pinned: true }, false, 'unstarChat'],
  ['Ignore', {}, false, 'ignoreChat'], ['Mark as unread', {}, false, 'markUnread'],
];
test.each(localCases)('%s emits one success, then one safe error when a subsequent write fails', async (label, patch, ignored, action) => {
  const { screen, onClose } = setup(patch, ignored);
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast(action, 'success')));
  expect(mockToast).toHaveBeenCalledTimes(1);
  onClose.mockClear();
  mockToast.mockClear();
  jest.mocked(setChatListPreference).mockRejectedValueOnce(new Error('private'));
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast(action, 'error')));
  expect(onClose).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledTimes(1);
});

test.each([
  ['Archive', {}, 'archiveChat'], ['Unarchive', { archived: true }, 'unarchiveChat'], ['Unmute', { muted: true }, 'unmuteChat'],
] as const)('%s emits correct success and failure', async (label, patch, action) => {
  const { screen } = setup(patch);
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast(action, 'success')));
  jest.mocked(updateOwnMember).mockRejectedValueOnce(new Error('private'));
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast(action, 'error')));
  expect(mockToast).toHaveBeenCalledTimes(2);
});

test('mute includes selected duration and handles failure', async () => {
  const { screen } = setup();
  fireEvent.press(screen.getByLabelText('Mute'));
  fireEvent.press(screen.getByLabelText('8 hours'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast('muteChat', 'success', { mute: 'eightHours' })));
  jest.mocked(updateOwnMember).mockRejectedValueOnce(new Error('private'));
  fireEvent.press(screen.getByLabelText('Back'));
  fireEvent.press(screen.getByLabelText('Mute'));
  fireEvent.press(screen.getByLabelText('8 hours'));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('muteChat', 'error')));
});

test('folder writes include destination and retain state on rejection', async () => {
  const { screen } = setup();
  fireEvent.press(screen.getByLabelText('Add to folder'));
  fireEvent.press(screen.getByLabelText('Work'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast('addToFolder', 'success', { folder: 'Work' })));
  mockSetChats.mockResolvedValueOnce({ kind: 'network' });
  fireEvent.press(screen.getByLabelText('Work'));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('addToFolder', 'error')));
});

test('delete failure keeps the confirmation available', async () => {
  jest.mocked(deleteChatFromDevice).mockRejectedValueOnce(new Error('private'));
  const { screen, onClose } = setup();
  fireEvent.press(screen.getByLabelText('Delete'));
  fireEvent.press(screen.getByLabelText('Delete'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast('deleteChat', 'error')));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Delete'));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('deleteChat', 'success')));
});
