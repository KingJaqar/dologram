import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { strings, validateMemoDetails, type MemoNoteRevision, type MemoRemoteStatus, type MemoSyncConflict, type MemoTag } from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { activeMemoScope, subscribeMemos, withMemoStore } from '../../../src/memos/vault';
import { isMemoScopeCurrent } from '../../../src/memos/lifecycle';
import { permanentlyRemoveMemo, saveMemoAttachment } from '../../../src/memos/assets';
import { exportMemoNote, type NoteExportFormat } from '../../../src/memos/noteExports';
import { enrollMemoPin, isMemoProtected, removeMemoPin, requestMemoPinReset, verifyMemoPinReset } from '../../../src/memos/protection';
import { changeMemoResidency, enableMemoSync, removeMemoRemoteCopy, retryMemoSynchronization } from '../../../src/memos/sync';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { pickAttachments } from '../../../src/media/pickers';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';

export default function MemoDetails() {
  const { memoId, searchItemId, searchQuery } = useLocalSearchParams<{ memoId: string; searchItemId?: string | string[]; searchQuery?: string | string[] }>();
  const selectedItemId = Array.isArray(searchItemId) ? searchItemId[0] : searchItemId;
  const originatingQuery = Array.isArray(searchQuery) ? searchQuery[0] : searchQuery;
  const scope = activeMemoScope();
  const theme = useTheme();
  const router = useRouter();
  const returnToMemo = () => goBackOrReplace(router, { pathname: '/memo/[memoId]', params: { memoId, searchItemId: selectedItemId, searchQuery: originatingQuery } });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<MemoTag[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [noteRevision, setNoteRevision] = useState(0);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [history, setHistory] = useState<MemoNoteRevision[]>([]);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [protectedMemo, setProtectedMemo] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<MemoRemoteStatus>('local_only');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<MemoSyncConflict[]>([]);
  const [resetChallenge, setResetChallenge] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [noteDraftSaved, setNoteDraftSaved] = useState(false);
  const [noteImageCount, setNoteImageCount] = useState(0);
  const [noteDirty, setNoteDirty] = useState(false);
  const lock = useRef(false);
  const skipDraftSave = useRef(false);
  useEffect(() => {
    let active = true;
    void withMemoStore(scope, async (store) => ({ memo: await store.get(memoId), remote: await store.remoteState(memoId), tags: await store.listTags(memoId), note: await store.note(memoId), draft: await store.noteDraft(memoId), history: await store.noteRevisions(memoId) })).then(({ memo, remote, tags: nextTags, note, draft, history: nextHistory }) => {
      if (active && isMemoScopeCurrent(scope)) { setTitle(memo.title); setDescription(memo.description); setRemoteStatus(remote.status); setRemoteError(remote.error); setTags(nextTags); setHistory(nextHistory); const source = draft ?? note; if (note) setNoteItemId(note.item_id); if (source) { setNoteTitle(source.title); setNoteDescription(source.description); setNoteBody(source.body); setNoteRevision(source.revision); setNoteDraftSaved(Boolean(draft)); } else { setNoteTitle(memo.title); setNoteDescription(memo.description); } setNoteImageCount((source?.body.match(/!\[[^\]]*\]\(/g) ?? []).length); setLoaded(true); }
    }).catch((error: unknown) => { if (active) setFailure(error instanceof Error ? error.message : strings.memos.noMemo); });
    return () => { active = false; };
  }, [scope, memoId]);
  useEffect(() => {
    if (!loaded || !noteDirty) return;
    if (skipDraftSave.current) { skipDraftSave.current = false; return; }
    const captured = { title: noteTitle, description: noteDescription, body: noteBody, revision: noteRevision };
    const timer = setTimeout(() => {
      void withMemoStore(scope, (store) => store.saveNoteDraft(memoId, captured.title, captured.description, captured.body, captured.revision, Date.now())).then(() => { setNoteDraftSaved(true); setNoteDirty((dirty) => dirty && (noteTitle !== captured.title || noteDescription !== captured.description || noteBody !== captured.body || noteRevision !== captured.revision)); }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : strings.memos.failed));
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, memoId, noteBody, noteDescription, noteDirty, noteRevision, noteTitle, scope]);
  useEffect(() => { void isMemoProtected(scope.accountId, memoId).then(setProtectedMemo).catch(() => setProtectedMemo(false)); }, [scope.accountId, memoId]);
  useEffect(() => subscribeMemos(() => {
    void withMemoStore(scope, (store) => store.remoteState(memoId)).then((state) => {
      if (isMemoScopeCurrent(scope)) { setRemoteStatus(state.status); setRemoteError(state.error); }
    }).catch(() => undefined);
  }), [memoId, scope]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void withMemoStore(scope, (store) => store.syncConflicts(memoId)).then((entries) => { if (active) setConflicts(entries); }).catch(() => undefined); };
    const stop = subscribeMemos(refresh); refresh();
    return () => { active = false; stop(); };
  }, [memoId, scope]);
  const syncAction = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure(null);
    try { await action(); }
    catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveTag = async () => {
    if (busy || !tagDraft.trim()) return;
    setBusy(true); setFailure(null);
    try {
      const next = await withMemoStore(scope, async (store) => {
        if (editingTagId) { await store.renameTag(memoId, editingTagId, tagDraft); }
        else { await store.createTag(memoId, Crypto.randomUUID(), tagDraft); }
        return store.listTags(memoId);
      }, true);
      setTags(next); setTagDraft(''); setEditingTagId(null);
    } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); }
    finally { setBusy(false); }
  };
  const removeTag = (tag: MemoTag) => {
    Alert.alert(strings.memos.removeTag, tag.display_name, [
      { text: strings.common.back, style: 'cancel' },
      { text: strings.memos.removeTag, style: 'destructive', onPress: () => {
        setBusy(true); void withMemoStore(scope, (store) => store.deleteTag(memoId, tag.tag_id), true).then(() => setTags((current) => current.filter((item) => item.tag_id !== tag.tag_id))).catch((error: unknown) => setFailure(error instanceof Error ? error.message : strings.memos.failed)).finally(() => setBusy(false));
      } },
    ]);
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      validateMemoDetails(title, description);
      await withMemoStore(scope, (store) => store.details(memoId, title, description, Date.now()), true);
      if (isMemoScopeCurrent(scope)) returnToMemo();
    } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); }
    finally { lock.current = false; setBusy(false); }
  };
  const saveNote = async (named: string | null = null) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure(null);
    try {
      const saved = await withMemoStore(scope, (store) => store.saveNote(memoId, noteItemId ?? Crypto.randomUUID(), Crypto.randomUUID(), noteTitle || title, noteDescription, noteBody, named, Date.now()), true);
      setNoteItemId(saved.item_id);
      setNoteRevision(saved.revision); setHistory(await withMemoStore(scope, (store) => store.noteRevisions(memoId))); 
      skipDraftSave.current = true; setNoteDirty(false); setNoteDraftSaved(false);
    } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); }
    finally { lock.current = false; setBusy(false); }
  };
  const insertNoteImage = async () => {
    if (noteImageCount >= 10) { setFailure('A note can contain at most 10 inline images.'); return; }
    const picked = await pickAttachments('photo', 1);
    if (picked.errors.length > 0) { setFailure(picked.errors.join(' ')); return; }
    const image = picked.attachments[0];
    if (!image) return;
    if ([...noteBody].length + [...image.name].length + 32 > 500000) { setFailure('This note is limited to 500,000 characters. Your existing draft was kept.'); return; }
    try {
      const saved = await saveMemoAttachment(scope, memoId, image);
      const nextBody = `${noteBody}${noteBody && !noteBody.endsWith('\n') ? '\n' : ''}![${saved.display_name}](memo-asset://${saved.asset.asset_id})\n`;
      if ([...nextBody].length > 500000) { setFailure('This note is limited to 500,000 characters. Your existing draft was kept.'); return; }
      setNoteBody(nextBody); setNoteImageCount((count) => count + 1); setNoteDirty(true);
    } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); }
  };
  const exportNote = async (format: NoteExportFormat) => { try { const note = await withMemoStore(scope, (store) => store.note(memoId)); if (!note) throw new Error('Save the note before exporting.'); if (!await Sharing.isAvailableAsync()) throw new Error(strings.media.shareUnavailable); await Sharing.shareAsync(await exportMemoNote(note, format)); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const protect = async () => { try { await enrollMemoPin(scope.accountId, memoId, pin, pinConfirm); setProtectedMemo(true); setPin(''); setPinConfirm(''); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const unprotect = async () => { try { await removeMemoPin(scope.accountId, memoId, pin); setProtectedMemo(false); setPin(''); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const enableSync = async () => { try { await enableMemoSync(scope, memoId); const state = await withMemoStore(scope, (store) => store.remoteState(memoId)); setRemoteStatus(state.status); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const requestReset = async () => { try { const challenge = await requestMemoPinReset(scope.accountId); setResetChallenge(challenge.challengeId); setFailure('A reset code was sent to your verified account email.'); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const verifyReset = async () => { if (!resetChallenge) return; try { await verifyMemoPinReset(scope.accountId, memoId, resetChallenge, resetCode); setProtectedMemo(false); setResetCode(''); setResetChallenge(null); setFailure(null); } catch (error: unknown) { setFailure(error instanceof Error ? error.message : strings.memos.failed); } };
  const moveToTrash = () => {
    if (lock.current) return;
    Alert.alert(strings.memos.trashTitle, strings.memos.trashBody, [
      { text: strings.common.back, style: 'cancel' },
      { text: strings.memos.trash, style: 'destructive', onPress: () => {
        lock.current = true; setBusy(true);
        void withMemoStore(scope, (store) => store.trash(memoId, Date.now()), true).then(() => {
          if (isMemoScopeCurrent(scope)) router.replace(scope.offline ? '/local-memos' : '/(main)/(tabs)');
        }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : strings.memos.failed)).finally(() => { lock.current = false; setBusy(false); });
      } },
    ]);
  };
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
    <TopBar title={strings.memos.details} onBack={returnToMemo} />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <TextField label={strings.memos.title} value={title} onChangeText={setTitle} editable={loaded && !busy} />
      <TextField label={strings.memos.description} value={description} onChangeText={setDescription} multiline editable={loaded && !busy} />
      <Text style={{ color: theme.colors.text.primary, fontWeight: '700' }}>Large note</Text>
      <Text style={{ color: theme.colors.text.secondary }}>{noteDraftSaved ? 'Recovery draft saved on this device.' : 'Autosaving recovery draft…'} {[...noteBody].length}/500,000 characters · revision {noteRevision}</Text>
      <Button label="Edit large note" loading={busy} disabled={!loaded} onPress={() => setNoteEditorVisible(true)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['txt', 'md', 'pdf', 'docx'] as const).map((format) => <Button key={format} label={`Export ${format.toUpperCase()}`} variant="text" disabled={!loaded || !noteRevision} onPress={() => void exportNote(format)} />)}
      </View>
      {history.length > 0 ? <Text style={{ color: theme.colors.text.primary, fontWeight: '700' }}>History</Text> : null}
      {history.map((item) => <View key={item.revision_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: theme.colors.text.secondary, flex: 1 }}>Revision {item.revision}{item.named ? ` · ${item.named}` : ''}</Text><Button label="Restore" variant="text" disabled={busy} onPress={() => { void withMemoStore(scope, (store) => store.restoreNoteRevision(memoId, item.revision_id, Crypto.randomUUID(), Date.now()), true).then((next) => { setNoteTitle(next.title); setNoteDescription(next.description); setNoteBody(next.body); setNoteRevision(next.revision); setNoteDirty(false); }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : strings.memos.failed)); }} /></View>)}
      <Text style={{ color: theme.colors.text.primary, fontWeight: '700' }}>Protection</Text>
      <TextField label="Six-digit PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!busy} />
      {!protectedMemo ? <><TextField label="Confirm PIN" value={pinConfirm} onChangeText={setPinConfirm} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!busy} /><Button label="Protect memo" variant="secondary" disabled={pin.length !== 6 || pinConfirm.length !== 6} onPress={() => void protect()} /></> : <Button label="Remove protection" variant="text" disabled={pin.length !== 6} onPress={() => void unprotect()} />}
      {protectedMemo ? <><Button label="Email PIN reset code" variant="text" disabled={busy} onPress={() => void requestReset()} />{resetChallenge ? <><TextField label="Email reset code" value={resetCode} onChangeText={setResetCode} keyboardType="number-pad" maxLength={6} editable={!busy} /><Button label="Verify email reset" variant="text" disabled={resetCode.length !== 6} onPress={() => void verifyReset()} /></> : null}</> : null}
      <Text style={{ color: theme.colors.text.secondary }}>{remoteStatus === 'local_only' ? strings.memos.localOnly : `Sync: ${remoteStatus.replaceAll('_', ' ')}`}. {strings.memos.saved}.</Text>
      {remoteError ? <Text accessibilityRole="alert" style={{ color: theme.colors.text.secondary }}>{remoteError}</Text> : null}
      {remoteStatus === 'local_only' && !scope.offline ? <Button label="Enable private sync" variant="secondary" disabled={!loaded || busy} onPress={() => void enableSync()} /> : null}
      {remoteStatus !== 'local_only' && !scope.offline ? <View style={{ gap: 8 }}>
        <Button label="Retry synchronization" disabled={busy} onPress={() => void syncAction(() => retryMemoSynchronization(scope, memoId))} />
        <Button label="Keep all attachments offline" variant="text" disabled={busy} onPress={() => void syncAction(() => changeMemoResidency(scope, memoId, 'keep_all'))} />
        <Button label="Download new attachments when opened" variant="text" disabled={busy} onPress={() => void syncAction(() => changeMemoResidency(scope, memoId, 'on_demand'))} />
        <Button label="Remove cloud copy and keep local memo" variant="text" disabled={busy} onPress={() => Alert.alert('Remove cloud copy?', 'Every original must be available on this device. The local memo will be kept.', [{ text: strings.common.back, style: 'cancel' }, { text: 'Remove cloud copy', style: 'destructive', onPress: () => void syncAction(() => removeMemoRemoteCopy(scope, memoId)) }])} />
      </View> : null}
      {conflicts.map((conflict) => <View key={conflict.conflict_id} style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.text.primary }}>Conflicting {conflict.entity_type}</Text>
        <Text selectable style={{ color: theme.colors.text.secondary }}>This device: {JSON.stringify(conflict.local_payload).slice(0, 500)}</Text>
        <Text selectable style={{ color: theme.colors.text.secondary }}>Cloud: {JSON.stringify(conflict.remote_payload).slice(0, 500)}</Text>
        {(['local', 'remote'] as const).map((choice) => <Button key={choice} label={choice === 'local' ? 'Keep this device’s version' : 'Use the cloud version'} disabled={busy} onPress={() => void syncAction(async () => { await withMemoStore(scope, (store) => store.resolveSyncConflict(memoId, conflict.conflict_id, choice), true); await retryMemoSynchronization(scope, memoId); })} />)}
      </View>)}
      <Text style={{ color: theme.colors.text.primary }}>{strings.memos.tags}</Text>
      {tags.length === 0 ? <Text style={{ color: theme.colors.text.secondary }}>{strings.memos.noTags}</Text> : tags.map((tag) => <View key={tag.tag_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: theme.colors.text.primary, flex: 1 }}>{tag.display_name}</Text>
        <Button label={strings.memos.renameTag} variant="text" disabled={busy} onPress={() => { setEditingTagId(tag.tag_id); setTagDraft(tag.display_name); }} />
        <Button label={strings.memos.removeTag} variant="text" disabled={busy} onPress={() => removeTag(tag)} />
      </View>)}
      <TextField label={editingTagId ? strings.memos.renameTag : strings.memos.addTag} value={tagDraft} onChangeText={setTagDraft} maxLength={64} editable={!busy} />
      <Button label={editingTagId ? strings.memos.renameTag : strings.memos.addTag} variant="secondary" loading={busy} disabled={!loaded || !tagDraft.trim()} onPress={() => void saveTag()} />
      {failure ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.text }}>{failure}</Text> : null}
      <Button label="Save" loading={busy} disabled={!loaded} onPress={() => void save()} />
      <Button label="Reminders" variant="secondary" disabled={!loaded} onPress={() => router.push({ pathname: '/memo/[memoId]/reminders', params: { memoId } })} />
      <Button label={strings.memos.trash} variant="text" loading={busy} disabled={!loaded} onPress={moveToTrash} />
      <Button label={strings.memos.permanentlyRemove} variant="text" loading={busy} disabled={!loaded} onPress={() => Alert.alert(strings.memos.permanentlyRemove, strings.memos.trashBody, [{ text: strings.common.back, style: 'cancel' }, { text: strings.memos.permanentlyRemove, style: 'destructive', onPress: () => { void permanentlyRemoveMemo(scope, memoId).then(() => router.replace(scope.offline ? '/local-memos' : '/(main)/(tabs)')).catch((error: unknown) => setFailure(error instanceof Error ? error.message : strings.memos.failed)); } }])} />
    </ScrollView>
    <BottomSheet visible={noteEditorVisible} onClose={() => setNoteEditorVisible(false)} style={{ padding: 16 }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.colors.text.primary, fontWeight: '700', marginBottom: 12 }}>Edit large note</Text>
        <TextField label="Note title" value={noteTitle} onChangeText={(value) => { setNoteTitle(value); setNoteDirty(true); }} editable={!busy} maxLength={128} />
        <TextField label="Note description" value={noteDescription} onChangeText={(value) => { setNoteDescription(value); setNoteDirty(true); }} multiline editable={!busy} maxLength={500} />
        <TextField label="Note body" value={noteBody} onChangeText={(value) => { setNoteBody(value); setNoteDirty(true); }} multiline editable={!busy} maxLength={500000} />
        <Text style={{ color: theme.colors.text.secondary }}>{[...noteBody].length}/500,000 characters · {noteImageCount}/10 inline images</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <Button label="Insert image" variant="secondary" disabled={busy || noteImageCount >= 10} onPress={() => void insertNoteImage()} />
          <Button label="Save note" loading={busy} disabled={!loaded} onPress={() => void saveNote()} />
        </View>
      </ScrollView>
    </BottomSheet>
  </View>;
}
