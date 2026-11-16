import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router/js-stack';
import { useLocalSearchParams } from 'expo-router';
import { AppState, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useMemoAccess } from '../../../src/memos/MemoProvider';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { enrollMemoPin, isMemoProtected, isMemoUnlocked, lockMemo, requestMemoPinReset, verifyMemoPin, verifyMemoPinReset } from '../../../src/memos/protection';
import { subscribeMemos, withMemoStore } from '../../../src/memos/vault';
import { isMemoScopeCurrent } from '../../../src/memos/lifecycle';

export default function MemoLayout() {
  const { scope, error } = useMemoAccess();
  const { status, session } = useAuth();
  const theme = useTheme();
  const { memoId } = useLocalSearchParams<{ memoId: string }>();
  const [gate, setGate] = useState<{ generation: number; memoId: string; open: boolean } | null>(null);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const permitted = scope && (status === 'signedIn' ? scope.accountId === session?.user.id : status === 'signedOut' && scope.offline);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!scope || !permitted) return;
      void Promise.all([isMemoProtected(scope.accountId, memoId), withMemoStore(scope, (store) => store.protectionRequired(memoId))]).then(([protectedMemo, required]) => {
        if (active && isMemoScopeCurrent(scope)) { setNeedsEnrollment(required && !protectedMemo); setGate({ generation: scope.generation, memoId, open: (!protectedMemo && !required) || isMemoUnlocked(scope.accountId, memoId) }); }
      }).catch((error: unknown) => { if (active) setFailure(error instanceof Error ? error.message : 'Memo protection is unavailable.'); });
    };
    refresh();
    const stop = subscribeMemos(refresh);
    const listener = AppState.addEventListener('change', (state) => {
      if (scope) lockMemo(scope.accountId, memoId);
      setPin(''); setConfirmation(''); setCode(''); setChallenge(null);
      if (scope) setGate({ generation: scope.generation, memoId, open: false });
      if (state === 'active') refresh();
    });
    return () => { active = false; stop(); listener.remove(); };
  }, [memoId, permitted, scope]);
  const act = async (action: () => Promise<void>) => {
    if (busy || !scope) return;
    setBusy(true); setFailure(null);
    try { await action(); }
    catch (error: unknown) { if (isMemoScopeCurrent(scope)) setFailure(error instanceof Error ? error.message : 'Memo authorization failed.'); }
    finally { setBusy(false); }
  };
  if (!permitted || error) return <View style={{ flex: 1, padding: 24, backgroundColor: theme.colors.bg.app }}><Text accessibilityRole="alert" style={{ color: theme.colors.text.primary }}>{error ?? strings.memos.noAccounts}</Text></View>;
  const childStack = <Stack key={`${scope.accountId}:${scope.generation}`} screenOptions={{ headerShown: false }} />;
  if (failure && !gate) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: theme.colors.bg.app }}><Text accessibilityRole="alert" style={{ color: theme.colors.error.text }}>{failure}</Text></View>;
  if (!gate || gate.generation !== scope.generation || gate.memoId !== memoId) return childStack;
  if (!gate.open) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12, backgroundColor: theme.colors.bg.app }}>
    <Text style={{ color: theme.colors.text.primary }}>{needsEnrollment ? 'Enroll a PIN on this device to open this protected memo' : 'This memo is protected'}</Text>
    {failure ? <Text accessibilityRole="alert" style={{ color: theme.colors.text.primary }}>{failure}</Text> : null}
    <TextField label="Six-digit PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!busy} />
    {needsEnrollment ? <TextField label="Confirm device PIN" value={confirmation} onChangeText={setConfirmation} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!busy} /> : null}
    <Button label={needsEnrollment ? 'Enroll device PIN' : 'Unlock memo'} disabled={busy || pin.length !== 6} onPress={() => void act(async () => { if (needsEnrollment) await enrollMemoPin(scope.accountId, memoId, pin, confirmation); else await verifyMemoPin(scope.accountId, memoId, pin); if (isMemoScopeCurrent(scope)) { setPin(''); setConfirmation(''); setGate({ generation: scope.generation, memoId, open: true }); } })} />
    {!scope.offline ? <Button label="Email PIN recovery code" variant="text" disabled={busy} onPress={() => void act(async () => { const value = await requestMemoPinReset(scope.accountId); if (isMemoScopeCurrent(scope)) setChallenge(value.challengeId); })} /> : null}
    {challenge ? <><TextField label="Email reset code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} /><Button label="Verify recovery code" disabled={busy || code.length !== 6} onPress={() => void act(async () => { await verifyMemoPinReset(scope.accountId, memoId, challenge, code); if (isMemoScopeCurrent(scope)) { setCode(''); setChallenge(null); setGate({ generation: scope.generation, memoId, open: true }); } })} /></> : null}
  </View>;
  return childStack;
}
