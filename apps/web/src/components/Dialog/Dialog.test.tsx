import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Dialog } from './Dialog';
import { useOverlayHistory } from '../../lib/useOverlayHistory';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
beforeEach(() => {
  history.replaceState({ routerKey: 'keep' }, '', '/');
  // jsdom has no native top layer. Real focus/trapping is covered by Playwright.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, get() { return this.hasAttribute('inert'); }, set(value: boolean) { this.toggleAttribute('inert', value); } });
});

test('Escape traverses once, closes, restores focus and releases inert/scroll state', async () => {
  function Harness() {
    const overlay = useOverlayHistory('test-dialog');
    return <><button onClick={overlay.show}>Open</button><Dialog overlay={overlay} title="Test dialog"><button onClick={overlay.close}>Cancel</button></Dialog></>;
  }
  const { container } = render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  expect(screen.getByRole('dialog')).toHaveAttribute('open');
  expect(container.inert).toBe(true);
  expect(history.state.routerKey).toBe('keep');
  const back = vi.spyOn(history, 'back');
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(back).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(opener).toHaveFocus();
  expect(container.inert).toBe(false);
  expect(document.body.style.overflow).toBe('');
  await act(async () => history.forward());
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
});
