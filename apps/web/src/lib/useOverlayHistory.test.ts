import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useOverlayHistory } from './useOverlayHistory';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
test('nested Back/Forward reconciles without pushing and preserves opaque router state', async () => {
  history.replaceState({ next: { tree: ['route'] }, marker: 'unchanged' }, '', '/');
  const push = vi.spyOn(history, 'pushState');
  const { result } = renderHook(() => ({ a: useOverlayHistory('a'), b: useOverlayHistory('b') }));
  act(() => result.current.a.show());
  act(() => result.current.a.show());
  act(() => result.current.b.show());
  expect(push).toHaveBeenCalledTimes(2);
  expect(history.state.next).toEqual({ tree: ['route'] });
  act(() => history.back());
  await waitFor(() => expect(result.current.b.open).toBe(false));
  expect(result.current.a.open).toBe(true);
  act(() => history.forward());
  await waitFor(() => expect(result.current.b.open).toBe(true));
  expect(push).toHaveBeenCalledTimes(2);
  act(() => result.current.b.close());
  await waitFor(() => expect(result.current.b.open).toBe(false));
  act(() => result.current.a.close());
  await waitFor(() => expect(result.current.a.open).toBe(false));
  expect(history.state.marker).toBe('unchanged');
  push.mockRestore();
});
