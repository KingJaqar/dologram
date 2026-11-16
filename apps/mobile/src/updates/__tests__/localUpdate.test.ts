import { Directory, File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as native from '../../../modules/local-apk-update';
import { strings } from '@dologram/shared';
import { APK_MIME, updateErrorMessage, updateFiles } from '../localUpdate';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../../modules/local-apk-update', () => ({
  discardPickerCopy: jest.fn(), removeStagedAttempt: jest.fn(),
}));
jest.mock('../../lib/ids', () => ({ ids: { mediaId: jest.fn() } }));
jest.mock('expo-file-system', () => {
  const files = new Map<string, number>();
  const directories = new Set<string>();
  const failures: { copy?: Error } = {};
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/').replace(/\/$/, '');
    }
    get exists() { return directories.has(this.uri); }
    get name() { return this.uri.split('/').pop(); }
    create() { directories.add(this.uri); }
    list() { return [...directories].filter((uri) => uri.startsWith(this.uri + '/') && !uri.slice(this.uri.length + 1).includes('/')).map((uri) => new Directory(uri)); }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/');
    }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri) ?? 0; }
    async copy(destination: File) {
      if (failures.copy) throw failures.copy;
      files.set(destination.uri, this.size);
    }
  }
  return { Directory, File, Paths: { cache: 'file:///cache' }, __files: files, __directories: directories, __failures: failures };
});

const fs = jest.requireMock<{ __files: Map<string, number>; __directories: Set<string>; __failures: { copy?: Error } }>('expo-file-system');
const id = 'lu-1794450000000-00000000-0000-4000-8000-000000000000';

beforeEach(() => { jest.clearAllMocks(); fs.__files.clear(); fs.__directories.clear(); delete fs.__failures.copy; });

test('single APK MIME picker and explicit browse-all; cancellation never reopens picker', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });
  expect(await updateFiles.pick(false)).toBeNull();
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1);
  expect(DocumentPicker.getDocumentAsync).toHaveBeenLastCalledWith({ type: APK_MIME, multiple: false, copyToCacheDirectory: true });
  await updateFiles.pick(true);
  expect(DocumentPicker.getDocumentAsync).toHaveBeenLastCalledWith({ type: '*/*', multiple: false, copyToCacheDirectory: true });
});

test('validates picker boundary and preserves display name only', async () => {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [] });
  await expect(updateFiles.pick(false)).rejects.toEqual({ code: 'unreadable' });
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/file', name: '../../release.apk', lastModified: 0 }] });
  expect(await updateFiles.pick(false)).toEqual({ uri: 'content://provider/file', name: '../../release.apk' });
});

test('awaits native disk copy of large APK to an internally named cache path without consuming original', async () => {
  const original = 'file:///downloads/update.apk';
  fs.__files.set(original, 500 * 1024 * 1024);
  let complete: (() => void) | undefined;
  const copy = jest.spyOn(File.prototype, 'copy').mockImplementationOnce((destination) => new Promise<void>((resolve) => {
    complete = () => { fs.__files.set(destination.uri, 500 * 1024 * 1024); resolve(); };
  }));
  const staging = updateFiles.stage({ uri: original, name: '../../anything.apkm' }, id);
  expect(fs.__files.has(`file:///cache/local-updates/${id}/candidate.apk`)).toBe(false);
  expect(complete).toBeDefined();
  complete?.();
  expect(await staging).toBe(`file:///cache/local-updates/${id}/candidate.apk`);
  expect(fs.__files.get(original)).toBe(500 * 1024 * 1024);
  copy.mockRestore();
});

test('missing/empty file and full storage fail recoverably; names cannot escape cache', async () => {
  await expect(updateFiles.stage({ uri: 'file:///missing', name: 'a.apk' }, id)).rejects.toEqual({ code: 'unreadable' });
  fs.__files.set('content://original', 1024);
  fs.__failures.copy = new Error('ENOSPC');
  await expect(updateFiles.stage({ uri: 'content://original', name: 'a.apk' }, id)).rejects.toThrow('ENOSPC');
  await expect(updateFiles.remove('../queue')).rejects.toThrow('Invalid update attempt');
  expect(native.removeStagedAttempt).not.toHaveBeenCalled();
});

test('only old internally named directories expire, excluding live operation and recent handoffs', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1794550000000);
  const live = id.replace('000000000000', '000000000001');
  const recent = id.replace('1794450000000', '1794549999999');
  new Directory('file:///cache/local-updates').create();
  [id, live, recent, 'queued-attachments', '../unrelated'].forEach((name) => new Directory(`file:///cache/local-updates/${name}`).create());
  await updateFiles.sweep(live);
  expect(native.removeStagedAttempt).toHaveBeenCalledTimes(1);
  expect(native.removeStagedAttempt).toHaveBeenCalledWith(`file:///cache/local-updates/${id}/candidate.apk`);
  jest.restoreAllMocks();
});

test('failed cleanup is reported and safe to retry; selection cleanup delegates canonical ownership to native', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1794550000000);
  new Directory('file:///cache/local-updates').create();
  new Directory(`file:///cache/local-updates/${id}`).create();
  jest.mocked(native.removeStagedAttempt).mockRejectedValueOnce(new Error('disk failure'));
  await expect(updateFiles.sweep()).rejects.toThrow('Update cleanup failed');
  await expect(updateFiles.sweep()).resolves.toBeUndefined();
  await updateFiles.discardSelection({ uri: 'content://original', name: 'original.apk' });
  expect(native.discardPickerCopy).toHaveBeenCalledWith('content://original');
  jest.restoreAllMocks();
});

test.each(Object.entries(strings.localUpdate.errors))('specific %s errors are mapped without exposing file paths', (code, message) => {
  expect(updateErrorMessage({ code: `LOCAL_APK_UPDATE_${code.toUpperCase()}`, message: '/private/source.apk' })).toBe(message);
});

test('unknown errors are redacted and ENOSPC maps to storage recovery', () => {
  expect(updateErrorMessage(new Error('/private/secret.apk'))).toBe(strings.localUpdate.errors.unknown);
  expect(updateErrorMessage(new Error('ENOSPC /private/cache'))).toBe(strings.localUpdate.errors.storageFull);
});
