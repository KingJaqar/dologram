# Phase 7 — Chat list and archive view

Date: 2026-11-10
Scope: M2-08, F2, AND-03, AND-04, CMP-09, CMP-13, CMP-14, D-44, D-92, D-94, T-04 and T-36 (Android rendering share).

## Environment

- Repository root `G:\codebase\DoloGram`, branch `main`. The whole tree is untracked in git (no commit was made; none was authorized).
- Device: `emulator-5560` (Android 12, MuMu Player instance `dologram`, index 3, ADB port 16480), the instance that has `com.dologram.app` installed. `emulator-5556` (an unrelated Android 9 emulator) and `emulator-5558` were not touched. Same recorded deviation as Phases 5 and 6: the plan names `emulator-5554`, which is not running.
- Metro on port 8090 with `adb -s emulator-5560 reverse tcp:8090 tcp:8090` (8081–8083 are held by unrelated processes; the port is not referenced by any file).
- The hosted project `jsyqtfsidtfahytcwutp` lists no chats for the signed-in account, so the live list is empty. The row rendering, ordering, unread count, Archive and offline paths were verified with cache rows written into the device database (see "Device verification"); the same run confirmed the D-91 prune removes rows the server does not list, so nothing seeded can linger.

## Plan discrepancy

The source plan's Phase 7 body contained only the Section 4 overview row; the step list, deliverables, acceptance criteria and exit gate were never transcribed, exactly as for Phases 5 and 6. The requirements were reconstructed from that row ("The chat list and Archive render from the cache in the D-94 order with banners and unread counts"), from M2-08, F2, AND-03, AND-04, CMP-09, CMP-13 and CMP-14 of v14, and from D-44, D-92 and D-94. They are recorded against the work that was done.

## Files

Shared, `packages/shared/src/chatList/`:

| File | Purpose |
| --- | --- |
| `types.ts` | `ChatListSourceRow` (one cached chat as the query returns it), `ChatListItem` (what CMP-09 renders), `BuildChatListOptions` |
| `preview.ts` | `stripMarkdown` (D-30/D-99 markers removed), `messagePreview` (text, attachment word, "Deleted message") |
| `format.ts` | `formatChatListTime`: today's time, "Yesterday", weekday within seven days, then the date, in the device locale and time zone (D-109) |
| `build.ts` | D-94 ordering, archive split, titles, group prefix, mute flag, Seen/Sent status, accessibility label |
| `index.ts` | barrel |
| `__tests__/chat-list.test.ts` | 12 Vitest tests |

Shared, supporting changes:

