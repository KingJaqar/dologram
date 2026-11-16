/** Escapes LIKE metacharacters so a user-supplied filter matches literal text. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, character => `\\${character}`);
}
