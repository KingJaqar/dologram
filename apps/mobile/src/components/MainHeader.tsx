/** Persistent main navigation header for the Chats, Folders, Archive, and Settings routes. */
import React, { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { DoloGramHeader } from './DoloGramHeader';
import { useChatList } from '../chatList/useChatList';
import { useNetState } from '../net/netState';
import { classifyConnectionStatus } from '../net/connectionStatus';

type MainHeaderSection = 'chats' | 'archive' | 'ignored' | 'folders' | 'settings';

function getMainHeaderSection(segments: readonly string[]): MainHeaderSection | null {
  const [group, section, tab] = segments;
  if (group !== '(main)') return null;
  if (section === 'archive' || section === 'ignored' || section === 'folders') return section;
  if (section === 'blocked') return 'settings';
  if (section === '(tabs)') return tab === 'settings' ? 'settings' : 'chats';
  return null;
}

export function MainHeader() {
  const router = useRouter();
  const segments = useSegments();
  const net = useNetState();
  const { active, archived, ignored } = useChatList();
  // Global segments change before the outgoing native screen is frozen. Keep
  // its header mounted so the chat list cannot reflow into the status bar.
  const lastSection = useRef<MainHeaderSection>('chats');
  const activeSection = getMainHeaderSection(segments) ?? lastSection.current;
  useEffect(() => { lastSection.current = activeSection; }, [activeSection]);
  const unreadArchived = archived.filter((item) => item.unreadCount > 0);
  const unreadIgnored = ignored.filter((item) => item.unreadCount > 0);
  const unreadChats = active.filter((item) => item.unreadCount > 0);

  const openChats = useCallback(() => {
    if (activeSection === 'chats') return;
    router.navigate('/(main)/(tabs)');
  }, [activeSection, router]);

  return (
    <DoloGramHeader
      connectionStatus={classifyConnectionStatus(net)}
      onChatsPress={openChats}
      onFoldersPress={() => { if (activeSection !== 'folders') router.navigate('/(main)/folders'); }}
      onArchivePress={() => { if (activeSection !== 'archive') router.navigate('/(main)/archive'); }}
      onIgnoredPress={() => { if (activeSection !== 'ignored') router.navigate('/(main)/ignored'); }}
      onSearchPress={(originX) => router.navigate({ pathname: '/search', params: { originX: String(originX) } })}
      showArchive
      chatsCount={unreadChats.length}
      archivedCount={unreadArchived.length}
      ignoredCount={unreadIgnored.length}
      activeSection={activeSection}
      onProfilePress={() => {
        const routeSegments = segments as readonly string[];
        const isSettingsRoute = routeSegments[1] === '(tabs)' && routeSegments[2] === 'settings';
        if (!isSettingsRoute) router.navigate('/(main)/(tabs)/settings');
      }}
    />
  );
}
