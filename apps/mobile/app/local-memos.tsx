import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { memoListKey, memoSearchFilterLabel, strings, type MemoSearchFilter } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { Button } from '../src/components/Button';
import { TopBar } from '../src/components/TopBar';
import { ChatRow } from '../src/components/ChatRow';
import { useMemoAccess } from '../src/memos/MemoProvider';
import { authorizeOfflineMemo, enrolledMemoAccounts, withMemoStore } from '../src/memos/vault';
import { closeMemoSession, memoGeneration, setMemoScope } from '../src/memos/lifecycle';
import { useMemos } from '../src/memos/useMemos';
import { memoConversation } from '../src/memos/conversations';
import { NewConversationMenu } from '../src/memos/NewConversationMenu';
import { MemoOrganizationActions } from '../src/memos/MemoOrganizationActions';
import { formatMemoBytes, permanentlyRemoveMemo } from '../src/memos/assets';
import { getLocalDatabase } from '../src/queue/db';
import { loadCachedFolders, type LocalFolder } from '../src/folders/cache';
import { FilterTabs } from '../src/components/FilterTabs';

const MEMO_FILTERS: readonly MemoSearchFilter[] = ['all', 'messages', 'photos', 'videos', 'photosVideos', 'audios', 'files', 'links', 'others'];

