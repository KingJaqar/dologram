import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { DoloGramHeader } from '../DoloGramHeader';

jest.mock('../TopBar', () => ({
  TopBar: ({ left }: { left: React.ReactNode }) => left,
}));
jest.mock('../HeaderNavActions', () => ({ HeaderNavActions: () => null }));
jest.mock('../Icon', () => ({ Icon: () => null }));

describe('DoloGramHeader', () => {
  test('uses the DoloGram logo as the chats navigation control', () => {
    const onChatsPress = jest.fn();
    const screen = render(
      <ThemeProvider>
        <DoloGramHeader onChatsPress={onChatsPress} onProfilePress={() => {}} />
      </ThemeProvider>,
    );

    const chatsControl = screen.getByRole('tab', { name: 'Chats' });
    fireEvent.press(chatsControl);

    expect(onChatsPress).toHaveBeenCalledTimes(1);
    expect(chatsControl.props.accessibilityState.selected).toBe(true);
    expect(screen.getAllByRole('tab', { name: 'Chats' })).toHaveLength(1);
  });

  test('exposes the folder screen beside the DoloGram logo', () => {
    const onFoldersPress = jest.fn();
    const screen = render(
      <ThemeProvider>
        <DoloGramHeader onChatsPress={() => {}} onFoldersPress={onFoldersPress} onProfilePress={() => {}} />
      </ThemeProvider>,
    );

    const foldersControl = screen.getByRole('tab', { name: 'Folders' });
    fireEvent.press(foldersControl);

    expect(onFoldersPress).toHaveBeenCalledTimes(1);
  });

  test('exposes the unread count on the Chats navigation control', () => {
    const screen = render(
      <ThemeProvider>
        <DoloGramHeader onChatsPress={() => {}} chatsCount={2} onProfilePress={() => {}} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('tab', { name: 'Chats, 2 unread' })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
