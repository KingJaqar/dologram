# Telegram-style “Seen” Functionality for Chats

This document defines the meaning, lifecycle, UI, data model, realtime behavior, privacy rules, and acceptance criteria for message read state (“seen”) in DoloGram. It uses Telegram as the product reference, while treating the DoloGram requirements and implementation as the source of truth for this repository.

## 1. Terminology

| Term | Meaning |
| --- | --- |
| Delivered | The message has been accepted by the server/cloud. It does not mean that a person has opened it. |
| Read / seen | A member has advanced their read pointer to at least the message’s sequence number. |
| Read pointer | The highest contiguous chat sequence a member has read. DoloGram stores this as `chat_members.last_read_seq`. |
| Read hint | An ephemeral realtime event telling open clients to re-read durable read state. It is not the source of truth. |
| Unread count | Messages from other senders with a sequence greater than the current user’s read pointer, excluding deleted/expired messages. |

“Seen” is therefore not an independent boolean on each message. It is derived from a member’s monotonic read pointer.

## 2. Telegram reference behavior

Telegram’s user-facing check marks are broadly:

1. One check: the message reached Telegram’s cloud and the recipient was notified if notifications are enabled.
2. Two checks: the recipient opened Telegram and opened the conversation containing the message.
3. Telegram intentionally does not expose a “delivered to this specific device” state because one account can be active on multiple devices.

