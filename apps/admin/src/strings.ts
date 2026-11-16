export const strings = {
  common: {
    retry: 'Retry', cancel: 'Cancel', copy: 'Copy', copied: 'Copied',
    unavailable: 'unavailable', openDashboard: 'Open Dashboard',
    enterByHand: 'Enter by hand', checkByHand: 'Check by hand', refused: 'Request refused.',
    loading: 'Loading', requestFailed: 'The request could not be completed. Try again.',
  },
  confirm: { typeToConfirm: (value: string) => `Type ${value} to confirm` },
  password: {
    label: 'Generated password', warning: 'This password is shown once. Copy it now.',
    copyFallback: 'Press Ctrl+C to copy', regenerate: 'Regenerate', downloadCsv: 'Download as CSV',
  },
  audit: {
    label: 'Audit log', allActions: 'All actions', action: 'Action', target: 'Filter by target',
    time: 'Time', username: 'Target username', result: 'Result', detail: 'Detail',
    showDetail: 'Show detail', hideDetail: 'Hide detail', empty: 'No actions yet',
  },
  usage: {
    warning: '80%+', reached: 'Limit reached',
    summary: (used: string, limit: string, percent: string) => `${used} of ${limit} (${percent}%)`,
    entered: (date: string) => `Entered by hand on ${date}`,
  },
  job: {
    run: 'Run', retryFailed: 'Retry failed', never: 'Never',
    lastRun: (date: string) => `Last run ${date}`, running: 'Running', log: 'Job log',
  },
  table: {
    label: 'Data table', previous: 'Previous', next: 'Next',
    range: (first: number, last: number, total: number) => `${first}-${last} of ${total}`,
  },
  accounts: {
    label: 'Accounts', search: 'Search by username or email', all: 'All',
    username: 'Username', displayName: 'Display name', email: 'Email',
    created: 'Created', lastSignIn: 'Last sign-in', status: 'Status', premium: 'Premium',
    empty: 'No accounts match', never: 'Never',
  },
  createAccount: {
    pageTitle: 'Create account', single: 'Single', csv: 'CSV', tabsLabel: 'Create account mode',
    formTitle: 'Account details', submit: 'Create', generating: 'Generating a password…',
    emailInvalid: 'Enter a valid email address.',
    usernameInvalid: 'Username must be 5 to 32 characters: a lowercase letter, then lowercase letters, digits or underscores.',
    displayNameInvalid: 'Display name must be 1 to 64 characters.',
    passwordUnavailable: 'The generated password is unavailable. Generate a new password and try again.',
    created: 'Account created.', openAccount: 'Open account',
    auditFailed: 'The audit entry could not be written. The account exists, so do not create it again.',
    recover: 'Recover account creation',
    recoveryRequired: 'The result could not be confirmed. Recover this operation before creating another account or generating another password.',
    refreshFailed: 'The account exists, but the accounts list could not be refreshed. Reload the list to see the current status.',
  },
  status: {
    active: 'Active', banned: 'Banned', mustChangePassword: 'Must change password', admin: 'Admin',
    pass: 'Pass', fail: 'Fail', due: 'Due', overdue: 'Overdue', success: 'Success', failed: 'Failed',
    premiumBadge: 'badge', premiumExtraReactions: 'extra_reactions', premiumStickers: 'premium_stickers',
  },
} as const;
