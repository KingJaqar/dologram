import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { memoCapabilities, strings, type Memo, type MemoRemoteStatus, type MemoTimelineItem, type MemoSaveState } from '@dologram/shared';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { TopBar } from '../../../src/components/TopBar';
import { Button, IconButton } from '../../../src/components/Button';
import { MessageText } from '../../../src/components/MessageText';
import { ChatComposer } from '../../../src/components/ChatComposer';
import { Dialog } from '../../../src/components/Dialog';
import { IgnoredChatActionBar } from '../../../src/components/IgnoredChatActionBar';
import { MediaPickerPanel, type MediaLibraryAsset } from '../../../src/components/MediaPickerPanel';
import { draftFromMediaLibraryAsset, pickAttachments } from '../../../src/media/pickers';
import type { DraftAttachment } from '../../../src/media/model';
import { activeMemoScope, withMemoStore } from '../../../src/memos/vault';
import { isMemoScopeCurrent, registerMemoFlush } from '../../../src/memos/lifecycle';
import { prepareMemoTextCapture, type MemoTextCapture } from '../../../src/memos/capture';
import { formatMemoBytes, saveMemoAttachment, withMemoAssetLease } from '../../../src/memos/assets';
import { isMemoProtected, isMemoUnlocked, verifyMemoPin } from '../../../src/memos/protection';

