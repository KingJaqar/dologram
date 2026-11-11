import { AppState } from 'react-native';
import { config, createQueueRunner, type QueueCore, type QueueRunner } from '@dologram/shared';
import { subscribeNetState } from '../../net/netState';
import { getQueueCore } from '../localQueue';
import { startQueueWorker, stopQueueWorker } from '../worker';

jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  AppState: { value: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) } },
}));
jest.mock('@dologram/shared', () => ({ config: { queue: { timerMs: 15000 } }, createQueueRunner: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../net/netState', () => ({ subscribeNetState: jest.fn(() => jest.fn()) }));
jest.mock('../localQueue', () => ({ getQueueCore: jest.fn(), setActiveRunner: jest.fn(), cleanupSentQueueItems: jest.fn() }));
jest.mock('../mediaUploader', () => ({ uploadMobileAttachment: jest.fn() }));
jest.mock('../../net/lowSignal', () => ({ attachmentDeliveryPolicy: jest.fn() }));

const failure = new Error('NativeDatabase.prepareAsync: java.lang.NullPointerException');
let runner: QueueRunner;
let report: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  report = jest.spyOn(console, 'error').mockImplementation(() => {});
  runner = { drain: jest.fn().mockRejectedValue(failure), handleConnectivity: jest.fn().mockRejectedValue(failure) };
  jest.mocked(createQueueRunner).mockReturnValue(runner);
  jest.mocked(getQueueCore).mockResolvedValue({} as QueueCore);
});

afterEach(() => {
  stopQueueWorker();
  jest.useRealTimers();
  report.mockRestore();
});

async function startConnected() {
  startQueueWorker();
  const notifyNet = jest.mocked(subscribeNetState).mock.calls[0]![0];
  notifyNet({ isConnected: true, type: 'wifi', cellularGeneration: null });
  await jest.advanceTimersByTimeAsync(0);
  report.mockClear();
  return notifyNet;
}

test('timer database failures are handled and later ticks can retry', async () => {
  await startConnected();
  await jest.advanceTimersByTimeAsync(config.queue.timerMs * 2);
  expect(runner.drain).toHaveBeenCalledTimes(3);
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenLastCalledWith('DoloGram queue: background drain failed.', failure);
});

test('reconnect database failures are handled', async () => {
  const notifyNet = await startConnected();
  notifyNet({ isConnected: false, type: 'none', cellularGeneration: null });
  notifyNet({ isConnected: true, type: 'wifi', cellularGeneration: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(runner.handleConnectivity).toHaveBeenCalledWith(true);
  expect(report).toHaveBeenCalledWith('DoloGram queue: background drain failed.', failure);
});

test('foreground database failures are handled and stopping removes the timer', async () => {
  await startConnected();
  const onAppState = jest.mocked(AppState.addEventListener).mock.calls[0]![1];
  onAppState('background');
  onAppState('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(report).toHaveBeenCalledWith('DoloGram queue: background drain failed.', failure);
  stopQueueWorker();
  jest.mocked(runner.drain).mockClear();
  await jest.advanceTimersByTimeAsync(config.queue.timerMs);
  expect(runner.drain).not.toHaveBeenCalled();
});
