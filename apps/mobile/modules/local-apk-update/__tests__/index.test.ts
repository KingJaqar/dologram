import { requireOptionalNativeModule } from 'expo';

import {
  getInstalledInfo,
  getLocalApkUpdateModule,
  hasLocalApkUpdateCapability,
  inspectCandidate,
  launchInstaller,
  LocalApkUpdateCapabilityError,
  type LocalApkUpdateNativeModule,
} from '../index';

jest.mock('expo', () => ({
  requireOptionalNativeModule: jest.fn(),
}));

const getOptionalModule = jest.mocked(requireOptionalNativeModule);

function createNativeModule(): LocalApkUpdateNativeModule {
  return {
    getInstalledInfo: jest.fn().mockResolvedValue({
      applicationId: 'com.dologram.app',
      versionName: '1.0.0',
      versionCode: '1',
    }),
    inspectCandidate: jest.fn().mockResolvedValue({
      applicationId: 'com.dologram.app',
      versionName: '1.0.1',
      versionCode: '2',
      attemptId: 'attempt-1',
    }),
    canRequestInstall: jest.fn().mockResolvedValue(true),
    openInstallPermissionSettings: jest.fn().mockResolvedValue({ opened: true }),
    invalidateAttempt: jest.fn(),
    removeStagedAttempt: jest.fn().mockResolvedValue(undefined),
    discardPickerCopy: jest.fn().mockResolvedValue(undefined),
    launchInstaller: jest.fn().mockResolvedValue({ attemptId: 'attempt-1', status: 'handedOff' }),
  };
}

describe('local APK update native adapter', () => {
  beforeEach(() => {
    getOptionalModule.mockReset();
  });

  it('reports missing native capability without throwing during import', () => {
    getOptionalModule.mockReturnValue(null);

    expect(getLocalApkUpdateModule()).toBeNull();
    expect(hasLocalApkUpdateCapability()).toBe(false);
    expect(() => getInstalledInfo()).toThrow(LocalApkUpdateCapabilityError);
  });

  it('delegates typed inspection and installer handoff to the native module', async () => {
    const nativeModule = createNativeModule();
    getOptionalModule.mockReturnValue(nativeModule);

    await expect(inspectCandidate('file:///cache/candidate.apk', 'attempt-1')).resolves.toMatchObject({
      versionCode: '2',
    });
    await expect(launchInstaller('file:///cache/candidate.apk', 'attempt-1')).resolves.toEqual({
      attemptId: 'attempt-1',
      status: 'handedOff',
    });
    expect(nativeModule.inspectCandidate).toHaveBeenCalledWith('file:///cache/candidate.apk', 'attempt-1');
    expect(nativeModule.launchInstaller).toHaveBeenCalledWith('file:///cache/candidate.apk', 'attempt-1');
  });
});
