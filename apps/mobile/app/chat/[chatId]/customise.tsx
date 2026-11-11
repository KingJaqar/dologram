import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { Button } from '../../../src/components/Button';
import { TopBar } from '../../../src/components/TopBar';
import { useAuth } from '../../../src/auth/AuthProvider';
import { actionToast } from '../../../src/notifications/toastCopy';
import { useToast } from '../../../src/components/Toast';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { CHAT_EMOJI_OPTIONS, CHAT_THEME_OPTIONS, loadChatPreferences, updateChatPreferences, type ChatThemeName } from '../../../src/chats/preferences';

export default function ChatCustomiseScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const { showToast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState<ChatThemeName>('default');
  const [selectedEmoji, setSelectedEmoji] = useState('👍');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    if (!chatId || !session?.user.id) return;
    void loadChatPreferences(session.user.id, chatId).then((preferences) => {
      setSelectedTheme(preferences.theme);
      setSelectedEmoji(preferences.emoji);
    }).catch(() => showToast({ message: strings.chatInfo.preferenceFailed, variant: 'error' })).finally(() => setLoading(false));
  }, [chatId, session?.user.id, showToast]);

  const save = async () => {
    if (!chatId || !session?.user.id || loading || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      await updateChatPreferences(session.user.id, chatId, { theme: selectedTheme, emoji: selectedEmoji });
      showToast(actionToast('customizeChat', 'success'));
      goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } });
    } catch {
      showToast(actionToast('customizeChat', 'error'));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.customise} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.space[5] }]}>
        <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>Chat theme</Text>
        <View style={styles.themeGrid}>
          {CHAT_THEME_OPTIONS.map((option) => <Pressable key={option.id} style={[styles.themeOption, { borderColor: selectedTheme === option.id ? c.brand.primary : c.separator }]} onPress={() => setSelectedTheme(option.id)} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected: selectedTheme === option.id }}><View style={[styles.swatch, { backgroundColor: option.color }]} /><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.primary }]}>{option.label}</Text></Pressable>)}
        </View>
        <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary, marginTop: 14 }]}>Chat emoji</Text>
        <View style={styles.emojiGrid}>
          {CHAT_EMOJI_OPTIONS.map((emoji) => <Pressable key={emoji} style={[styles.emoji, { backgroundColor: selectedEmoji === emoji ? c.bg.pressed : c.bg.surface }]} onPress={() => setSelectedEmoji(emoji)} accessibilityRole="radio" accessibilityLabel={`Use ${emoji} as chat emoji`} accessibilityState={{ selected: selectedEmoji === emoji }}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}
        </View>
        <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>Your selected theme and emoji are used for this chat on this device.</Text>
        <Button label="Save" fullWidth loading={saving || loading} disabled={loading} onPress={() => void save()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeOption: { width: '30%', minHeight: 84, borderWidth: 2, borderRadius: 14, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 24 },
});
