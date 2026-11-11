import { config } from '../config';
import { codePointLength, dgTrim } from './text';

/** D-116 rule 4; Supabase Auth applies its own server rule. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/** D-47 and M0-05: at least 12 code points. */
export function validateNewPassword(password: string): boolean {
  return codePointLength(password) >= config.password.minLength;
}

/** D-89: `^[a-z][a-z0-9_]{4,31}$`, so a username is 5 to 32 characters. */
export function validateUsername(username: string): boolean {
  return config.profile.usernamePattern.test(username);
}

/** D-89: 1 to 64 characters after trimming. */
export function validateDisplayName(displayName: string): boolean {
  const length = codePointLength(dgTrim(displayName));
  return length >= 1 && length <= config.profile.displayNameMaxChars;
}
