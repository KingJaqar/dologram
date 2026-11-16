import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { ToastProvider } from '../../src/components/Toast/Toast';
import { CreateAccountClient } from '../../src/app/(admin)/accounts/new/CreateAccountClient';

const actions = vi.hoisted(() => ({ generatePassword: vi.fn(), createAccount: vi.fn(), recoverAccountCreation: vi.fn() }));
vi.mock('../../src/app/(admin)/accounts/new/actions', () => actions);
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) =>
    <a href={href} {...rest}>{children}</a>,
}));
vi.mock('server-only', () => ({}));

const DRAFT_ID = '60000000-0000-4000-8000-00000000000a';
const PASSWORD = 'Abcdefghijk23456';
const NEXT_PASSWORD = 'Zyxwvutsrq987654';
const USER_ID = '50000000-0000-4000-8000-00000000000a';

beforeEach(() => {
  actions.generatePassword.mockResolvedValue({ ok: true, password: PASSWORD, passwordDraftId: DRAFT_ID });
  actions.createAccount.mockResolvedValue({
    ok: true, userId: USER_ID, password: PASSWORD, auditRecorded: true,
  });
  actions.recoverAccountCreation.mockResolvedValue({ ok: true, userId: USER_ID, auditRecorded: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderScreen(prerequisite?: string) {
  return render(<ToastProvider><CreateAccountClient prerequisite={prerequisite} /></ToastProvider>);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'new_user@example.com');
  await user.type(screen.getByLabelText('Username'), 'new_user');
  await user.type(screen.getByLabelText('Display name'), 'New User');
}

describe('ADM-04 single create screen', () => {
  it('shows the prerequisite, mints the server password and keeps Create disabled until every field is valid', async () => {
    const user = userEvent.setup();
    renderScreen('Creation stays disabled until the contract is verified.');
    expect(screen.getByRole('alert').textContent).toContain('Creation stays disabled until the contract is verified.');
    const field = await screen.findByLabelText('Generated password', { selector: 'input' });
    expect((field as HTMLInputElement).value).toBe(PASSWORD);
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create.hasAttribute('disabled')).toBe(true);
    await fillValidForm(user);
    expect(create.hasAttribute('disabled')).toBe(true);
    expect(actions.createAccount).not.toHaveBeenCalled();
  });

  it('reports a 4-character username on blur without submitting', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByLabelText('Generated password', { selector: 'input' });
    await user.type(screen.getByLabelText('Username'), 'abcd');
    await user.tab();
    expect(screen.getByText(/Username must be 5 to 32 characters/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true);
  });

  it('submits only the opaque draft id and shows a returned field error on its TextField', async () => {
    actions.createAccount.mockResolvedValue({
      ok: false, field: 'email', message: 'An account with this email already exists.',
    });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByLabelText('Generated password', { selector: 'input' });
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(actions.createAccount).toHaveBeenCalledWith({
      email: 'new_user@example.com', username: 'new_user', displayName: 'New User', passwordDraftId: DRAFT_ID,
    });
    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  });

  it('replaces the form with the created password and link, and drops the password on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen();
    await screen.findByLabelText('Generated password', { selector: 'input' });
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Account created.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open account' }).getAttribute('href')).toBe(`/accounts/${USER_ID}`);
    expect((screen.getByLabelText('Generated password', { selector: 'input' }) as HTMLInputElement).value).toBe(PASSWORD);
    unmount();
    expect(document.body.textContent).not.toContain(PASSWORD);
  });

  it('regenerates a fresh draft and submits the newest id', async () => {
    actions.generatePassword
      .mockResolvedValueOnce({ ok: true, password: PASSWORD, passwordDraftId: DRAFT_ID })
      .mockResolvedValueOnce({ ok: true, password: NEXT_PASSWORD, passwordDraftId: '60000000-0000-4000-8000-00000000000b' });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    await screen.findByDisplayValue(NEXT_PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(actions.createAccount).toHaveBeenCalledWith(expect.objectContaining({
      passwordDraftId: '60000000-0000-4000-8000-00000000000b',
    }));
  });

  it('shows a safe message when the password draft cannot be generated', async () => {
    actions.generatePassword.mockResolvedValue({ ok: false, message: 'Request refused.' });
    renderScreen();
    expect(await screen.findByText('Request refused.')).toBeTruthy();
    expect(screen.queryByLabelText('Generated password', { selector: 'input' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true);
  });

  it('can retry a failed password request without remounting', async () => {
    actions.generatePassword.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue(PASSWORD)).toBeTruthy();
    expect(actions.generatePassword).toHaveBeenCalledTimes(2);
  });

  it('replaces an unavailable draft before another creation attempt', async () => {
    actions.createAccount.mockResolvedValueOnce({ ok: false, message: 'Service unavailable.' });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue(PASSWORD)).toBeTruthy();
    expect(actions.generatePassword).toHaveBeenCalledTimes(2);
    expect(actions.createAccount).toHaveBeenCalledTimes(1);
  });

  it('recovers a lost response with the original draft identity without another create or regeneration', async () => {
    actions.createAccount.mockRejectedValueOnce(new Error('response-lost'));
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const recover = await screen.findByRole('button', { name: 'Recover account creation' });
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Regenerate' }).hasAttribute('disabled')).toBe(true);
    await user.click(recover);
    expect(await screen.findByText('Account created.')).toBeTruthy();
    expect(await screen.findByDisplayValue(PASSWORD)).toBeTruthy();
    expect(actions.recoverAccountCreation).toHaveBeenCalledWith(DRAFT_ID);
    expect(actions.createAccount).toHaveBeenCalledTimes(1);
    expect(actions.generatePassword).toHaveBeenCalledTimes(1);
  });

  it('recovers an applied initialization failure and retries only its audit when needed', async () => {
    actions.createAccount.mockResolvedValueOnce({ ok: false, operationId: DRAFT_ID, userId: USER_ID, message: 'Initialization unavailable.' });
    actions.recoverAccountCreation.mockResolvedValueOnce({ ok: true, userId: USER_ID, auditRecorded: false });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(await screen.findByRole('button', { name: 'Recover account creation' }));
    expect(await screen.findByText(/The audit entry could not be written/u)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Recover account creation' }));
    expect(screen.queryByRole('button', { name: 'Recover account creation' })).toBeNull();
    expect(screen.queryByText(/The audit entry could not be written/u)).toBeNull();
    expect(actions.createAccount).toHaveBeenCalledTimes(1);
    expect(actions.recoverAccountCreation).toHaveBeenCalledTimes(2);
  });

  it('keeps recovery available after an outage and reports list refresh failures', async () => {
    actions.createAccount.mockResolvedValueOnce({ ok: false, operationId: DRAFT_ID, message: 'Creation outcome unknown.' });
    actions.recoverAccountCreation.mockRejectedValueOnce(new Error('outage'));
    actions.recoverAccountCreation.mockResolvedValueOnce({ ok: true, userId: USER_ID, auditRecorded: true, refreshFailed: true });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(await screen.findByRole('button', { name: 'Recover account creation' }));
    expect(await screen.findByText('The request could not be completed. Try again.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Recover account creation' }));
    expect(await screen.findByText(/The account exists, but the accounts list could not be refreshed/u)).toBeTruthy();
    expect(actions.createAccount).toHaveBeenCalledTimes(1);
  });

  it('preserves an applied account identity and prevents creating again after partial failure', async () => {
    actions.createAccount.mockResolvedValue({ ok: false, userId: USER_ID, message: 'The profile could not be verified.' });
    const user = userEvent.setup();
    renderScreen();
    await screen.findByDisplayValue(PASSWORD);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('link', { name: 'Open account' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true);
  });
});
