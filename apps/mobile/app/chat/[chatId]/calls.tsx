import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings, type CallHistoryRow } from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { EmptyState, ErrorState } from '../../../src/components/EmptyState';
import { Icon } from '../../../src/components/Icon';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useNetState } from '../../../src/net/netState';
import { useChatInfo } from '../../../src/chats/useChatInfo';
import { useCall } from '../../../src/calls/useCall';
import { callDirection, callOutcome, formatCallDuration, useCallHistory } from '../../../src/calls/history';
import { useToast } from '../../../src/components/Toast';

export default function CallHistoryScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { isConnected } = useNetState();
  const { info } = useChatInfo(chatId);
  const { session } = useAuth();
  const { startVoiceCall, startVideoCall } = useCall();
  const { showToast } = useToast();
  const history = useCallHistory(chatId);
  const userId = session?.user.id;
  const canCall = Boolean(isConnected && info && !info.isGroup && !info.savedMessages);

  const callAgain = useCallback((row: CallHistoryRow) => {
    if (!isConnected) {
      showToast({ message: strings.callsHistory.offline, variant: 'error' });
      return;
    }
    if (!canCall) {
      showToast({ message: strings.callsHistory.unavailable, variant: 'error' });
      return;
    }
    void (row.mediaType === 'video' ? startVideoCall(chatId) : startVoiceCall(chatId));
  }, [canCall, chatId, isConnected, showToast, startVideoCall, startVoiceCall]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.callsHistory.title} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      {history.loading && history.rows.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={c.brand.primary} /><Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>{strings.callsHistory.loading}</Text></View>
      ) : history.error && history.rows.length === 0 ? (
        <ErrorState title={strings.callsHistory.loadFailed} message={strings.callsHistory.errorBody} onRetry={() => void history.reload()} />
      ) : history.rows.length === 0 ? (
        <EmptyState iconName="action.phone" title={strings.callsHistory.empty} message={strings.callsHistory.emptyBody} />
      ) : (
        <FlatList
          data={history.rows}
          keyExtractor={(item) => item.callId}
          renderItem={({ item }) => <CallHistoryRowView row={item} userId={userId ?? ''} onCallAgain={() => callAgain(item)} disabled={!canCall} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={() => void history.reload()} tintColor={c.brand.primary} />}
          onEndReached={() => void history.loadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={history.loadingMore ? <ActivityIndicator color={c.brand.primary} style={styles.footer} /> : history.error ? (
            <View style={styles.footerError}>
              <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text }]}>{history.error}</Text>
              {history.nextCursor ? <Pressable onPress={() => void history.loadMore()} accessibilityRole="button" accessibilityLabel={strings.callsHistory.retry}><Text style={[textStyle(theme.typeTokens.labelMd), { color: c.brand.primary }]}>{strings.callsHistory.retry}</Text></Pressable> : null}
            </View>
          ) : null}
        />
      )}
    </View>
  );
}

function CallHistoryRowView({ row, userId, onCallAgain, disabled }: { row: CallHistoryRow; userId: string; onCallAgain: () => void; disabled: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const direction = callDirection(row, userId);
  const duration = formatCallDuration(row);
  const mediaLabel = row.mediaType === 'video' ? strings.callsHistory.video : strings.callsHistory.voice;
  const directionLabel = direction === 'incoming' ? strings.callsHistory.incoming : strings.callsHistory.outgoing;
  return (
    <View style={[styles.row, { borderBottomColor: c.separator }]}>
      <View style={[styles.icon, { backgroundColor: c.bg.surface }]}><Icon name={row.mediaType === 'video' ? 'action.camera' : 'action.phone'} size="md" color={c.brand.primary} accessibilityLabel="" /></View>
      <View style={styles.copy}>
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{directionLabel} · {mediaLabel}</Text>
        <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{callOutcome(row)} · {new Date(row.createdAt).toLocaleString()}</Text>
        {duration ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{strings.callsHistory.duration(duration)}</Text> : null}
      </View>
      <Pressable onPress={onCallAgain} disabled={disabled} style={({ pressed }) => [styles.callAgain, { opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? c.bg.pressed : 'transparent' }]} accessibilityRole="button" accessibilityLabel={strings.callsHistory.callAgain} accessibilityState={{ disabled }}>
        <Icon name={row.mediaType === 'video' ? 'action.camera' : 'action.phone'} size="sm" color={c.brand.primary} accessibilityLabel="" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { paddingBottom: 24 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  copy: { flex: 1, gap: 3 },
  callAgain: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16 },
  footerError: { alignItems: 'center', gap: 8, padding: 16 },
});
