import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignInForm } from '../../src/app/sign-in/SignInForm';
import { signIn } from '../../src/app/sign-in/actions';
vi.mock('../../src/app/sign-in/actions', () => ({ signIn: vi.fn() }));
describe('account sign-in form', () => {
  it('uses accessible bounded normal account credentials and no role selector', () => {
    render(<SignInForm accessFailed />);
    expect(screen.getByLabelText('Username or email').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Username or email').getAttribute('type')).toBe('text');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByLabelText('Password').getAttribute('maxlength')).toBe('1024');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('could not be verified');
  });
  it('clears password, prevents pending duplicates and recovers with safe errors', async () => {
    let resolve: (value: { ok: false; message: string }) => void = () => {};
    vi.mocked(signIn).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'admin@fixture.invalid' } });
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    fireEvent.change(password, { target: { value: 'synthetic-input' } });
    const form = password.closest('form'); if (!form) throw Error('Missing form');
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true));
    resolve({ ok: false, message: 'This account does not have admin access.' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('does not have admin access'));
    expect(password.value).toBe('');
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
    vi.mocked(signIn).mockRejectedValueOnce(Error('secret-provider-detail')); fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Could not reach'));
    expect(document.body.textContent).not.toContain('secret-provider-detail');
  });
});
