/**
 * Preview text of a chat row (CMP-09, AND-03).
 *
 * The preview is the message text with Markdown markers removed, or the attachment's word, or
 * "Deleted message". D-30 and D-99 keep rendering to CommonMark basics and their plain text, so
 * headings, lists, quotes and link targets lose their markers here as well.
 */
import type { MediaType } from '../config';
import type { MessageRow } from '../db/repositories/messages';
import { strings } from '../strings';
import { dgTrim } from '../validation/text';

/** Removes the CommonMark markers of D-30/D-99, leaving the text they wrap. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, ''))
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/~~([\s\S]*?)~~/g, '$1')
    // Italic markers only at word boundaries, so snake_case stays intact.
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2')
    // Block markers of D-99: headings, quotes, list items and ordered items.
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, '')
    .replace(/^[ \t]{0,3}\d+[.)][ \t]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MEDIA_PREVIEW: Record<MediaType, string> = {
  photo: strings.chat.previewPhoto,
  video: strings.chat.previewVideo,
  voice: strings.chat.previewVoice,
  file: strings.chat.previewFile,
};

/**
 * The preview of one message: "Deleted message" for a soft-deleted row, otherwise its text with
 * Markdown removed, otherwise the attachment's word (CMP-09).
 */
export function messagePreview(message: MessageRow, mediaType: MediaType | null): string {
  if (message.deleted_at !== null) return strings.chat.deletedMessage;
  const text = stripMarkdown(message.content);
  if (dgTrim(text).length > 0) return text;
  if (mediaType !== null) return MEDIA_PREVIEW[mediaType];
  // An attachment whose media row has not arrived yet still previews as an attachment.
  if (message.attachment_count > 0) return strings.chat.previewFile;
  return '';
}
