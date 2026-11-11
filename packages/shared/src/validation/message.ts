import { config } from '../config';
import { codePointLength, isBlank } from './text';export { dgTrim, isBlank } from './text';
export type MessageTextResult
 =
  | { ok: true }
  | { ok: false; reason: 'blank' | 'tooLong' };

/**
 * D-30, D-90 and D-116: at most 4096 code points, and blank text is refused only when the message
 * has no attachment (PF-13).
 */
export function validateMessageText(content: string, attachmentCount: number): MessageTextResult {
  if (codePointLength(content) > config.message.maxChars) {
    return { ok: false, reason: 'tooLong' };
  }
  if (attachmentCount === 0 && isBlank(content)) {
    return { ok: false, reason: 'blank' };
  }
  return { ok: true };
}
