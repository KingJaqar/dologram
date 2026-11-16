import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemoAccess } from '../src/memos/MemoProvider';

export default function MemoReminderEntry() {
  const params = useLocalSearchParams<{ memo_id?: string; reminder_id?: string; occurrence_id?: string }>();
  const router = useRouter();
  const { scope } = useMemoAccess();
  useEffect(() => {
    if (!scope || !params.memo_id || !params.reminder_id || !params.occurrence_id) return;
    router.replace({ pathname: '/memo/[memoId]/reminders', params: { memoId: params.memo_id, reminderId: params.reminder_id, occurrenceId: params.occurrence_id } });
  }, [params.memo_id, params.reminder_id, params.occurrence_id, router, scope]);
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
}
