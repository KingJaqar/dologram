import { config } from '../config';
import { codePointLength, dgTrim } from './text';

/** D-109 rule 3: a group title is 1 to 64 characters after trimming. */
export function validateGroupTitle(title: string): boolean {
  const length = codePointLength(dgTrim(title));
  return length >= 1 && length <= config.groups.titleMaxChars;
}

/** D-94: a folder name is 1 to 32 characters after trimming. */
export function validateFolderName(name: string): boolean {
  const length = codePointLength(dgTrim(name));
  return length >= 1 && length <= config.folders.nameMaxChars;
}
