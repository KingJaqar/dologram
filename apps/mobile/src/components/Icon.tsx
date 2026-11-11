/**
 * Icon component — renders a Lucide icon by its DoloGram semantic name.
 * Screens never import from lucide-react-native directly; they use <Icon />.
 * Assumption A-06: every mapped Lucide name exists in lucide-react-native@1.70.0.
 *
 * 12.3, D-131
 */
import React from 'react';
import { Image as RNImage } from 'react-native';
import { iconNames, iconSizes } from '@dologram/shared';
import type { IconSize } from '@dologram/shared';

// ─── Lucide component registry ───────────────────────────────────────────────
// Import only the icons named in iconNames to keep the bundle small.
// PascalCase map: kebab-case icon name → Lucide React Native component.

import {
  Clock,
  LoaderCircle,
  Check,
  Eye,
  EyeOff,
  XCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Plus,
  Settings,
  Search,
  X,
  EllipsisVertical,
  CornerDownLeft,
  Forward,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  BellOff,
  Bell,
  Archive,
  ArchiveRestore,
  Pin,
  PinOff,
  StarOff,
  CircleSlash2,
  UserPlus,
  MailOpen,
  Folder,
  FolderPlus,
  User,
  Users,
  Send,
  Paperclip,
  Camera,
  Phone,
  Mic,
  Volume2,
  VolumeX,
  FileText,
  Download,
  Share,
  Play,
  Ellipsis,
  LogOut,
  Lock,
  Image,
  Video,
  ThumbsUp,
  Heart,
  Smile,
  Star,
  ThumbsDown,
  Angry,
  AlertTriangle,
  WifiOff,
  SignalLow,
  Wifi,
  Bookmark,
  ArrowDown,
  Info,
} from 'lucide-react-native';

const starredIcon = require('../../assets/icons/starred.png');

// lucide-react-native components are typed as ComponentType<any> in the dist
const lucideRegistry: Record<string, React.ComponentType<any>> = {
  clock: Clock,
  'loader-circle': LoaderCircle,
  check: Check,
  eye: Eye,
  'eye-off': EyeOff,
  'x-circle': XCircle,
  'check-circle': CheckCircle,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'message-circle': MessageCircle,
  plus: Plus,
  settings: Settings,
  search: Search,
  x: X,
  'ellipsis-vertical': EllipsisVertical,
  'corner-down-left': CornerDownLeft,
  forward: Forward,
  pencil: Pencil,
  'trash-2': Trash2,
  copy: Copy,
  'refresh-cw': RefreshCw,
  'bell-off': BellOff,
  bell: Bell,
  archive: Archive,
  'archive-restore': ArchiveRestore,
  pin: Pin,
  'pin-off': PinOff,
  'star-off': StarOff,
  'circle-slash-2': CircleSlash2,
  'user-plus': UserPlus,
  'mail-open': MailOpen,
  folder: Folder,
  'folder-plus': FolderPlus,
  user: User,
  users: Users,
  send: Send,
  paperclip: Paperclip,
  camera: Camera,
  phone: Phone,
  mic: Mic,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  'file-text': FileText,
  download: Download,
  share: Share,
  play: Play,
  ellipsis: Ellipsis,
  'log-out': LogOut,
  lock: Lock,
  image: Image,
  video: Video,
  'thumbs-up': ThumbsUp,
  heart: Heart,
  smile: Smile,
  star: Star,
  'thumbs-down': ThumbsDown,
  angry: Angry,
  'alert-triangle': AlertTriangle,
  'wifi-off': WifiOff,
  'signal-low': SignalLow,
  wifi: Wifi,
  bookmark: Bookmark,
  'arrow-down': ArrowDown,
  info: Info,
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IconProps {
  /** Semantic icon name from v14 12.3, e.g. "status.queued". */
  name: string;
  size?: IconSize;
  /** Resolved color string from the theme. Required for proper theming. */
  color: string;
  /** Required for accessibility (D-95). */
  accessibilityLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Icon({
  name,
  size = 'md',
  color,
  accessibilityLabel,
}: IconProps): React.ReactElement | null {
  const lucideName = iconNames[name];
  if (!lucideName) {
    if (__DEV__) {
      console.warn(`[Icon] Unknown semantic icon name: "${name}"`);
    }
    return null;
  }

  const LucideComponent = lucideRegistry[lucideName];
  if (!LucideComponent) {
    if (__DEV__) {
      console.warn(`[Icon] Lucide component not registered for: "${lucideName}"`);
    }
    return null;
  }

  const { size: px, stroke } = iconSizes[size];

  if (lucideName === 'star') {
    return (
      <RNImage
        source={starredIcon}
        style={{ width: px, height: px }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        accessibilityElementsHidden={!accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      />
    );
  }

  return (
    <LucideComponent
      size={px}
      color={color}
      strokeWidth={stroke}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
