import { fetchCallSnapshot } from './api';
import { isTerminalCallStatus } from './state';
import { ids } from '../lib/ids';

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Recheck the active account and authoritative lifecycle before routing a call tap. */
export async function validateCallNotification(callId: string, userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(callId) || !UUID_PATTERN.test(userId)) return false;
  try {
    const snapshot = await fetchCallSnapshot(ids.messageId(), callId);
    const call = snapshot.call;
    return call !== null
      && (call.callerId === userId || call.calleeId === userId)
      && !isTerminalCallStatus(call.status)
      && (call.status !== 'ringing' || Date.parse(call.ringExpiresAt) > Date.parse(snapshot.serverTime))
      && (call.status !== 'accepted' || call.connectExpiresAt === null || Date.parse(call.connectExpiresAt) > Date.parse(snapshot.serverTime));
  } catch {
    return false;
  }
}
