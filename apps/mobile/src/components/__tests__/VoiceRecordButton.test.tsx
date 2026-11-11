import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { VoiceRecordButton } from '../VoiceRecordButton';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { strings } from '@dologram/shared';

const mockRecorder = { isRecording: false, uri: 'file:///voice.m4a', prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
const mockPermission = jest.fn();
const mockMode = jest.fn();
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { bitRate: 128000 } },
  requestRecordingPermissionsAsync: () => mockPermission(),
  setAudioModeAsync: (options: unknown) => mockMode(options),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ durationMillis: 1000 }),
}));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => { const react = jest.requireActual<typeof import('react')>('react'); react.useEffect(callback, [callback]); } }));
jest.mock('expo-file-system', () => ({ File: class { size = 1000; exists = true; delete = jest.fn(); } }));
jest.mock('../../lib/ids', () => ({ ids: { mediaId: () => 'voice' } }));
function wrapper({ children }: { children: React.ReactNode }) { return <ThemeProvider>{children}</ThemeProvider>; }
beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.isRecording = false;
  mockPermission.mockResolvedValue({ granted: true });
  mockMode.mockResolvedValue(undefined);
  mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
  mockRecorder.record.mockImplementation(() => { mockRecorder.isRecording = true; });
  mockRecorder.stop.mockImplementation(async () => { mockRecorder.isRecording = false; });
});
test('denied microphone permission never prepares or records', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  const error = jest.fn();
  const screen = render(<VoiceRecordButton disabled={false} onRecorded={jest.fn()} onError={error} />, { wrapper });
  await act(async () => fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressIn'));
  expect(error).toHaveBeenCalledWith(strings.media.permissionDenied);
  expect(mockRecorder.prepareToRecordAsync).not.toHaveBeenCalled();
  expect(mockRecorder.record).not.toHaveBeenCalled();
});
test('hold and release attaches one valid recording, including after another press-out', async () => {
  const recorded = jest.fn();
  const screen = render(<VoiceRecordButton disabled={false} onRecorded={recorded} onError={jest.fn()} />, { wrapper });
  await act(async () => fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressIn'));
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressOut'));
  await waitFor(() => expect(recorded).toHaveBeenCalledTimes(1));
  await act(async () => fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressOut'));
  expect(recorded).toHaveBeenCalledTimes(1);
  expect(recorded).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'voice', mime: 'audio/mp4', sizeBytes: 1000 }));
});
test('release during the permission prompt never starts a late recording', async () => {
  let resolve: ((value: { granted: boolean }) => void) | undefined;
  mockPermission.mockReturnValue(new Promise<{ granted: boolean }>((done) => { resolve = done; }));
  const screen = render(<VoiceRecordButton disabled={false} onRecorded={jest.fn()} onError={jest.fn()} />, { wrapper });
  fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressIn');
  fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressOut');
  await act(async () => { resolve?.({ granted: true }); });
  expect(mockRecorder.record).not.toHaveBeenCalled();
});
test('cancel drops the recording instead of attaching it', async () => {
  const recorded = jest.fn();
  const screen = render(<VoiceRecordButton disabled={false} onRecorded={recorded} onError={jest.fn()} />, { wrapper });
  await act(async () => fireEvent(screen.getByLabelText(strings.media.holdToRecord), 'pressIn'));
  await act(async () => fireEvent.press(screen.getByLabelText(strings.media.cancelRecording)));
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(recorded).not.toHaveBeenCalled();
});
