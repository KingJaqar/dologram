import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { insertMember, removeMember, strings, updateOwnMember } from '@dologram/shared';
import NicknamesScreen from '../../../app/chat/[chatId]/nicknames';
import CustomiseScreen from '../../../app/chat/[chatId]/customise';
import ChatNotificationsScreen from '../../../app/chat/[chatId]/notifications';
import ChatInfoScreen from '../../../app/chat/[chatId]/info';
import ChatProfileScreen from '../../../app/chat/[chatId]/profile';
import NewGroupScreen from '../../../app/new-group';
import { DEFAULT_CHAT_PREFERENCES, loadChatPreferences, updateChatPreferences } from '../../chats/preferences';
import { createGroupChat } from '../../chats/group';
import { actionToast } from '../toastCopy';

const mockToast = jest.fn();
let mockInfoLoading = false;
const mockReload = jest.fn().mockResolvedValue(undefined);
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true };
const mockMember = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn() };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ chatId: 'chat' }), useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => { const tokens = jest.requireActual('@dologram/shared'); return { ...tokens, colors: tokens.color.light, duration: () => 0, reduceMotion: true }; } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: true }) }));
jest.mock('../../lib/supabase', () => ({ supabase: { from: () => mockMember } }));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/Avatar', () => ({ Avatar: () => null }));
jest.mock('../../components/BottomSheet', () => ({ BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));
jest.mock('../../chats/preferences', () => ({ ...jest.requireActual('../../chats/preferences'), loadChatPreferences: jest.fn(), updateChatPreferences: jest.fn() }));
jest.mock('../../chats/group', () => ({ createGroupChat: jest.fn() }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('../../chatList/deleteChat', () => ({ deleteChatFromDevice: jest.fn() }));
jest.mock('../../sync/lifecycle', () => ({ resyncNow: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../chats/useContacts', () => ({ useContacts: () => ({ loading: false, contacts: [{ userId: 'alice', displayName: 'Alice' }, { userId: 'bob', displayName: 'Bob' }] }) }));
jest.mock('../../chats/useChatInfo', () => ({ useChatInfo: () => ({ loading: mockInfoLoading, error: null, reload: mockReload, applyMember: jest.fn(), info: mockInfoLoading ? null : {
  chatId: 'chat', title: 'Group', subtitle: '', isGroup: true, savedMessages: false,
  canAddMembers: true, canManageMembers: true, canLeave: false, archived: false, muted: false,
  members: [{ userId: 'other', displayName: 'Other', roleLabel: null, isSelf: false }],
} }) }));
jest.mock('@dologram/shared', () => ({ ...jest.requireActual('@dologram/shared'), insertMember: jest.fn(), removeMember: jest.fn(), updateOwnMember: jest.fn() }));

beforeEach(() => {
  mockInfoLoading = false;
  jest.clearAllMocks();
  jest.mocked(loadChatPreferences).mockResolvedValue(DEFAULT_CHAT_PREFERENCES);
  jest.mocked(updateChatPreferences).mockImplementation(async (_user, _chat, patch) => ({ ...DEFAULT_CHAT_PREFERENCES, ...patch }));
  jest.mocked(insertMember).mockResolvedValue({ data: {} as never, error: null });
  jest.mocked(removeMember).mockResolvedValue({ data: true, error: null });
  jest.mocked(updateOwnMember).mockResolvedValue({ data: {} as never, error: null });
  mockMember.single.mockResolvedValue({ data: { muted_until: null }, error: null });
  mockReload.mockResolvedValue(undefined);
});

test('chat info and profile never show an unavailable error while the initial read is pending', () => {
  mockInfoLoading = true;
  const info = render(<ChatInfoScreen />);
  expect(info.queryByText(strings.chatInfo.unavailable)).toBeNull();
  info.unmount();
  const profile = render(<ChatProfileScreen />);
  expect(profile.queryByText(strings.chatInfo.unavailable)).toBeNull();
});

test('group profile shows actual members and a group-specific action', () => {
  const screen = render(<ChatProfileScreen />);
  expect(screen.getByText('Group members')).toBeTruthy();
  expect(screen.getByText('Other')).toBeTruthy();
  expect(screen.queryByText('Chat member')).toBeNull();
  expect(screen.getByRole('button', { name: 'Open group chat' })).toBeTruthy();
});

test.each([
  ['', 'Ali', 'setNickname'], ['Old', 'Ali', 'changeNickname'], ['Old', '', 'removeNickname'],
] as const)('%s → %s nickname reports persistence and preserves input on failure', async (original, next, action) => {
  jest.mocked(loadChatPreferences).mockResolvedValue({ ...DEFAULT_CHAT_PREFERENCES, nickname: original });
  const screen = render(<NicknamesScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.changeText(screen.getByLabelText('Nickname'), next);
  jest.mocked(updateChatPreferences).mockRejectedValueOnce(new Error('secret'));
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(actionToast(action, 'error')));
  expect(screen.getByLabelText('Nickname').props.value).toBe(next);
  expect(mockRouter.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast(action, 'success')));
  expect(mockToast).toHaveBeenCalledTimes(2);
});

test('customization reports a failed write without losing the selected theme', async () => {
  const screen = render(<CustomiseScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.press(screen.getByRole('radio', { name: 'Ocean' }));
  jest.mocked(updateChatPreferences).mockRejectedValueOnce(new Error('secret'));
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('customizeChat', 'error')));
  expect(screen.getByRole('radio', { name: 'Ocean' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('customizeChat', 'success')));
});

test.each([true, false])('notifications %s only changes after a confirmed server result', async (enabled) => {
  mockMember.single.mockResolvedValue({ data: { muted_until: enabled ? 'infinity' : null }, error: null });
  const screen = render(<ChatNotificationsScreen />);
  const control = () => screen.getByRole('switch', { name: 'Notifications' });
  await waitFor(() => expect(control()).toBeEnabled());
  jest.mocked(updateOwnMember).mockResolvedValueOnce({ data: null, error: { kind: 'network' } });
  fireEvent.press(control());
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast(enabled ? 'enableNotifications' : 'disableNotifications', 'error')));
  expect(control().props.accessibilityState.checked).toBe(!enabled);
  expect(updateChatPreferences).not.toHaveBeenCalled();
  fireEvent.press(control());
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast(enabled ? 'enableNotifications' : 'disableNotifications', 'success')));
  expect(control().props.accessibilityState.checked).toBe(enabled);
});

test('adding members accurately reports partial success and retries only the failed selection', async () => {
  const screen = render(<ChatInfoScreen />);
  fireEvent.press(screen.getByLabelText(strings.chatInfo.addMembers));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Alice' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Bob' }));
  jest.mocked(insertMember).mockResolvedValueOnce({ data: {} as never, error: null }).mockRejectedValueOnce(new Error('secret'));
  fireEvent.press(screen.getByRole('button', { name: strings.chatInfo.add }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: strings.toasts.membersAdded(1, 1), variant: 'error', placement: 'bottom' }));
  expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
  jest.mocked(insertMember).mockClear();
  // A refresh failure after a successful addition is not a failed addition.
  mockReload.mockRejectedValueOnce(new Error('refresh'));
  fireEvent.press(screen.getByRole('button', { name: strings.chatInfo.add }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith({ message: strings.toasts.membersAdded(1, 0), variant: 'success', placement: 'bottom' }));
  expect(insertMember).toHaveBeenCalledTimes(1);
  expect(insertMember).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ user_id: 'bob' }));
});

