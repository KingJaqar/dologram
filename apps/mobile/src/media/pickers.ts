import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { strings } from '@dologram/shared';
import { ids } from '../lib/ids';
import { attachmentRefusal, type DraftAttachment } from './model';
import type { MediaLibraryAsset } from '../components/MediaPickerPanel';

export type PickerKind = 'photo' | 'video' | 'gallery' | 'file';
export type PickedAttachments = { attachments: DraftAttachment[]; errors: string[] };

function mimeForAsset(asset: MediaLibraryAsset, fileType: string | null | undefined): string {
  if (fileType) return fileType;
  const extension = asset.filename.split('.').pop()?.toLowerCase();
  if (asset.mediaType === 'video') {
    return extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : 'video/mp4';
  }
  return extension === 'png' ? 'image/png' : extension === 'heic' ? 'image/heic' : 'image/jpeg';
}

export async function draftFromMediaLibraryAsset(asset: MediaLibraryAsset): Promise<{ attachment?: DraftAttachment; error?: string }> {
  try {
    const file = new File(asset.uri);
    const source: DraftAttachment = {
      id: ids.mediaId(),
      uri: asset.uri,
      name: asset.filename || (asset.mediaType === 'video' ? strings.media.cameraVideo : strings.media.cameraPhoto),
      mediaType: asset.mediaType,
      mime: mimeForAsset(asset, file.type),
      sizeBytes: file.size,
    };
    const refusal = attachmentRefusal(source, source.name);
    return refusal ? { error: refusal } : { attachment: source };
  } catch {
    return { error: strings.media.unreadable(asset.filename || strings.media.title) };
  }
}

export async function pickAttachments(kind: PickerKind, remaining: number): Promise<PickedAttachments> {
  if (remaining <= 0) return { attachments: [], errors: [strings.media.tooMany] };
  const result: PickedAttachments = { attachments: [], errors: [] };
  try {
    if (kind === 'photo' || kind === 'video') {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (!camera.granted) return { attachments: [], errors: [strings.media.permissionDenied] };
      if (kind === 'video' && !(await requestRecordingPermissionsAsync()).granted) {
        return { attachments: [], errors: [strings.media.permissionDenied] };
      }
    }
    // Android's system photo picker does not require broad media-library permission (SDK 57).
    const picked = kind === 'file'
      ? await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      : kind === 'gallery'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 1 })
        : await ImagePicker.launchCameraAsync({ mediaTypes: kind === 'video' ? ['videos'] : ['images'], quality: 1 });
    if (picked.canceled) return result;
    if (picked.assets.length > remaining) return { attachments: [], errors: [strings.media.tooMany] };
    for (const asset of picked.assets) {
      const name = 'name' in asset ? asset.name : asset.fileName ?? strings.media.title;
      try {
        const file = new File(asset.uri);
        const mediaType = kind === 'file' ? 'file' : 'type' in asset && asset.type === 'video' ? 'video' : 'photo';
        const source: DraftAttachment = {
          id: ids.mediaId(), uri: asset.uri, name,
          mediaType, mime: asset.mimeType ?? file.type, sizeBytes: file.size,
        };
        const refusal = attachmentRefusal(source, name);
        if (refusal) result.errors.push(refusal);
        else result.attachments.push(source);
      } catch { result.errors.push(strings.media.unreadable(name)); }
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { attachments: [], errors: [/permission|denied/i.test(message) ? strings.media.permissionDenied : strings.media.pickerFailed] };
  }
}
