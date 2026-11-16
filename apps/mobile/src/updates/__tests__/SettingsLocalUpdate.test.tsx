import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import { strings } from '@dologram/shared';
import * as native from '../../../modules/local-apk-update';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { useCall } from '../../calls/useCall';
import { localUpdateController, updateFiles } from '../localUpdate';
import { supabase } from '../../lib/supabase';
import SettingsScreen from '../../../app/(main)/(tabs)/settings';

jest.mock('expo-file-system', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: 'fallback' }, platform: { android: { versionCode: 7 } } } }));
jest.mock('../../lib/ids', () => ({ ids: { mediaId: () => '00000000-0000-4000-8000-000000000000' } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }), useIsFocused: () => true,
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ profile: null, session: { user: { id: 'test-account' } } }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: false }) }));
jest.mock('../../net/lowSignalPreferences', () => ({ useForceLowSignalMode: () => false, setForceLowSignalMode: jest.fn() }));
jest.mock('../../components/Toast', () => {
  const showToast = jest.fn();
  return { useToast: () => ({ showToast }), ToastModalHost: () => null };
});
jest.mock('../../components/Avatar', () => ({ Avatar: () => null }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../queue/events', () => ({ subscribeQueueChange: () => () => {} }));
jest.mock('../../queue/localQueue', () => ({ getUnsentItems: jest.fn().mockResolvedValue([]) }));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));
jest.mock('../../storage/localData', () => ({ clearLocalData: jest.fn() }));
jest.mock('../../notifications/pushNotifications', () => ({ withPushRegistrationPaused: jest.fn() }));
jest.mock('../../auth/savedAccounts', () => ({ saveCurrentAccount: jest.fn() }));
jest.mock('../../calls/lifecycle', () => ({ stopCurrentCallForSessionChange: jest.fn() }));
jest.mock('../../calls/useCall', () => ({ useCall: jest.fn() }));
jest.mock('../../../modules/local-apk-update', () => ({
  hasLocalApkUpdateCapability: jest.fn(() => true), getInstalledInfo: jest.fn(), inspectCandidate: jest.fn(),
  canRequestInstall: jest.fn(), openInstallPermissionSettings: jest.fn(), launchInstaller: jest.fn(), invalidateAttempt: jest.fn(),
}));

function Wrapper({ children }: { children: React.ReactNode }) { return <ThemeProvider>{children}</ThemeProvider>; }
// Real RN/Theme/Dialog cold initialization can exceed Jest's default 5-second per-test limit.
jest.setTimeout(15000);
async function renderSettings() {
  const screen = render(<SettingsScreen />, { wrapper: Wrapper });
  await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });
  return screen;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(native.hasLocalApkUpdateCapability).mockReturnValue(true);
  jest.mocked(native.getInstalledInfo).mockResolvedValue({ applicationId: 'com.dologram.app', versionName: 'native-version', versionCode: '9007199254740993' });
  jest.mocked(native.inspectCandidate).mockResolvedValue({ applicationId: 'com.dologram.app', versionName: 'selected-version', versionCode: '9007199254740994', attemptId: 'test' });
  jest.mocked(native.canRequestInstall).mockResolvedValue(true);
  jest.mocked(native.launchInstaller).mockResolvedValue({ attemptId: 'test', status: 'handedOff' });
  jest.mocked(useCall).mockReturnValue({ view: { phase: 'idle' }, currentCall: null } as ReturnType<typeof useCall>);
  jest.spyOn(updateFiles, 'sweep').mockResolvedValue(undefined);
  jest.spyOn(updateFiles, 'pick').mockResolvedValue({ uri: 'content://original', name: 'release.apk' });
  jest.spyOn(updateFiles, 'stage').mockResolvedValue('file:///owned/candidate.apk');
  jest.spyOn(updateFiles, 'discardSelection').mockResolvedValue(undefined);
  jest.spyOn(updateFiles, 'remove').mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => { await Promise.resolve(); }); jest.restoreAllMocks(); });

test('offline update stays enabled, shows exact native build and preserves existing settings rows', async () => {
  const screen = await renderSettings();
  expect(await screen.findByText('DoloGram native-version (9007199254740993)')).toBeTruthy();
  const row = screen.getByRole('button', { name: strings.localUpdate.title });
  expect(row.props.accessibilityState).toEqual({ disabled: false, busy: false });
  expect(StyleSheet.flatten(row.props.style).minHeight).toBe(56);
  expect(screen.getByRole('button', { name: strings.settings.changePassword }).props.accessibilityState.disabled).toBe(true);
  [strings.settings.folders, strings.settings.manageAccounts, strings.settings.signOut, strings.settings.notifications].forEach((name) => {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  });
});

test('sign out always asks for confirmation even when there are no unsent messages', async () => {
  const screen = await renderSettings();
  fireEvent.press(screen.getByRole('button', { name: strings.settings.signOut }));
  expect(await screen.findByText(strings.settings.signOutConfirmBody)).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.settings.signOut })).toBeTruthy();
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});

test.each(['ios', 'web', 'missing'])('%s capability hides update control and retains version fallback without throwing', async (variant) => {
  jest.replaceProperty(Platform, 'OS', variant === 'ios' ? 'ios' : variant === 'web' ? 'web' : 'android');
  jest.mocked(native.hasLocalApkUpdateCapability).mockReturnValue(variant !== 'missing');
  const screen = await renderSettings();
  expect(screen.queryByRole('button', { name: strings.localUpdate.title })).toBeNull();
  expect(screen.getByText('DoloGram fallback (7)')).toBeTruthy();
  expect(native.getInstalledInfo).not.toHaveBeenCalled();
  await act(async () => { await Promise.resolve(); });
});

