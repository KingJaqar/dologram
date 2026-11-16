import { requireOptionalNativeModule } from 'expo';

export const LOCAL_APK_UPDATE_MODULE_NAME = 'DoloGramLocalApkUpdate' as const;

export type LocalApkUpdateErrorCode =
  | 'unreadable'
  | 'invalidApk'
  | 'unsupportedApk'
  | 'wrongPackage'
  | 'wrongSigner'
  | 'sameVersion'
  | 'olderVersion'
  | 'permissionRequired'
  | 'settingsUnavailable'
  | 'installerUnavailable'
  | 'activityUnavailable'
  | 'staleAttempt'
  | 'invalidAttempt'
  | 'alreadyLaunched'
  | 'operationTimedOut'
  | 'moduleUnavailable'
  | 'unknown';

export interface InstalledApkInfo {
  applicationId: string;
  versionName: string;
  versionCode: string;
}

export interface CandidateApkInfo extends InstalledApkInfo {
  attemptId: string;
}

export interface InstallerHandoff {
  attemptId: string;
  status: 'handedOff';
}

export interface LocalApkUpdateNativeModule {
  getInstalledInfo(): Promise<InstalledApkInfo>;
  inspectCandidate(stagedFileUri: string, attemptId: string): Promise<CandidateApkInfo>;
  canRequestInstall(): Promise<boolean>;
  openInstallPermissionSettings(attemptId: string): Promise<{ opened: true }>;
  invalidateAttempt(attemptId: string): void;
  launchInstaller(stagedFileUri: string, attemptId: string): Promise<InstallerHandoff>;
  removeStagedAttempt(stagedFileUri: string): Promise<void>;
  discardPickerCopy(fileUri: string): Promise<void>;
}

export class LocalApkUpdateCapabilityError extends Error {
  readonly code: LocalApkUpdateErrorCode = 'moduleUnavailable';

  constructor() {
    super('Local APK update is unavailable in this app build.');
    this.name = 'LocalApkUpdateCapabilityError';
  }
}

export function getLocalApkUpdateModule(): LocalApkUpdateNativeModule | null {
  return requireOptionalNativeModule<LocalApkUpdateNativeModule>(LOCAL_APK_UPDATE_MODULE_NAME);
}

export function hasLocalApkUpdateCapability(): boolean {
  return getLocalApkUpdateModule() !== null;
}

function requireLocalApkUpdateModule(): LocalApkUpdateNativeModule {
  const module = getLocalApkUpdateModule();
  if (!module) {
    throw new LocalApkUpdateCapabilityError();
  }
  return module;
}

export function getInstalledInfo(): Promise<InstalledApkInfo> {
  return requireLocalApkUpdateModule().getInstalledInfo();
}

export function inspectCandidate(stagedFileUri: string, attemptId: string): Promise<CandidateApkInfo> {
  return requireLocalApkUpdateModule().inspectCandidate(stagedFileUri, attemptId);
}

export function canRequestInstall(): Promise<boolean> {
  return requireLocalApkUpdateModule().canRequestInstall();
}

export function openInstallPermissionSettings(attemptId: string): Promise<{ opened: true }> {
  return requireLocalApkUpdateModule().openInstallPermissionSettings(attemptId);
}

export function invalidateAttempt(attemptId: string): void {
  getLocalApkUpdateModule()?.invalidateAttempt(attemptId);
}

export function launchInstaller(stagedFileUri: string, attemptId: string): Promise<InstallerHandoff> {
  return requireLocalApkUpdateModule().launchInstaller(stagedFileUri, attemptId);
}

export function removeStagedAttempt(stagedFileUri: string): Promise<void> {
  return requireLocalApkUpdateModule().removeStagedAttempt(stagedFileUri);
}

export function discardPickerCopy(fileUri: string): Promise<void> {
  return requireLocalApkUpdateModule().discardPickerCopy(fileUri);
}
