import { MemoDownloadValidationError, receiveMemoDownload } from '../download';
import { ReadableStream } from 'node:stream/web';

const response = (status: number, range: string | null, bytes: number[]) => ({
  status, headers: { get: () => range },
  body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(Uint8Array.from(bytes)); controller.close(); } }),
});
test('resumes exact ranges, restarts when the provider ignores Range, and bounds every append', async () => {
  let bytes = [1, 2];
  const reset = () => { bytes = []; };
  const append = (chunk: Uint8Array) => { bytes.push(...chunk); };
  await receiveMemoDownload(response(206, 'bytes 2-3/4', [3, 4]), 2, 4, reset, append);
  expect(bytes).toEqual([1, 2, 3, 4]);
  bytes = [9, 9];
  await receiveMemoDownload(response(200, null, [1, 2, 3, 4]), 2, 4, reset, append);
  expect(bytes).toEqual([1, 2, 3, 4]);
  await expect(receiveMemoDownload(response(206, 'bytes 1-3/4', [3, 4]), 2, 4, reset, append)).rejects.toBeInstanceOf(MemoDownloadValidationError);
  await expect(receiveMemoDownload(response(200, null, [1, 2, 3, 4, 5]), 0, 4, reset, append)).rejects.toBeInstanceOf(MemoDownloadValidationError);
});
test('retains a valid partial prefix for retry without claiming a complete download', async () => {
  let bytes: number[] = [];
  await expect(receiveMemoDownload(response(200, null, [1, 2]), 0, 4, () => { bytes = []; }, (chunk) => { bytes.push(...chunk); })).rejects.toThrow('incomplete');
  expect(bytes).toEqual([1, 2]);
  await receiveMemoDownload(response(206, 'bytes 2-3/4', [3, 4]), bytes.length, 4, () => { bytes = []; }, (chunk) => { bytes.push(...chunk); });
  expect(bytes).toEqual([1, 2, 3, 4]);
});
