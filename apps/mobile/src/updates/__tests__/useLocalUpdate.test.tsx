import { act, renderHook } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';
import { strings } from '@dologram/shared';
import * as native from '../../../modules/local-apk-update';
import { LocalUpdateController, localUpdateController, updateFiles, type UpdateFiles } from '../localUpdate';
import { useLocalUpdate } from '../useLocalUpdate';

jest.mock('expo-file-system', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('../../lib/ids', () => ({ ids: { mediaId: () => '00000000-0000-4000-8000-000000000000' } }));
jest.mock('../../calls/useCall', () => ({ useCall: () => ({ view: { phase: 'idle' }, currentCall: null }) }));
jest.mock('expo-router', () => ({
  useIsFocused: jest.fn(() => true),
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('../../../modules/local-apk-update', () => ({
  hasLocalApkUpdateCapability: jest.fn(() => true), getInstalledInfo: jest.fn(),
  inspectCandidate: jest.fn(), canRequestInstall: jest.fn(),
  openInstallPermissionSettings: jest.fn(), launchInstaller: jest.fn(), invalidateAttempt: jest.fn(),
}));

function deferred<T>() {
  let complete: ((value: T) => void) | undefined;
  let fail: ((error: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => { complete = resolve; fail = reject; });
  return { promise, resolve(value: T) { if (!complete) throw new Error('Missing resolver'); complete(value); },
    reject(error: unknown) { if (!fail) throw new Error('Missing rejecter'); fail(error); } };
}
const installed = { applicationId: 'com.dologram.app', versionName: '1.0', versionCode: '1' };
const candidate = { ...installed, versionName: '1.1', versionCode: '2', attemptId: 'test' };
const owner = Symbol('settings');
const environment = { accountId: 'test-account', focused: true, callBlocked: false };
function setup() {
  const files: jest.Mocked<UpdateFiles> = {
    pick: jest.fn().mockResolvedValue({ uri: 'content://original', name: 'release.apk' }),
    stage: jest.fn().mockResolvedValue('file:///owned/candidate.apk'),
    discardSelection: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined), sweep: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new LocalUpdateController(files, native);
  controller.observe(owner, environment);
  return { controller, files };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(native.getInstalledInfo).mockResolvedValue(installed);
  jest.mocked(native.inspectCandidate).mockResolvedValue(candidate);
  jest.mocked(native.canRequestInstall).mockResolvedValue(true);
  jest.mocked(native.openInstallPermissionSettings).mockResolvedValue({ opened: true });
  jest.mocked(native.launchInstaller).mockResolvedValue({ attemptId: 'test', status: 'handedOff' });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('valid flow needs explicit Continue, launches once and retains file without claiming installed', async () => {
  const { controller, files } = setup();
  await controller.select(owner);
  expect(controller.getSnapshot().phase).toBe('confirming');
  expect(native.launchInstaller).not.toHaveBeenCalled();
  await Promise.all([controller.continue(owner), controller.continue(owner)]);
  expect(native.launchInstaller).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().phase).toBe('awaitingReturn');
  controller.appState(owner, true);
  expect(controller.getSnapshot().phase).toBe('awaitingReturn');
  controller.appState(owner, false); controller.appState(owner, true);
  await Promise.resolve();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(files.remove).not.toHaveBeenCalled();
  expect(controller.getSnapshot().message).toBeNull();
});

test('picker cancel offers browse-all only on next explicit selection; confirmation cancel removes only owned attempt', async () => {
  const { controller, files } = setup();
  files.pick.mockResolvedValueOnce(null);
  await controller.select(owner);
  expect(controller.getSnapshot()).toMatchObject({ phase: 'idle', browseAll: true });
  expect(files.pick).toHaveBeenCalledTimes(1);
  await controller.select(owner, true);
  expect(files.pick).toHaveBeenLastCalledWith(true);
  controller.cancel(owner);
  await Promise.resolve();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(files.remove).toHaveBeenCalledTimes(2);
});

test.each(['wrongSigner', 'wrongPackage', 'sameVersion', 'olderVersion', 'invalidApk', 'unsupportedApk', 'unreadable'])('native %s rejection cannot launch or touch account stores', async (code) => {
  const { controller, files } = setup();
  jest.mocked(native.inspectCandidate).mockRejectedValueOnce({ code: `LOCAL_APK_UPDATE_${code.toUpperCase()}` });
  await controller.select(owner);
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(controller.getSnapshot().message).toBeTruthy();
  expect(files.remove).toHaveBeenCalledTimes(1);
  expect(native.launchInstaller).not.toHaveBeenCalled();
});

test('SDK pending selection survives background but blocks rapid taps, remount and late dispatch after abandonment', async () => {
  const { controller, files } = setup();
  const picker = deferred<{ uri: string; name: string } | null>();
  const started = deferred<void>();
  files.pick.mockImplementationOnce(() => { started.resolve(); return picker.promise; });
  const selecting = controller.select(owner);
  await started.promise;
  controller.appState(owner, false); controller.appState(owner, true);
  await controller.select(owner);
  expect(files.pick).toHaveBeenCalledTimes(1);
  controller.detach(owner);
  const replacement = Symbol('remounted');
  controller.observe(replacement, environment);
  await controller.select(replacement);
  expect(files.pick).toHaveBeenCalledTimes(1);
  picker.resolve({ uri: 'content://original', name: 'late.apk' });
  await selecting;
  expect(files.stage).not.toHaveBeenCalled();
  expect(files.discardSelection).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().phase).toBe('idle');
});

test('backgrounding for picker alone does not cancel a valid selection', async () => {
  const { controller, files } = setup();
  const picker = deferred<{ uri: string; name: string } | null>();
  const started = deferred<void>();
  files.pick.mockImplementationOnce(() => { started.resolve(); return picker.promise; });
  const selecting = controller.select(owner);
  await started.promise;
  controller.appState(owner, false); controller.appState(owner, true);
  picker.resolve({ uri: 'file:///picker', name: 'valid.apk' });
  await selecting;
  expect(controller.getSnapshot().phase).toBe('confirming');
  controller.cancel(owner);
});

test.each(['account', 'focus', 'call'])('%s invalidation during native revalidation is sent to native before pending launch settles', async (reason) => {
  const { controller, files } = setup();
  await controller.select(owner);
  const launch = deferred<native.InstallerHandoff>();
  jest.mocked(native.launchInstaller).mockReturnValueOnce(launch.promise);
  const handoff = controller.continue(owner);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(native.launchInstaller).toHaveBeenCalledTimes(1);
  controller.observe(owner, { ...environment, accountId: reason === 'account' ? 'other' : environment.accountId,
    focused: reason !== 'focus', callBlocked: reason === 'call' });
  expect(native.invalidateAttempt).toHaveBeenCalledTimes(1);
  expect(files.remove).not.toHaveBeenCalled();
  launch.reject({ code: 'LOCAL_APK_UPDATE_STALEATTEMPT' });
  await handoff;
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(files.remove).not.toHaveBeenCalled(); // conservative uncertain-dispatch retention
});

test('permission grant and fast return require another explicit Continue, duplicate active events do not launch', async () => {
  const { controller } = setup();
  jest.mocked(native.canRequestInstall).mockResolvedValueOnce(false).mockResolvedValue(true);
  await controller.select(owner); await controller.continue(owner);
  expect(controller.getSnapshot().needsPermission).toBe(true);
  const settings = deferred<{ opened: true }>();
  jest.mocked(native.openInstallPermissionSettings).mockReturnValueOnce(settings.promise);
  const opening = controller.openSettings(owner);
  controller.appState(owner, false); controller.appState(owner, true); controller.appState(owner, true);
  settings.resolve({ opened: true }); await opening;
  expect(controller.getSnapshot()).toMatchObject({ phase: 'confirming', needsPermission: false });
  expect(native.launchInstaller).not.toHaveBeenCalled();
  await controller.continue(owner);
  expect(native.launchInstaller).toHaveBeenCalledTimes(1);
  controller.detach(owner);
});

test('denied permission is explained with explicit retry and no automatic settings loop', async () => {
  const { controller } = setup();
  jest.mocked(native.canRequestInstall).mockResolvedValue(false);
  await controller.select(owner); await controller.continue(owner); await controller.openSettings(owner);
  controller.appState(owner, false); controller.appState(owner, true); controller.appState(owner, true);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.permissionDenied);
  expect(native.openInstallPermissionSettings).toHaveBeenCalledTimes(1);
  expect(native.launchInstaller).not.toHaveBeenCalled();
  await controller.openSettings(owner);
  expect(native.openInstallPermissionSettings).toHaveBeenCalledTimes(2);
  controller.detach(owner);
});

test('settings handler failure and revoked permission are actionable without false success', async () => {
  const { controller, files } = setup();
  jest.mocked(native.canRequestInstall).mockResolvedValueOnce(false);
  jest.mocked(native.openInstallPermissionSettings).mockRejectedValueOnce({ code: 'LOCAL_APK_UPDATE_SETTINGSUNAVAILABLE' });
  await controller.select(owner); await controller.continue(owner); await controller.openSettings(owner);
  expect(controller.getSnapshot()).toMatchObject({ phase: 'idle', message: strings.localUpdate.errors.settingsUnavailable });
  expect(files.remove).toHaveBeenCalledTimes(1);
  await controller.select(owner);
  jest.mocked(native.launchInstaller).mockRejectedValueOnce({ code: 'LOCAL_APK_UPDATE_PERMISSIONREQUIRED' });
  await controller.continue(owner);
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.errors.permissionRequired);
});

test('post-picker timeout invalidates but keeps serialization/file until a late disk copy settles', async () => {
  jest.useFakeTimers();
  const { controller, files } = setup();
  const copy = deferred<string>(); files.stage.mockReturnValueOnce(copy.promise);
  const selecting = controller.select(owner);
  await jest.advanceTimersByTimeAsync(120001);
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.errors.operationTimedOut);
  expect(native.invalidateAttempt).toHaveBeenCalledTimes(1);
  await controller.select(owner);
  expect(files.pick).toHaveBeenCalledTimes(1);
  expect(files.remove).not.toHaveBeenCalled();
  copy.resolve('file:///late.apk'); await selecting;
  expect(files.remove).toHaveBeenCalledTimes(1);
  expect(native.inspectCandidate).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('launch revalidation has 130-second whole-method bound, not 10 seconds; late uncertain dispatch is retained', async () => {
  jest.useFakeTimers();
  const { controller, files } = setup();
  await controller.select(owner);
  const launch = deferred<native.InstallerHandoff>(); jest.mocked(native.launchInstaller).mockReturnValueOnce(launch.promise);
  const handoff = controller.continue(owner);
  await jest.advanceTimersByTimeAsync(11000);
  expect(native.invalidateAttempt).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(120000);
  expect(native.invalidateAttempt).toHaveBeenCalledTimes(1);
  expect(files.remove).not.toHaveBeenCalled();
  launch.resolve({ attemptId: 'late', status: 'handedOff' }); await handoff;
  expect(files.remove).not.toHaveBeenCalled();
  expect(controller.getSnapshot().phase).toBe('awaitingReturn');
  controller.appState(owner, false); controller.appState(owner, true);
  await Promise.resolve();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(jest.getTimerCount()).toBe(0);
});

test('fast installer return before launch resolves releases lock once; cancel/backdrop is ignored while busy', async () => {
  const { controller } = setup(); await controller.select(owner);
  const launch = deferred<native.InstallerHandoff>(); jest.mocked(native.launchInstaller).mockReturnValueOnce(launch.promise);
  const handoff = controller.continue(owner);
  controller.cancel(owner);
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.appState(owner, false); controller.appState(owner, true); controller.appState(owner, true);
  launch.resolve({ attemptId: 'test', status: 'handedOff' }); await handoff;
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(native.launchInstaller).toHaveBeenCalledTimes(1);
});

test('hook observes focus/account changes and removes AppState subscription on unmount', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(updateFiles, 'sweep').mockResolvedValue(undefined);
  jest.spyOn(updateFiles, 'remove').mockResolvedValue(undefined);
  jest.spyOn(updateFiles, 'discardSelection').mockResolvedValue(undefined);
  jest.spyOn(updateFiles, 'pick').mockResolvedValue(null);
  const remove = jest.fn(); const listener = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const screen = renderHook(({ accountId }: { accountId: string }) => useLocalUpdate(accountId), { initialProps: { accountId: 'one' } });
  await act(async () => { await Promise.resolve(); });
  expect(screen.result.current.supported).toBe(true);
  jest.mocked(useIsFocused).mockReturnValue(false);
  screen.rerender({ accountId: 'two' });
  screen.unmount();
  expect(listener).toHaveBeenCalledWith('change', expect.any(Function));
  expect(remove).toHaveBeenCalledTimes(1);
  localUpdateController.detach(owner);
});

test('observed call blocks starting and invalidates a pending selection before staging', async () => {
  const { controller, files } = setup();
  controller.observe(owner, { ...environment, callBlocked: true });
  await controller.select(owner);
  expect(files.pick).not.toHaveBeenCalled();
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.callBlocked);
  controller.observe(owner, environment);
  const picker = deferred<{ uri: string; name: string } | null>();
  const started = deferred<void>();
  files.pick.mockImplementationOnce(() => { started.resolve(); return picker.promise; });
  const selecting = controller.select(owner); await started.promise;
  controller.observe(owner, { ...environment, callBlocked: true });
  picker.resolve({ uri: 'content://original', name: 'late.apk' }); await selecting;
  expect(files.stage).not.toHaveBeenCalled();
  expect(native.invalidateAttempt).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.callBlocked);
});

