import React from 'react';
import { render } from '@testing-library/react-native';
import { MainHeader } from '../MainHeader';

let mockSegments = ['(main)', 'archive'];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments, useRouter: () => ({ navigate: jest.fn() }) }));
jest.mock('../DoloGramHeader', () => ({ DoloGramHeader: ({ activeSection, chatsCount, ignoredCount }: { activeSection: string; chatsCount?: number; ignoredCount?: number }) => {
  const { Text } = jest.requireActual('react-native');
  return <Text>{activeSection} header {chatsCount} {ignoredCount}</Text>;
} }));
jest.mock('../../chatList/useChatList', () => ({ useChatList: () => ({ active: [{ unreadCount: 2 }], archived: [], ignored: [{ unreadCount: 1 }] }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: false }) }));
jest.mock('../../net/lowSignalPreferences', () => ({ useForceLowSignalMode: () => false }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn() }));
jest.mock('../Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

test('opening a chat keeps the outgoing list header mounted with its previous section', () => {
  const screen = render(<MainHeader />);
  expect(screen.getByText('archive header 1 1')).toBeTruthy();
  mockSegments = ['chat', '[chatId]'];
  screen.rerender(<MainHeader />);
  expect(screen.getByText('archive header 1 1')).toBeTruthy();
  mockSegments = ['(main)', '(tabs)'];
  screen.rerender(<MainHeader />);
  expect(screen.getByText('chats header 1 1')).toBeTruthy();
});
