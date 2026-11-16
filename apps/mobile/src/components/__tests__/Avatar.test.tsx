import React from 'react';
import { Image } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { Avatar } from '../Avatar';

const mockSign = jest.fn();
const mockBucket = jest.fn((_bucket: string) => ({ createSignedUrl: mockSign }));
jest.mock('../../lib/supabase', () => ({ supabase: { storage: { from: (bucket: string) => mockBucket(bucket) } } }));

beforeEach(() => jest.clearAllMocks());

test('signs profile and group paths from their own buckets and falls back on image failure', async () => {
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' }, error: null });
  const screen = render(<Avatar id="ada" displayName="Ada Lovelace" imageUrl="ada/avatar" />, { wrapper: ThemeProvider });
  await waitFor(() => expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe('https://example.com/photo.jpg'));
  expect(mockBucket).toHaveBeenLastCalledWith('avatars');
  expect(mockSign).toHaveBeenLastCalledWith('ada/avatar', 3600);
  fireEvent(screen.UNSAFE_getByType(Image), 'error');
  expect(screen.getByText('AL', { includeHiddenElements: true })).toBeTruthy();
  screen.rerender(<Avatar id="group" displayName="Study Group" imageUrl="group/avatar" imageBucket="chat-avatars" />);
  await waitFor(() => expect(mockBucket).toHaveBeenLastCalledWith('chat-avatars'));
  await waitFor(() => expect(screen.UNSAFE_getByType(Image)).toBeTruthy());
});

test('late signing responses cannot display another profile photo and removal clears the image', async () => {
  let finishFirst!: (result: unknown) => void;
  mockSign.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ data: { signedUrl: 'https://example.com/second.jpg' }, error: null });
  const screen = render(<Avatar id="first" displayName="First" imageUrl="first/avatar" />, { wrapper: ThemeProvider });
  screen.rerender(<Avatar id="second" displayName="Second" imageUrl="second/avatar" />);
  await waitFor(() => expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe('https://example.com/second.jpg'));
  await act(async () => { finishFirst({ data: { signedUrl: 'https://example.com/first.jpg' }, error: null }); });
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe('https://example.com/second.jpg');
  screen.rerender(<Avatar id="second" displayName="Second" imageUrl={null} />);
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  expect(screen.getByText('S', { includeHiddenElements: true })).toBeTruthy();
});
