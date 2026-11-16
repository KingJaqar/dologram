import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

afterEach(() => vi.useRealTimers());
test('newest toast replaces, plain/action durations, hover/focus pause and cleanup', () => {
  vi.useFakeTimers();
  function Harness() {
    const toast = useToast();
    return <><button onClick={() => toast.show({ text: 'Copied' })}>Plain</button><button onClick={() => toast.show({ text: 'Failed', action: { label: 'Retry', onClick: () => toast.show({ text: 'Retried' }) } })}>Action</button></>;
  }
  const { unmount } = render(<ToastProvider><Harness /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
  act(() => vi.advanceTimersByTime(3999));
  expect(screen.getByRole('status')).toHaveTextContent('Copied');
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
  fireEvent.click(screen.getByRole('button', { name: 'Action' }));
  expect(screen.getAllByRole('status')).toHaveLength(1);
  act(() => vi.advanceTimersByTime(5000));
  const status = screen.getByRole('status');
  fireEvent.mouseEnter(status);
  act(() => vi.advanceTimersByTime(7000));
  expect(status).toBeInTheDocument();
  fireEvent.focus(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.mouseLeave(status);
  act(() => vi.advanceTimersByTime(7000));
  expect(status).toBeInTheDocument();
  fireEvent.blur(screen.getByRole('button', { name: 'Retry' }), { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(999));
  expect(status).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Action' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(screen.getByRole('status')).toHaveTextContent('Retried');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
