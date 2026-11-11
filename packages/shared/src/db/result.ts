import type { ClassifiedError } from '../errors';

/** Every repository call resolves to either data or a classified error, never both. */
export type DgResult<T> = { data: T; error: null } | { data: null; error: ClassifiedError };
