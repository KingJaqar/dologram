export type ReadStatus = 'sent' | 'seen' | null;

export type ReadStatusInput = {
  senderId: string;
  currentUserId: string;
  seq: number | null;
  otherMaxReadSeq: number;
  savedMessages?: boolean;
};

/** Selects the aggregate receipt status for one stored outgoing message. */
export function selectReadStatus({
  senderId,
  currentUserId,
  seq,
  otherMaxReadSeq,
  savedMessages = false,
}: ReadStatusInput): ReadStatus {
  if (savedMessages || senderId !== currentUserId || seq === null) return null;
  if (!Number.isSafeInteger(seq) || seq <= 0 || !Number.isSafeInteger(otherMaxReadSeq) || otherMaxReadSeq < 0) return null;
  return otherMaxReadSeq >= seq ? 'seen' : 'sent';
}
