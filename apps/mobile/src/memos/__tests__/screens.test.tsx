import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { strings, type MemoStore } from '@dologram/shared';
import MemoTimeline from '../../../app/memo/[memoId]/index';
import MemoDetails from '../../../app/memo/[memoId]/info';
import { NewConversationMenu } from '../NewConversationMenu';
import { setMemoScope } from '../lifecycle';
import { withMemoStore } from '../vault';
import { enrollMemoPin } from '../protection';
import { combineMemoConversations } from '../conversations';
import type { MemoTextCapture } from '../capture';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockNavigation = { addListener: jest.fn((_event: string, _callback: (event: unknown) => void) => () => {}), dispatch: jest.fn() };
const mockToast = jest.fn();
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { bitRate: 128000 } },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: jest.fn(() => ({ isRecording: false, uri: null, addListener: () => ({ remove: () => {} }), prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() })),
  useAudioRecorderState: jest.fn(() => ({ durationMillis: 0 })),
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({ memoId: '10000000-0000-4000-8000-000000000001' }),
  useFocusEffect: (callback: () => void) => { const { useEffect } = jest.requireActual<typeof React>('react'); useEffect(callback, [callback]); },
}));
jest.mock('../vault', () => ({ withMemoStore: jest.fn(), subscribeMemos: jest.fn(() => () => {}), activeMemoScope: () => {
  const { memoScope } = jest.requireActual<typeof import('../lifecycle')>('../lifecycle'); return memoScope();
} }));
jest.mock('../protection', () => ({ enrollMemoPin: jest.fn(), isMemoProtected: jest.fn(async () => false), isMemoUnlocked: jest.fn(() => true) }));
jest.mock('../MemoProvider', () => ({ useMemoAccess: () => { const { memoScope } = jest.requireActual<typeof import('../lifecycle')>('../lifecycle'); return { scope: memoScope(), error: null }; } }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '20000000-0000-4000-8000-000000000001') }));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedOut', session: null }) }));
jest.mock('../../components/MessageText', () => ({ MessageText: ({ content }: { content: string }) => { const { Text } = jest.requireActual('react-native'); return <Text>{content}</Text>; } }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/VoiceRecordButton', () => ({ VoiceRecordButton: () => null }));
jest.mock('../../components/MediaPickerPanel', () => ({ MediaPickerPanel: () => null }));
jest.mock('../../media/pickers', () => ({ pickAttachments: jest.fn(), draftFromMediaLibraryAsset: jest.fn() }));
jest.mock('../assets', () => ({ formatMemoBytes: jest.fn(), saveMemoAttachment: jest.fn(), withMemoAssetLease: jest.fn() }));
jest.mock('../noteExports', () => ({ exportMemoNote: jest.fn() }));
jest.mock('../sync', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => {
  const { color, typeTokens, radius, space, elevation } = jest.requireActual('@dologram/shared');
  return { colors: color.dark, typeTokens, radius, space, elevation };
} }));
const memo = {
  memo_id: '10000000-0000-4000-8000-000000000001', account_id: '00000000-0000-4000-8000-000000000001',
  title: 'Memo testing', description: '', replication: 'local' as const, residency: 'keep_all' as const,
  revision: 1, created_at: 1, updated_at: 1, pinned: 0, archived: 0, ignored: 0, unread: 0, muted_until: null, preview: '', deleted_at: null, purge_after: null, trash_mode: 'manual' as const,
};
const store = {
  get: jest.fn(async () => memo), create: jest.fn(async () => memo),
  remoteState: jest.fn(async () => ({ status: 'local_only' })),
  timeline: jest.fn(async () => []), draftRecord: jest.fn(async () => ({ text: 'Restored draft', revision: 3 })),
  pending: jest.fn<Promise<MemoTextCapture[]>, []>(async () => []), saveDraft: jest.fn(async () => undefined), saveText: jest.fn(async () => undefined),
  preference: jest.fn(async () => undefined), trash: jest.fn(async () => undefined),
  listTags: jest.fn(async () => []), note: jest.fn(async () => null), noteDraft: jest.fn(async () => null),
  noteRevisions: jest.fn(async () => []), syncConflicts: jest.fn(async () => []), details: jest.fn(async () => undefined),
};
beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.back.mockReset();
  store.saveDraft.mockResolvedValue(undefined);
  store.preference.mockResolvedValue(undefined);
  store.trash.mockResolvedValue(undefined);
  store.get.mockResolvedValue(memo);
  mockRouter.canGoBack.mockReturnValue(true);
  setMemoScope(memo.account_id);
  jest.mocked(withMemoStore).mockImplementation(async (_scope, work) => work(store as unknown as MemoStore));
});
afterEach(() => { setMemoScope(null); });

