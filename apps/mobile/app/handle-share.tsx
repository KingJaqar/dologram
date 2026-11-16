import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { strings } from '@dologram/shared';
import { Button } from '../src/components/Button';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useMemoAccess } from '../src/memos/MemoProvider';
import { authorizeOfflineMemo, enrolledMemoAccounts, withMemoStore } from '../src/memos/vault';
import { memoScope, setMemoScope } from '../src/memos/lifecycle';
import { captureSharedPayloads, clearCapturedShares } from '../src/memos/shareCapture';

export default function HandleShareScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { scope } = useMemoAccess();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [accounts, setAccounts] = useState<string[]>([]);
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    const importFor = async (selectedScope: typeof scope) => {
      try {
        const payloads = Sharing.getSharedPayloads();
        if (payloads.length === 0) throw new Error('No shared content is waiting to be imported.');
        let target = selectedScope;
        if (!target) {
          const available = await enrolledMemoAccounts();
          if (available.length > 1) { if (active) { setAccounts(available); setBusy(false); } return; }
          const accountId = available[0];
          if (!accountId) throw new Error('Sign in to an enrolled memo account before importing shared content.');
          await authorizeOfflineMemo(accountId);
          setMemoScope(accountId, true);
          target = memoScope();
        }
        if (!target) throw new Error('Choose a memo account before importing shared content.');
        const memo = (await withMemoStore(target, (store) => store.list()))[0] ?? await withMemoStore(target, (store) => store.create(Crypto.randomUUID(), Date.now(), strings.memos.defaultTitle), true);
        await captureSharedPayloads(target, memo.memo_id, payloads);
        clearCapturedShares();
        if (active) router.replace({ pathname: '/memo/[memoId]', params: { memoId: memo.memo_id } });
      } catch (cause: unknown) {
        if (active) { setError(cause instanceof Error ? cause.message : 'Shared content could not be imported.'); setBusy(false); }
      }
    };
    if (!started.current) { started.current = true; void importFor(scope); }
    return () => { active = false; };
  }, [router, scope]);
  const chooseAccount = async (accountId: string) => {
    setBusy(true); setError(null);
    try { await authorizeOfflineMemo(accountId); setMemoScope(accountId, true); started.current = false; setAccounts([]); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'This memo account is unavailable.'); setBusy(false); }
  };
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg.app }}>
    {accounts.length > 1 ? <><Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.primary, textAlign: 'center', marginBottom: 16 }]}>Choose the memo account for this shared content.</Text>{accounts.map((accountId) => <Button key={accountId} label={`Account ${accountId.slice(-8)}`} onPress={() => void chooseAccount(accountId)} />)}</> : busy ? <><ActivityIndicator color={theme.colors.brand.primary} /><Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary, textAlign: 'center', marginTop: 16 }]}>Importing shared content…</Text></> : <>
      <Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.error.text, textAlign: 'center' }]}>{error}</Text>
      <Button label="Back" variant="text" onPress={() => router.replace('/(main)/(tabs)')} />
    </>}
  </View>;
}
