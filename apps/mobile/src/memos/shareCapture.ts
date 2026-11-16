import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import type { SharePayload } from 'expo-sharing';
import { saveMemoAttachment } from './assets';
import { withMemoStore } from './vault';
import type { MemoScope } from './lifecycle';
import type { DraftAttachment } from '../media/model';

export type CapturedShare = { operationId: string; itemId: string; kind: 'text' | 'attachment' };

function uuidFromHash(hash: string, offset = 0): string {
  const value = hash.slice(offset, offset + 32);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-${((Number.parseInt(value.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${value.slice(18, 20)}-${value.slice(20, 32)}`;
}

function filename(uri: string, index: number): string {
  const last = uri.split(/[\\/]/).pop()?.split('?')[0]?.trim();
  return last && last !== '.' && last !== '..' ? last.slice(0, 255) : `shared-file-${index + 1}`;
}

function mediaType(payload: SharePayload): DraftAttachment['mediaType'] {
  if (payload.shareType === 'image') return 'photo';
  if (payload.shareType === 'video') return 'video';
  if (payload.shareType === 'audio') return 'voice';
  return 'file';
}

function payloadValue(payload: SharePayload): string {
  const value = payload.value.trim();
  if (!value) throw new Error('The shared item is empty.');
  if (payload.shareType === 'text' || payload.shareType === 'url') {
    if ([...value].length > 4096) throw new Error('The shared text is too long for one memo item.');
    return value;
  }
  if (!/^(content|file|https?):/i.test(value)) throw new Error('The shared file grant is invalid or expired.');
  return value;
}

export async function captureSharedPayloads(scope: MemoScope, memoId: string, payloads: readonly SharePayload[]): Promise<CapturedShare[]> {
  if (payloads.length === 0) throw new Error('No shared content is waiting to be imported.');
  const captured: CapturedShare[] = [];
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const value = payloadValue(payload);
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify({ shareType: payload.shareType, mimeType: payload.mimeType ?? '', value }));
    const operationId = uuidFromHash(fingerprint);
    const itemId = uuidFromHash(fingerprint, 1);
    const job = await withMemoStore(scope, (store) => store.prepareShareJob(operationId, fingerprint, memoId, Date.now()));
    if (job.stage === 'committed') {
      captured.push({ operationId, itemId, kind: payload.shareType === 'text' || payload.shareType === 'url' ? 'text' : 'attachment' });
      continue;
    }
    try {
      if (payload.shareType === 'text' || payload.shareType === 'url') {
        await withMemoStore(scope, (store) => store.saveText(memoId, operationId, itemId, value, Date.now()), true);
        captured.push({ operationId, itemId, kind: 'text' });
      } else {
        const source = new File(value);
        if (!source.exists || !Number.isSafeInteger(source.size) || source.size < 0) throw new Error('The shared file grant is invalid or expired.');
        await saveMemoAttachment(scope, memoId, { id: itemId, uri: value, mediaType: mediaType(payload), mime: payload.mimeType || source.type || 'application/octet-stream', sizeBytes: source.size, name: filename(value, index) }, undefined, operationId);
        captured.push({ operationId, itemId, kind: 'attachment' });
      }
      await withMemoStore(scope, (store) => store.completeShareJob(operationId), true);
    } catch (error) {
      await withMemoStore(scope, (store) => store.failShareJob(operationId)).catch(() => undefined);
      throw error;
    }
  }
  return captured;
}

export function clearCapturedShares(): void { Sharing.clearSharedPayloads(); }
