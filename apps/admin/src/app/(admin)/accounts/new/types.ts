export type CreateAccountField = 'email' | 'username' | 'displayName';

export type CreateAccountActionResult =
  | { ok: true; userId: string; password: string; auditRecorded: boolean; operationId?: string; refreshFailed?: boolean }
  | { ok: false; field?: CreateAccountField; message: string; userId?: string; operationId?: string };

export type RecoverCreationActionResult =
  | { ok: true; userId: string; auditRecorded: boolean; refreshFailed?: boolean }
  | { ok: false; message: string; userId?: string };

export type GeneratePasswordResult =
  | { ok: true; password: string; passwordDraftId: string }
  | { ok: false; message: string };
