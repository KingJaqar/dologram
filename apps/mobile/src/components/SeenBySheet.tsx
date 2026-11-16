import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getMessageReadParticipants,
  strings,
  type ReadDetailsResult,
  type ReadParticipant,
} from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { DelayedActivityIndicator } from './DelayedActivityIndicator';

type SeenBySheetProps = {
  visible: boolean;
  accountId: string;
  chatId: string;
  messageId: string;
  direct: boolean;
  onClose: () => void;
  onExited?: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; result: ReadDetailsResult };

function participantOrder(left: ReadParticipant, right: ReadParticipant): number {
  if (left.read_at === null && right.read_at === null) return left.user_id.localeCompare(right.user_id);
  if (left.read_at === null) return 1;
  if (right.read_at === null) return -1;
  const time = Date.parse(left.read_at) - Date.parse(right.read_at);
  return time === 0 ? left.user_id.localeCompare(right.user_id) : time;
}

function formattedTime(value: string): { visible: string; accessible: string } {
  const date = new Date(value);
  return {
    visible: date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    accessible: date.toLocaleString([], { dateStyle: 'full', timeStyle: 'long' }),
  };
}

function ResultBody({ result, direct }: { result: ReadDetailsResult; direct: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  if (result.state !== 'available') {
    const copy = result.state === 'expired' ? strings.seenBy.expired
      : result.state === 'not_available_for_large_group' ? strings.seenBy.largeGroup
      : result.state === 'not_recorded' ? strings.seenBy.notRecorded
      : result.state === 'hidden' ? strings.seenBy.hidden
      : strings.seenBy.notFound;
    return <Text accessibilityRole="text" style={[styles.stateText, textStyle(theme.typeTokens.bodyLg), { color: c.text.secondary }]}>{copy}</Text>;
  }

  const participants = [...result.participants].sort(participantOrder);
  if (participants.length === 0) {
    return <Text style={[styles.stateText, textStyle(theme.typeTokens.bodyLg), { color: c.text.secondary }]}>{strings.seenBy.empty}</Text>;
  }

  return <>
    {participants.map((participant) => {
      const time = participant.read_at === null ? null : formattedTime(participant.read_at);
      const secondary = time === null ? strings.seenBy.timeHidden
        : direct ? strings.seenBy.readAt(time.visible) : time.visible;
      return <View
        key={participant.user_id}
        accessible
        accessibilityLabel={`${participant.display_name}. ${time === null ? strings.seenBy.timeHidden : strings.seenBy.readAt(time.accessible)}`}
        style={styles.participant}
      >
        <Avatar id={participant.user_id} displayName={participant.display_name} imageUrl={participant.avatar_url} size={48} />
        <View style={styles.participantText}>
          <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{participant.display_name}</Text>
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{secondary}</Text>
        </View>
      </View>;
    })}
    <Text style={[styles.note, textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}>{strings.seenBy.serverRecordedNote}</Text>
  </>;
}

function SeenBySheetBody({ visible, accountId, chatId, messageId, direct, onClose, onExited }: SeenBySheetProps) {
  const theme = useTheme();
  const c = theme.colors;
  const generationRef = useRef(0);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!visible || !accountId || !chatId || !messageId) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setState({ kind: 'loading' });
    const response = await getMessageReadParticipants(supabase, chatId, messageId);
    if (generationRef.current !== generation || !visible) return;
    setState(response.error || response.data === null
      ? { kind: 'error' }
      : { kind: 'result', result: response.data });
  }, [accountId, chatId, messageId, visible]);

  useEffect(() => {
    if (!visible) {
      generationRef.current += 1;
      return;
    }
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, visible]);

  useEffect(() => () => { generationRef.current += 1; }, []);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });
    return () => subscription.remove();
  }, [load, visible]);

  const expiry = state.kind === 'result' && state.result.state === 'available'
    ? state.result.expires_at : null;
  useEffect(() => {
    if (!visible || expiry === null) return;
    const remaining = Date.parse(expiry) - Date.now();
    const timer = setTimeout(() => {
      setState({ kind: 'result', result: { state: 'expired' } });
    }, Math.min(Math.max(0, remaining), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiry, visible]);

  const body = useMemo(() => {
    if (state.kind === 'loading') return <View style={styles.loading} accessibilityLabel={strings.seenBy.loading}>
      <DelayedActivityIndicator active color={c.brand.primary} />
    </View>;
    if (state.kind === 'error') return <View style={styles.error}>
      <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodyLg), { color: c.error.text }]}>{strings.seenBy.loadFailed}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={strings.common.retry} onPress={() => void load()} style={styles.retry}>
        <Text style={[textStyle(theme.typeTokens.labelLg), { color: c.brand.primary }]}>{strings.common.retry}</Text>
      </Pressable>
    </View>;
    return <ResultBody result={state.result} direct={direct} />;
  }, [c, direct, load, state, theme]);

  return <BottomSheet visible={visible} onClose={onClose} onExited={onExited}>
    <View accessibilityRole="summary" accessibilityLabel={direct ? strings.seenBy.directTitle : strings.seenBy.groupTitle} style={styles.header}>
      <Text accessibilityRole="header" style={[textStyle(theme.typeTokens.heading1), { color: c.text.primary }]}>
        {direct ? strings.seenBy.directTitle : strings.seenBy.groupTitle}
      </Text>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>{body}</ScrollView>
  </BottomSheet>;
}

export function SeenBySheet(props: SeenBySheetProps) {
  return <SeenBySheetBody key={`${props.accountId}:${props.chatId}:${props.messageId}`} {...props} />;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  scroll: { maxHeight: 520 },
  content: { paddingBottom: 24 },
  loading: { minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  error: { minHeight: 120, paddingHorizontal: 20, gap: 12, justifyContent: 'center' },
  retry: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 },
  stateText: { paddingHorizontal: 20, paddingVertical: 28 },
  participant: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  participantText: { flex: 1, gap: 2 },
  note: { paddingHorizontal: 20, paddingTop: 12 },
});
