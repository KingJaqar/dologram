import 'server-only';
import { createSessionStore } from './sessionStore';
export { createSessionStore, IDLE_MS } from './sessionStore';
declare global {
  var __dgAdminAccountsV1: ReturnType<typeof createSessionStore> | undefined;
}
export const sessionStore = globalThis.__dgAdminAccountsV1 ??= createSessionStore();
