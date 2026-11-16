import { createHash } from 'node:crypto';

/** Verify original bytes with bounded memory; the caller owns the request deadline. */
export async function verifyMemoAssetStream(body: ReadableStream<Uint8Array>, expectedBytes: number, expectedDigest: string | null): Promise<string> {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > 50 * 1024 * 1024) throw new Error('MEMO_QUOTA_EXCEEDED');
  if (expectedDigest !== null && !/^(md5:[a-f0-9]{32}|sha256:[a-f0-9]{64})$/.test(expectedDigest)) throw new Error('MEMO_INVALID_REQUEST');
  const algorithm = expectedDigest?.startsWith('md5:') ? 'md5' : 'sha256';
  const hash = createHash(algorithm);
  const reader = body.getReader();
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > expectedBytes) throw new Error('MEMO_ASSET_CHECKSUM_MISMATCH');
      hash.update(chunk.value);
    }
    const digest = `${algorithm}:${hash.digest('hex')}`;
    if (bytes !== expectedBytes || (expectedDigest !== null && digest !== expectedDigest)) throw new Error('MEMO_ASSET_CHECKSUM_MISMATCH');
    return digest;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
