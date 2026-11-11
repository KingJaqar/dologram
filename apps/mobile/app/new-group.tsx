/**
 * AND-11: New group (M2-07, D-46, D-58, D-70, D-109).
 *
 * A group title (1 to 64 characters after trimming), then the people the caller already shares a
 * chat with (D-70), at most 99 besides the creator (D-58). Create inserts the chat and the member
 * rows and opens the new chat; the 21st chat created within a day is refused with DG429 (D-46).
 * Creating needs a connection, so Create is disabled offline with "No connection" (12.5).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  codePointLength,
  config,
  maxSelectableMembers,
  strings,
  toggleContactSelection,
  validateGroupTitle,
} from '@dologram/shared';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ContactRow } from '../src/components/ContactRow';
import { EmptyState } from '../src/components/EmptyState';
import { SkeletonRow } from '../src/components/Skeleton';
import { actionToast } from '../src/notifications/toastCopy';
import { useToast } from '../src/components/Toast';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useAuth } from '../src/auth/AuthProvider';
import { useNetState } from '../src/net/netState';
import { supabase } from '../src/lib/supabase';
import { ids } from '../src/lib/ids';
import { useContacts } from '../src/chats/useContacts';
import { createGroupChat } from '../src/chats/group';

const SKELETON_ROWS = 4;

export default function NewGroupScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const net = useNetState();
  const { session } = useAuth();
  const { groupWith } = useLocalSearchParams<{ groupWith?: string }>();
  const { showToast } = useToast();
  const userId = session?.user.id ?? null;

  const { loading, error, contacts, reload } = useContacts();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);

  useEffect(() => {
    if (!groupWith || selected.length > 0 || contacts.length === 0) return;
    if (contacts.some((contact) => contact.userId === groupWith)) setSelected([groupWith]);
  }, [contacts, groupWith, selected.length]);

  const titleValid = validateGroupTitle(title);
  const canCreate = titleValid && net.isConnected && !creating;

  const onToggle = useCallback((memberId: string) => {
    setSelected((current) => toggleContactSelection(current, memberId, maxSelectableMembers));
  }, []);

  const onCreate = useCallback(async () => {
    if (!userId || !canCreate || createLock.current) return;
    createLock.current = true;
    setCreating(true);
    try {
      const outcome = await createGroupChat({
        client: supabase,
        userId,
        title,
        memberIds: selected,
        newChatId: ids.chatId(),
      });
      if (outcome.kind === 'failed') {
        showToast({ ...actionToast('createGroup', 'error'), message: outcome.message });
        return;
      }
      showToast(outcome.failedMembers > 0
        ? { message: strings.toasts.groupPartial(outcome.failedMembers), variant: 'error', placement: 'bottom' }
        : actionToast('createGroup', 'success'));
      router.replace({ pathname: '/chat/[chatId]', params: { chatId: outcome.chatId } });
    } catch {
      showToast(actionToast('createGroup', 'error'));
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }, [userId, canCreate, title, selected, router, showToast]);

  const memberLabel = useMemo(() => strings.newGroup.selected(selected.length), [selected.length]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar
        title={strings.newGroup.title}
        onBack={() => goBackOrReplace(router)}
        right={
          <Button
            label={strings.newGroup.create}
            variant="text"
            onPress={() => void onCreate()}
            disabled={!canCreate}
            loading={creating}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: theme.space[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: theme.space[4], gap: theme.space[4] }}>
          <TextField
            label={strings.newGroup.titleLabel}
            value={title}
            onChangeText={setTitle}
            charCount={codePointLength(title)}
            maxLength={config.groups.titleMaxChars}
            editable={!creating}
          />

          {net.isConnected ? null : (
            <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>
              {strings.newGroup.offline}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.sectionHeader,
            { paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] },
          ]}
        >
          <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>
            {strings.newGroup.members}
          </Text>
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>
            {memberLabel}
          </Text>
        </View>

        {loading ? (
          <View accessible accessibilityLabel="Loading">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <SkeletonRow key={index} />
            ))}
          </View>
        ) : error ? (
          <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
            <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>
              {strings.common.couldNotLoad}
            </Text>
            <Button
              label={strings.common.retry}
              variant="secondary"
              onPress={() => void reload()}
            />
          </View>
        ) : contacts.length === 0 ? (
          <EmptyState
            iconName="action.newChat"
            title={strings.newGroup.noContacts}
            message={strings.newGroup.noContactsBody}
          />
        ) : (
          contacts.map((contact) => {
            const isSelected = selected.includes(contact.userId);
            return (
              <ContactRow
                key={contact.userId}
                userId={contact.userId}
                displayName={contact.displayName}
                selected={isSelected}
                disabled={!isSelected && selected.length >= maxSelectableMembers}
                onToggle={onToggle}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
});
