import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { strings, type MemoReminder, type MemoTimelineItem } from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { activeMemoScope, withMemoStore } from '../../../src/memos/vault';
import { isMemoScopeCurrent } from '../../../src/memos/lifecycle';
import { completeMemoReminder, snoozeMemoReminder, reconcileMemoReminderSchedules } from '../../../src/memos/reminders';
import { openMemoAlarmSettings } from '../../../src/memos/alarm';
import { isMemoProtected, isMemoUnlocked, verifyMemoPin } from '../../../src/memos/protection';

export default function MemoReminders() {
  const { memoId, reminderId, occurrenceId } = useLocalSearchParams<{ memoId: string; reminderId?: string; occurrenceId?: string }>();
  const scope = activeMemoScope();
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<MemoTimelineItem[]>([]);
  const [reminders, setReminders] = useState<MemoReminder[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState('60');
  const [pin, setPin] = useState('');
  const [locked, setLocked] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const protectedMemo = await isMemoProtected(scope.accountId, memoId);
      if (protectedMemo && !isMemoUnlocked(scope.accountId, memoId)) { setLocked(true); return; }
      const result = await withMemoStore(scope, async (store) => ({ items: await store.timeline(memoId), reminders: await store.listReminders(memoId, true) }));
      if (isMemoScopeCurrent(scope)) { setItems(result.items); setReminders(result.reminders); setSelected(result.items.map((item) => item.item_id)); }
    } catch (cause: unknown) { setFailure(cause instanceof Error ? cause.message : strings.memos.failed); }
  }, [memoId, scope]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const unlock = async () => {
    try { await verifyMemoPin(scope.accountId, memoId, pin); setPin(''); setLocked(false); }
    catch (cause: unknown) { setFailure(cause instanceof Error ? cause.message : 'The memo could not be unlocked.'); }
  };
  const create = async (mode: 'regular' | 'alarm') => {
    const delay = Number(minutes);
    if (!Number.isSafeInteger(delay) || delay < 1 || delay > 525600 || selected.length === 0) { setFailure('Choose at least one item and enter a delay from 1 to 525,600 minutes.'); return; }
    setBusy(true); setFailure(null);
    try {
      await withMemoStore(scope, (store) => store.createReminder({ reminder_id: Crypto.randomUUID(), memo_id: memoId, mode, item_ids: selected, schedule: { kind: 'one_time', at: Date.now() + delay * 60_000, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, recurrence: 'none' }, now: Date.now() }), true);
      await reconcileMemoReminderSchedules(scope); await load();
    } catch (cause: unknown) { setFailure(cause instanceof Error ? cause.message : strings.memos.failed); }
    finally { setBusy(false); }
  };
  if (locked) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: theme.colors.bg.app }}><Text style={{ color: theme.colors.text.primary, marginBottom: 12 }}>This memo is protected. Enter its PIN to manage reminders.</Text><TextField label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} /><Button label="Unlock" disabled={pin.length !== 6} onPress={() => void unlock()} />{failure ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.text }}>{failure}</Text> : null}</View>;
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}><TopBar title="Reminders" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
    <Text style={{ color: theme.colors.text.secondary }}>Selected items are frozen when a reminder is created. Missing items remain recorded as unavailable.</Text>
    {items.map((item) => <Button key={item.item_id} label={`${selected.includes(item.item_id) ? '✓ ' : ''}${item.display_name || item.text.slice(0, 48) || 'Attachment'}`} variant={selected.includes(item.item_id) ? 'secondary' : 'text'} disabled={busy} onPress={() => setSelected((current) => current.includes(item.item_id) ? current.filter((id) => id !== item.item_id) : [...current, item.item_id])} />)}
    <TextField label="Remind me in minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" editable={!busy} />
    <View style={{ flexDirection: 'row', gap: 8 }}><Button label="Regular reminder" loading={busy} disabled={selected.length === 0} onPress={() => void create('regular')} /><Button label="Alarm" variant="secondary" loading={busy} disabled={selected.length === 0} onPress={() => void create('alarm')} /></View>
    {reminders.map((reminder) => <View key={reminder.reminder_id} style={{ gap: 4, paddingVertical: 8 }}><Text style={{ color: theme.colors.text.primary }}>{reminder.mode === 'alarm' ? 'Alarm' : 'Regular reminder'} · {reminder.state} · {reminder.live_count}/{reminder.selected_count} items</Text><Text style={{ color: theme.colors.text.secondary }}>{reminder.actual_schedule_status === 'unavailable' ? 'Alarm access is unavailable; enable exact alarms or choose a regular reminder.' : `Next: ${reminder.next_occurrence_at ? new Date(reminder.next_occurrence_at).toLocaleString() : 'none'}`}</Text>{reminder.actual_schedule_status === 'unavailable' && reminder.mode === 'alarm' ? <Button label="Open alarm settings" variant="text" onPress={() => { void openMemoAlarmSettings().catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); }} /> : null}{reminderId === reminder.reminder_id && occurrenceId ? <View style={{ flexDirection: 'row', gap: 8 }}><Button label="Complete" onPress={() => { void completeMemoReminder(scope, reminder.reminder_id, occurrenceId).then(load).catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); }} /><Button label="Snooze 10 min" variant="secondary" onPress={() => { void snoozeMemoReminder(scope, reminder.reminder_id, occurrenceId, 10 * 60_000).then(load).catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : strings.memos.failed)); }} /></View> : null}</View>)}
    {failure ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.text }}>{failure}</Text> : null}
  </ScrollView></View>;
}