type Pending = MemoTextCapture;
export default function MemoTimeline() {
  const { memoId, searchItemId, searchQuery } = useLocalSearchParams<{ memoId: string; searchItemId?: string | string[]; searchQuery?: string | string[] }>();
  const selectedItemId = Array.isArray(searchItemId) ? searchItemId[0] : searchItemId;
  const originatingQuery = Array.isArray(searchQuery) ? searchQuery[0] : searchQuery;
  const scope = activeMemoScope();
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const allowRemove = useRef(false);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<MemoRemoteStatus>('local_only');
  const [items, setItems] = useState<MemoTimelineItem[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [saveState, setSaveState] = useState<MemoSaveState>('saving');
  const [failure, setFailure] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [failedSend, setFailedSend] = useState(false);
  const [ignoredActionBusy, setIgnoredActionBusy] = useState(false);
  const [deleteIgnoredVisible, setDeleteIgnoredVisible] = useState(false);
  const liveDraft = useRef('');
  const revision = useRef(0);
  const ready = useRef(false);
  const sendLock = useRef(false);
  const saveOperation = useRef<Pending | null>(null);
  const mounted = useRef(true);
  const current = useCallback(() => mounted.current && isMemoScopeCurrent(scope), [scope]);
  const report = useCallback((error: unknown) => { if (current()) { setFailure(error instanceof Error ? error.message : strings.memos.failed); setSaveState('error'); } }, [current]);
  const load = useCallback(async () => {
    try {
      if (memoCapabilities.protection && await isMemoProtected(scope.accountId, memoId) && !isMemoUnlocked(scope.accountId, memoId)) { setLocked(true); return; }
      const snapshot = await withMemoStore(scope, async (store) => {
        const items = await store.timeline(memoId);
        const selected = selectedItemId && !items.some((item) => item.item_id === selectedItemId) ? await store.item(memoId, selectedItemId) : null;
        return { memo: await store.get(memoId), remote: await store.remoteState(memoId), items: selected ? [selected, ...items] : items, draft: await store.draftRecord(memoId), pending: await store.pending(memoId) };
      });
      if (!current()) return;
      setMemo(snapshot.memo); setRemoteStatus(snapshot.remote.status); setItems(snapshot.items); setHasMore(snapshot.items.length === 50); setPending(snapshot.pending);
      if (!ready.current) {
        liveDraft.current = snapshot.draft.text; revision.current = snapshot.draft.revision; setDraft(snapshot.draft.text);
        const interrupted = snapshot.pending.find((job) => job.text === snapshot.draft.text);
        saveOperation.current = interrupted ?? null; setFailedSend(Boolean(interrupted));
        ready.current = true; setSaveState('saved');
      }
      setFailure(null);
    } catch (error: unknown) { report(error); }
  }, [scope, memoId, selectedItemId, current, report]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const persistDraft = useCallback(async () => {
    if (!ready.current) return;
    const text = liveDraft.current;
    const version = revision.current;
    await withMemoStore(scope, (store) => store.saveDraft(memoId, text, version));
    if (current() && version === revision.current) setSaveState('saved');
  }, [scope, memoId, current]);
  useEffect(() => registerMemoFlush(persistDraft), [persistDraft]);
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowRemove.current || !isMemoScopeCurrent(scope) || !ready.current) return;
    event.preventDefault();
    void persistDraft().then(() => {
      allowRemove.current = true;
      navigation.dispatch(event.data.action);
    }).catch(report);
  }), [navigation, persistDraft, report, scope]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') void persistDraft().catch(report); });
    return () => subscription.remove();
  }, [persistDraft, report]);
  const changeDraft = (text: string) => {
    liveDraft.current = text; revision.current++; setDraft(text); setSaveState('saving');
    void persistDraft().catch(report);
  };
  const send = async (retry?: Pending) => {
    if (sendLock.current || !ready.current) return;
    sendLock.current = true; setSending(true); setSaveState('saving');
    try {
      const queued = attachments;
      for (let index = 0; index < queued.length; index++) {
        try { await saveMemoAttachment(scope, memoId, queued[index]); }
        catch (error: unknown) { if (current()) setAttachments(queued.slice(index)); throw error; }
      }
      if (queued.length > 0 && current()) setAttachments([]);
      const operation = retry ?? saveOperation.current ?? (liveDraft.current.trim() ? prepareMemoTextCapture(liveDraft.current) : null);
      if (operation) {
        saveOperation.current = operation;
        await withMemoStore(scope, (store) => store.saveText(memoId, operation.operation_id, operation.item_id, operation.text, operation.created_at), true);
      }
      if ((queued.length > 0 || operation) && (memo?.ignored || memo?.archived)) {
        await withMemoStore(scope, async (store) => {
          if (memo?.ignored) await store.preference(memoId, 'ignored', false);
          if (memo?.archived) await store.preference(memoId, 'archived', false);
        }, true);
      }
      if (!current()) return;
      if (operation && liveDraft.current === operation.text) { liveDraft.current = ''; revision.current++; setDraft(''); }
      saveOperation.current = null; setFailedSend(false); setSaveState('saved');
      await load();
    } catch (error: unknown) { if (current()) setFailedSend(true); report(error); }
    finally { sendLock.current = false; if (current()) setSending(false); }
  };
  const pick = async (kind: 'photo' | 'gallery' | 'file') => {
    const picked = await pickAttachments(kind, Math.max(0, 10 - attachments.length), { allowArbitraryFile: kind === 'file' });
    if (picked.errors.length > 0) setFailure(picked.errors.join(' '));
    if (picked.attachments.length > 0) setAttachments((previous) => [...previous, ...picked.attachments].slice(0, 10));
  };
  const selectGalleryAssets = async (assets: MediaLibraryAsset[]) => {
    setGalleryOpen(false);
    const next: DraftAttachment[] = [];
    for (const asset of assets) {
      const result = await draftFromMediaLibraryAsset(asset);
      if (result.attachment) next.push(result.attachment); else if (result.error) setFailure(result.error);
    }
    setAttachments((previous) => [...previous, ...next].slice(0, 10));
  };
  const openAttachment = async (item: Extract<MemoTimelineItem, { kind: 'attachment' }>) => {
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error(strings.media.shareUnavailable);
      await withMemoAssetLease(scope, item.asset.asset_id, (lease) => Sharing.shareAsync(lease.uri, { mimeType: lease.asset.mime_type }));
    } catch (error: unknown) { if (current()) setFailure(error instanceof Error ? error.message : strings.media.unavailable); }
  };
  const back = async () => {
    try {
      await persistDraft();
      if (!current()) return;
      allowRemove.current = true;
      if (router.canGoBack()) router.back();
      else if (originatingQuery) router.replace({ pathname: '/search', params: { query: originatingQuery } });
      else router.replace(scope.offline ? '/local-memos' : '/(main)/(tabs)');
    }
    catch (error: unknown) { report(error); }
  };
  const more = async () => {
    const cursor = items[items.length - 1];
    if (!cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await withMemoStore(scope, (store) => store.timeline(memoId, cursor));
      if (current()) { setItems((previous) => [...previous, ...page.filter((item) => !previous.some((existing) => existing.item_id === item.item_id))]); setHasMore(page.length === 50); }
    } catch (error: unknown) { report(error); }
    finally { if (current()) setLoadingMore(false); }
  };
  const unignore = async () => {
    if (ignoredActionBusy) return;
    setIgnoredActionBusy(true);
    try {
      await withMemoStore(scope, (store) => store.preference(memoId, 'ignored', false), true);
      await load();
    } catch (error: unknown) { report(error); }
    finally { if (current()) setIgnoredActionBusy(false); }
  };
  const unarchive = async () => {
    if (ignoredActionBusy) return;
    setIgnoredActionBusy(true);
    try {
      await withMemoStore(scope, (store) => store.preference(memoId, 'archived', false), true);
      await load();
    } catch (error: unknown) { report(error); }
    finally { if (current()) setIgnoredActionBusy(false); }
  };
  const deleteIgnoredMemo = async () => {
    if (ignoredActionBusy) return;
    setIgnoredActionBusy(true);
    try {
      await withMemoStore(scope, (store) => store.trash(memoId, Date.now()), true);
      if (!current()) return;
      setDeleteIgnoredVisible(false);
      router.replace(scope.offline ? '/local-memos' : '/(main)/(tabs)');
    } catch (error: unknown) { report(error); }
    finally { if (current()) setIgnoredActionBusy(false); }
  };
  if (locked) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg.app }}><Text style={[textStyle(theme.typeTokens.titleLg), { color: theme.colors.text.primary }]}>Memo locked</Text><Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary, marginVertical: 12 }]}>Enter the six-digit PIN to view this memo.</Text><ChatComposer value={unlockPin} onChangeText={setUnlockPin} onSend={() => { void verifyMemoPin(scope.accountId, memoId, unlockPin).then(() => { setLocked(false); setUnlockPin(''); }).catch(report); }} sending={false} attachments={[]} onRemoveAttachment={() => undefined} onCamera={() => undefined} onGallery={() => undefined} onAttach={() => undefined} onRecorded={() => undefined} onMediaError={report} /></View>;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.bg.chat }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={memo?.title ?? strings.memos.defaultTitle} subtitle={remoteStatus === 'local_only' ? strings.memos.localOnly : `Sync: ${remoteStatus.replaceAll('_', ' ')}`} onBack={() => void back()}
      right={<IconButton iconName="action.edit" accessibilityLabel={strings.memos.details} disabled={!memo} onPress={() => router.push({ pathname: '/memo/[memoId]/info', params: { memoId, searchItemId: selectedItemId, searchQuery: originatingQuery } })} />} />
    {failure ? <View style={{ padding: 16 }}><Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{failure}</Text><Button label={strings.common.retry} onPress={() => { void (memo ? persistDraft().catch(report) : load()); }} /></View> : null}
    <FlatList data={items} inverted keyExtractor={(item) => item.item_id} onEndReached={() => void more()} onEndReachedThreshold={0.3}
      renderItem={({ item }) => <View style={{ padding: 12, margin: 8, borderRadius: theme.radius.md, backgroundColor: theme.colors.bubble.outgoing }}>
        {item.kind === 'attachment' ? <>
          <Button label={`${item.display_name} · ${formatMemoBytes(item.asset.byte_size)}`} variant="text" onPress={() => void openAttachment(item)} />
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.bubble.outgoingText }]}>{item.asset.mime_type} · {strings.memos.attachmentSaved}</Text>
        </> : <MessageText content={item.text} color={theme.colors.bubble.outgoingText} />}
        <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.bubble.outgoingText }]}>{new Date(item.created_at).toLocaleString()} · {strings.memos.saved}</Text>
      </View>}
      ListEmptyComponent={<Text style={[textStyle(theme.typeTokens.bodyMd), { padding: 16, color: theme.colors.text.secondary }]}>{memo ? strings.memos.empty : strings.memos.saving}</Text>} />
    {pending.map((job) => <View key={job.operation_id} style={{ paddingHorizontal: 12 }}>
      <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]} numberOfLines={2}>{job.text}</Text>
      <Button label={strings.memos.retrySave} disabled={sending} onPress={() => void send(job)} />
    </View>)}
    {memoCapabilities.text || memoCapabilities.attachments ? <>
      {memo?.ignored ? <IgnoredChatActionBar busy={ignoredActionBusy} message={strings.ignoredChat.memoMessage}
        onUnignore={() => { void unignore(); }} onDelete={() => setDeleteIgnoredVisible(true)} /> : memo?.archived ? (
        <IgnoredChatActionBar accessibilityLabel={strings.archivedChat.actionsLabel} busy={ignoredActionBusy}
          message={strings.archivedChat.memoMessage} restoreLabel={strings.organization.unarchive}
          onUnignore={() => { void unarchive(); }} onDelete={() => setDeleteIgnoredVisible(true)} />
      ) : null}
      <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), { paddingHorizontal: 12, color: saveState === 'error' || failedSend ? theme.colors.error.text : theme.colors.text.secondary }]}>{failedSend ? strings.memos.retrySave : saveState === 'saving' ? strings.memos.saving : saveState === 'error' ? strings.memos.failed : draft ? strings.memos.draftSaved : strings.memos.saved}</Text>
      <ChatComposer value={draft} onChangeText={changeDraft} onSend={() => void send()} sending={sending} attachments={attachments}
      onRemoveAttachment={(id) => setAttachments((previous) => previous.filter((attachment) => attachment.id !== id))}
      onCamera={() => { void pick('photo'); }} onGallery={() => setGalleryOpen(true)} galleryActive={galleryOpen} onAttach={() => { void pick('file'); }}
      onRecorded={(attachment) => setAttachments((previous) => [...previous, attachment].slice(0, 10))} onMediaError={setFailure} />
    </> : null}
    <MediaPickerPanel visible={galleryOpen} maxSelection={Math.max(0, 10 - attachments.length)} onClose={() => setGalleryOpen(false)} onDone={(selected) => { void selectGalleryAssets(selected); }} onError={setFailure} />
    <Dialog visible={deleteIgnoredVisible} title={strings.memos.trashTitle} message={strings.memos.trashBody}
      confirmLabel={strings.ignoredChat.delete} onConfirm={() => { void deleteIgnoredMemo(); }}
      onDismiss={() => { if (!ignoredActionBusy) setDeleteIgnoredVisible(false); }} destructive busy={ignoredActionBusy} />
  </KeyboardAvoidingView>;
}