test('validation timeout keeps guard until settlement; unmount removes owned watchdog', async () => {
  jest.useFakeTimers();
  const { controller, files } = setup();
  const inspection = deferred<native.CandidateApkInfo>();
  jest.mocked(native.inspectCandidate).mockReturnValueOnce(inspection.promise);
  const selecting = controller.select(owner);
  await jest.advanceTimersByTimeAsync(120001);
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.errors.operationTimedOut);
  controller.detach(owner);
  expect(jest.getTimerCount()).toBe(0);
  inspection.resolve(candidate); await selecting;
  expect(controller.getSnapshot().candidate).toBeNull();
  expect(files.remove).toHaveBeenCalledTimes(1);
});

test('permission queries have a separate ten-second bound and cannot launch after timeout', async () => {
  jest.useFakeTimers();
  const { controller, files } = setup(); await controller.select(owner);
  const permission = deferred<boolean>(); jest.mocked(native.canRequestInstall).mockReturnValueOnce(permission.promise);
  const checking = controller.continue(owner);
  await jest.advanceTimersByTimeAsync(10001);
  await controller.select(owner);
  expect(files.pick).toHaveBeenCalledTimes(1);
  permission.resolve(true); await checking;
  expect(native.launchInstaller).not.toHaveBeenCalled();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(jest.getTimerCount()).toBe(0);
});

