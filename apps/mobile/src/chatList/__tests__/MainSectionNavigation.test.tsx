import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text } from 'react-native';
import { act, fireEvent, renderRouter } from 'expo-router/testing-library';
import { router } from 'expo-router';
import TabsLayout from '../../../app/(main)/(tabs)/_layout';

// Expo Router's testing library installs its own mock. Use the workspace's mapped mock for the header.
jest.dontMock('react-native-reanimated');
const { default: MainLayout } = jest.requireActual<typeof import('../../../app/(main)/_layout')>(
  '../../../app/(main)/_layout',
);

jest.mock('../../components/AccountSwitcherPopover', () => ({ AccountSwitcherPopover: () => null }));
jest.mock('../../components/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('../useChatList', () => ({ useChatList: () => ({ active: [], archived: [], ignored: [] }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: false }) }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn() }));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => {
    const { avatarFills, color, typeTokens } = jest.requireActual('@dologram/shared');
    return { avatarFills, colors: color.light, typeTokens, reduceMotion: false };
  },
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('header tabs navigate, transfer the active label, and preserve mounted section state on narrow screens', () => {
  jest.useFakeTimers();
  const timing = jest.spyOn(Animated, 'timing');
  const getDimensions = Dimensions.get;
  const windowWidth = 320;
  jest.spyOn(Dimensions, 'get').mockImplementation((name) => (
    name === 'window' ? { ...getDimensions(name), width: windowWidth } : getDimensions(name)
  ));
  const mounts = jest.fn();
  const unmounts = jest.fn();
  function Chats() {
    const [count, setCount] = useState(0);
    useEffect(() => { mounts('chats'); return () => { unmounts('chats'); }; }, []);
    return <Pressable onPress={() => setCount((value) => value + 1)}><Text>Chats {count}</Text></Pressable>;
  }
  function Archive() {
    useEffect(() => { mounts('archive'); return () => { unmounts('archive'); }; }, []);
    return <Text>Archived chats</Text>;
  }
  function Ignored() {
    useEffect(() => { mounts('ignored'); return () => { unmounts('ignored'); }; }, []);
    return <Text>Ignored conversations</Text>;
  }
  const screen = renderRouter({
    '(main)/_layout': MainLayout,
    '(main)/(tabs)/_layout': TabsLayout,
    '(main)/(tabs)/index': Chats,
    '(main)/(tabs)/settings': () => <Text>Settings</Text>,
    '(main)/archive': Archive,
    '(main)/ignored': Ignored,
    '(main)/folders': () => <Text>Chat folders</Text>,
  }, { initialUrl: '/' });
  const tabs = [
    { section: 'chats', name: 'Chats', label: 'Chats', path: '/' },
    { section: 'folders', name: 'Folders', label: 'Folders', path: '/folders' },
    { section: 'archive', name: 'Archive', label: 'Archive', path: '/archive' },
    { section: 'ignored', name: 'Ignored chats', label: 'Ignored', path: '/ignored' },
    { section: 'settings', name: 'Profile. Offline, no network connection. Long press to switch accounts', label: 'Profile', path: '/settings' },
  ];
  function expectActiveTab(path: string) {
    expect(screen.getPathname()).toBe(path);
    const search = screen.getByRole('button', { name: 'Search chats and messages' });
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    let totalWidth = StyleSheet.flatten(search.props.style).width;
    for (const tab of tabs) {
      const active = tab.path === path;
      expect(screen.getByRole('tab', { name: tab.name, selected: active })).toBeTruthy();
      const frame = screen.getByTestId(`header-tab-frame-${tab.section}`);
      totalWidth += StyleSheet.flatten(frame.props.style).width;
      // Labels stay mounted during the UI-thread fade so interrupted transitions do not flicker.
      expect(screen.queryAllByText(tab.label)).toHaveLength(1);
    }
    expect(totalWidth).toBeLessThanOrEqual(windowWidth);
  }

  expectActiveTab('/');
  fireEvent.press(screen.getByText('Chats 0'));
  function pressTab(path: string) {
    const tab = tabs.find((item) => item.path === path)!;
    fireEvent.press(screen.getByRole('tab', { name: tab.name }));
  }

  for (const path of ['/folders', '/archive', '/ignored', '/', '/settings', '/', '/settings', '/archive', '/']) {
    timing.mockClear();
    pressTab(path);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: 250,
      easing: expect.any(Function),
      useNativeDriver: true,
    }));
    act(() => { jest.advanceTimersByTime(300); });
    expectActiveTab(path);
  }
  // Interrupt each fade before completion, as repeated header taps do on-device.
  for (const path of ['/ignored', '/archive', '/', '/folders', '/settings', '/ignored', '/']) {
    pressTab(path);
    act(() => { jest.advanceTimersByTime(50); });
    expectActiveTab(path);
  }
  act(() => { jest.advanceTimersByTime(300); });
  expectActiveTab('/');
  expect(screen.getByText('Chats 1')).toBeTruthy();
  expect(mounts.mock.calls).toEqual([['chats'], ['archive'], ['ignored']]);
  expect(unmounts).not.toHaveBeenCalled();
  act(() => { router.navigate('/archive'); });
  act(() => { jest.advanceTimersByTime(300); });
  act(() => { router.back(); });
  act(() => { jest.advanceTimersByTime(300); });
  expect(screen.getPathname()).toBe('/');
  screen.unmount();
  jest.clearAllTimers();
});
