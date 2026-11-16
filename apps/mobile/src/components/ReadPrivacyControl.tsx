import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMyReadPrivacy, setMyReadPrivacy, strings, type ReadTimeVisibility } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { DelayedActivityIndicator } from './DelayedActivityIndicator';
import { SwitchRow } from './SwitchRow';
import { useToast } from './Toast';

const SAVE_TOAST_DELAY_MS = 250;

function AccountReadPrivacyControl({ accountId, online }: { accountId: string; online: boolean }) {
  const theme = useTheme();
  const { showToast, hideToast } = useToast();
  const generationRef = useRef(0);
  const savingRef = useRef(false);
  const saveToastRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const saveSequenceRef = useRef(0);
  const [visibility, setVisibility] = useState<ReadTimeVisibility | null>(null);
  const [loading, setLoading] = useState(online);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const retryTargetRef = useRef<ReadTimeVisibility | null>(null);

  const clearSaveToast = useCallback(() => {
    const pending = saveToastRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    hideToast(pending.id);
    saveToastRef.current = null;
  }, [hideToast]);

  useEffect(() => () => {
    generationRef.current += 1;
    savingRef.current = false;
    clearSaveToast();
  }, [clearSaveToast]);

  const load = useCallback(async () => {
    if (!accountId) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setLoading(true);
    setError(false);
    retryTargetRef.current = null;
    const response = await getMyReadPrivacy(supabase);
    if (generationRef.current !== generation) return;
    setLoading(false);
    if (response.error || response.data === null) setError(true);
    else setVisibility(response.data);
  }, [accountId]);

  useEffect(() => {
    if (!online) return () => { generationRef.current += 1; };
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      generationRef.current += 1;
    };
  }, [load, online]);

  const save = useCallback(async (next: ReadTimeVisibility) => {
    if (savingRef.current || !online) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    retryTargetRef.current = next;
    const toastId = `read-privacy-save:${accountId}:${++saveSequenceRef.current}`;
    const timer = setTimeout(() => {
      if (saveToastRef.current?.id !== toastId) return;
      showToast({ id: toastId, message: strings.readPrivacy.saving, variant: 'info', loading: true, durationMs: 0 });
    }, SAVE_TOAST_DELAY_MS);
    saveToastRef.current = { id: toastId, timer };
    const response = await setMyReadPrivacy(supabase, next);
    if (generationRef.current !== generation) {
      savingRef.current = false;
      clearSaveToast();
      return;
    }
    clearSaveToast();
    savingRef.current = false;
    setSaving(false);
    if (response.error || response.data === null) setError(true);
    else {
      retryTargetRef.current = null;
      setVisibility(response.data);
      showToast({ message: strings.readPrivacy.saved, variant: 'success' });
    }
  }, [accountId, clearSaveToast, online, showToast]);

  if (!online && visibility === null) return <SwitchRow
    label={strings.readPrivacy.label}
    description={strings.common.noConnection}
    value={false}
    disabled
    onValueChange={() => undefined}
  />;

  if (loading && visibility === null) return <View accessible accessibilityLabel={strings.readPrivacy.loading} style={styles.loading}>
    <DelayedActivityIndicator active color={theme.colors.brand.primary} />
  </View>;

  if (error && visibility === null) return <View style={styles.error}>
    <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{strings.readPrivacy.loadFailed}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={strings.common.retry} onPress={() => void load()} disabled={!online}>
      <Text style={[textStyle(theme.typeTokens.labelMd), { color: theme.colors.brand.primary }]}>{strings.common.retry}</Text>
    </Pressable>
  </View>;

  return <View>
    <SwitchRow
      label={strings.readPrivacy.label}
      description={!online ? strings.common.noConnection : strings.readPrivacy.description}
      value={visibility !== 'nobody'}
      disabled={!online || saving || error}
      onValueChange={(value) => void save(value ? 'everyone' : 'nobody')}
    />
    {error ? <View style={styles.error}>
      <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{strings.readPrivacy.saveFailed}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={strings.common.retry} onPress={() => {
        const target = retryTargetRef.current;
        if (target === null) void load();
        else void save(target);
      }} disabled={!online}>
        <Text style={[textStyle(theme.typeTokens.labelMd), { color: theme.colors.brand.primary }]}>{strings.common.retry}</Text>
      </Pressable>
    </View> : null}
  </View>;
}

export function ReadPrivacyControl(props: { accountId: string; online: boolean }) {
  return <AccountReadPrivacyControl key={props.accountId} {...props} />;
}

const styles = StyleSheet.create({
  loading: { minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  error: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
});
