/**
 * Text measurement and trimming shared by every limit (D-116).
 */

/** A character is a Unicode code point, exactly as Postgres char_length counts it. */
export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** Removes leading and trailing space, tab, line feed, carriage return, form feed and vertical tab. */
export function dgTrim(value: string): string {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '');
}

/** Blank means empty after trimming (D-116 rule 2). */
export function isBlank(value: string): boolean {
  return dgTrim(value) === '';
}
