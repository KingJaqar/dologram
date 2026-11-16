import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getMessageReadParticipants, strings } from '@dologram/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { SeenBySheet } from '../SeenBySheet';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('@dologram/shared', () => {
  const actual = jest.requireActual('@dologram/shared');
  return { ...actual, getMessageReadParticipants: jest.fn() };
});
jest.mock('../Avatar', () => ({ Avatar: () => null }));
jest.mock('../BottomSheet', () => ({ BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));

const request = jest.mocked(getMessageReadParticipants);
const baseProps = {
  visible: true,
  accountId: 'account-a',
  chatId: 'chat-a',
  messageId: 'message-a',
  direct: false,
  onClose: jest.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

test('uses delayed loading feedback and renders stable disclosed/hidden participant order', async () => {
  const pending = deferred<Awaited<ReturnType<typeof getMessageReadParticipants>>>();
  request.mockReturnValueOnce(pending.promise);
  const screen = render(<ThemeProvider><SeenBySheet {...baseProps} /></ThemeProvider>);
  expect(screen.getByLabelText(strings.seenBy.loading)).toBeTruthy();
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  await act(async () => pending.resolve({ data: {
    state: 'available', expires_at: '2099-01-01T00:00:00Z', participants: [
      { user_id: 'z', display_name: 'Hidden Z', avatar_url: null, read_at: null },
      { user_id: 'b', display_name: 'Later', avatar_url: null, read_at: '2026-11-14T02:00:00Z' },
      { user_id: 'a', display_name: 'Earlier', avatar_url: null, read_at: '2026-11-14T01:00:00Z' },
      { user_id: 'y', display_name: 'Hidden Y', avatar_url: null, read_at: null },
    ],
  }, error: null }));
  const labels = screen.getAllByLabelText(/^(Earlier|Later|Hidden)/).map((node) => node.props.accessibilityLabel as string);
  expect(labels.map((label) => label.split('.')[0])).toEqual(['Earlier', 'Later', 'Hidden Y', 'Hidden Z']);
  expect(screen.getAllByText(strings.seenBy.timeHidden)).toHaveLength(2);
});

test('shows transport failure with Retry and keeps it distinct from an empty roster', async () => {
  request
    .mockResolvedValueOnce({ data: null, error: { kind: 'network' } })
    .mockResolvedValueOnce({ data: { state: 'available', participants: [], expires_at: '2099-01-01T00:00:00Z' }, error: null });
  const screen = render(<ThemeProvider><SeenBySheet {...baseProps} /></ThemeProvider>);
  expect(await screen.findByText(strings.seenBy.loadFailed)).toBeTruthy();
  fireEvent.press(screen.getByLabelText(strings.common.retry));
  expect(await screen.findByText(strings.seenBy.empty)).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(2);
});

test.each([
  ['expired', strings.seenBy.expired],
  ['not_available_for_large_group', strings.seenBy.largeGroup],
  ['not_recorded', strings.seenBy.notRecorded],
  ['hidden', strings.seenBy.hidden],
  ['not_found', strings.seenBy.notFound],
] as const)('renders the %s result state', async (state, copy) => {
  request.mockResolvedValue({ data: { state }, error: null });
  const screen = render(<ThemeProvider><SeenBySheet {...baseProps} /></ThemeProvider>);
  expect(await screen.findByText(copy)).toBeTruthy();
});

test('expires an available result while the panel remains open', async () => {
  request.mockResolvedValue({ data: {
    state: 'available', participants: [], expires_at: '2000-01-01T00:00:00Z',
  }, error: null });
  const screen = render(<ThemeProvider><SeenBySheet {...baseProps} /></ThemeProvider>);
  expect(await screen.findByText(strings.seenBy.expired)).toBeTruthy();
});

test('discards a delayed response after the account/message key changes', async () => {
  const oldRequest = deferred<Awaited<ReturnType<typeof getMessageReadParticipants>>>();
  request.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce({
    data: { state: 'hidden' }, error: null,
  });
  const screen = render(<ThemeProvider><SeenBySheet {...baseProps} /></ThemeProvider>);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  screen.rerender(<ThemeProvider><SeenBySheet {...baseProps} accountId="account-b" messageId="message-b" /></ThemeProvider>);
  expect(await screen.findByText(strings.seenBy.hidden)).toBeTruthy();
  await act(async () => oldRequest.resolve({ data: { state: 'expired' }, error: null }));
  await waitFor(() => expect(screen.queryByText(strings.seenBy.expired)).toBeNull());
});
