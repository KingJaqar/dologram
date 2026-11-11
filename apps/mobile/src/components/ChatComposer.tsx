/** CMP-10/11: text and attachment drafts. */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { codePointLength, config, strings, validateMessageText } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import type { DraftAttachment } from '../media/model';
import { VoiceRecordButton } from './VoiceRecordButton';

export type ChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  replyPreview?: { senderName: string; content: string; deleted: boolean };
  editing?: boolean;
  onCancelMode?: () => void;
  attachments?: DraftAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onCamera?: () => void;
  onGallery?: () => void;
  galleryActive?: boolean;
  onMessageFocus?: () => void;
  onAttach?: () => void;
  onRecorded?: (attachment: DraftAttachment) => void;
  onMediaError?: (message: string) => void;
};

export function ChatComposer({ value, onChangeText, onSend, sending = false, replyPreview, editing = false, onCancelMode, attachments = [], onRemoveAttachment, onCamera, onGallery, galleryActive = false, onMessageFocus, onAttach, onRecorded, onMediaError }: ChatComposerProps) {
  const theme = useTheme();
  const c = theme.colors;
  const length = codePointLength(value);
  const tooLong = length > config.message.maxChars;
  const hasDraft = value.trim().length > 0 || !editing && attachments.length > 0;
  const canSend = validateMessageText(value, editing ? 0 : attachments.length).ok && !sending;
  const showCounter = length >= config.message.counterFromChars;

  return (
    <View style={[styles.container, { backgroundColor: c.bg.chat }]}>
      {!editing && attachments.length > 0 ? <View style={styles.strip}>
        <ScrollView horizontal accessibilityLabel="Selected attachments" contentContainerStyle={styles.tiles}>
          {attachments.map((attachment) => <View key={attachment.id} style={[styles.tile, { backgroundColor: c.bg.surface, borderRadius: theme.radius.sm }]}>
            {attachment.mediaType === 'photo' ? <Image source={{ uri: attachment.uri }} resizeMode="cover" style={styles.preview} accessibilityLabel={attachment.name} /> : <Icon name={attachment.mediaType === 'video' ? 'media.video' : attachment.mediaType === 'voice' ? 'action.microphone' : 'action.file'} color={c.brand.primary} accessibilityLabel="" />}
            <Text numberOfLines={1} style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}>{attachment.name}</Text>
            <Pressable onPress={() => onRemoveAttachment?.(attachment.id)} disabled={sending} accessibilityRole="button" accessibilityLabel={strings.media.remove(attachment.name)} style={styles.remove}><Icon name="nav.close" size="xs" color={c.text.primary} accessibilityLabel="" /></Pressable>
          </View>)}
        </ScrollView>
        <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary }]}>{attachments.length} / {config.media.maxAttachments}</Text>
      </View> : null}
      {replyPreview || editing ? (
        <View style={[styles.modeBar, { backgroundColor: c.bg.surface, borderLeftColor: c.brand.primary }]}>
          <View style={styles.modeCopy}>
            <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.brand.primary }]}>{editing ? strings.chat.editing : strings.chat.replyTo(replyPreview?.senderName ?? '')}</Text>
            {!editing && replyPreview ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>{replyPreview.deleted ? strings.chat.deletedReply : replyPreview.content}</Text> : null}
          </View>
          <Pressable hitSlop={4} onPress={onCancelMode} accessibilityRole="button" accessibilityLabel="Cancel reply" style={styles.cancelMode}>
            <Icon name="nav.close" size="sm" color={c.text.secondary} accessibilityLabel="" />
          </Pressable>
        </View>
      ) : null}
      {showCounter ? (
        <Text style={[textStyle(theme.typeTokens.labelMd), styles.counter, { color: tooLong ? c.error.text : c.text.muted }]}>
          {length} / {config.message.maxChars}
        </Text>
      ) : null}
      {tooLong ? (
        <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), styles.limitError, { color: c.error.text }]}>
          {strings.chat.messageTooLong(config.message.maxChars, length - config.message.maxChars)}
        </Text>
      ) : null}
      <View style={[styles.pill, { backgroundColor: c.bg.input, borderColor: c.text.muted, borderRadius: theme.radius.xl }]}>
        <Pressable
          disabled={editing || sending || !onCamera}
          onPress={onCamera}
          accessibilityRole="button"
          accessibilityLabel="Camera"
          style={styles.iconButton}
        >
          <Icon name="action.camera" size="md" color={c.text.muted} accessibilityLabel="" />
        </Pressable>
        <TextInput
          value={value}
          editable={!sending}
          onChangeText={onChangeText}
          onFocus={onMessageFocus}
          placeholder={editing ? strings.chat.editPlaceholder : 'Message'}
          placeholderTextColor={c.text.muted}
          multiline
          scrollEnabled
          textAlignVertical="top"
          autoCorrect
          style={[textStyle(theme.typeTokens.bodyLg), styles.input, { color: c.text.primary }]}
          accessibilityLabel="Message"
        />
        {hasDraft || tooLong ? (
          <Pressable
            hitSlop={8}
            disabled={!canSend}
            onPress={onSend}
            accessibilityRole="button"
            accessibilityLabel={editing ? strings.chat.save : 'Send'}
            accessibilityState={{ disabled: !canSend }}
            accessibilityHint={tooLong ? strings.chat.messageTooLong(config.message.maxChars, length - config.message.maxChars) : undefined}
            style={({ pressed }) => [styles.send, { opacity: !canSend ? 0.4 : pressed ? 0.7 : 1 }]}
          >
            <Text style={[textStyle(theme.typeTokens.labelLg), { color: c.brand.primary }]}>{editing ? strings.chat.save : 'Send'}</Text>
          </Pressable>
        ) : (
          <View style={styles.trailingActions}>
            {onRecorded && onMediaError && !editing ? <VoiceRecordButton onRecorded={onRecorded} onError={onMediaError} disabled={sending || attachments.length >= config.media.maxAttachments} /> : null}
            <Pressable hitSlop={8} disabled={editing || sending || !onGallery} onPress={onGallery} accessibilityRole="button" accessibilityLabel="Gallery" accessibilityState={{ expanded: galleryActive }} style={styles.iconButton}>
              <Icon name="action.gallery" size="md" color={galleryActive ? c.brand.primary : c.text.muted} accessibilityLabel="" />
            </Pressable>
            <Pressable hitSlop={8} disabled={editing || sending || !onAttach} onPress={onAttach} accessibilityRole="button" accessibilityLabel="Attach" style={styles.iconButton}>
              <Icon name="action.attach" size="md" color={c.text.muted} accessibilityLabel="" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  tiles: { gap: 8 },
  tile: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  preview: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  remove: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'flex-end', justifyContent: 'flex-start', padding: 4 },
  container: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8 },
  modeBar: { minHeight: 48, borderLeftWidth: 3, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 6, borderRadius: 6 },
  modeCopy: { flex: 1, gap: 2 },
  cancelMode: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  counter: { alignSelf: 'flex-end', marginRight: 12, marginBottom: 3 },
  limitError: { marginHorizontal: 12, marginBottom: 6 },
  pill: { minHeight: 48, maxHeight: 168, padding: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 32, maxHeight: 144, paddingHorizontal: 8, paddingVertical: 6 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  trailingActions: { flexDirection: 'row', alignItems: 'center' },
  send: { height: 40, justifyContent: 'center', paddingHorizontal: 8 },
});