test('the shared creation menu preserves ordinary chat/group destinations and creates once under repeated taps', async () => {
  const screen = render(<NewConversationMenu />);
  fireEvent.press(screen.getByRole('button', { name: strings.memos.newMemo }));
  fireEvent.press(screen.getByRole('button', { name: 'New Chat' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/search', params: { category: 'username' } });
  fireEvent.press(screen.getByRole('button', { name: strings.memos.newMemo }));
  fireEvent.press(screen.getByRole('button', { name: 'New Group Chat' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith('/new-group');
  fireEvent.press(screen.getByRole('button', { name: strings.memos.newMemo }));
  const action = screen.getAllByRole('button', { name: strings.memos.newMemo })[0];
  fireEvent.press(action); fireEvent.press(action);
  fireEvent.changeText(screen.getByLabelText(strings.memos.name), 'Project notes');
  expect(screen.getByLabelText(strings.memos.pinOptional)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: strings.memos.createMemo }));
  await waitFor(() => expect(store.create).toHaveBeenCalledTimes(1));
  expect(enrollMemoPin).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByLabelText(strings.memos.pinOptional)).toBeNull());
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/memo/[memoId]', params: { memoId: memo.memo_id } });
});
test('memo creation can opt into a six-digit PIN from the creation form', async () => {
  const screen = render(<NewConversationMenu />);
  fireEvent.press(screen.getByRole('button', { name: strings.memos.newMemo }));
  fireEvent.press(screen.getAllByRole('button', { name: strings.memos.newMemo })[0]);
  fireEvent.changeText(screen.getByLabelText(strings.memos.name), 'Private notes');
  fireEvent.changeText(screen.getByLabelText(strings.memos.pinOptional), '123456');
  fireEvent.changeText(screen.getByLabelText(strings.memos.confirmPin), '123456');
  fireEvent.press(screen.getByRole('button', { name: strings.memos.createMemo }));
  await waitFor(() => expect(enrollMemoPin).toHaveBeenCalledWith(memo.account_id, memo.memo_id, '123456', '123456'));
});
test('offline creation exposes memo capture without cloud chat or group actions', () => {
  const screen = render(<NewConversationMenu offline />);
  fireEvent.press(screen.getByRole('button', { name: strings.memos.newMemo }));
  expect(screen.queryByRole('button', { name: 'New Chat' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'New Group Chat' })).toBeNull();
});
test('restores a durable draft, saves with stable retry IDs, and never clears text on a failed save', async () => {
  store.saveText.mockRejectedValueOnce(new Error('Disk failure'));
  const screen = render(<MemoTimeline />);
  await screen.findByText('Memo testing');
  expect(screen.getByDisplayValue('Restored draft')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('Disk failure');
  expect(screen.getByDisplayValue('Restored draft')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(store.saveText).toHaveBeenCalledTimes(2));
  expect(store.saveText.mock.calls[0]).toEqual(store.saveText.mock.calls[1]);
  await waitFor(() => expect(screen.queryByDisplayValue('Restored draft')).toBeNull());
});
test('long drafts remain intact, report the text limit, and cannot enter the publication path', async () => {
  const screen = render(<MemoTimeline />); await screen.findByText('Memo testing');
  const longDraft = '😀'.repeat(4097);
  fireEvent.changeText(screen.getByLabelText('Message'), longDraft);
  await screen.findByText(strings.chat.messageTooLong(4096, 1));
  expect(screen.getByDisplayValue(longDraft)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(store.saveText).not.toHaveBeenCalled();
  await waitFor(() => expect(store.saveDraft).toHaveBeenCalledWith(memo.memo_id, longDraft, 4));
});
test('a restored interrupted draft resumes its original save envelope instead of creating another operation', async () => {
  const job = { operation_id: '20000000-0000-4000-8000-000000000009', item_id: '30000000-0000-4000-8000-000000000009', text: 'Restored draft', created_at: 100 };
  store.pending.mockResolvedValueOnce([job]);
  const screen = render(<MemoTimeline />); await screen.findByText('Memo testing');
  fireEvent.press(screen.getAllByRole('button', { name: strings.memos.retrySave }).slice(-1)[0]);
  await waitFor(() => expect(store.saveText).toHaveBeenCalledWith(memo.memo_id, job.operation_id, job.item_id, job.text, 100));
  expect(store.saveText).toHaveBeenCalledTimes(1);
});
test('back navigation waits for a durable draft and remains on screen when both writes fail', async () => {
  const screen = render(<MemoTimeline />); await screen.findByText('Memo testing');
  store.saveDraft.mockRejectedValue(new Error('Disk full'));
  fireEvent.changeText(screen.getByLabelText('Message'), 'Unsaved thought');
  await screen.findByText('Disk full');
  fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
  await act(async () => {});
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Unsaved thought')).toBeTruthy();
  store.saveDraft.mockResolvedValue(undefined);
});

test('back saves the draft once and permits removal before returning to the previous screen', async () => {
  const screen = render(<MemoTimeline />); await screen.findByText('Memo testing');
  fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  const listener = mockNavigation.addListener.mock.calls.find(([name]) => name === 'beforeRemove')?.[1] as unknown as (event: unknown) => void;
  const preventDefault = jest.fn();
  listener({ preventDefault, data: { action: { type: 'GO_BACK' } } });
  expect(preventDefault).not.toHaveBeenCalled();
  expect(store.saveDraft).toHaveBeenCalledTimes(1);
});

test('back uses the local library when opened without navigation history', async () => {
  mockRouter.canGoBack.mockReturnValueOnce(false);
  setMemoScope(memo.account_id, true);
  const screen = render(<MemoTimeline />); await screen.findByText('Memo testing');
  fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/local-memos'));
});

test.each(['Go back', 'Save'])('memo details %s returns to the original chat so its next back exits to the list', async (action) => {
  const history = ['/local-memos', '/memo/[memoId]'];
  mockRouter.push.mockImplementation((route: { pathname: string }) => history.push(route.pathname));
  mockRouter.replace.mockImplementation((route: { pathname: string }) => { history[history.length - 1] = route.pathname; });
  mockRouter.back.mockImplementation(() => history.pop());
  const chat = render(<MemoTimeline />);
  await chat.findByText('Memo testing');
  fireEvent.press(chat.getByRole('button', { name: strings.memos.details }));
  expect(history).toEqual(['/local-memos', '/memo/[memoId]', '/memo/[memoId]/info']);
  chat.unmount();

  const details = render(<MemoDetails />);
  await details.findByDisplayValue('Memo testing');
  fireEvent.press(details.getByRole('button', { name: action }));
  await waitFor(() => expect(history).toEqual(['/local-memos', '/memo/[memoId]']));
  if (action === 'Save') expect(store.details).toHaveBeenCalledWith(memo.memo_id, memo.title, memo.description, expect.any(Number));
  expect(mockRouter.replace).not.toHaveBeenCalled();
  details.unmount();

  const returnedChat = render(<MemoTimeline />);
  await returnedChat.findByText('Memo testing');
  fireEvent.press(returnedChat.getByRole('button', { name: 'Go back' }));
  await waitFor(() => expect(history).toEqual(['/local-memos']));
});

test.each(['Go back', 'Save'])('directly opened memo details %s falls back to the memo chat', async (action) => {
  mockRouter.canGoBack.mockReturnValue(false);
  const screen = render(<MemoDetails />);
  await screen.findByDisplayValue('Memo testing');
  fireEvent.press(screen.getByRole('button', { name: action }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: '/memo/[memoId]', params: { memoId: memo.memo_id, searchItemId: undefined, searchQuery: undefined },
  }));
  expect(mockRouter.back).not.toHaveBeenCalled();
});
test('ignored memos expose applicable actions and can be unignored directly', async () => {
  store.get.mockResolvedValue({ ...memo, ignored: 1 });
  const screen = render(<MemoTimeline />);
  await screen.findByText(strings.ignoredChat.memoMessage);
  expect(screen.queryByRole('button', { name: strings.ignoredChat.block })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: strings.ignoredChat.unignore }));
  await waitFor(() => expect(store.preference).toHaveBeenCalledWith(memo.memo_id, 'ignored', false));
});
test('sending to an ignored memo automatically unignores it', async () => {
  store.get.mockResolvedValue({ ...memo, ignored: 1 });
  const screen = render(<MemoTimeline />);
  await screen.findByText(strings.ignoredChat.memoMessage);
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(store.saveText).toHaveBeenCalled());
  expect(store.preference).toHaveBeenCalledWith(memo.memo_id, 'ignored', false);
});
test('deleting an ignored memo moves it to trash and exits the timeline', async () => {
  store.get.mockResolvedValue({ ...memo, ignored: 1 });
  const screen = render(<MemoTimeline />);
  await screen.findByText(strings.ignoredChat.memoMessage);
  fireEvent.press(screen.getByRole('button', { name: strings.ignoredChat.delete }));
  fireEvent.press(screen.getAllByRole('button', { name: strings.ignoredChat.delete }).slice(-1)[0]);
  await waitFor(() => expect(store.trash).toHaveBeenCalledWith(memo.memo_id, expect.any(Number)));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(main)/(tabs)');
});
test('archived memos expose unarchive and delete actions', async () => {
  store.get.mockResolvedValue({ ...memo, archived: 1 });
  const screen = render(<MemoTimeline />);
  await screen.findByText(strings.archivedChat.memoMessage);
  expect(screen.queryByRole('button', { name: strings.ignoredChat.block })).toBeNull();
  expect(screen.getByRole('button', { name: strings.ignoredChat.delete })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: strings.organization.unarchive }));
  await waitFor(() => expect(store.preference).toHaveBeenCalledWith(memo.memo_id, 'archived', false));
});
test('sending to an archived memo automatically unarchives it', async () => {
  store.get.mockResolvedValue({ ...memo, archived: 1 });
  const screen = render(<MemoTimeline />);
  await screen.findByText(strings.archivedChat.memoMessage);
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(store.saveText).toHaveBeenCalled());
  expect(store.preference).toHaveBeenCalledWith(memo.memo_id, 'archived', false);
});
test('namespaced list adapters keep memos out of Groups and organize archive/ignored/unread independently', () => {
  const rows = combineMemoConversations([], [memo, { ...memo, memo_id: '10000000-0000-4000-8000-000000000002', archived: 1 }], 'active');
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ chatId: `memo:${memo.memo_id}`, unreadCount: 0, isGroup: false, conversation: { kind: 'memo' } });
  expect(combineMemoConversations([], [{ ...memo, unread: 1 }], 'active')[0].unreadCount).toBe(1);
  expect(combineMemoConversations([], [{ ...memo, ignored: 1 }], 'active')).toEqual([]);
  expect(combineMemoConversations([], [{ ...memo, ignored: 1 }], 'ignored')).toHaveLength(1);
  expect(combineMemoConversations([], [memo], 'active', [])).toEqual([]);
});
