import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Button } from './Button';
import { Skeleton } from '../Skeleton/Skeleton';

afterEach(() => vi.useRealTimers());
test('loading waits 300 ms, blocks repeat submits and preserves the label width', () => {
  vi.useFakeTimers();
  const click = vi.fn();
  const { container, rerender } = render(<Button loading onClick={click}>Save changes</Button>);
  expect(screen.getByRole('button')).toBeDisabled();
  expect(container.querySelector('svg')).toBeNull();
  act(() => vi.advanceTimersByTime(299));
  expect(container.querySelector('svg')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(container.querySelector('svg')).not.toBeNull();
  expect(screen.getByText('Save changes')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  rerender(<Button loading={false} onClick={click}>Save changes</Button>);
  expect(container.querySelector('svg')).toBeNull();
  expect(screen.getByRole('button')).toBeEnabled();
  expect(click).not.toHaveBeenCalled();
});

test('short waits cancel, a new wait starts fresh and unmount removes timers', () => {
  vi.useFakeTimers();
  const { rerender, unmount } = render(<Skeleton active />);
  act(() => vi.advanceTimersByTime(200));
  rerender(<Skeleton active={false} />);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<Skeleton active />);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole('status')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true');
  rerender(<Skeleton active={false} />);
  rerender(<Skeleton active />);
  expect(screen.queryByRole('status')).toBeNull();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
