import { config, strings } from '@dologram/shared';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { pickAttachments } from '../pickers';

jest.mock('expo-image-picker', () => ({ PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' }, requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-audio', () => ({ requestRecordingPermissionsAsync: jest.fn() }));
jest.mock('../../lib/ids', () => ({ ids: { mediaId: () => 'draft-id' } }));
jest.mock('expo-file-system', () => ({ File: class { type = 'image/jpeg'; size = 1000; } }));

const photo: ImagePicker.ImagePickerAsset = { uri: 'file:///photo.jpg', type: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg', width: 100, height: 100 };
const gallery = jest.mocked(ImagePicker.launchImageLibraryAsync);
const camera = jest.mocked(ImagePicker.launchCameraAsync);
const permission = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const microphone = jest.mocked(requestRecordingPermissionsAsync);

beforeEach(() => { jest.clearAllMocks(); permission.mockResolvedValue({ granted: true, canAskAgain: true, expires: 'never', status: ImagePicker.PermissionStatus.GRANTED }); });

test('camera denial starts no picker', async () => {
  permission.mockResolvedValue({ granted: false, canAskAgain: false, expires: 'never', status: ImagePicker.PermissionStatus.DENIED });
  expect((await pickAttachments('photo', 10)).errors).toEqual([strings.media.permissionDenied]);
  expect(camera).not.toHaveBeenCalled();
});
test('video microphone denial starts no camera', async () => {
  microphone.mockResolvedValue({ granted: false, canAskAgain: false, expires: 'never', status: ImagePicker.PermissionStatus.DENIED });
  expect((await pickAttachments('video', 10)).errors).toEqual([strings.media.permissionDenied]);
  expect(camera).not.toHaveBeenCalled();
});
test('system gallery cancellation preserves drafts', async () => {
  gallery.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickAttachments('gallery', 3)).toEqual({ attachments: [], errors: [] });
  expect(gallery).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 3, allowsMultipleSelection: true }));
});
test('gallery validates every type and accepts a supported photo', async () => {
  gallery.mockResolvedValue({ canceled: false, assets: [photo, { ...photo, mimeType: 'application/x-msdownload', fileName: 'bad.exe' }] });
  const result = await pickAttachments('gallery', 10);
  expect(result.attachments).toEqual([expect.objectContaining({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes: 1000 })]);
  expect(result.errors).toEqual([strings.media.unsupported('bad.exe')]);
});
test('count cap is checked before and after picker', async () => {
  expect((await pickAttachments('gallery', 0)).errors).toEqual([strings.media.tooMany]);
  expect(gallery).not.toHaveBeenCalled();
  gallery.mockResolvedValue({ canceled: false, assets: [photo, photo] });
  expect((await pickAttachments('gallery', 1)).errors).toEqual([strings.media.tooMany]);
});
test('documents are copied to readable cache and retain their file type', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///file.pdf', mimeType: 'application/pdf', name: 'file.pdf', lastModified: 0, size: 1000 }] });
  const result = await pickAttachments('file', config.media.maxAttachments);
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({ multiple: true, copyToCacheDirectory: true });
  expect(result.attachments[0]).toMatchObject({ mediaType: 'file', name: 'file.pdf' });
});
test('picker errors are visible', async () => {
  gallery.mockRejectedValue(new Error('provider unavailable'));
  expect((await pickAttachments('gallery', 10)).errors).toEqual([strings.media.pickerFailed]);
});
