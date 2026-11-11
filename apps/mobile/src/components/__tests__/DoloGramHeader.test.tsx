import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { DoloGramHeader } from '../DoloGramHeader';

const mockHeaderNavActions = jest.fn((_props: { showChats?: boolean }) => null);

jest.mock('../TopBar', () => ({
  TopBar: ({ left }: { left: React.ReactNode }) => left,
}));
jest.mock('../HeaderNavActions', () => ({
  HeaderNavActions: (props: { showChats?: boolean }) => {
    mockHeaderNavActions(props);
    return null;
  },
}));
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
    expect(mockHeaderNavActions).toHaveBeenCalledWith(
      expect.objectContaining({ showChats: false }),
    );
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
});