test('removing a member retains confirmation after rejection and succeeds on retry', async () => {
  const screen = render(<ChatInfoScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Other remove' }));
  jest.mocked(removeMember).mockResolvedValueOnce({ data: null, error: { kind: 'network' } });
  fireEvent.press(screen.getByRole('button', { name: strings.chatInfo.remove }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('removeMember', 'error')));
  expect(screen.getByRole('button', { name: strings.chatInfo.remove })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: strings.chatInfo.remove }));
  await waitFor(() => expect(mockToast).toHaveBeenLastCalledWith(actionToast('removeMember', 'success')));
});

test.each([0, 1])('group creation reports one accurate result with %s failed members', async (failedMembers) => {
  jest.mocked(createGroupChat).mockResolvedValue({ kind: 'created', chatId: 'new', failedMembers });
  const screen = render(<NewGroupScreen />);
  fireEvent.changeText(screen.getByLabelText(strings.newGroup.titleLabel), 'New group');
  fireEvent.press(screen.getByRole('button', { name: strings.newGroup.create }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
  expect(mockToast).toHaveBeenCalledWith(failedMembers
    ? { message: strings.toasts.groupPartial(failedMembers), variant: 'error', placement: 'bottom' }
    : actionToast('createGroup', 'success'));
});

test('failed group creation retains the title and selection', async () => {
  jest.mocked(createGroupChat).mockRejectedValue(new Error('secret'));
  const screen = render(<NewGroupScreen />);
  fireEvent.changeText(screen.getByLabelText(strings.newGroup.titleLabel), 'New group');
  fireEvent.press(screen.getByRole('checkbox', { name: 'Alice' }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: strings.newGroup.create })); });
  expect(mockToast).toHaveBeenCalledWith(actionToast('createGroup', 'error'));
  expect(screen.getByLabelText(strings.newGroup.titleLabel).props.value).toBe('New group');
  expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeChecked();
});
