import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { strings } from '@dologram/shared';
import { MediaPickerPanel } from '../MediaPickerPanel';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn(), getAlbumsAsync: jest.fn(), getAssetsAsync: jest.fn(), getAssetInfoAsync: jest.fn(),
  MediaType: { photo: 'photo', video: 'video' }, SortBy: { creationTime: 'creationTime' },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../Icon', () => ({ Icon: () => null }));
jest.mock('../PhotoViewer', () => ({ PhotoViewer: () => null }));
jest.mock('../VideoPlayback', () => ({ VideoPlayback: () => null }));

const photos = jest.mocked(MediaLibrary.getAssetsAsync);
const asset = { id: 'one', uri: 'file:///one.jpg', filename: 'one.jpg', mediaType: 'photo', duration: 0 } as MediaLibrary.Asset;
const video = { ...asset, id: 'two', filename: 'two.mp4', mediaType: 'video', duration: 65 } as MediaLibrary.Asset;

function setup(maxSelection = 3) {
  const onDone = jest.fn();
  const onError = jest.fn();
  const screen = render(<ThemeProvider><MediaPickerPanel visible maxSelection={maxSelection} onClose={jest.fn()} onDone={onDone} onError={onError} /></ThemeProvider>);
  return { screen, onDone, onError };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: true } as MediaLibrary.PermissionResponse);
  jest.mocked(MediaLibrary.getAlbumsAsync).mockResolvedValue([{ id: 'camera', title: 'Camera', assetCount: 2 }] as MediaLibrary.Album[]);
  photos.mockResolvedValue({ assets: [asset, video], endCursor: 'two', hasNextPage: false, totalCount: 2 });
  jest.mocked(MediaLibrary.getAssetInfoAsync).mockResolvedValue({ ...asset, localUri: 'file:///resolved.jpg' } as MediaLibrary.AssetInfo);
});

afterEach(() => jest.useRealTimers());

test('recent gallery mixes photos and videos and keeps ordered selection across album changes', async () => {
  const { screen, onDone } = setup();
  await waitFor(() => expect(screen.getByLabelText('one.jpg')).toBeTruthy());
  expect(screen.getByText('1:05')).toBeTruthy();
  expect(photos).toHaveBeenCalledWith(expect.objectContaining({ mediaType: ['photo', 'video'] }));
  fireEvent.press(screen.getByLabelText('one.jpg'));
  fireEvent.press(screen.getByLabelText('Choose photo album'));
  fireEvent.press(screen.getByLabelText('Camera'));
  await waitFor(() => expect(photos).toHaveBeenCalledWith(expect.objectContaining({ album: 'camera' })));
  await waitFor(() => expect(screen.getByLabelText('one.jpg, selected 1')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Add selected media'));
  await waitFor(() => expect(onDone).toHaveBeenCalledWith([expect.objectContaining({ id: 'one', uri: 'file:///resolved.jpg' })]));
}, 20000);

test('selection limit leaves the current selection intact', async () => {
  const { screen, onError } = setup(1);
  await waitFor(() => expect(screen.getByLabelText('one.jpg')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('one.jpg'));
  fireEvent.press(screen.getByLabelText('two.mp4'));
  expect(onError).toHaveBeenCalledWith(strings.media.tooMany);
  expect(screen.getByLabelText('one.jpg, selected 1')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('one.jpg, selected 1'));
  expect(screen.queryByLabelText('Add selected media')).toBeNull();
});

test('long press previews media without changing the current selection', async () => {
  const { screen } = setup();
  await waitFor(() => expect(screen.getByLabelText('one.jpg')).toBeTruthy());

  expect(screen.queryByLabelText('View photo one.jpg')).toBeNull();
  expect(screen.queryByLabelText('Play video two.mp4, 1:05')).toBeNull();
  fireEvent(screen.getByLabelText('one.jpg'), 'longPress');
  expect(screen.getByText('Photo preview')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close photo preview'));
  expect(screen.queryByText('Photo preview')).toBeNull();

  fireEvent(screen.getByLabelText('two.mp4'), 'longPress');
  expect(screen.getByText('Video preview')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close video preview'));
  expect(screen.queryByText('Video preview')).toBeNull();
});

test('scrolling loads the next page without repeating the permission request', async () => {
  photos.mockResolvedValueOnce({ assets: [asset], endCursor: 'one', hasNextPage: true, totalCount: 2 });
  photos.mockResolvedValueOnce({ assets: [video], endCursor: 'two', hasNextPage: false, totalCount: 2 });
  const { screen } = setup();
  await waitFor(() => expect(screen.getByLabelText('one.jpg')).toBeTruthy());
  fireEvent(screen.getByLabelText('Recent media'), 'onEndReached');
  await waitFor(() => expect(screen.getByLabelText('two.mp4')).toBeTruthy());
  expect(photos).toHaveBeenLastCalledWith(expect.objectContaining({ after: 'one' }));
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('denied access has a retry action and no library enumeration', async () => {
  jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: false } as MediaLibrary.PermissionResponse);
  const { screen } = setup();
  await waitFor(() => expect(screen.getByLabelText('Allow photo access')).toBeTruthy());
  expect(photos).not.toHaveBeenCalled();
  expect(MediaLibrary.getAlbumsAsync).not.toHaveBeenCalled();
});