In one-to-one chats and small groups, Telegram can also show the exact time a message was read. Telegram keeps this read-time information for a limited period, currently seven days, and read-time visibility follows the relevant last-seen privacy rules. See the [Telegram FAQ](https://telegram.org/faq#q-what-do-the-check-marks-mean).

In small groups, a sender can open an outgoing message’s “Seen By” view to see which members read it. Group messages can show two checks when at least one other member has read them. Telegram limits per-member group read receipts to smaller groups and expires the stored receipt data; the official API exposes this through `messages.getMessageReadParticipants`. See Telegram’s [read-receipts announcement](https://telegram.org/blog/chat-themes-interactive-emoji-read-receipts/id?setln=en) and [API method](https://core.telegram.org/method/messages.getMessageReadParticipants).

Telegram clients mark history read using a maximum message identifier, and the pointer only moves forward. The client batches read updates, usually after the open chat has remained stable briefly, and flushes pending updates when the app is suspended. See the [Telegram read-state client guidance](https://core.telegram.org/api/views) and [`messages.readHistory`](https://core.telegram.org/method/messages.readHistory).

## 3. DoloGram product contract

### Direct chats

- A message sent by the current user is `sent` until the other member’s `last_read_seq` is greater than or equal to that message’s `seq`.
- It becomes `seen` when the other member has read it.
- The chat-list preview applies the same rule to the newest message sent by the current user.
- Saved Messages never displays a sent/seen status because there is no other member who can read it.

### Group chats

- A message sent by the current user is `seen` when at least one other group member’s `last_read_seq` is greater than or equal to that message’s `seq`.
- This is intentionally the same aggregate rule as Telegram’s group check marks.
- DoloGram does not currently expose a per-member “Seen By” roster or read timestamps.
- The aggregate state is derived from current member rows; no separate per-message receipt rows are needed.

### Incoming messages and unread counts

- Opening a chat advances the current user’s read pointer to the newest displayed server sequence.
- The unread count includes only messages from other senders with `seq > last_read_seq`.
- Deleted and expired messages do not contribute to the unread count.
- A user’s own messages never contribute to their unread count.
- Reading a chat does not mark messages in another chat as read.

### Monotonicity

`last_read_seq` may only increase. A stale device, delayed realtime event, retry, or forged client payload must never move it backward.

## 4. Read lifecycle

```text
Message arrives with seq N
        |
        v
Client displays message in the active chat
        |
        v
Advance own last_read_seq to max(current, N)
        |
        +--> online: persist to public.chat_members
        |             then broadcast read hint
        |
        +--> offline: persist locally + queue highest pending seq
                      flush after reconnection
        |
        v
Other open clients receive the hint
        |
        v
They re-read chat_members through RLS
        |
        v
Sent message status recomputes as sent or seen
```

The broadcast is only an invalidation signal. A client must never trust the broadcast payload as proof that a user read something. It must fetch or reconcile the member row that the database authorized.

## 5. DoloGram storage and transport

### Durable state

`public.chat_members.last_read_seq` is the durable read cursor for one user in one chat.

The current user may update only their own membership row, and only the permitted fields, including `last_read_seq`. The server-side policy and monotonic update condition must remain authoritative; UI state alone is insufficient.

### Local state

The mobile client keeps read state in its SQLite cache and stores unsent read updates in `pending_read_states`. A pending row is coalesced to the highest sequence for that chat, so opening a chat repeatedly does not create an unbounded queue.

### Realtime state

Each open chat uses one private `chat:<chat_id>` Broadcast channel. The `read` event payload is:

```ts
{
  user_id: string;
  last_read_seq: number;
}
```

The channel is shared with typing events, but read and typing have separate event names. Read hints are ephemeral and do not replace the persisted member row.

### Sequence comparison

For a message `m`:

```text
directSeen(m) = otherMember.last_read_seq >= m.seq
groupSeen(m)  = any(otherMember.last_read_seq >= m.seq)
```

For the chat list:

```text
ownLastMessageSeen =
  lastMessage.sender_id == currentUserId
  AND otherMaxReadSeq >= lastMessage.seq
  AND chat is not Saved Messages
```

## 6. UI behavior

### Message bubble

For the current user’s latest outgoing message, show:

- `Queued` / pending while it exists only in the local delivery queue.
- `Sent` after the server has stored the message and assigned `seq`.
- `Seen` after the relevant other-member read condition is true.
- `Failed` when delivery exhausts retries; this is a delivery error, not a read state.

Older outgoing messages may omit a status to reduce visual noise. Incoming messages do not show a sender-oriented sent/seen label.

### Chat list

The latest outgoing message preview may show `Sent` or `Seen`. Saved Messages shows no status. The row separately shows unread count, muted state, preview, and timestamp.

### Accessibility

The visual icon must have a text label such as “sent” or “seen”. The status must not be conveyed by color alone. A screen-reader label for a chat row should include the chat title, unread count when nonzero, preview, and timestamp.

## 7. Triggering a read

The client should mark a chat read when all of these are true:

- The user is an active member of the chat.
- The chat screen is open or the user explicitly marks the chat read.
- The message has been loaded and is considered displayed by the chat UI.
- The candidate sequence is greater than the local read pointer.

The candidate should be the highest displayed server `seq`, not the highest locally queued message. Locally queued messages have no server sequence and cannot make another member’s message appear read.

The update should be idempotent and forward-only. Multiple calls with the same sequence are harmless.

## 8. Offline and multi-device behavior

### Offline

- The UI may immediately clear the local unread indicator after the message is displayed.
- The durable server row cannot be updated until a connection exists.
- The highest pending sequence per chat is retained locally.
- On reconnection, the client writes the pending state, removes the pending row only after success, and sends the read hint.
- If delivery fails, the pending state remains and is retried later.

### Multiple devices

- A read on one device updates the shared `chat_members` row.
- Other devices learn the state on foreground/open refresh or through an authorized realtime path.
- A stale device must merge read state with `max(local, server)` and never overwrite a newer server value with an older value.
- The seen state is account-level per chat, not device-level.

### Backgrounding and foregrounding

- When the app returns to the foreground, refresh member/read state for visible chats.
- When a chat opens, refresh before relying on a cached `seen` result.
- Do not mark every chat read merely because the app enters the foreground; only visible/open chats should advance.

## 9. Security and privacy rules

- Only active chat members may receive the chat’s read hint channel.
- A non-member’s read hint must be rejected or never delivered.
- A member may send a syntactically valid hint for another `user_id`, but the receiving client must not treat it as authoritative; it must re-read database state through RLS.
- The update policy must prevent one user from changing another user’s read cursor.
- Read state should not reveal message content to a user who cannot already read the chat.
- Read receipts are not online presence. DoloGram does not infer “online” from a read hint and does not implement Telegram’s last-seen privacy controls in this feature.

## 10. Edge cases

| Case | Expected behavior |
| --- | --- |
| Message is deleted before being read | It is excluded from unread counts; it cannot make a message appear newly read. |
| Message expires | It is excluded from unread counts after expiry. |
| User scrolls through history | Only messages actually displayed should advance the cursor; avoid marking an entire chat read merely because old history was fetched. |
| User opens a chat with no messages | No read update is sent. |
| Message is queued offline | It has no `seq`; it cannot advance server read state. |
| Read update arrives out of order | Keep the maximum sequence only. |
| User leaves or is removed from a group | Stop receiving read hints and purge the chat from the local cache on the next foreground/sync. |
| Group has many members | Aggregate “at least one other member” behavior remains; do not add a per-member roster without a separate product decision. |
| Sender is the only member (Saved Messages) | No `seen` status is shown. |
| Member reads on another device | The sender eventually sees `seen` after authorized state refresh/realtime invalidation. |
| Read hint is forged | It may cause a refresh, but cannot directly change the displayed truth. |

## 11. Current repository mapping

The current implementation already covers the core contract:

- `apps/mobile/src/chat/readState.ts` performs monotonic local advancement, offline coalescing, pending flush, and hint emission.
- `apps/mobile/src/chat/realtime.ts` subscribes to the private per-chat read channel and validates the payload shape.
- `packages/shared/src/realtime/topics.ts` centralizes the `read` event name and payload contract.
- `packages/shared/src/chatList/query.ts` derives unread counts and the highest other-member read sequence.
- `packages/shared/src/chatList/build.ts` turns the derived sequence comparison into `sent` or `seen` for chat-list rows.
- `apps/mobile/app/chat/[chatId]/index.tsx` derives the message-bubble seen state from other members’ persisted read sequences.
- `supabase/migrations/016_align_messenger_schema.sql` adds and constrains `chat_members.last_read_seq`.

The project’s authoritative decisions are D-23 and D-92. D-23 defines the monotonic persisted cursor and offline behavior; D-92 defines the broadcast refresh, direct/group seen rule, RLS re-read behavior, and deleted/expired unread exclusion.

## 12. Acceptance checklist

1. Send a message in a direct chat: sender sees `Sent`, then `Seen` after the recipient opens the chat.
2. Keep the recipient’s chat closed: sender remains at `Sent`.
3. In a group, one other member reading the message changes the sender’s state to `Seen`.
4. In Saved Messages, no `Sent`/`Seen` state appears.
5. Open a chat offline: local unread state clears, the highest cursor is queued, and the server updates after reconnection.
6. Repeat open/close/retry operations: `last_read_seq` never decreases and pending rows coalesce.
7. Read on device B: device A reflects the new state after a realtime hint or foreground refresh.
8. Send a forged read hint: it cannot change database-backed seen state.
9. A non-member cannot subscribe to or publish useful read state for the chat.
10. Deleted and expired messages do not contribute to unread counts.
11. A queued local message without a server `seq` never advances read state.
12. Accessibility output says “sent” and “seen” without depending on icon color.