| File | Addition |
| --- | --- |
| `db/repositories/profiles.ts` | `ProfileRow`, `listProfilesByIds(client, userIds)` (RLS returns the caller's own row and users who share a chat, 10.5) |
| `sync/types.ts` | `SyncSource.fetchProfiles`, `SyncCacheStore.upsertProfile` |
| `sync/engine.ts` | caches the profiles of a chat's members with the chat; a profile failure does not block the chat's history |
| `sync/__tests__/sync-engine.test.ts` | +1 test: a chat's member display names are cached |
| `theme/icons.ts` | `action.folder` → `folder-plus` (12.3: "Add to folder; the add button at the end of the folder tabs") |
| `strings/index.ts` | preview words, "Yesterday", "You: ", "Unknown user", "All", "Folders", "Low Signal", "No archived chats" and its body, the empty-list wording |
| `index.ts` | exports the chat-list module, `listProfilesByIds` and `ProfileRow` |

Mobile, `apps/mobile`:

| File | Purpose |
| --- | --- |
| `src/chatList/query.ts` | the single chat-list SQL statement (D-44, proposed D-159): chat, own member row, newest message, its sender name and media type, unread count, other members' highest read seq, the other member of a direct chat |
| `src/chatList/useChatList.ts` | one read feeding both screens; reload on cache change, on focus and on pull to refresh; loading/error/refreshing state |
| `src/sync/cacheEvents.ts` | cache-change notifications |
| `src/sync/lifecycle.ts` | notifies after a merged event and after a finished pass |
| `src/sync/cacheStore.ts` | writes the new message columns, `last_read_seq` and profiles |
| `src/sync/source.ts` | `fetchProfiles` |
| `src/queue/db.ts` | local schema version 2: `sender_id`, `created_at`, `deleted_at`, `last_read_seq`, `cache_profiles`, the `(chat_id, created_at)` index, and a backfill from the stored payloads |
| `src/components/ChatRow.tsx` | CMP-09 row, the "Archived (n)" row and the CMP-18 skeleton row |
| `src/components/ConnectionBanner.tsx` | CMP-13 offline banner and Low Signal chip |
| `src/components/FolderTabs.tsx` | CMP-14 folder tabs ("All", the folders, the Folders button) |
| `src/components/__tests__/ChatRow.test.tsx` | 4 Jest render tests |
| `app/(main)/(tabs)/index.tsx` | AND-03 rebuilt |
| `app/(main)/archive.tsx` | AND-04 rebuilt |

## Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` (both workspaces) | exit 0 |
| `npm --workspace @dologram/shared run test` | exit 0, 113/113 (100 before: +12 chat list, +1 profile caching) |
| `npm --workspace @dologram/mobile run test` | 42 passed, 6 failed — the same 6 pre-existing `signIn`/`signUp` label failures recorded in Phase 5 (the tests query `Email`, the screen labels the field `Email or username`) |
| `npx expo lint` (apps/mobile) | 3 problems, all pre-existing in `app/sign-up.tsx` (2 errors, 1 warning); no new problem |
| `npx expo export --platform android` | exit 0, Hermes bundle built with the new modules |

## Device verification

All screenshots are in this folder.

| Step | Result | Evidence |
| --- | --- | --- |
| Cold start with an empty cache | The chat list renders the wordmark, the CMP-14 row ("All" + Folders button) and the empty state; no JS error or warning in logcat | `phase7_01_empty.png` |
| Chat list with cached rows | "Archived (1)" row, then Fixture group (unread badge 1, "Grace Hopper: bold …", 11:30 AM), Saved Messages (bookmark avatar, "note to self", 10:05 AM), Grace Hopper (check icon, "see link", 9:00 AM) — D-94 order, group prefix, unread count, Sent status, Saved Messages title | `phase7_02_chat_list.png` |
| Archive | "Archived" with back, "Old group" row with "Grace Hopper: archived …" and "Yesterday"; no tab bar on the pushed screen (D-142) | `phase7_03_archive.png` |
| Row tap | Opens AND-05 with the chat id; the back button returns to the Archive | `phase7_04_row_opens_chat.png` |
| Offline cold start | The offline banner "Offline: messages send when connected" sits under the top bar above the folder tabs, and the full cached list still renders (F2) | `phase7_05_offline_banner.png` |
| Light theme | The same screen renders from the tokens in the light palette (D-138) | `phase7_06_light_theme.png` |
| Pull to refresh | Swipe down runs the resync; no JS error in logcat | logcat |
| D-91 prune | After the seeded rows were written, the next online pass removed every chat the server does not list (`cache_chats` count 0) and the list showed the empty state | logcat + `sqlite3` count |

The cache rows used for the device run were written with the device's own `sqlite3` into `files/SQLite/dologram.db` (four chats, five messages, two profiles) while the app was stopped, then read through the real query and builder after a tab switch. No backend row was created or changed.

## Optional remaining verification

- The Low Signal chip on a real 2G or 3G cellular connection, and its tap into Settings. The chip is driven by the Automatic row of LS-5 (D-13); the emulator has no 2G/3G cellular network, and toggling its radio through ADB froze the instance (recovered by restarting the MuMu instance), so it was not exercised.
- The "n waiting for Wi-Fi" banner: it belongs to the LS-5 deferral of Phase 13 and reads that phase's deferred-item count.
- The CMP-18 skeleton: with a warm cache the first read finishes before the 300 ms delay, so it was not observed.
- T-04's two-device half and T-36's archive/mute/folder half: they need a second device and F9 (Phase 14).

## Notes

- The emulator froze twice while its radio was toggled through ADB (`svc wifi disable`, `cmd connectivity airplane-mode enable`). It was restarted with `MuMuManager.exe control -v 3 restart`; the app data and the seeded cache survived. This is an emulator limitation, not an app defect.
- AND-03's long-press row actions (Archive, Mute, Add to folder, Leave group) and AND-04's Unarchive are F9 (Phase 14, M4-01) and are not part of this phase.
- The LS-2 queued/sending/failed captions for pending items belong to Phase 9, where the pending rows are rendered in the chat.
