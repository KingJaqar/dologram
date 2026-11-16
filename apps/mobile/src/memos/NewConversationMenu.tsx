import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { FloatingActionMenu } from '../components/FloatingActionButton';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { useMemoAccess } from './MemoProvider';
import { isMemoScopeCurrent } from './lifecycle';
import { enrollMemoPin } from './protection';
import { withMemoStore } from './vault';

const creations = new Map<number, Promise<string>>();
export function NewConversationMenu({ offline = false }: { offline?: boolean }) {
  const router = useRouter();
  const { scope } = useMemoAccess();
  const theme = useTheme();
  const lock = useRef(false);
  const memoId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { lock.current = false; memoId.current = null; }, []));
  const dismissCreate = () => {
    if (busy) return;
    setCreateVisible(false);
    setTitle('');
    setPin('');
    setConfirmation('');
    setFormError(null);
  };
  const openCreate = () => {
    setTitle('');
    setPin('');
    setConfirmation('');
    setFormError(null);
    setCreateVisible(true);
  };
  const create = async () => {
    if (lock.current || !scope) return;
    if (!title.trim()) { setFormError(strings.memos.nameRequired); return; }
    if (pin && !/^\d{6}$/.test(pin)) { setFormError(strings.memos.pinRequiredDigits); return; }
    if (pin && pin !== confirmation) { setFormError(strings.memos.pinConfirmationMismatch); return; }
    lock.current = true;
    setBusy(true);
    setFormError(null);
    try {
      const id = memoId.current ?? Crypto.randomUUID();
      memoId.current = id;
      let request = creations.get(scope.generation);
      if (!request) {
        request = withMemoStore(scope, async (store) => (await store.create(id, Date.now(), title.trim())).memo_id, true);
        creations.set(scope.generation, request);
      }
      const created = await request;
      if (pin) await enrollMemoPin(scope.accountId, created, pin, confirmation);
      if (isMemoScopeCurrent(scope)) {
        setCreateVisible(false);
        setPin('');
        setConfirmation('');
        router.push({ pathname: '/memo/[memoId]', params: { memoId: created } });
      }
    } catch (error: unknown) {
      lock.current = false;
      if (isMemoScopeCurrent(scope)) setFormError(error instanceof Error ? error.message : strings.memos.failed);
    } finally {
      creations.delete(scope.generation);
      setBusy(false);
    }
  };
  return <>
  <FloatingActionMenu accessibilityLabel={strings.memos.newMemo} disabled={busy} actions={[
    ...(!offline ? [
      { label: 'New Chat', iconName: 'action.newChat', onPress: () => router.push({ pathname: '/search', params: { category: 'username' } }) },
      { label: 'New Group Chat', iconName: 'action.newGroup', onPress: () => router.push('/new-group') },
    ] : []),
    { label: busy ? strings.memos.saving : strings.memos.newMemo, iconName: 'action.newMemo', onPress: openCreate },
  ]} />
  <Modal visible={createVisible} transparent animationType="fade" onRequestClose={dismissCreate} accessibilityViewIsModal>
    <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.bg.elevated }]}>
        <Text style={[textStyle(theme.typeTokens.titleMd), { color: theme.colors.text.primary }]}>{strings.memos.newMemo}</Text>
        <TextField
          label={strings.memos.name}
          value={title}
          onChangeText={(value) => { setTitle(value); setFormError(null); }}
          autoFocus
          maxLength={128}
          editable={!busy}
        />
        <TextField
          label={strings.memos.pinOptional}
          helper={strings.memos.pinHelper}
          value={pin}
          onChangeText={(value) => { setPin(value); setFormError(null); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          editable={!busy}
        />
        {pin ? <TextField
          label={strings.memos.confirmPin}
          value={confirmation}
          onChangeText={(value) => { setConfirmation(value); setFormError(null); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          editable={!busy}
        /> : null}
        {formError ? <Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{formError}</Text> : null}
        <View style={styles.actions}>
          <Button label={strings.memos.cancelCreate} variant="text" disabled={busy} onPress={dismissCreate} />
          <Button label={busy ? strings.memos.saving : strings.memos.createMemo} disabled={busy} onPress={() => { void create(); }} />
        </View>
      </View>
    </View>
  </Modal>
  </>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, padding: 24, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 },
});
