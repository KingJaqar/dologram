/**
 * Client-generated UUIDs (D-10, D-100). The caller supplies the UUID source: expo-crypto's
 * `Crypto.randomUUID` on mobile and `crypto.randomUUID` on web.
 */
export type IdGenerator = {
  messageId(): string;
  mediaId(): string;
  chatId(): string;
  folderId(): string;
};

export function createIdGenerator(randomUUID: () => string): IdGenerator {
  return {
    messageId: () => randomUUID(),
    mediaId: () => randomUUID(),
    chatId: () => randomUUID(),
    folderId: () => randomUUID(),
  };
}