export default function LocalMemosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { scope } = useMemoAccess();
  const [contentFilter, setContentFilter] = useState<MemoSearchFilter>('all');
  const { memos, trash, links, error, loading, reload, accounting: loadedAccounting, largest: loadedLargest, counts: loadedCounts } = useMemos(contentFilter);
  const accounting = loadedAccounting ?? { live_bytes: 0, trash_bytes: 0, staging_bytes: 0, repair_bytes: 0, total_bytes: 0 };
  const largest = loadedLargest ?? [];
  const counts = loadedCounts ?? { all: 0, messages: 0, photos: 0, videos: 0, photosVideos: 0, audios: 0, files: 0, links: 0, others: 0 };
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [section, setSection] = useState<'active' | 'unread' | 'starred' | 'archived' | 'ignored' | 'trash'>('active');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [folderSnapshot, setFolderSnapshot] = useState<{ generation: number; folders: LocalFolder[] } | null>(null);
  useEffect(() => {
    if (!scope?.offline) return;
    let active = true;
    void getLocalDatabase().then((db) => loadCachedFolders(db, scope.accountId)).then((folders) => {
      if (active) setFolderSnapshot({ generation: scope.generation, folders });
    }).catch(() => { if (active) setFailure('Cached folders could not be loaded. Local memos remain available.'); });
    return () => { active = false; };
  }, [scope]);
  useEffect(() => {
    let active = true;
    void enrolledMemoAccounts().then((ids) => { if (active) setAccounts(ids); }).catch((cause: unknown) => {
      if (active) setFailure(cause instanceof Error ? cause.message : strings.memos.noAccounts);
    });
    return () => { active = false; };
  }, []);
  const choose = async (accountId: string) => {
    if (busy) return;
    const generation = memoGeneration();
    setBusy(true);
    try { await authorizeOfflineMemo(accountId); if (mounted.current && memoGeneration() === generation) { setMemoScope(accountId, true); setFailure(null); } }
    catch (cause: unknown) { if (mounted.current && memoGeneration() === generation) setFailure(cause instanceof Error ? cause.message : strings.memos.noAccounts); }
    finally { if (mounted.current) setBusy(false); }
  };
  const visibleMemos = section === 'trash' ? trash : memos.filter((memo) => section === 'ignored' ? Boolean(memo.ignored) : !memo.ignored && Boolean(memo.archived) === (section === 'archived'))
    .filter((memo) => section === 'unread' ? Boolean(memo.unread) : section === 'starred' ? Boolean(memo.pinned) : true);
  const selectedMemo = memos.find((memo) => memoListKey(memo.memo_id) === organizationId);
  const localFolders = folderSnapshot?.generation === scope?.generation ? folderSnapshot?.folders ?? [] : [];
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
    <TopBar title={strings.memos.library} onBack={() => { void closeMemoSession().then(() => router.replace('/sign-in')).catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); }} />
    <Text style={[textStyle(theme.typeTokens.bodySm), { padding: 16, color: theme.colors.text.secondary }]}>{strings.memos.offlineHelp}</Text>
    {failure || error ? <View style={{ padding: 16 }}><Text accessibilityRole="alert" style={{ color: theme.colors.error.text }}>{failure ?? error}</Text><Button label={strings.common.retry} onPress={() => void reload()} /></View> : null}
    {!scope?.offline ? <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {accounts?.map((id) => <Button key={id} label={`Account ${id.slice(-8)}`} disabled={busy} onPress={() => void choose(id)} />)}
      <Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.primary }]}>{accounts?.length === 0 ? strings.memos.noAccounts : accounts === null && !failure ? strings.memos.saving : ''}</Text>
      <Button label={strings.signIn.title} variant="text" onPress={() => router.replace('/sign-in')} />
    </ScrollView> : <>
      <Button label="Choose another memo account" variant="text" onPress={() => { void closeMemoSession().catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); }} />
      <Text style={[textStyle(theme.typeTokens.bodySm), { paddingHorizontal: 16, color: theme.colors.text.secondary }]}>{strings.memos.storage(formatMemoBytes(accounting.total_bytes))}</Text>
      {section === 'active' && largest.length > 0 ? <Text style={[textStyle(theme.typeTokens.labelMd), { paddingHorizontal: 16, color: theme.colors.text.muted }]} numberOfLines={2}>Largest: {largest.slice(0, 3).map((asset) => `${asset.original_name} (${formatMemoBytes(asset.byte_size)})`).join(' · ')}</Text> : null}
      <FilterTabs
        tabs={MEMO_FILTERS.map((value) => ({ value, label: `${memoSearchFilterLabel(value)} (${counts[value]})`, iconName: value === 'photos' || value === 'photosVideos' ? 'media.photo' : value === 'videos' ? 'media.video' : value === 'audios' ? 'media.voice' : value === 'files' || value === 'others' ? 'action.file' : value === 'links' ? 'action.link' : 'nav.chats' }))}
        activeValue={contentFilter}
        onSelect={(value) => setContentFilter(value as MemoSearchFilter)}
        indicatorTestID="memo-content-filter-indicator"
      />
      <View><ScrollView horizontal contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {([
          ['active', strings.chatList.all], ['unread', strings.chatList.unread], ['starred', strings.chatList.starred], ['archived', strings.chatList.archivedChats], ['ignored', strings.chatList.ignored], ['trash', strings.memos.trash],
        ] as const).map(([value, label]) => <Button key={value} label={label} variant={section === value ? 'primary' : 'text'} accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} />)}
      </ScrollView></View>
      <FlatList data={visibleMemos.map((memo) => memoConversation(memo))} keyExtractor={(item) => item.chatId}
        renderItem={({ item }) => <ChatRow item={item} onLongPress={() => section === 'trash' ? undefined : setOrganizationId(item.chatId)} onPress={() => {
          if (item.conversation?.kind !== 'memo') return;
          if (section === 'trash') {
            Alert.alert(strings.memos.trashTitle, strings.memos.trashBody, [
              { text: strings.memos.restore, onPress: () => { if (scope) void withMemoStore(scope, (store) => store.restore(item.conversation?.kind === 'memo' ? item.conversation.memoId : '', Date.now()), true).then(reload).catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); } },
              { text: strings.memos.permanentlyRemove, style: 'destructive', onPress: () => { if (scope) void permanentlyRemoveMemo(scope, item.conversation?.kind === 'memo' ? item.conversation.memoId : '').then(reload).catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); } },
              { text: strings.common.back, style: 'cancel' },
            ]);
          } else router.push({ pathname: '/memo/[memoId]', params: { memoId: item.conversation.memoId } });
        }} />}
        ListEmptyComponent={<Text style={[textStyle(theme.typeTokens.bodyMd), { padding: 16, color: theme.colors.text.secondary }]}>{loading ? strings.memos.saving : section === 'trash' ? strings.memos.trashEmpty : strings.memos.empty}</Text>} />
      {section !== 'trash' ? <NewConversationMenu offline /> : null}
      {section !== 'trash' ? <MemoOrganizationActions item={selectedMemo ? memoConversation(selectedMemo) : null} ignored={Boolean(selectedMemo?.ignored)} onClose={() => setOrganizationId(null)} folders={{ folders: localFolders.map((folder) => ({ ...folder, chatIds: [...folder.chatIds, ...links.filter((link) => link.folder_id === folder.folder_id).map((link) => memoListKey(link.memo_id))] })) }} /> : null}
    </>}
  </View>;
}
