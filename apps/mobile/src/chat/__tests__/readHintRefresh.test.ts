import { createReadHintRefresh } from '../readHintRefresh';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
});

afterEach(() => jest.useRealTimers());

test('coalesces a burst and keeps at most one queued follow-up while a request runs', async () => {
  let finish!: () => void;
  const starts: number[] = [];
  const firstRequest = new Promise<void>((resolve) => { finish = resolve; });
  const refresh = jest.fn(() => {
    starts.push(Date.now());
    return firstRequest;
  });
  const coordinator = createReadHintRefresh(refresh);

  coordinator.invalidate();
  coordinator.invalidate();
  await jest.advanceTimersByTimeAsync(100);
  expect(refresh).toHaveBeenCalledTimes(1);

  coordinator.invalidate();
  coordinator.invalidate();
  finish();
  await firstRequest;
  await Promise.resolve();
  await Promise.resolve();
  expect(jest.getTimerCount()).toBe(1);
  await jest.runOnlyPendingTimersAsync();
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(starts).toEqual([100, 350]);
});

test('stop cancels a scheduled refresh and prevents a completed request from following up', async () => {
  let finish!: () => void;
  const refresh = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const scheduled = createReadHintRefresh(refresh);
  scheduled.invalidate();
  scheduled.stop();
  await jest.runAllTimersAsync();
  expect(refresh).not.toHaveBeenCalled();

  const running = createReadHintRefresh(refresh);
  running.invalidate();
  await jest.advanceTimersByTimeAsync(100);
  running.invalidate();
  running.stop();
  finish();
  await Promise.resolve();
  await jest.runAllTimersAsync();
  expect(refresh).toHaveBeenCalledTimes(1);
});
