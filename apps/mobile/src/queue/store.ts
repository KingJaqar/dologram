/**
 * expo-sqlite adapter for the queue store (M2-02). It implements the platform-agnostic
 * `LocalQueueStore` contract of `packages/shared`, so the queue state machine never imports
 * React Native (plan Phase 5 progress note, defect 3).
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  LocalQueueStore,
  QueueItem,
  QueueStatus,
  QueuedAttachment,
  TextQueuePayload,
} from '@dologram/shared';

type QueueRow = {
  temp_id: string;
  chat_id: string;
  payload: string;
  status: string;
  retry_count: number;
  next_attempt_at: number;
  row_may_exist: number;
  row_state: string;
  last_error: string | null;
  created_at: number;
};

const COLUMNS =
  'temp_id, chat_id, payload, status, retry_count, next_attempt_at, row_may_exist, row_state, last_error, created_at';

const STATUSES: readonly QueueStatus[] = ['queued', 'sending', 'sent', 'failed'];

function toStatus(value: string): QueueStatus {
  const status = STATUSES.find((candidate) => candidate === value);
  if (!status) {
    throw new Error(`queue row has an unknown status: ${value}`);
  }
  return status;
}

function parsePayload(raw: string, tempId: string): TextQueuePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`queue row ${tempId} has an unreadable payload`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`queue row ${tempId} has an unreadable payload`);
  }

  const payload = parsed as Record<string, unknown>;
  const attachmentCount = payload.attachment_count;
  const valid =
    payload.kind === 'text' &&
    typeof payload.chat_id === 'string' &&
    typeof payload.sender_id === 'string' &&
    typeof payload.content === 'string' &&
    (payload.reply_to === null || typeof payload.reply_to === 'string') &&
    typeof attachmentCount === 'number' && Number.isInteger(attachmentCount) && attachmentCount >= 0 &&
    (payload.force_low_signal === undefined || typeof payload.force_low_signal === 'boolean');

  if (!valid) {
    throw new Error(`queue row ${tempId} has an unreadable payload`);
  }

  const attachments = parseAttachments(payload.attachments, tempId);
  if (attachments.length !== attachmentCount) {
    throw new Error(`queue row ${tempId} has an invalid attachment count`);
  }

  return {
    kind: 'text',
    chat_id: payload.chat_id as string,
    sender_id: payload.sender_id as string,
    content: payload.content as string,
    reply_to: (payload.reply_to as string | null) ?? null,
    attachment_count: attachmentCount,
    attachments,
    force_low_signal: payload.force_low_signal === true,
    ...(payload.feedback === 'forward' ? { feedback: 'forward' as const } : {}),
  };
}

function isMediaType(value: unknown): value is QueuedAttachment['media_type'] {
  return value === 'photo' || value === 'video' || value === 'voice' || value === 'file';
}

function parseAttachments(value: unknown, tempId: string): QueuedAttachment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`queue row ${tempId} has unreadable attachments`);
  return value.map((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new Error(`queue row ${tempId} has unreadable attachments`);
    }
    const attachment = candidate as Record<string, unknown>;
    if (
      typeof attachment.media_id !== 'string' ||
      !isMediaType(attachment.media_type) ||
      typeof attachment.mime !== 'string' ||
      typeof attachment.size_bytes !== 'number' ||
      !Number.isFinite(attachment.size_bytes) ||
      typeof attachment.local_uri !== 'string' ||
      typeof attachment.compressed !== 'boolean'
    ) {
      throw new Error(`queue row ${tempId} has unreadable attachments`);
    }
    return {
      media_id: attachment.media_id,
      media_type: attachment.media_type,
      mime: attachment.mime,
      size_bytes: attachment.size_bytes,
      local_uri: attachment.local_uri,
      compressed: attachment.compressed,
    };
  });
}

function toLastError(value: string | null): QueueItem['last_error'] {
  if (value === 'network' || value === 'server' || value === 'rateLimited' || value === 'waitingWifi') {
    return value;
  }
  return null;
}

function toItem(row: QueueRow): QueueItem {
  return {
    temp_id: row.temp_id,
    chat_id: row.chat_id,
    payload: parsePayload(row.payload, row.temp_id),
    status: toStatus(row.status),
    retry_count: row.retry_count,
    next_attempt_at: row.next_attempt_at,
    row_may_exist: row.row_may_exist === 1,
    row_state: row.row_state === 'stored' || row.row_state === 'unknown' ? row.row_state : 'absent',
    last_error: toLastError(row.last_error),
    created_at: row.created_at,
  };
}

export function createSqliteQueueStore(db: SQLiteDatabase): LocalQueueStore {
  return {
    async init(): Promise<void> {
      // The schema is created and upgraded by getLocalDatabase().
    },

    async insert(item: QueueItem): Promise<void> {
      await db.runAsync(
        `INSERT INTO queue_items (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.temp_id,
          item.chat_id,
          JSON.stringify(item.payload),
          item.status,
          item.retry_count,
          item.next_attempt_at,
          item.row_may_exist ? 1 : 0,
          item.row_state,
          item.last_error,
          item.created_at,
        ],
      );
    },

    async update(item: QueueItem): Promise<void> {
      await db.runAsync(
        `UPDATE queue_items SET chat_id = ?, payload = ?, status = ?, retry_count = ?,
           next_attempt_at = ?, row_may_exist = ?, row_state = ?, last_error = ? WHERE temp_id = ?`,
        [
          item.chat_id,
          JSON.stringify(item.payload),
          item.status,
          item.retry_count,
          item.next_attempt_at,
          item.row_may_exist ? 1 : 0,
          item.row_state,
          item.last_error,
          item.temp_id,
        ],
      );
    },

    async get(tempId: string): Promise<QueueItem | null> {
      const row = await db.getFirstAsync<QueueRow>(
        `SELECT ${COLUMNS} FROM queue_items WHERE temp_id = ?`,
        [tempId],
      );
      return row ? toItem(row) : null;
    },

    async listUnsent(): Promise<QueueItem[]> {
      const rows = await db.getAllAsync<QueueRow>(
        `SELECT ${COLUMNS} FROM queue_items WHERE status <> 'sent'
           ORDER BY created_at ASC, temp_id ASC`,
      );
      return rows.map(toItem);
    },

    async countUnsent(): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM queue_items WHERE status <> 'sent'`,
      );
      return row?.count ?? 0;
    },

    async resetSending(): Promise<void> {
      await db.runAsync(`UPDATE queue_items SET status = 'queued' WHERE status = 'sending'`);
    },

    async makeAllDue(now: number): Promise<void> {
      await db.runAsync(
        `UPDATE queue_items SET next_attempt_at = ? WHERE status = 'queued'`,
        [now],
      );
    },

    async delete(tempId: string): Promise<void> {
      await db.runAsync(`DELETE FROM queue_items WHERE temp_id = ?`, [tempId]);
    },

    async deleteSent(): Promise<void> {
      await db.runAsync(`DELETE FROM queue_items WHERE status = 'sent'`);
    },

    async listSent(): Promise<QueueItem[]> {
      const rows = await db.getAllAsync<QueueRow>(
        `SELECT ${COLUMNS} FROM queue_items WHERE status = 'sent'
           ORDER BY created_at ASC, temp_id ASC`,
      );
      return rows.map(toItem);
    },
  };
}
