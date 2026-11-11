import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { attachmentLabel, formatMediaSize, type ChatAttachment } from '../media/model';
import { useMediaSource } from '../media/useMediaSource';
import { shareMediaFile } from '../media/shareFile';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { Icon } from './Icon';
import { DelayedActivityIndicator } from './DelayedActivityIndicator';

export function AttachmentTile({ attachment, index, total, pending, onOpen }: {
  attachment: ChatAttachment; index: number; total: number; pending: boolean; onOpen: () => void;
}) {
  const theme = useTheme();
  const source = useMediaSource(attachment);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const label = `${attachmentLabel(attachment.mediaType)}, ${index + 1} of ${total}`;
  const open = async () => {
    if (attachment.mediaType !== 'file') { onOpen(); return; }
    if (!source.uri || sharing) return;
    setSharing(true);
    setShareError(null);
    try { await shareMediaFile(attachment, source.uri, source.mime); }
    catch (error) { setShareError(error instanceof Error ? error.message : strings.common.couldNotLoad); }
    finally { setSharing(false); }
  };
  if (source.error) return <Pressable onPress={source.retry} accessibilityRole="button" accessibilityLabel={`${label}. ${source.error}`} style={[styles.tile, { backgroundColor: theme.colors.bg.surface }]}><Icon name="status.failed" color={theme.colors.error.text} accessibilityLabel="" /><Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{source.error}</Text></Pressable>;
  if (!source.uri || source.loading) return <View style={styles.tile} accessibilityLabel={`Loading ${label}`}><DelayedActivityIndicator active={source.loading || !source.uri} color={theme.colors.brand.primary} /></View>;
  if (attachment.mediaType === 'voice') return <VoiceNotePlayer uri={source.uri} onError={source.fail} />;
  return <View style={styles.wrapper}>
    <Pressable onPress={() => void open()} disabled={sharing} accessibilityRole="button" accessibilityLabel={label} style={[attachment.mediaType === 'file' ? styles.file : styles.tile, { backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg }]}>
      {attachment.mediaType === 'photo' ? <>
        <Image source={{ uri: source.uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={label} onLoad={() => setLoadedImage(source.uri)} onError={source.fail} />
        {loadedImage !== source.uri ? <DelayedActivityIndicator active={loadedImage !== source.uri} style={styles.spinner} color={theme.colors.brand.primary} /> : null}
      </> : <Icon name={attachment.mediaType === 'video' ? 'media.video' : 'action.file'} color={theme.colors.brand.primary} accessibilityLabel="" />}
      {attachment.mediaType !== 'photo' ? <Text numberOfLines={1} ellipsizeMode="middle" style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.primary, flexShrink: 1 }]}>{attachment.mediaType === 'file' ? attachment.mediaId : strings.media.video}{source.sizeBytes !== undefined ? ` · ${formatMediaSize(source.sizeBytes)}` : ''}{source.mime ? ` · ${source.mime.split('/').pop()?.toUpperCase()}` : ''}</Text> : null}
      {pending ? <View style={[styles.pending, { backgroundColor: theme.colors.scrim }]}><DelayedActivityIndicator active={pending} color={theme.colors.media.text} /><Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.media.text }]}>{strings.media.uploading}</Text></View> : null}
    </Pressable>
    {sharing ? <DelayedActivityIndicator active={sharing} color={theme.colors.brand.primary} /> : null}
    {shareError ? <Pressable onPress={() => void open()} accessibilityRole="button" accessibilityLabel={shareError}><Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{shareError}</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({ wrapper: { marginTop: 6 }, tile: { width: 220, maxWidth: '100%', height: 170, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 8 }, photo: { width: '100%', height: '100%' }, spinner: { position: 'absolute' }, file: { width: 240, maxWidth: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 }, pending: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 } });
