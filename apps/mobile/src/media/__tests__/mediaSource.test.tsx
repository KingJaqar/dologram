import { act, renderHook, waitFor } from '@testing-library/react-native';
import { config, createMediaSignedUrl } from '@dologram/shared';
import { useMediaSource } from '../useMediaSource';
import { AppState } from 'react-native';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('@dologram/shared', () => ({ ...jest.requireActual('@dologram/shared'), createMediaSignedUrl: jest.fn() }));
const sign = jest.mocked(createMediaSignedUrl);
beforeEach(() => { AppState.currentState = 'active'; jest.useRealTimers(); sign.mockReset(); sign.mockResolvedValue({ data: 'https://example.test/signed', error: null }); });
afterEach(() => jest.useRealTimers());

test('local previews require no signing', async () => {
  const { result } = renderHook(() => useMediaSource({ mediaId: 'local', mediaType: 'photo', localUri: 'file:///private.jpg' }));
  await waitFor(() => expect(result.current.uri).toBe('file:///private.jpg'));
  expect(sign).not.toHaveBeenCalled();
});
test('signing failure stops until explicit retry', async () => {
  sign.mockResolvedValueOnce({ data: null, error: { kind: 'server', code: 'DENIED', status: 403 } });
  const { result } = renderHook(() => useMediaSource({ mediaId: 'remote', mediaType: 'photo', storagePath: 'chat/media' }));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(sign).toHaveBeenCalledTimes(1);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.uri).toBe('https://example.test/signed'));
  expect(sign).toHaveBeenCalledTimes(2);
});
test('expiry renews once and unmount removes the timer', async () => {
  jest.useFakeTimers();
  const { unmount } = renderHook(() => useMediaSource({ mediaId: 'remote', mediaType: 'photo', storagePath: 'chat/media' }));
  await act(async () => { await Promise.resolve(); });
  expect(sign).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(config.media.signedUrlSeconds * 1000); });
  expect(sign).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { jest.advanceTimersByTime(config.media.signedUrlSeconds * 2000); });
  expect(sign).toHaveBeenCalledTimes(2);
});
test('load errors do not start a refresh loop', async () => {
  const { result } = renderHook(() => useMediaSource({ mediaId: 'remote', mediaType: 'photo', storagePath: 'chat/media' }));
  await waitFor(() => expect(result.current.uri).toBeTruthy());
  act(() => result.current.fail());
  expect(result.current.error).toBeTruthy();
  expect(sign).toHaveBeenCalledTimes(1);
});
