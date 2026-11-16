import 'server-only';
import { createAccountAuth } from '@dologram/admin-core';
declare global {
  var __dgAccountAuth: ReturnType<typeof createAccountAuth> | undefined;
}
/** Lazy configuration; builds and the sign-in screen need no backend connection. */
export function accountAuth() {
  return globalThis.__dgAccountAuth ??= createAccountAuth();
}
