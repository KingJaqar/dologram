import { createIdGenerator } from '@dologram/shared';

// UUID access is deferred until a browser command needs an ID, never during prerender.
export const ids = createIdGenerator(() => crypto.randomUUID());
