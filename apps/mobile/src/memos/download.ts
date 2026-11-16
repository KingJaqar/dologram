export class MemoDownloadValidationError extends Error {}

/** Range responses are hints until their complete original bytes pass the digest check. */
export async function receiveMemoDownload(
  response: {
    status: number;
    headers: Pick<Headers, 'get'>;
    body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void>; releaseLock(): void } } | null;
  },
  offset: number,
  total: number,
  reset: () => void,
  append: (bytes: Uint8Array) => void,
): Promise<number> {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(total) || total < offset) throw new MemoDownloadValidationError('Memo download checkpoint is invalid.');
  let received = offset;
  let declaredEnd: number | null = null;
  if (response.status === 200) { reset(); received = 0; }
  else if (response.status === 206) {
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    if (!range || Number(range[1]) !== offset || Number(range[2]) < offset || Number(range[2]) >= total || Number(range[3]) !== total) throw new MemoDownloadValidationError('Memo download range does not match its checkpoint.');
    declaredEnd = Number(range[2]);
  } else throw new Error('Memo attachment download failed. Retry when online.');
  if (!response.body) throw new Error('Memo attachment download has no content.');
  const reader = response.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!chunk.value) throw new MemoDownloadValidationError('Memo download returned an invalid chunk.');
      received += chunk.value.byteLength;
      if (received > total) throw new MemoDownloadValidationError('Memo attachment length does not match.');
      append(chunk.value);
    }
    if (declaredEnd !== null && received !== declaredEnd + 1) throw new MemoDownloadValidationError('Memo download bytes do not match its declared range.');
    if (received !== total) throw new Error('Memo attachment download is incomplete. Retry to resume it.');
    return received;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
