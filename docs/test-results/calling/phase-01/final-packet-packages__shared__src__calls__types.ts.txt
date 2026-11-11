export const CALL_HISTORY_PAGE_SIZE = 30 as const;

export type CallMediaType = 'voice' | 'video';

export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'in_progress'
  | 'declined'
  | 'cancelled'
  | 'missed'
  | 'ended'
  | 'failed';

export type CallEndReason =
  | 'declined'
  | 'cancelled'
  | 'no_answer'
  | 'busy'
  | 'hangup'
  | 'connection_timeout'
  | 'media_disconnected'
  | 'permission_denied'
  | 'provider_error'
  | 'access_lost'
  | 'account_restricted'
  | 'max_duration'
  | 'feature_disabled';

export type CallParticipantRole = 'caller' | 'callee';

export type CallState = {
  callId: string;
  chatId: string;
  callerId: string;
  calleeId: string;
  mediaType: CallMediaType;
  status: CallStatus;
  createdAt: string;
  ringExpiresAt: string;
  acceptedAt: string | null;
  connectExpiresAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endReason: CallEndReason | null;
  revision: string;
};

export type CallCapabilities = {
  canAnswer: boolean;
  canCancel: boolean;
  canJoin: boolean;
  canEnd: boolean;
  belongsToThisSession: boolean;
};

export type CallParticipant = {
  callId: string;
  userId: string;
  role: CallParticipantRole;
  connected: boolean;
  connectionGeneration: string;
  joinedAt: string | null;
  leftAt: string | null;
  revision: string;
};

export type CallCleanupState = 'not_required' | 'pending' | 'confirmed' | 'failed';

export type CallSnapshot = {
  call: CallState | null;
  participants: CallParticipant[];
  capabilities: CallCapabilities;
  availability: { callingEnabled: boolean };
  serverTime: string;
  cleanupState: CallCleanupState;
};

export type CallHistoryCursor = {
  createdAt: string;
  callId: string;
};

export type CallHistoryRow = CallState;

export type CallAction = 'accept' | 'decline' | 'cancel' | 'end';

export type CallHistoryPage = {
  rows: CallHistoryRow[];
  nextCursor: CallHistoryCursor | null;
};
