import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthForm, type AuthMode } from './AuthForm';
import type { SessionState } from '../../lib/session/session';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const controller = { signIn: vi.fn(), signUp: vi.fn(), forgotPassword: vi.fn(), changePassword: vi.fn(), verifyPassword: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined), restore: vi.fn() };
let state: SessionState;
vi.mock('../../lib/session/SessionProvider', () => ({ useSession: () => ({ ...state, controller }) }));
beforeEach(() => {
  vi.clearAllMocks();
  state = { status: 'signedOut', session: null, profile: null, online: true, error: null, recoveryReady: false, pendingRevocation: false, passwordUpdated: false };
});
function fill(name: string, value: string) { fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value } }); }

it.each(['owner@example.test', ' OWNER_A '])('accepts email or username sign-in: %s', async (identifier) => {
  controller.signIn.mockResolvedValueOnce(undefined);
  render(<AuthForm mode="sign-in" />);
  const input = screen.getByLabelText('Email or username', { exact: true });
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('autocomplete', 'username');
  fill('Email or username', identifier); fill('Password', 'correct-password');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(controller.signIn).toHaveBeenCalledWith(identifier.trim(), 'correct-password'));
});

it.each<AuthMode>(['sign-in', 'sign-up', 'forgot-password'])('%s validates before sending and focuses the first invalid field', async (mode) => {
  render(<AuthForm mode={mode} />);
  fireEvent.submit(screen.getByRole('button', { name: mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link' }).closest('form') as HTMLFormElement);
  expect(screen.getByLabelText(mode === 'sign-in' ? 'Email or username' : 'Email', { exact: true })).toHaveFocus();
  expect(screen.getByText(mode === 'sign-in' ? 'Enter a valid email or username.' : 'Enter a valid email address.')).toBeVisible();
  expect(controller.signIn).not.toHaveBeenCalled();
  expect(controller.signUp).not.toHaveBeenCalled();
  expect(controller.forgotPassword).not.toHaveBeenCalled();
});

it('validates shared sign-up rules for password, username and display name', () => {
  render(<AuthForm mode="sign-up" />);
  fill('Email', 'owner@example.test'); fill('Password', 'short'); fill('Confirm password', 'different'); fill('Username', '1bad'); fill('Display name', 'x'.repeat(65));
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByText('Use at least 12 characters.')).toBeVisible();
  expect(screen.getByText("Passwords don't match.")).toBeVisible();
  expect(screen.getByText('Use 5–32 letters, numbers or underscores, starting with a letter.')).toBeVisible();
  expect(controller.signUp).not.toHaveBeenCalled();
});

it('blocks duplicate submits, maps credential faults safely and retains input', async () => {
  let reject: ((reason: unknown) => void) | undefined;
  controller.signIn.mockImplementationOnce(() => new Promise((_resolve, failure) => { reject = failure; }));
  render(<AuthForm mode="sign-in" />);
  fill('Email or username', 'owner@example.test'); fill('Password', 'incorrect-password');
  const button = screen.getByRole('button', { name: 'Sign in' });
  fireEvent.click(button);
  fireEvent.submit(button.closest('form') as HTMLFormElement);
  expect(controller.signIn).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => { reject?.({ code: 'invalid_credentials', message: 'private server detail' }); });
  expect(screen.getByRole('alert')).toHaveTextContent('Email, username or password is incorrect.');
  expect(screen.getByLabelText('Email or username', { exact: true })).toHaveValue('owner@example.test');
});

it('disables offline requests with No connection and preserves password reveal', () => {
  state.online = false;
  render(<AuthForm mode="sign-in" />);
  expect(screen.getByRole('status')).toHaveTextContent('No connection');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
});

it('offers local sign-out when a saved session cannot be restored, then enables fresh sign-in', async () => {
  state.status = 'error';
  state.error = 'Could not restore your session. Check your connection and try again.';
  const view = render(<AuthForm mode="sign-in" />);
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out on this browser' }));
  await waitFor(() => expect(controller.signOut).toHaveBeenCalledOnce());
  state.status = 'signedOut'; state.error = null;
  view.rerender(<AuthForm mode="sign-in" />);
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

it('shows the generic forgot response and same-origin action through the controller', async () => {
  controller.forgotPassword.mockResolvedValueOnce(undefined);
  render(<AuthForm mode="forgot-password" />);
  fill('Email', 'unknown@example.test');
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Check your email for a reset link.');
  expect(controller.forgotPassword).toHaveBeenCalledWith('unknown@example.test');
});

it('reports confirmation-required registration without navigating', async () => {
  controller.signUp.mockResolvedValueOnce(true);
  render(<AuthForm mode="sign-up" />);
  fill('Email', 'owner@example.test'); fill('Password', 'new-password12'); fill('Confirm password', 'new-password12'); fill('Username', 'OWNER_A'); fill('Display name', ' Owner A ');
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm your account');
  expect(controller.signUp).toHaveBeenCalledWith('owner@example.test', 'new-password12', 'owner_a', 'Owner A');
  expect(replace).not.toHaveBeenCalled();
});

it('direct reset cannot Save; cancellation signs out before navigation', async () => {
  render(<AuthForm mode="reset-password" />);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Retry verification' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel recovery' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'));
  expect(controller.signOut).toHaveBeenCalledOnce();
});

it('forced mode offers no Back and redirects other auth pages to its gate', async () => {
  state.status = 'mustChangePassword';
  const view = render(<AuthForm mode="change-password" />);
  expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
  view.rerender(<AuthForm mode="sign-in" />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/change-password'));
});

it('keeps every auth page behind pending recovery and never redirects SIGNED_IN prematurely', async () => {
  state.status = 'passwordRecovery';
  render(<AuthForm mode="sign-in" />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password'));
  expect(replace).not.toHaveBeenCalledWith('/');
});