test('full-storage failure and cleanup failure preserve primary error, release lock and allow explicit retry', async () => {
  const { controller, files } = setup();
  files.stage.mockRejectedValueOnce(new Error('ENOSPC'));
  files.remove.mockRejectedValueOnce(new Error('disk failure'));
  await controller.select(owner);
  expect(controller.getSnapshot().message).toBe(`${strings.localUpdate.errors.storageFull}\n${strings.localUpdate.cleanupFailed}`);
  await controller.select(owner);
  expect(controller.getSnapshot().phase).toBe('confirming');
  controller.cancel(owner);
});

test('expired-copy cleanup failure does not prevent a fresh selection; metadata failure stays truthful', async () => {
  const { controller, files } = setup();
  files.sweep.mockRejectedValueOnce(new Error('old file busy'));
  await controller.select(owner);
  expect(controller.getSnapshot().phase).toBe('confirming');
  expect(controller.getSnapshot().message).toBe(strings.localUpdate.cleanupFailed);
  controller.cancel(owner); await Promise.resolve();
  jest.mocked(native.getInstalledInfo).mockRejectedValueOnce(new Error('unavailable'));
  await controller.enter();
  expect(controller.getSnapshot()).toMatchObject({ installed: null, message: strings.localUpdate.metadataFailed });
});

test('unknown dispatch failure retains file until return, and route departure after settled handoff safely releases UI', async () => {
  const { controller, files } = setup(); await controller.select(owner);
  jest.mocked(native.launchInstaller).mockRejectedValueOnce(new Error('Unknown native dispatch result'));
  await controller.continue(owner);
  expect(controller.getSnapshot().phase).toBe('awaitingReturn');
  expect(files.remove).not.toHaveBeenCalled();
  controller.appState(owner, false); controller.appState(owner, true); await Promise.resolve();
  expect(controller.getSnapshot().phase).toBe('idle');
  await controller.select(owner); await controller.continue(owner);
  controller.observe(owner, { ...environment, focused: false });
  await Promise.resolve();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(files.remove).not.toHaveBeenCalled();
});

test('fresh process/controller never restores or installs retained attempts automatically', async () => {
  const { controller } = setup(); await controller.enter();
  expect(controller.getSnapshot().phase).toBe('idle');
  expect(native.launchInstaller).not.toHaveBeenCalled();
  expect(native.openInstallPermissionSettings).not.toHaveBeenCalled();
});
