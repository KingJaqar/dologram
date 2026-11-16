import { act, renderHook } from '@testing-library/react-native';
import { useMessageSearch } from '../useMessageSearch';
import { notifyCacheChange } from '../../sync/cacheEvents';
import { notifyQueueChange } from '../../queue/events';
import { updateChatPreferences } from '../../chats/preferences';
import type { SearchIdentity } from '../query';

const scope = { userId: 'me', allowedChatIds: ['chat'], chatId: 'chat' };
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
async function advance(ms = 150) { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); }
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('not initialized'); };
  let reject: (error: Error) => void = () => { throw new Error('not initialized'); };
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('rapid queries/account/chat changes suppress late results; clearing cancels immediately', async () => {
  const old = deferred<string>();
  const load = jest.fn<Promise<string>, [SearchIdentity, AbortSignal]>().mockReturnValueOnce(old.promise).mockResolvedValue('new');
  const hook = renderHook(({ query, userId, chatId }: { query: string; userId: string; chatId: string }) => useMessageSearch({ userId, chatId, allowedChatIds: [chatId] }, query, true, load),
    { initialProps: { query: 'old', userId: 'me', chatId: 'chat' } });
  await advance();
  const oldSignal = load.mock.calls[0][1];
  hook.rerender({ query: 'new', userId: 'other', chatId: 'other-chat' });
  expect(oldSignal.aborted).toBe(true);
  expect(hook.result.current.data).toBeNull();
  await advance(); expect(hook.result.current.data).toBe('new');
  await act(async () => old.resolve('stale')); expect(hook.result.current.data).toBe('new');
  hook.rerender({ query: '', userId: 'other', chatId: 'other-chat' });
  expect(hook.result.current).toMatchObject({ loading: false, data: null, error: null });
  hook.unmount(); await advance(0); expect(jest.getTimerCount()).toBe(0);
});

test('starts the debounced scan at 150ms and resolves the controlled fixture within 300ms', async () => {
  const startedAt = Date.now();
  const load = jest.fn<Promise<string>, [SearchIdentity, AbortSignal]>(
    () => new Promise((resolve) => { setTimeout(() => resolve('fresh'), 10); }),
  );
  const hook = renderHook(() => useMessageSearch(scope, 'needle', true, load));

  await advance(149);
  expect(load).not.toHaveBeenCalled();
  expect(hook.result.current.loading).toBe(true);

  await advance(1);
  expect(load).toHaveBeenCalledTimes(1);
  expect(hook.result.current.loading).toBe(true);

  await advance(10);
  expect(hook.result.current).toMatchObject({ data: 'fresh', loading: false, error: null });
  expect(Date.now() - startedAt).toBeLessThanOrEqual(300);
  hook.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('waits for a late native settlement before starting the next scan', async () => {
  const first = deferred<string>();
  let activeReads = 0;
  let maxActiveReads = 0;
  let calls = 0;
  const load = jest.fn(async () => {
    calls += 1;
    activeReads += 1;
    maxActiveReads = Math.max(maxActiveReads, activeReads);
    if (calls === 1) {
      return first.promise.finally(() => { activeReads -= 1; });
    }
    activeReads -= 1;
    return 'fresh';
  });
  const hook = renderHook(({ query }: { query: string }) => useMessageSearch(scope, query, true, load),
    { initialProps: { query: 'old' } });

  await advance();
  hook.rerender({ query: 'new' });
  await advance();
  expect(load).toHaveBeenCalledTimes(1);
  expect(maxActiveReads).toBe(1);

  await act(async () => {
    first.resolve('stale');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(maxActiveReads).toBe(1);
  expect(hook.result.current).toMatchObject({ data: 'fresh', error: null, loading: false });
  hook.unmount();
});

test('coalesces synchronous invalidations into one refresh generation', async () => {
  const load = jest.fn(async () => 'value');
  const hook = renderHook(() => useMessageSearch(scope, 'needle', true, load));
  await advance();
  const epoch = hook.result.current.epoch;
  act(() => {
    notifyCacheChange();
    notifyCacheChange();
    notifyQueueChange();
  });
  expect(hook.result.current.epoch).toBe(epoch + 1);
  await advance();
  expect(load).toHaveBeenCalledTimes(2);
  hook.unmount();
});

test('cache/queue/preference bursts invalidate immediately, coalesce, refresh on focus and unsubscribe', async () => {
  const load = jest.fn(async () => 'value');
  const hook = renderHook(({ active }: { active: boolean }) => useMessageSearch(scope, 'needle', active, load), { initialProps: { active: true } });
  await advance(); expect(load).toHaveBeenCalledTimes(1);
  const freshEpoch = hook.result.current.epoch;
  act(() => { notifyCacheChange(); notifyCacheChange(); notifyQueueChange(); });
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.epoch).toBeGreaterThan(freshEpoch);
  await advance(); expect(load).toHaveBeenCalledTimes(2);
  await act(async () => { await updateChatPreferences('me', 'chat', { blocked: true }); });
  expect(hook.result.current.data).toBeNull();
  await advance(); expect(load).toHaveBeenCalledTimes(3);
  const sealedEpoch = hook.result.current.epoch;
  hook.rerender({ active: false });
  act(() => { notifyCacheChange(); notifyQueueChange(); });
  await advance(); expect(load).toHaveBeenCalledTimes(3);
  // A covered card keeps its completed result so returning focus does not blank the screen.
  expect(hook.result.current).toMatchObject({ data: 'value', epoch: sealedEpoch });
  hook.rerender({ active: true });
  expect(hook.result.current).toMatchObject({ data: 'value', loading: false, error: null });
  await advance(); expect(load).toHaveBeenCalledTimes(4);
  hook.unmount(); act(() => { notifyCacheChange(); notifyQueueChange(); });
  expect(jest.getTimerCount()).toBe(0);
});

test('deadline is explicit, late rejection is consumed and only explicit retry starts another read', async () => {
  const pending = deferred<string>();
  const load = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue('recovered');
  const hook = renderHook(() => useMessageSearch(scope, 'needle', true, load));
  await advance(); await advance(15000);
  expect(hook.result.current).toMatchObject({ data: null, loading: false, error: 'timeout' });
  expect(load.mock.calls[0][1].aborted).toBe(true);
  await act(async () => pending.reject(new Error('late')));
  await advance(15000); expect(load).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.retry()); await advance();
  expect(hook.result.current).toMatchObject({ data: 'recovered', error: null, loading: false });
  hook.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('read failures do not look like successful empty results; permission loss hides old data', async () => {
  const load = jest.fn().mockResolvedValueOnce(['match']).mockRejectedValueOnce(new Error('read failed'));
  const hook = renderHook(({ allowedChatIds }: { allowedChatIds: string[] }) => useMessageSearch({ ...scope, allowedChatIds }, 'needle', true, load),
    { initialProps: { allowedChatIds: ['chat'] } });
  await advance(); expect(hook.result.current.data).toEqual(['match']);
  hook.rerender({ allowedChatIds: [] }); expect(hook.result.current.data).toBeNull();
  await advance(); expect(hook.result.current).toMatchObject({ data: null, error: 'read', loading: false });
  hook.unmount();
});
