import {
  getLatencySummary,
  getLatencySamples,
  markMessageReceived,
  markSendStarted,
  resetLatencyCapture,
} from '../latency';

describe('latency capture', () => {
  const originalFlag = process.env.EXPO_PUBLIC_DG_LATENCY_LOG;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DG_LATENCY_LOG = '1';
    resetLatencyCapture();
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_DG_LATENCY_LOG;
    else process.env.EXPO_PUBLIC_DG_LATENCY_LOG = originalFlag;
  });

  test('matches a send start to a receive and exposes the sample', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    markSendStarted('message-1', 1_000);
    markMessageReceived('message-1', 1_750);

    expect(getLatencySamples()).toEqual([750]);
    expect(getLatencySummary()).toMatchObject({ count: 1, p95Ms: 750, budgetMs: 2_000 });
    expect(info).toHaveBeenNthCalledWith(1, '[DG_LATENCY] send-start message-1 1000');
    expect(info).toHaveBeenNthCalledWith(2, '[DG_LATENCY] receive message-1 1750');
    expect(info).toHaveBeenNthCalledWith(3, '[DG_LATENCY] 750ms');
    info.mockRestore();
  });

  test('ignores unmatched receives and invalid elapsed times', () => {
    markMessageReceived('unknown', 1_000);
    markSendStarted('message-2', 2_000);
    markMessageReceived('message-2', 1_000);
    expect(getLatencySamples()).toEqual([]);
  });
});
