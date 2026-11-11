import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, renderRouter } from 'expo-router/testing-library';
import { router } from 'expo-router';
import MainLayout from '../../../app/(main)/_layout';
import TabsLayout from '../../../app/(main)/(tabs)/_layout';

jest.mock('../../components/MainHeader', () => ({ MainHeader: () => null }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'navigation-test' } } }) }));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: jest.requireActual('@dologram/shared').color.light, reduceMotion: false }),
}));

test('switching all three sections preserves mounted content and local state', () => {
  jest.useFakeTimers();
  const mounts = jest.fn();
  const unmounts = jest.fn();
  function Chats() {
    const [count, setCount] = useState(0);
    useEffect(() => { mounts('chats'); return () => { unmounts('chats'); }; }, []);
    return <Pressable onPress={() => setCount((value) => value + 1)}><Text>Chats {count}</Text></Pressable>;
  }
  function Archive() {
    useEffect(() => { mounts('archive'); return () => { unmounts('archive'); }; }, []);
    return <Text>Archive</Text>;
  }
  function Ignored() {
    useEffect(() => { mounts('ignored'); return () => { unmounts('ignored'); }; }, []);
    return <Text>Ignored</Text>;
  }
  const screen = renderRouter({
    '(main)/_layout': MainLayout,
    '(main)/(tabs)/_layout': TabsLayout,
    '(main)/(tabs)/index': Chats,
    '(main)/(tabs)/settings': () => <Text>Settings</Text>,
    '(main)/archive': Archive,
    '(main)/ignored': Ignored,
  }, { initialUrl: '/' });
  fireEvent.press(screen.getByText('Chats 0'));
  for (const path of ['/archive', '/ignored', '/', '/settings', '/archive', '/', '/ignored', '/archive', '/']) {
    act(() => { router.navigate(path); });
    act(() => { jest.advanceTimersByTime(300); });
    expect(screen.getPathname()).toBe(path);
  }
  // Interrupt each fade before completion, as repeated header taps do on-device.
  for (const path of ['/ignored', '/archive', '/', '/archive', '/ignored', '/']) {
    act(() => { router.navigate(path); });
    act(() => { jest.advanceTimersByTime(50); });
  }
  act(() => { jest.advanceTimersByTime(300); });
  expect(screen.getPathname()).toBe('/');
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
  jest.useRealTimers();
});
