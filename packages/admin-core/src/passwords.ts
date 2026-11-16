import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';

/**
 * D-105 generated password: 16 characters from this 56-character alphabet. I, O, l,
 * o, 0 and 1 are absent so a password copied by hand cannot be misread.
 */
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export const PASSWORD_LENGTH = 16;
/** Bounded lifetime of one server-minted password draft. */
export const PASSWORD_DRAFT_TTL_MS = 10 * 60 * 1000;
const MAX_DRAFTS = 32;

/** Injected uniform index source; production always uses `crypto.randomInt`. */
export type RandomIndex = (maxExclusive: number) => number;

function pick(randomIndex: RandomIndex): string {
  const index = randomIndex(PASSWORD_ALPHABET.length);
  const character = Number.isInteger(index) ? PASSWORD_ALPHABET.charAt(index) : '';
  if (character === '') throw new Error('Random index is outside the password alphabet.');
  return character;
}

export function generatePassword(randomIndex: RandomIndex = max => randomInt(max)): string {
  let password = '';
  for (let position = 0; position < PASSWORD_LENGTH; position += 1) password += pick(randomIndex);
  return password;
}

/** The length/alphabet check of D-105; it never proves who generated the value. */
export function isGeneratedPassword(value: string): boolean {
  if (value.length !== PASSWORD_LENGTH) return false;
  for (const character of value) {
    if (!PASSWORD_ALPHABET.includes(character)) return false;
  }
  return true;
}

interface PasswordDraft {
  password: string;
  sessionId: string;
  expiresAt: number;
}

declare global {
  var __dgPasswordDrafts: Map<string, PasswordDraft> | undefined;
}

/** Server-process memory only: only the preview and opaque ID reach the browser. */
function draftStore(): Map<string, PasswordDraft> {
  return globalThis.__dgPasswordDrafts ??= new Map();
}

function prune(now: number): void {
  const drafts = draftStore();
  for (const [id, draft] of drafts) {
    if (draft.expiresAt <= now) drafts.delete(id);
  }
}

export interface PasswordDraftPreview {
  /** Opaque reference the browser submits instead of a password. */
  passwordDraftId: string;
  password: string;
  expiresAt: number;
}

/**
 * Mints one draft bound to a verified local session. Regenerating replaces the
 * session's previous draft, so a superseded id can never be consumed.
 */
export function mintPasswordDraft(
  options: { sessionId: string; now?: number; randomIndex?: RandomIndex },
): PasswordDraftPreview {
  const now = options.now ?? Date.now();
  const drafts = draftStore();
  prune(now);
  for (const [id, draft] of drafts) {
    if (draft.sessionId === options.sessionId) drafts.delete(id);
  }
  if (drafts.size >= MAX_DRAFTS) {
    const oldest = drafts.keys().next().value;
    if (oldest !== undefined) drafts.delete(oldest);
  }
  const password = generatePassword(options.randomIndex);
  const passwordDraftId = randomUUID();
  const expiresAt = now + PASSWORD_DRAFT_TTL_MS;
  drafts.set(passwordDraftId, { password, sessionId: options.sessionId, expiresAt });
  return { passwordDraftId, password, expiresAt };
}

export type PasswordDraftFailure = 'unknown' | 'expired' | 'foreign';

/**
 * Single-use consumption. A draft from another session is refused without being
 * removed, so a forged request cannot destroy the legitimate caller's draft.
 */
export function consumePasswordDraft(
  options: { passwordDraftId: string; sessionId: string; now?: number },
): { ok: true; password: string } | { ok: false; reason: PasswordDraftFailure } {
  const now = options.now ?? Date.now();
  const drafts = draftStore();
  const draft = drafts.get(options.passwordDraftId);
  if (!draft) return { ok: false, reason: 'unknown' };
  if (draft.expiresAt <= now) {
    drafts.delete(options.passwordDraftId);
    return { ok: false, reason: 'expired' };
  }
  if (draft.sessionId !== options.sessionId) return { ok: false, reason: 'foreign' };
  drafts.delete(options.passwordDraftId);
  return { ok: true, password: draft.password };
}
