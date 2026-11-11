import { act, renderHook } from '@testing-library/react-native';
import { useDelayedFlag } from '../useDelayedFlag';

describe('useDelayedFlag', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('waits for the configured delay', () => {
    const { result } = renderHook<boolean, { active: boolean }>(({ active }) => useDelayedFlag(active, 300), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
