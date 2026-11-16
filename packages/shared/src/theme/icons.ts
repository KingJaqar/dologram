/**
 * Mapping of semantic icon names (v14 12.3) to Lucide component names (kebab-case).
 * The Icon component imports Lucide components by these names.
 * Screens never import Lucide directly — they use <Icon name="..." />.
 *
 * All names confirmed present in lucide-react-native@1.70.0 dist/cjs/icons/.
 */
const semanticIcons = {
  // --- Status (message delivery) ---
  'status.queued': 'clock',
  'status.sending': 'loader-circle',
  'status.sent': 'check',
  'status.seen': 'eye',
  'status.failed': 'x-circle',

  // --- Navigation ---
  'nav.back': 'chevron-left',
  'nav.chats': 'message-circle',
  'nav.new': 'plus',
  'nav.settings': 'settings',
  'nav.forward': 'chevron-right',
  'nav.archive': 'archive',
  'nav.folder': 'folder',
  'nav.close': 'x',
  'nav.more': 'ellipsis-vertical',

  // --- Actions ---
  'action.reply': 'corner-down-left',
  'action.forward': 'forward',
  'action.edit': 'pencil',
  'action.delete': 'trash-2',
  'action.copy': 'copy',
  'action.select': 'check-circle',
  'action.retry': 'refresh-cw',
  'action.discard': 'x',
  'action.mute': 'bell-off',
  'action.unmute': 'bell',
  'action.archive': 'archive',
  'action.unarchive': 'archive-restore',
  'action.pin': 'pin',
  'action.unpin': 'pin-off',
  'action.star': 'star',
  'action.starOff': 'star-off',
  'action.ignore': 'circle-slash-2',
  'action.unignore': 'circle-slash-2',
  'action.addMembers': 'user-plus',
  'action.markUnread': 'mail-open',
  'action.addToFolder': 'folder-plus',
  'action.folder': 'folder',
  'action.removeFromFolder': 'folder',
  'action.newChat': 'user',
  'action.newGroup': 'users',
  'action.newMemo': 'file-text',
  'action.showPassword': 'eye',
  'action.view': 'eye',
  'action.hidePassword': 'eye-off',
  'action.send': 'send',
  'action.attach': 'paperclip',
  'action.camera': 'camera',
  'action.phone': 'phone',
  'action.microphone': 'mic',
  'action.volume2': 'volume-2',
  'action.volumeX': 'volume-x',
  'action.file': 'file-text',
  'action.download': 'download',
  'action.share': 'share',
  'action.play': 'play',
  'action.pause': 'ellipsis',
  'action.signOut': 'log-out',
  'action.changePassword': 'lock',
  'action.search': 'search',
  'action.link': 'link',

  // --- Attachment / media types ---
  'media.photo': 'image',
  'media.video': 'video',
  'media.voice': 'mic',
  'media.file': 'file-text',

  // --- Emoji / reaction palette (12.3 positions 1–8) ---
  'emoji.like': 'thumbs-up',
  'emoji.heart': 'heart',
  'emoji.laugh': 'smile',
  'emoji.wow': 'star',
  'emoji.sad': 'thumbs-down',
  'emoji.angry': 'angry',
  'emoji.fire': 'chevron-up',
  'emoji.clap': 'check',

  // --- Admin ---
  'admin.overview': 'layout-dashboard',
  'admin.accounts': 'users',
  'admin.maintenance': 'wrench',
  'admin.audit': 'scroll-text',
  'admin.settingsCheck': 'list-checks',
  'admin.lock': 'lock',
  'admin.pass': 'circle-check',
  'person.badge': 'badge-check',
  'admin.fail': 'x-circle',
  'admin.success': 'check-circle',
  'admin.warning': 'alert-triangle',

  // --- Connectivity ---
  'conn.offline': 'wifi-off',
  'conn.lowSignal': 'signal-low',
  'conn.wifi': 'wifi',

  // --- People ---
  'person.deleted': 'user',
  'person.former': 'user',

  // --- Chat special ---
  'chat.saved': 'bookmark',
  'chat.deleted': 'trash-2',
  'action.gallery': 'image',
  'action.info': 'info',

  // --- Jump ---
  'ui.jumpToBottom': 'arrow-down',
  'ui.loading': 'loader-circle',
} as const;

export type IconName = keyof typeof semanticIcons;
export type LucideIconName = typeof semanticIcons[IconName];
// Preserve dynamic string indexing for existing mobile consumers.
export const iconNames: typeof semanticIcons & Record<string, LucideIconName> = semanticIcons;

/**
 * @deprecated Use iconNames. Kept for backward compat with existing Icon.tsx.
 */
export const iconMap = iconNames;

/** Icon sizes with stroke widths (12.3). */
export const iconSizes = {
  xs: { size: 14, stroke: 2 },
  sm: { size: 16, stroke: 2 },
  md: { size: 20, stroke: 1.75 },
  lg: { size: 24, stroke: 1.75 },
  xl: { size: 48, stroke: 1.5 },
} as const;

export type IconSize = keyof typeof iconSizes;
