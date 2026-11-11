# Phase 6 — Sync

Date: 2026-11-10
Scope: M2-05, 6.4, D-40, D-43, D-91, T-13.

## Environment

- Repository root `G:\codebase\DoloGram`, branch `main`. The whole tree is untracked in git (no commit was made; none was authorized).
- Device: `emulator-5560` (Android 12), the running instance that has `com.dologram.app` installed. The plan names `emulator-5554` (MuMu); that instance is not running now (`adb devices` lists 5556, 5558, 5560 only). 5556 (an unrelated Android 9 emulator) and 5558 were not touched. Same recorded deviation as Phase 5.
- Metro on port 8082 with `adb -s emulator-5560 reverse tcp:8082 tcp:8082` (the Phase 0 port deviation).

## Plan discrepancy

The source plan's Phase 6 body contained only the Section 4 overview row; the step list, deliverables, acceptance criteria and exit gate were never transcribed. The requirements below were reconstructed from the row ("Postgres Changes and per-chat resync by sync_seq keep the local cache identical to the server"), from M2-05 in the v14 document (`G:\codebase\DoloGram\Documentation\DoloGram_Documentation_v14.docx`, sections 6.4 and 7.1), and from D-40, D-43, D-91 and T-13. They are recorded against the work that was done, exactly as Phase 5 handled the same gap.

## Files

Shared, `packages/shared/src/sync/`:

| File | Purpose |
| --- | --- |
| `types.ts` | `ChangePayload` for messages / message_media / reactions, `SyncDelivery` (`subscribe` with `onChange` and `onStatus`) behind which Postgres Changes can later be replaced by Broadcast (D-43), `SyncSource` (three paged reads plus chats and members), `SyncCacheStore`, `SyncSummary` |
| `engine.ts` | merge by key, per-chat cursor, paged resync, chat/member refresh, unknown-chat fetch, prune of chats the server no longer lists (D-91), channel-recovery resync, serialized writes |
| `index.ts` | barrel |
| `__tests__/sync-engine.test.ts` | 12 Vitest tests (T-13 automated half) |

Shared, supporting reads the resync needs (Phase 1 owned the repositories; these are read-only additions):

| File | Addition |
| --- | --- |
| `db/repositories/messages.ts` | `listMessagesAfter(chatId, afterSyncSeq, limit)` |
| `db/repositories/media.ts` | new file: `MessageMediaRow`, `listMessageMediaAfter(...)` |
| `db/repositories/reactions.ts` | `listReactionsAfter(...)` |
| `db/repositories/chats.ts` | new file: `ChatRow`, `listMyChats()`, `getChat(chatId)` |
| `db/repositories/members.ts` | `listChatMembers(chatId)` |
| `index.ts` | exports the new functions and row types plus `DgClient` / `DgFetch` / `DgStorage` |

Mobile, `apps/mobile`:

| File | Purpose |
| --- | --- |
| `src/sync/cacheStore.ts` | `SyncCacheStore` over the Phase 5 expo-sqlite cache tables: UPSERT by key, forward-only cursor (`MAX`), `deleteChat` removes the chat, members, messages, media, reactions and `sync_state` |
| `src/sync/source.ts` | `createSupabaseSyncSource` (RLS reads, no client filter) and `createSupabaseDelivery` (one Realtime channel with `postgres_changes` on the three tables, row validation, `SUBSCRIBED` → connected and `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` → disconnected) |
| `src/sync/lifecycle.ts` | `startSync()` / handle: foreground-only, connection-aware; resubscribes and resyncs on start, foreground and reconnect; background stops the channel; exposes `resyncNow()` and a status subscription |
| `src/sync/debug.ts` | read-only counts and cursors for the dev-tools screen (D-160) |
| `app/dev/sync.tsx` | dev-tools screen: status, summary, cached counts, cursors, Resync now / Refresh |
| `app/_layout.tsx` | starts and stops the sync engine with the same `signedIn` lifecycle as the queue worker |

## Baseline before editing

| Check | Baseline | Final | Delta |
| --- | --- | --- | --- |
| `npm run typecheck` (both workspaces) | exit 0 | exit 0 | none |
| `npm --workspace @dologram/shared run test` | 88 passed | 100 passed | +12 (sync engine) |
| `npm --workspace @dologram/mobile run test` | 6 failed, 38 passed | 6 failed, 38 passed | none (same suites) |
| `npm --workspace @dologram/mobile run lint` | 3 problems, all `app/sign-up.tsx` | 3 problems, all `app/sign-up.tsx` | my `app/dev/sync.tsx` set-state-in-effect error was found and fixed |
| `npx expo export --platform android` | — | exit 0, 6.5 MB Hermes bundle | new modules resolve |

