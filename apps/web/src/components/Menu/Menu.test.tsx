import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { expect, test, vi } from 'vitest';
import { Menu } from './Menu';

test('arrows wrap, Home/End work, disabled reason is exposed and Escape restores focus', () => {
  const select = vi.fn();
  function Harness() {
    const anchor = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    return <><button ref={anchor} onClick={() => setOpen(true)}>Actions</button><Menu open={open} onClose={() => setOpen(false)} anchorRef={anchor} label="Example" items={[
      { id: 'one', label: 'Copy', onSelect: select },
      { id: 'two', label: 'Archive', disabledReason: 'No connection', onSelect: select },
      { id: 'three', label: 'Delete', onSelect: select },
    ]} /></>;
  }
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Actions' });
  opener.focus();
  fireEvent.click(opener);
  const menu = screen.getByRole('menu');
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  const disabled = screen.getByRole('menuitem', { name: /Archive/ });
  expect(disabled).toHaveFocus();
  expect(disabled).toHaveAccessibleDescription('No connection');
  fireEvent.click(disabled);
  expect(select).not.toHaveBeenCalled();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(opener).toHaveFocus();
});
