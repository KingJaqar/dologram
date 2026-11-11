/** Persistent main navigation header for the Chats, Folders, Archive, and Settings routes. */
import React, { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { updateOwnMember } from '@dologram/shared';
import { DoloGramHeader } from './DoloGramHeader';
import { useChatList } from '../chatList/useChatList';
import { useNetState } from '../net/netState';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { getLocalDatabase } from '../queue/db';
import { flushPendingReadStates } from '../chat/readState';
import { notifyCacheChange } from '../sync/cacheEvents';

type MainHeaderSection = 'chats' | 'archive' | 'ignored' | 'folders' | 'settings';

function getMainHeaderSection(segments: readonly string[]): MainHeaderSection | null {
  if (segments.includes('archive')) return 'archive';
  if (segments.includes('ignored')) return 'ignored';
  if (segments.includes('folders')) return 'folders';
  if (segments.includes('settings')) return 'settings';
  if (segments.includes('(tabs)') || segments.includes('index')) return 'chats';
  return null;
}

export function MainHeader() {
  const router = useRouter();
  const segments = useSegments();
  const net = useNetState();
  const { session } = useAuth();
  const { archived } = useChatList();
  // Global segments change before the outgoing native screen is frozen. Keep
  // its header mounted so the chat list cannot reflow into the status bar.
  const lastSection = useRef<MainHeaderSection>('chats');
  const activeSection = getMainHeaderSection(segments) ?? lastSection.current;
  useEffect(() => { lastSection.current = activeSection; }, [activeSection]);
  const unreadArchived = archived.filter((item) => item.unreadCount > 0);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !net.isConnected) return;
    let cancelled = false;
    void getLocalDatabase()
      .then((db) => flushPendingReadStates(
        db,
        (chatId, seq) => updateOwnMember(supabase, chatId, userId, { last_read_seq: seq }),
        async () => false,
      ))
      .then(() => {
        if (!cancelled) notifyCacheChange();
      })
      .catch(() => {
        // A later connection transition retries the pending read states.
      });
    return () => {
      cancelled = true;
    };
  }, [net.isConnected, session?.user.id]);

  const openChats = useCallback(() => {
    if (activeSection === 'chats') return;
    router.navigate('/(main)/(tabs)');
  }, [activeSection, router]);

  return (
    <DoloGramHeader
      onChatsPress={openChats}
      onFoldersPress={() => { if (activeSection !== 'folders') router.navigate('/folders'); }}
      onArchivePress={() => { if (activeSection !== 'archive') router.navigate('/archive'); }}
      onIgnoredPress={() => { if (activeSection !== 'ignored') router.navigate('/ignored'); }}
      onSearchPress={(originX) => router.navigate({ pathname: '/search', params: { originX: String(originX) } })}
      showArchive
      archivedCount={unreadArchived.length}
      activeSection={activeSection}
      onProfilePress={() => { if (activeSection !== 'settings') router.navigate('/(main)/(tabs)/settings'); }}
    />
  );
}