test('real Dialog shows installed/selected identity, confirmation and Cancel with no dispatch', async () => {
  const screen = await renderSettings();
  await screen.findByText('DoloGram native-version (9007199254740993)');
  fireEvent.press(screen.getByRole('button', { name: strings.localUpdate.title }));
  expect(await screen.findByText(strings.localUpdate.confirm('release.apk', 'native-version (9007199254740993)', 'selected-version (9007199254740994)'))).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.localUpdate.continue })).toBeTruthy();
  fireEvent.press(screen.getAllByRole('button', { name: strings.localUpdate.cancel })[1]);
  await waitFor(() => expect(localUpdateController.getSnapshot().phase).toBe('idle'));
  expect(native.launchInstaller).not.toHaveBeenCalled();
});

test('pending selection exposes busy/disabled state and recovery copy without allowing duplicate selection', async () => {
  jest.spyOn(updateFiles, 'pick').mockImplementationOnce(() => new Promise((resolve) => {
    setTimeout(() => resolve(null), 20);
  }));
  const screen = await renderSettings();
  await screen.findByText('DoloGram native-version (9007199254740993)');
  fireEvent.press(screen.getByRole('button', { name: strings.localUpdate.title }));
  expect(screen.getByRole('button', { name: strings.localUpdate.title }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(screen.getByText(strings.localUpdate.picking)).toBeTruthy();
  await screen.findByRole('button', { name: strings.localUpdate.browseAll });
  expect(updateFiles.pick).toHaveBeenCalledTimes(1);
});

test('call restriction disables update and explains nonterminal call even with unavailable rendered phase', async () => {
  jest.mocked(useCall).mockReturnValue({ view: { phase: 'unavailable' }, currentCall: { status: 'accepted' } } as ReturnType<typeof useCall>);
  const screen = await renderSettings();
  await screen.findByText('DoloGram native-version (9007199254740993)');
  expect(screen.getByText(strings.localUpdate.callBlocked)).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.localUpdate.title }).props.accessibilityState.disabled).toBe(true);
});

test('permission explanation and recoverable validation errors are visible, no silent failure', async () => {
  jest.mocked(native.canRequestInstall).mockResolvedValue(false);
  const screen = await renderSettings();
  await screen.findByText('DoloGram native-version (9007199254740993)');
  fireEvent.press(screen.getByRole('button', { name: strings.localUpdate.title }));
  fireEvent.press(await screen.findByRole('button', { name: strings.localUpdate.continue }));
  expect(await screen.findByRole('button', { name: strings.localUpdate.openSettings })).toBeTruthy();
  expect(screen.getAllByText(strings.localUpdate.permissionBody).length).toBeGreaterThan(0);
  fireEvent.press(screen.getAllByRole('button', { name: strings.localUpdate.cancel })[1]);
  await waitFor(() => expect(localUpdateController.getSnapshot().phase).toBe('idle'));
  jest.mocked(native.inspectCandidate).mockRejectedValueOnce({ code: 'LOCAL_APK_UPDATE_WRONGSIGNER' });
  fireEvent.press(screen.getByRole('button', { name: strings.localUpdate.title }));
  expect(await screen.findByText(strings.localUpdate.errors.wrongSigner)).toBeTruthy();
});

test('both themes and large text retain wrapping copy, labelled controls and minimum row target', async () => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  const screen = await renderSettings();
  const helper = await screen.findByText(strings.localUpdate.helper);
  expect(helper.props.numberOfLines).toBeUndefined();
  const lightColor = StyleSheet.flatten(helper.props.style).color;
  fireEvent(screen.getByRole('switch', { name: strings.settings.theme }), 'valueChange', true);
  const darkColor = StyleSheet.flatten(screen.getByText(strings.localUpdate.helper).props.style).color;
  expect(darkColor).not.toBe(lightColor);
  const row = screen.getByRole('button', { name: strings.localUpdate.title });
  expect(StyleSheet.flatten(row.props.style).minHeight).toBe(56);
  expect(StyleSheet.flatten(row.props.style).height).toBeUndefined();
  fireEvent.press(row);
  const message = await screen.findByText(strings.localUpdate.confirm('release.apk', 'native-version (9007199254740993)', 'selected-version (9007199254740994)'));
  expect(message.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(screen.getByTestId('local-update-details').props.style).maxHeight).toBeGreaterThan(0);
  fireEvent.press(screen.getAllByRole('button', { name: strings.localUpdate.cancel })[1]);
  await waitFor(() => expect(localUpdateController.getSnapshot().phase).toBe('idle'));
});

test('very long provider filenames remain display text inside bounded scrolling details with actions outside', async () => {
  const name = `${'long release name '.repeat(100)}.apk`;
  jest.spyOn(updateFiles, 'pick').mockResolvedValueOnce({ uri: 'content://original', name });
  const screen = await renderSettings();
  fireEvent.press(screen.getByRole('button', { name: strings.localUpdate.title }));
  expect(await screen.findByText(strings.localUpdate.confirm(name, 'native-version (9007199254740993)', 'selected-version (9007199254740994)'))).toBeTruthy();
  const details = screen.getByTestId('local-update-details');
  expect(StyleSheet.flatten(details.props.style).maxHeight).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: strings.localUpdate.continue })).toBeTruthy();
  fireEvent.press(screen.getAllByRole('button', { name: strings.localUpdate.cancel })[1]);
  await waitFor(() => expect(localUpdateController.getSnapshot().phase).toBe('idle'));
});