Pre-existing failures (unchanged, not fixed — outside this phase's scope): the 6 `signIn` / `signUp` mobile tests (the tests query the old `Email` label) and the 3 lint problems in `app/sign-up.tsx` (color literal, `set-state-in-effect`, unused `data`).

## Shared test coverage (Vitest)

`packages/shared/src/sync/__tests__/sync-engine.test.ts` (12):

- initial fetch caches the chat, its members, messages, media and reactions and sets the cursor to the highest `sync_seq`;
- paging: with `pageSize` 2, five messages are fetched at `after` 0, 2, 4 and then 5, and all five are cached;
- the cursor is never the device clock: with `Date.now` mocked to 9,999,999 the cursor is the row's `sync_seq` (3);
- replaying the same event twice leaves one row and an unchanged cursor;
- an event received while the chat is not caught up is stored but does not move the cursor; the next successful pass fetches the row behind it by `sync_seq` and then advances the cursor;
- an event naming an unknown chat fetches that chat and its members and then its history;
- an edit (message UPDATE with a higher `sync_seq`) and a reaction removal (`removed_at`) are both applied;
- events after `stop()` are ignored and the subscription is removed once;
- missed rows from two senders (1, 2, 3, 4) all arrive after a foreground resync and none is skipped;
- a chat missing from the chat-list fetch is removed with its cache and cursor; the following pass is not fetched for it;
- a failed chat-list fetch prunes nothing and reports `failed: 1`;
- a `connected` channel status runs a catch-up resync.

Not found by the tests: `SyncSource` / `SyncCacheStore` failures on individual tables are treated as a failed chat (`failed` count, cursor unchanged); the paging loop is bounded at 1000 pages and also stops if a page does not advance the cursor, so a misbehaving server cannot loop forever.

## Device verification (emulator-5560)

Metro on 8082, app already signed in from the earlier phases.

- `adb shell monkey -p com.dologram.app -c android.intent.category.LAUNCHER 1`: the app opens; `dumpsys window` shows `com.dologram.app/.MainActivity` focused; logcat has no `FATAL EXCEPTION`, no `ReactNativeJS` error or warning.
- `dologram://dev/sync` (delivered to the running instance) renders AND-xx dev tools: `Sync debug`, `sync: synced · online`, `0 chats · 0 pruned · 0 failed`, cached counts and `No chat synced yet.`
- Tapping `Resync now` (bounds 418,499–662,559) completes and returns to `sync: synced · online` with `0 chats · 0 pruned · 0 failed`; logcat shows no JS error.
- Zero chats is correct for this project today: the hosted project's public tables have no chat rows for the account (Phase 4 record: `chats` 0 rows), so the chat-list fetch legitimately returns nothing and there is no message, media or reaction page to fetch.

## Optional remaining verification (pending manual; not part of the exit gate)

1. **Non-empty resync on device.** Needs a chat with at least two messages, one media row and one reaction, and the v14 6.2 schema on the hosted project (`messages.message_id`, `messages.seq`, `messages.sync_seq`, `message_media.sync_seq`, `reactions.sync_seq`). Phase 5 recorded that the applied migrations do not provide these columns, so a paged resync cannot be exercised against H yet. No backend change was made here (out of scope).
   Steps once both exist: sign in on two devices → open `dologram://dev/sync` → cursor and message count appear → send a message from the other device → the count rises without tapping Resync → force-stop, receive two more messages and an edit, reopen the app → the cursor, messages and edited content match the server.
2. **T-13 across two devices** (background, receive from the other device, foreground) as written in v14 Section 7.2. The automated half above covers the same rules with fakes; the two-device run needs test accounts A and B from M1-08, which Phase 4 recorded as not seeded.
3. **Prune after removal from a group** on device. Phase 8 creates groups; groups do not exist on H yet.

## Exit gate

`npm --workspace @dologram/shared run test` exits 0 with 100/100, including the 12 sync tests, and `npm run typecheck` exits 0 in both workspaces. `npm --workspace @dologram/mobile run test` still exits 1 on the six pre-existing failures, and lint still reports the three pre-existing `sign-up.tsx` problems; both are identical to the baseline. The device half of M2-05 is **optional, pending manual verification** under the plan's §1 rule: it needs backend data and the 6.2 schema, not a client change.
