/**
 * Every tunable value fixed by v14 (D-27, D-28, D-29, D-30, D-57, D-89, D-95, D-109, D-116, D-122).
 * Later phases import these values instead of repeating numbers (M2-01, 10.9).
 */

export type MediaType = 'photo' | 'video' | 'voice' | 'file';

export type MuteOptionId = 'oneHour' | 'eightHours' | 'oneWeek' | 'untilUnmuted';

export interface DgConfig {
  queue: {
    timerMs: number;
    backoffBaseMs: number;
    backoffFactor: number;
    backoffCapMs: number;
    jitter: number;
    maxAttempts: number;
    maxUnsent: number;
  };
  lowSignal: {
    largeMediaBytes: number;
    photoLongEdgePx: number;
    photoQuality: number;
    photoOutputMime: string;
  };
  media: {
    smallBucket: string;
    largeBucket: string;
    smallMaxBytes: number;
    largeMaxBytes: number;
    tusThresholdBytes: number;
    maxAttachments: number;
    signedUrlSeconds: number;
    cacheControlSeconds: number;
    allowedTypes: Record<MediaType, readonly string[]>;
  };
  message: {
    maxChars: number;
    counterFromChars: number;
  };
  reactions: {
    palette: readonly string[];
    extraPalette: readonly string[];
    maxActivePerMessage: number;
  };
  typing: {
    sendEveryMs: number;
    hideAfterMs: number;
  };
  folders: {
    nameMaxChars: number;
    maxPerUser: number;
  };
  groups: {
    maxMembers: number;
    titleMaxChars: number;
  };
  profile: {
    usernamePattern: RegExp;
    displayNameMaxChars: number;
  };
  password: {
    minLength: number;
  };
  ui: {
    loadingDelayMs: number;
  };
  list: {
    pageSize: number;
  };
  sync: {
    pageSize: number;
  };
  latency: {
    budgetMs: number;
    samples: number;
  };
  mute: {
    options: readonly { id: MuteOptionId; seconds: number | null }[];
  };
}

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const videoTypes = ['video/mp4', 'video/webm'] as const;
const audioTypes = ['audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm'] as const;
const documentTypes = [
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const config = {
  queue: {
    timerMs: 15000,
    backoffBaseMs: 2000,
    backoffFactor: 2,
    backoffCapMs: 60000,
    jitter: 0.2,
    maxAttempts: 8,
    maxUnsent: 200,
  },
  lowSignal: {
    largeMediaBytes: 5242880,
    photoLongEdgePx: 1280,
    photoQuality: 0.7,
    photoOutputMime: 'image/jpeg',
  },
  media: {
    smallBucket: 'chat-media-small',
    largeBucket: 'chat-media-large',
    smallMaxBytes: 10485760,
    largeMaxBytes: 52428800,
    tusThresholdBytes: 6291456,
    maxAttachments: 10,
    signedUrlSeconds: 600,
    cacheControlSeconds: 600,
    allowedTypes: {
      photo: imageTypes,
      video: videoTypes,
      voice: audioTypes,
      file: [...imageTypes, ...videoTypes, ...audioTypes, ...documentTypes],
    },
  },
  message: {
    maxChars: 4096,
    counterFromChars: 3500,
  },
  reactions: {
    palette: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'],
    extraPalette: ['⭐', '💯', '👏', '👀'],
    maxActivePerMessage: 3,
  },
  typing: {
    sendEveryMs: 3000,
    hideAfterMs: 5000,
  },
  folders: {
    nameMaxChars: 32,
    maxPerUser: 10,
  },
  groups: {
    maxMembers: 100,
    titleMaxChars: 64,
  },
  profile: {
    usernamePattern: /^[a-z][a-z0-9_]{4,31}$/,
    displayNameMaxChars: 64,
  },
  password: {
    minLength: 12,
  },
  ui: {
    loadingDelayMs: 300,
  },
  list: {
    pageSize: 50,
  },
  sync: {
    pageSize: 500,
  },
  latency: {
    budgetMs: 2000,
    samples: 100,
  },
  mute: {
    options: [
      { id: 'oneHour', seconds: 3600 },
      { id: 'eightHours', seconds: 28800 },
      { id: 'oneWeek', seconds: 604800 },
      { id: 'untilUnmuted', seconds: null },
    ],
  },
} as const satisfies DgConfig;

/**
 * The `chat_members.muted_until` value for a mute option (D-109 rule 1). "Until I unmute" is the
 * Postgres timestamptz literal `infinity`, which no client ever reaches by arithmetic.
 */
export function mutedUntil(option: MuteOptionId, now: Date): string {
  const entry = config.mute.options.find((candidate) => candidate.id === option);
  if (!entry || entry.seconds === null) {
    return 'infinity';
  }
  return new Date(now.getTime() + entry.seconds * 1000).toISOString();
}
