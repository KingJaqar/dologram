import 'server-only';

export const actionRegistry = Object.freeze({
  signIn: 'public-sign-in',
  signOut: 'local-sign-out', generatePassword: 'session', createAccount: 'session', recoverAccountCreation: 'session',
  validateCsv: 'session', resetPassword: 'session', banAccount: 'session',
  unbanAccount: 'session', deleteAccount: 'session', setPremiumFlag: 'session',
  restoreProject: 'session', enterUsageByHand: 'session', runSettingsCheck: 'session',
  startExport: 'session', startMediaCopy: 'session', retryFailedMediaCopy: 'session',
  startPurgePreview: 'session', startPurge: 'session', markDrillDone: 'session',
  beginCsvImport: 'session', finishCsvImport: 'session',
} as const);

export function actionPolicy(name: string) {
  return Object.hasOwn(actionRegistry, name)
    ? actionRegistry[name as keyof typeof actionRegistry] : undefined;
}

