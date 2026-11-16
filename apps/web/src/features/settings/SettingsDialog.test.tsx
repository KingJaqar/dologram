import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { strings } from '@dologram/shared/src/strings';
import { SettingsDialog } from './SettingsDialog';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  setTheme: vi.fn((value: string) => (value === 'system' ? null : null)),
  signOut: vi.fn(() => Promise.resolve()),
  session: { online: true },
  query: {
    status: 'ready' as 'ready' | 'loading' | 'error',
    data: undefined as undefined | { unsent: number; profile: { user_id: string; display_name: string; username: string } },
    error: null as string | null,
    retry: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('../../lib/session/SessionProvider', () => ({
  useSession: () => ({
    profile: { user_id: 'owner', display_name: 'Server Owner', username: 'server_owner' },
    session: { user: { id: 'owner' } },
    online: mocks.session.online,
    controller: {},
  }),
}));
vi.mock('../../lib/store/StoreProvider', () => ({ useStore: () => ({ countUnsent: () => 2, list: () => [] }) }));
vi.mock('../../lib/store/useStoreQuery', () => ({ useStoreQuery: () => mocks.query }));
vi.mock('../../lib/session/signOut', () => ({ signOutAndWipe: mocks.signOut }));
vi.mock('../../theme/useTheme', () => ({ useThemeSetting: () => 'system', setThemeSetting: mocks.setTheme }));

beforeEach(() => {
  history.replaceState({ routerKey: 'keep' }, '', '/');
  mocks.session.online = true;
  mocks.query.status = 'ready';
  mocks.query.data = { unsent: 2, profile: { user_id: 'owner', display_name: 'Cached Owner', username: 'cached_owner' } };
  mocks.query.error = null;
  mocks.setTheme.mockClear();
  mocks.signOut.mockClear();
  mocks.replace.mockClear();
  // jsdom has no native top layer. Focus trapping and real Escape handling are covered by Playwright.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true, get() { return this.hasAttribute('inert'); }, set(value: boolean) { this.toggleAttribute('inert', value); } });
});

test('cached profile, appearance, account and About follow 12.5 without excluded controls', () => {
  render(<SettingsDialog />);
  expect(screen.getByText('Cached Owner')).toBeVisible();
  expect(screen.getByText('@cached_owner')).toBeVisible();
  for (const name of [strings.settings.themeSystem, strings.settings.themeLight, strings.settings.themeDark]) {
    expect(screen.getByRole('radio', { name })).toBeVisible();
  }
  expect(screen.getByRole('radio', { name: strings.settings.themeSystem })).toBeChecked();
  expect(screen.getByRole('group', { name: strings.settings.appearance })).toBeVisible();
  expect(screen.getByRole('heading', { name: strings.settings.account })).toBeVisible();
  expect(screen.getByRole('heading', { name: strings.settings.about })).toBeVisible();
  expect(screen.getByText(/^DoloGram \S+ \(\S+\)$/)).toBeVisible();
  // D-19: no Low Signal switch, app lock or notification row. WEB-13 folders arrive in Phase 18.
  expect(screen.queryByText(strings.settings.forceLowSignal)).toBeNull();
  expect(screen.queryByText(/app lock|notifications/i)).toBeNull();
  expect(screen.queryByRole('button', { name: strings.settings.folders })).toBeNull();
});

test('theme choice applies through the shared setter and account actions use the router', () => {
  render(<SettingsDialog />);
  fireEvent.click(screen.getByRole('radio', { name: strings.settings.themeDark }));
  expect(mocks.setTheme).toHaveBeenCalledWith('dark');
  fireEvent.click(screen.getByRole('button', { name: strings.settings.changePassword }));
  expect(mocks.replace).toHaveBeenCalledWith('/change-password?from=settings');
});

test('offline disables change password with No connection while sign out stays available', () => {
  mocks.session.online = false;
  render(<SettingsDialog />);
  const change = screen.getByRole('button', { name: strings.settings.changePassword });
  expect(change).toBeDisabled();
  expect(change).toHaveAccessibleDescription(strings.common.noConnection);
  expect(screen.getByRole('button', { name: strings.settings.signOut })).toBeEnabled();
});

test('sign-out warns with the unsent count, cancels without wiping and confirms the wipe', async () => {
  render(<SettingsDialog />);
  fireEvent.click(screen.getByRole('button', { name: strings.settings.signOut }));
  const confirm = await screen.findByRole('dialog', { name: strings.settings.signOutTitle });
  expect(within(confirm).getByText('2 unsent messages will be lost')).toBeVisible();
  fireEvent.click(within(confirm).getByRole('button', { name: strings.common.cancel }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.signOut).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: strings.settings.signOut }));
  const confirmed = await screen.findByRole('dialog', { name: strings.settings.signOutTitle });
  fireEvent.click(within(confirmed).getByRole('button', { name: strings.settings.signOut }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
});

test('a queued count above zero is required before the confirmation can wipe', async () => {
  mocks.query.status = 'loading';
  mocks.query.data = undefined;
  render(<SettingsDialog />);
  expect(screen.getByRole('status')).toHaveTextContent(strings.settings.checkingUnsent);
  fireEvent.click(screen.getByRole('button', { name: strings.settings.signOut }));
  const confirm = await screen.findByRole('dialog', { name: strings.settings.signOutTitle });
  expect(within(confirm).getByRole('button', { name: strings.settings.signOut })).toBeDisabled();
  expect(within(confirm).getByText(strings.settings.signOutConfirmBody)).toBeVisible();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
