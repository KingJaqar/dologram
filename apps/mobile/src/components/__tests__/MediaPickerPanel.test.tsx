import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { GestureDetector, type Gesture } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { strings } from '@dologram/shared';
import { MediaPickerPanel } from '../MediaPickerPanel';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));
jest.mock('expo-media-library/legacy', () => {
  throw new Error('Cannot find native module ExpoMediaLibrary');
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../Icon', () => ({ Icon: () => null }));
jest.mock('../PhotoViewer', () => ({ PhotoViewer: () => null }));
jest.mock('../VideoPlayback', () => ({ VideoPlayback: () => null }));

const gallery = jest.mocked(ImagePicker.launchImageLibraryAsync);
const photo: ImagePicker.ImagePickerAsset = {
  uri: 'file:///photo.jpg', fileName: 'photo.jpg', type: 'image', width: 100, height: 100,
};

function setup(maxSelection = 3) {
  const onDone = jest.fn();
  const onError = jest.fn();
  const screen = render(
    <ThemeProvider>
      <MediaPickerPanel visible maxSelection={maxSelection} onClose={jest.fn()} onDone={onDone} onError={onError} />
    </ThemeProvider>,
  );
  return { screen, onDone, onError };
}

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function setupDrag() {
  const sharedValues = jest.spyOn(Reanimated, 'useSharedValue');
  const { screen } = setup();
  await act(async () => { jest.runOnlyPendingTimers(); });
  const gesture = screen.UNSAFE_getByType(GestureDetector).props.gesture as ReturnType<typeof Gesture.Pan>;
  const panelHeight = sharedValues.mock.results[0].value as { value: number };
  const windowHeight = Dimensions.get('window').height;
  const min = Math.min(340, Math.max(280, windowHeight * 0.34));
  const max = Math.min(620, Math.max(min + 80, windowHeight * 0.72));
  return { screen, gesture, panelHeight, min, max };
}

type PanEvent = Parameters<NonNullable<ReturnType<typeof Gesture.Pan>['handlers']['onBegin']>>[0];
function panEvent(absoluteY: number, translationY = 0, velocityY = 0): PanEvent {
  return { absoluteY, translationY, velocityY } as PanEvent;
}

test('dragging follows the finger even when resizing changes relative gesture coordinates', async () => {
  const { gesture, panelHeight, max } = await setupDrag();
  const initialHeight = panelHeight.value;
  act(() => gesture.handlers.onBegin!(panEvent(600)));

  // Layout moves the gesture root, so its relative translation can bounce
  // while the finger stays still or continues steadily upward.
  for (const translation of [-20, 0, -20, 0]) {
    act(() => gesture.handlers.onUpdate!(panEvent(580, translation)));
    expect(panelHeight.value).toBe(Math.min(max, initialHeight + 20));
  }
  act(() => gesture.handlers.onUpdate!(panEvent(560, 0)));
  expect(panelHeight.value).toBe(Math.min(max, initialHeight + 40));
  act(() => gesture.handlers.onUpdate!(panEvent(590, -40)));
  expect(panelHeight.value).toBe(Math.min(max, initialHeight + 10));
});

test('dragging clamps height at both limits without oscillating', async () => {
  const { gesture, panelHeight, min, max } = await setupDrag();
  act(() => gesture.handlers.onBegin!(panEvent(600)));
  for (const translation of [-400, 0, -400]) {
    act(() => gesture.handlers.onUpdate!(panEvent(-10000, translation)));
    expect(panelHeight.value).toBe(max);
  }
  for (const translation of [400, 0, 400]) {
    act(() => gesture.handlers.onUpdate!(panEvent(10000, translation)));
    expect(panelHeight.value).toBe(min);
  }
});

test.each([
  { distance: -70, velocity: 1200, expanded: false },
  { distance: 70, velocity: -1200, expanded: true },
])('release follows final velocity after reversing a drag: $velocity', async ({ distance, velocity, expanded }) => {
  const { screen, gesture, panelHeight, min, max } = await setupDrag();
  act(() => gesture.handlers.onBegin!(panEvent(600)));
  act(() => gesture.handlers.onUpdate!(panEvent(600 + distance, distance)));
  act(() => gesture.handlers.onEnd!(panEvent(600 + distance, distance, velocity), true));
  expect(panelHeight.value).toBe(expanded ? max : min);
  expect(screen.getByLabelText(expanded ? 'Collapse media picker' : 'Expand media picker')).toBeTruthy();
});

test('a new drag cancels the snap animation and starts from the current height', async () => {
  const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  const { gesture, panelHeight, min } = await setupDrag();
  // An interrupted snap can leave the panel between its two snap points.
  panelHeight.value = min + 30;
  act(() => gesture.handlers.onBegin!(panEvent(500)));
  expect(cancel).toHaveBeenLastCalledWith(panelHeight);
  act(() => gesture.handlers.onUpdate!(panEvent(510, -100)));
  expect(panelHeight.value).toBe(min + 20);
});

test('missing native library does not crash and system picker returns readable assets', async () => {
  gallery.mockResolvedValue({ canceled: false, assets: [photo] });
  const { screen, onDone } = setup();
  fireEvent.press(screen.getByLabelText('Open device gallery'));
  await waitFor(() => expect(onDone).toHaveBeenCalledWith([
    { id: photo.uri, uri: photo.uri, filename: 'photo.jpg', mediaType: 'photo' },
  ]));
  expect(gallery).toHaveBeenCalledWith(expect.objectContaining({
    mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 3,
  }));
});

test('video tab uses the video system picker and cancellation preserves the draft', async () => {
  gallery.mockResolvedValue({ canceled: true, assets: null });
  const { screen, onDone, onError } = setup();
  fireEvent.press(screen.getByLabelText('Choose photo album'));
  fireEvent.press(screen.getByLabelText('Videos'));
  fireEvent.press(screen.getByLabelText('Open device gallery'));
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  expect(gallery).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['videos'] }));
  expect(onDone).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

test('system picker enforces attachment count even if the platform exceeds its limit', async () => {
  gallery.mockResolvedValue({ canceled: false, assets: [photo, photo] });
  const { screen, onDone, onError } = setup(1);
  fireEvent.press(screen.getByLabelText('Open device gallery'));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(strings.media.tooMany));
  expect(onDone).not.toHaveBeenCalled();
});

test('system picker failures are reported without crashing', async () => {
  gallery.mockRejectedValue(new Error('picker unavailable'));
  const { screen, onDone, onError } = setup();
  fireEvent.press(screen.getByLabelText('Open device gallery'));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(strings.media.pickerFailed));
  expect(onDone).not.toHaveBeenCalled();
});
