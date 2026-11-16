import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { strings } from '@dologram/shared/src/strings';
import { TextField } from './TextField';
import { SearchField } from '../SearchField/SearchField';
import { ErrorState } from '../ErrorState/ErrorState';

test('password toggle, linked error/helper/counter and multiline have accessible labels', () => {
  render(<><TextField label="Password" type="password" error={strings.changePassword.tooShort} counter="3 / 12" /><TextField label="About" multiline helper="Six lines" /></>);
  const input = screen.getByLabelText('Password');
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveAccessibleDescription(`${strings.changePassword.tooShort} 3 / 12`);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(input).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('About').tagName).toBe('TEXTAREA');
});

test('clearing search returns focus, and unrecoverable errors have no Retry', () => {
  function Harness() { const [value, setValue] = useState('Ana'); return <SearchField label="Search chats" value={value} onValueChange={setValue} />; }
  render(<><Harness /><ErrorState title="Unavailable" body={strings.chatInfo.unavailableBody} /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('searchbox')).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});

test('search helper, error and counter descriptions are separate accessible references', () => {
  render(<SearchField label="Filter" value="Ana" onValueChange={() => {}} error={strings.common.noConnection} counter="3 / 64" />);
  expect(screen.getByRole('searchbox', { name: 'Filter' })).toHaveAccessibleDescription('No connection 3 / 64');
  expect(screen.getByRole('searchbox')).toHaveAttribute('aria-invalid', 'true');
});
