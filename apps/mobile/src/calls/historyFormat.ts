import { strings } from '@dologram/shared';
import type { CallHistoryRow } from '@dologram/shared';

export function formatCallDuration(row: Pick<CallHistoryRow, 'connectedAt' | 'endedAt'>): string | null {
  if (!row.endedAt) return null;
  if (!row.connectedAt) return '0:00';
  const connectedAt = Date.parse(row.connectedAt);
  const endedAt = Date.parse(row.endedAt);
  if (!Number.isFinite(connectedAt) || !Number.isFinite(endedAt)) return null;
  const seconds = Math.max(0, Math.floor((endedAt - connectedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function callDirection(row: Pick<CallHistoryRow, 'callerId' | 'calleeId'>, userId: string): 'incoming' | 'outgoing' {
  return row.callerId === userId ? 'outgoing' : 'incoming';
}

export function callOutcome(row: Pick<CallHistoryRow, 'status' | 'endReason'>): string {
  if (row.endReason === 'busy') return strings.callsHistory.busy;
  switch (row.status) {
    case 'ringing': return strings.callsHistory.ringing;
    case 'accepted':
    case 'in_progress': return strings.callsHistory.inProgress;
    case 'missed': return strings.callsHistory.missed;
    case 'declined': return strings.callsHistory.declined;
    case 'cancelled': return strings.callsHistory.cancelled;
    case 'failed': return strings.callsHistory.failed;
    default: return strings.callsHistory.ended;
  }
}
