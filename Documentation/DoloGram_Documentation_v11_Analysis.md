# DoloGram Documentation v11 — Structured Analysis

Source: `DoloGram_Documentation_v11.docx` (1,404 extracted lines, Sections 1–11 read in full).
The path given, `G:\codebase\DoloGram\Documentation\`, has only v3–v7. The v11 file analysed here is the
untracked copy in the sibling worktree `.claude/worktrees/dologram-docs-analysis-61bfbe/Documentation/`
(dated 31 Oct 2026, 12:29).

Legend: **[A-unverified]** = the document marks the claim "Assumption" and records no check result yet.

---

## 1. Phase summary

### MVP (built by M1–M4; gate = every test in 7.2, i.e. T-01–T-22 and T-36–T-50)

1. **1-on-1 & group chat** — Realtime Postgres Changes on `messages`; user lookup via `find_user`, chat creation, membership rules. D-14, D-26, D-42, D-58, D-70, D-91.
2. **Text formatting** — Markdown only (CommonMark basics), HTML shown as literal text; mobile `react-native-markdown-display`, web `react-markdown`; headings/lists/images rendered as plain text. D-05, D-30, D-99. **[A-unverified]** mobile library works on the pinned Expo SDK; **[A-unverified]** web shows HTML tags rather than dropping them (settled by T-12).
3. **Message edit / delete** — UPDATE of `content` or `deleted_at`, sender only, no time limit; the server sets `edited_at`/`deleted_at` and clears content on delete. D-22, D-76.
4. **Reply** — `reply_to` column; must be in the same chat (trigger). D-90.
5. **Forward** — new message with the copied text; attachments not forwarded in the MVP; no attribution. D-31, D-50, D-109(4).
6. **Reactions** — `reactions` table, 8-emoji palette, at most 3 active per user per message, removed by UPDATE of `removed_at` (never DELETE). D-22, D-76.
7. **Read receipts** — `chat_members.last_read_seq` (never decreases) plus a Broadcast read hint on `chat:<id>`. D-23, D-92.
8. **Typing indicators** — Broadcast on private `chat:<id>`, 1 event per 3 s, hides after 5 s, advisory. D-14, D-57, D-92.
9. **Photos, videos, voice notes, files** — two private buckets by size class (10 MB / 50 MB), signed URLs (1 h), TUS above 6 MB, at most 10 attachments, media rows bound to uploaded objects. D-29, D-39, D-75, D-90.
10. **Saved Messages** — a direct chat whose only member is the user, created by the `auth.users` insert trigger. D-70.
11. **Folders, archive, mute** — `chat_members.archived/muted_until`, `folders` + `folder_chats`; synced across devices; disabled offline. D-09, D-24, D-94, D-109(1).
12. **Dark mode** — System/Light/Dark, stored per device. D-35, D-83, D-95.
13. **Low Signal Mode** — device-local queue, LS-1 to LS-10 (2G/3G trigger and Force toggle, 5 MB threshold, 1280 px / q0.7 compression, backoff, idempotency). D-10, D-13, D-17, D-19, D-27, D-28, D-77, D-93.
14. **Admin web (owner only)** — local Next.js on 127.0.0.1:3100, passcode, no content access, audit log. D-102 to D-108.

### V2 (built by M5; gate = T-23–T-33 plus regression)

15. **Push notifications** — DB webhook → Edge Function → Expo Push API, `push_tokens`, payload carries only `chat_id`, bearer secret. D-25, D-49, D-96. **[A-unverified]** Firebase needs no billing account.
16. **App lock** — `expo-local-authentication`, re-lock after Immediately / 1 min / 5 min. D-21, D-49, D-100.
17. **Stickers & GIFs (custom only)** — bundled assets, `kind=sticker`, `p_` prefix = premium. D-59, D-67, D-97.
18. **Polls** — `polls` + `poll_votes`, single-choice, non-anonymous, 2–10 options. D-59, D-67.
19. **Location (static)** — coordinates card plus an "Open in Maps" link, no map SDK. D-49.
20. **Secret Chats (E2EE)** — libsodium `crypto_box`, X25519 key per chat, `secret_keys` table, 1-on-1, text-only, mobile-only. D-33, D-49, D-68, D-90, D-91.
21. **Self-destructing messages** — `ttl_seconds`/`expires_at`, pg_cron every minute soft-deletes. D-59, D-69.
22. **Admin roles & group permissions** — `role`, `restricted_until`. D-71, D-109(2).
23. **Premium cosmetics** — `premium_flags` (badge, extra_reactions, premium_stickers), set by the owner only. D-32, D-72, D-87.
24. *(Not a 3.2 row, but V2 tasks)* attachment forwarding (M5-12, D-50) and profile editing with avatars (M5-13, D-51, D-72, D-89).

### V3 (built by M6; gate = T-34, T-35)

25. **Voice / video calls** — WebRTC 1-on-1 in direct chats, Google STUN only, no TURN, `call:<chat_id>` signalling, `user:<user_id>` invitations, 20 s connect timeout and 30 s no-answer timeout. D-34, D-73, D-98. **[A-unverified]** `react-native-webrtc` Expo plugin supports the SDK (fallback: web-only calls).

---

## 2. Data model (Section 6.2 + policy table 10.5)

Shared rules: RLS is on for every public table, and an operation with no policy is denied. Policies call `(select private.is_active_user())`, which is false while the user must change their password, is banned, or is listed in `private.disabled_users`. Membership checks use SECURITY DEFINER helpers (D-44, D-78, D-79, D-86).

1. **profiles** — `user_id`, `username` (`^[a-z][a-z0-9_]{4,31}$`, unique), `display_name` (1–64), `avatar_url`, `premium_flags`. RLS: SELECT own row and rows of users who share a chat; INSERT/DELETE only through the trigger; no client UPDATE in the MVP; in V2 (M5-13) own row only, for `username`/`display_name`/`avatar_url`. `premium_flags` is readable by others but writable only through the secret key. Discovery is through `find_user()` (EXECUTE for authenticated users, exact case-insensitive match, 30 calls/min). D-38, D-42, D-87, D-88, D-89.
2. **chats** — `chat_id`, `type` (CHECK direct|group, plus secret in V2), `title` (group only, 1–64), `created_by`, `created_at`, `next_seq`, `direct_key` (unique, trigger-set). RLS: SELECT for members; INSERT with `created_by = caller`, 20 per day; no UPDATE/DELETE. D-40, D-46, D-70, D-91, D-109.
3. **chat_members** — `chat_id`, `user_id`, `role`, `joined_at`, `last_read_seq`, `archived`, `muted_until`, plus V2 `restricted_until`. RLS: SELECT for members. INSERT by the owner (owner/admins in V2), at most 100 members, and a new group member must already share a chat with the adder; direct chats have 2 rows and Saved Messages 1. UPDATE of own row, only `last_read_seq`/`archived`/`muted_until`. DELETE in groups only (owner removes a member, or a member leaves). V2: the owner sets `role`; the owner or an admin sets `restricted_until`. D-23, D-24, D-38, D-58, D-70, D-71, D-91.
4. **messages** — `message_id` (client UUID), `chat_id`, `sender_id`, `content` (≤4096, or ≤22,000 base64 in a secret chat), `reply_to`, `attachment_count` (0–10, immutable), `seq`, `sync_seq`, `edited_at`, `deleted_at`, `created_at`, plus V2 `kind`, `payload`, `ttl_seconds`, `expires_at`. RLS: SELECT for members. INSERT needs `sender_id = caller` and membership, with writable columns limited; in V2 the sender must not be restricted, and `p_` stickers need `premium_stickers`. UPDATE by the sender, only `content`/`deleted_at`. No DELETE. Integrity triggers enforce D-90. D-10, D-14, D-22, D-40, D-67, D-68, D-69, D-76, D-90, D-97.
5. **message_media** — `media_id`, `message_id`, `chat_id` (trigger-copied), `storage_path` (`{chat_id}/{media_id}`), `media_type`, `compressed`, `sync_seq`. RLS: SELECT for members only while the parent message is neither deleted nor expired. INSERT only on one's own message, up to `attachment_count`, for an object the caller uploaded with a matching type. No UPDATE/DELETE. V2: refused in secret chats. D-38, D-39, D-69, D-75, D-90.
6. **reactions** — PK (`message_id`, `user_id`, `emoji`), `chat_id`, `removed_at`, `sync_seq`. RLS: SELECT for members; INSERT own rows with the palette CHECK and the 3-active limit; UPDATE own rows, `removed_at` only; no DELETE. V2: not restricted, and none in secret chats. D-22, D-72, D-76.
7. **folders** — `folder_id`, `user_id`, `name` (1–32), at most 10 per user. **folder_chats** — `folder_id`, `chat_id`, with ON DELETE CASCADE from folders. RLS: own rows only, and a `folder_chats` row needs membership of the chat. D-24, D-84, D-94.
8. **rate_limits** (internal) — `user_id`, `action`, `tokens`, `refilled_at`. No client access; used by the triggers and `find_user`. D-29, D-46.
9. **private.disabled_users**, **private.initial_passwords**, **private.admin_audit** — in a schema that is not exposed; RLS on with no policy; written over `SUPABASE_DB_URL`. D-86, D-106.
10. **polls** (V2) — `poll_id` (= `message_id`), `chat_id`, `question`, `options`, `closed_at`, `sync_seq`. RLS: members read; the sender inserts and sets `closed_at`; no DELETE. D-67.
11. **poll_votes** (V2) — PK (`poll_id`, `user_id`), `chat_id`, `option_index`, `removed_at`, `sync_seq`. RLS: members read; insert own vote while the poll is open; UPDATE own row; no DELETE. D-67.
12. **secret_keys** (V2) — PK (`chat_id`, `user_id`), `public_key`, `created_at`. RLS: members of the secret chat read; insert own row once; no UPDATE/DELETE. D-68.
13. **push_tokens** (V2) — `token`, `user_id`, `created_at`, `last_seen_at`. RLS: own rows. D-25, D-96.
14. **storage.objects** — `chat-media-small` / `chat-media-large`: INSERT needs membership of the chat named by the first path segment; SELECT also needs a live `message_media` row; no UPDATE/DELETE. `avatars` (V2): read by anyone who may read the profile; write only in the caller's own folder, ≤512 KB. D-39, D-72, D-75.
15. **realtime.messages** — `chat:<id>` and `call:<id>` for active members; `user:<id>`: SELECT by that user only, INSERT by an active member of a shared direct chat. D-79, D-86, D-92, D-98.
16. **Device-only:** queue record (`temp_id`, `payload`, `status`, `retry_count`, `next_attempt_at`, ≤200 unsent items) and sync state (`chat_id`, `cursor`). D-10, D-40, D-93.

---

## 3. Open decisions

1. **No OD-nn item is open.** OD-01–OD-23 are closed (D-19, D-21–D-40, D-47–D-49), and Section 8 states "No decision is open."
2. What remains is not decisions but **pending verifications**, each with a check point and a fallback (D-85 register). These are the real blockers:
   1. `react-native-markdown-display` on the SDK — M2-06 → `react-native-marked`.
   2. `react-markdown` shows HTML as text — T-12 → an HTML-to-text handler.
   3. Device reports the 2G/3G generation — M3-05 (information only; never blocks).
   4. Firebase without billing — M5-10 → push not built, T-23 recorded N/A.
   5. `react-native-libsodium` functions — M5-07 → tweetnacl.
   6. `react-native-webrtc` on Expo — M6-01 → web-only calls.
   7. BEFORE UPDATE trigger on `auth.users` — M1-03 → `private.initial_passwords` check.
   8. Admin API ban sets `banned_until` — M1-08 → `private.disabled_users`.
   9. Supabase limits, pause rule and RLS-performance notes — M1-04 → correct 6.4 and 7.1.
   10. `expo-audio`/`expo-video` in the pinned SDK — M0-08 → `expo-av`.
   11. Expo session storage and auto-refresh — M2-04 → refresh on every foreground.
   12. Storage checks only the declared Content-Type — accepted, no check.
   13. Management API for a Free project — M4-08 → Dashboard links.
3. Outside D-85, two Assumptions also lack a register entry: **D-108** (Admin API delete cascades messages; checked at M4-08) and **D-109(9)** (browser parity; checked by T-50).
4. Owner actions that gate work (Section 8): create the contacts' accounts (M1-08/R-7), supply sticker files (M5-02), and create a Firebase project for push (M5-10).

---

## 4. Decision-log gaps, conflicts and ambiguities (Sections 3–7)

1. **D-69 vs D-90 — the self-destruct cleanup is blocked by its own trigger.** D-69 has pg_cron soft-delete expired messages *by UPDATE*. D-90 (and the M1-03 trigger) says "An update is rejected once `expires_at` has passed." No exemption for the cron role is specified, so T-29's "empty content with `deleted_at` set within one minute" cannot pass as written.
2. **D-108 vs D-14 / D-22 / D-40 — account deletion hard-deletes messages.** D-108 expects the Admin API delete to remove messages "through the schema's foreign keys" (a cascading DELETE). Everything else in the design assumes messages are never hard-deleted: DELETE events are not RLS-filtered (D-14), and resync works only on `sync_seq` changes (D-40). Other members' clients never learn those rows are gone, so their caches keep the content. Cascades through `reply_to`, `message_media` and `reactions` are also undefined. A soft-delete-then-detach path is needed.
3. **D-71 / 10.5 — restriction checks only INSERT.** The V2 row restricts `messages`, `reactions` and `poll_votes` **INSERT**. But re-adding a reaction (UPDATE that clears `removed_at`, D-76) and changing a vote (UPDATE of `option_index`) are UPDATEs, so a restricted member can still react and vote. Whether a restricted member may edit or delete their own messages is also unstated.
4. **D-109(6) vs LS-3 / LS-5 — foreground-only worker.** D-109 makes the delivery worker foreground-only. Section 3.4 was not amended: LS-3 still says the worker runs "whenever the device reports any connection", and LS-5 says "Wait for Wi-Fi" items are sent "as soon as the device reports a Wi-Fi connection". In the background neither happens, and the "waiting for Wi-Fi" UX is misleading.
5. **D-75 / D-69 "stop being readable at once" vs D-29 1-hour signed URLs.** The policies stop *new* downloads and signed URLs. A signed URL issued before the delete or expiry is a token checked without RLS at fetch time, so it likely keeps working for up to an hour. T-11 and T-29 test only creating a new URL. Either shorten the lifetime or state the window.
6. **D-79 "Realtime authorization stops at once" — likely only at channel join.** Realtime Authorization policies are evaluated when a channel is joined, not per message. A banned user already joined to `chat:<id>` probably keeps receiving typing and read hints until reconnect. Postgres Changes stops, because RLS uses `is_active_user()`. This needs verification; it is not in the D-85 register.
7. **D-78 wording vs D-86.** D-78 (and M1-02) still say `is_active_user()` is false "while the JWT carries the flag". D-86 says it reads `auth.users`, not the token. The amended rule is clear, but the superseded text was left in both places.
8. **D-80 vs D-91.** D-80 says "chats.type = channel stays reserved", while D-91 says channel "is not a stored value" and is rejected by CHECK. D-91 lists D-21, D-68 and D-70 as amended, but not D-80.
9. **D-76 / D-72 — emoji CHECK vs per-user premium palette.** A CHECK constraint cannot depend on the user's `premium_flags`, so the CHECK must allow all 12 emoji and the trigger must gate the extra 4. That split is implied but not stated. What happens to active extra reactions when the owner removes `extra_reactions` is undefined.
10. **LS-6 / M3-06 vs M3-07 — when the LS-5 row is evaluated.** The toggle is snapshotted at enqueue, but the network row is evaluated "at each attempt". T-08 expects a photo queued offline before the toggle to be sent "without Low Signal compression". That holds only if the cellular link is 4G/5G, and T-08's setup says only "cellular".
11. **Gate definitions vs N/A fallbacks.** 3.1 and M5-11 require all tests to "pass", but D-85 allows T-23 to be "recorded as not applicable" and T-34/T-35 to run browser-only. The gate wording should say "pass or recorded N/A per D-85".
12. **Naming collision: "D".** D is both the physical Android device (10.2 environments; T-01, T-34) and test account D (T-38, T-47). T-47 ("Account D") and T-38 ("Sessions of A, B, C and D") are readable only from context.

---

## 5. Implementation risk by milestone

1. **M0 — Pinning the Expo SDK (M0-08).** One choice determines whether five unverified libraries work: `react-native-markdown-display`, `@react-native-community/netinfo`, `expo-audio`/`expo-video`, `react-native-libsodium` and `react-native-webrtc` (6.3; D-85 items 1, 5, 6, 10). EAS Free gives 15 cloud builds a month and there is no local build or emulator (6.5, D-66), so a bad pin is slow to recover from.
2. **M1 — Auth-coupled RLS (M1-02/M1-03).** Every policy, Storage rule and Realtime rule depends on `private.is_active_user()` plus a BEFORE UPDATE trigger on `auth.users` that Supabase may refuse (**[A-unverified]**, D-78, D-85(7), Section 5.1). The `message_media` trigger also reads `storage.objects` owner and type (D-90). A mistake here is the 7.1 "High" RLS-exposure risk.
3. **M2 — Queue core plus sync ordering (M2-03, M2-05).** Strict per-chat row order, backoff that only wake-ups trigger, rate-limit waits that don't count as attempts, and Retry/Discard semantics (LS-7, D-77, D-93) sit on the critical path. They also rely on the commit-order `seq` claim of D-40, which only T-13 verifies (Section 6.4).
4. **M3 — Automatic 2G/3G detection (M3-05).** netinfo may not report a generation on the device (PR-9, D-85(3), Section 6.3). T-03 passes on an injected state, so M3 can exit with an Automatic trigger that never fires on real hardware. Secondary: TUS uploads (>6 MB) must leave an object whose `owner_id` and declared type satisfy the D-90 trigger.
5. **M4 — Admin web sequencing and Management API (M4-08).** The MVP gate needs T-42–T-48, yet 10.6 lists M4-08 last (step 13, after the V2/V3 steps) and the 10.9 critical path omits it. Its panels rely on the **[A-unverified]** Management API for Free projects (D-107), and deletion relies on the **[A-unverified]** cascade of D-108 (see §4.2).
6. **M5 — Secret Chat crypto (M5-07).** `react-native-libsodium` implements only part of libsodium-wrappers (7.1 "High"; D-85(5)). A fallback to tweetnacl would change the key and nonce code, and the T-28 known-answer vectors. A close second: Firebase billing for push (D-85(4), 6.1, **[A-unverified]**).
7. **M6 — STUN-only WebRTC and `react-native-webrtc` (M6-01).** Without TURN, calls across networks fail behind symmetric or carrier-grade NAT, which is common on mobile data (D-73, T-34). The Expo plugin's SDK support is **[A-unverified]** (D-73, D-85(6)).

---

## 6. Acceptance-test coverage

### T-01 – T-22 (Section 7.2)

1. **T-01** — F3 text delivery; 3.2 Chat; latency budget (D-35, D-82).
2. **T-02** — LS-1, LS-3, LS-8 (offline queue → single delivery).
3. **T-03** — LS-2, LS-5 Automatic row; 3.2 Low Signal Mode (photo compression).
4. **T-04** — F2, 3.2 Read receipts (D-23); multi-device history.
5. **T-05** — 5.2 SELECT isolation for messages, media and reactions (not `chats` or `chat_members` rows).
6. **T-06** — F4; 3.2 Edit/delete; 5.2 UPDATE messages.
7. **T-07** — LS-9; 3.2 Media (upload survives a kill).
8. **T-08** — LS-5 Forced row, LS-6.
9. **T-09** — LS-8 idempotency.
10. **T-10** — F1; 5.1 (D-47, D-78).
11. **T-11** — 5.3 Storage access; signed-URL lifetime (D-29).
12. **T-12** — 3.2 Text formatting; 5.5 Markdown safety (D-05, D-99).
13. **T-13** — 6.4 resync by `sync_seq`; D-40 commit order.
14. **T-14** — 6.4 channel authorization; 3.2 Typing (negative case only).
15. **T-15** — F3 and 5.2 INSERT rules.
16. **T-16** — 5.2 RLS enabled on every table.
17. **T-17** — F3: 3.2 Reply, Forward (text) and Reactions (soft removal).
18. **T-18** — LS-7 retry exhaustion.
19. **T-19** — LS-10 web queue.
20. **T-20** — LS-4 and F5 (text before attachments).
21. **T-21** — 5.5 rate limits, LS-7 and D-77 (D-29, D-46).
22. **T-22** — 5.2 profile privacy, `find_user` (D-42, D-88).

### Section 3.2 rows with no corresponding test

7. **No test in T-01–T-22** for these MVP rows: **Folders/archive/mute** (only T-36), **Dark mode** (only T-40) and **Admin web** (only T-42–T-48). **Saved Messages** has only "T-05 (variant)" in M2-12 and an incidental check in T-46. Every V2 and V3 row is tested only by T-23–T-35, as designed.
8. **No test anywhere in the document:**
   1. **Typing indicator, positive path** — that a member sees "typing…", plus the 3 s throttle and 5 s hide of D-57. T-14 checks only that a non-member is refused. M2-11 has an acceptance criterion but no T-number.
   2. **Media size and type caps** (D-29/D-75) — the 12 MB photo refusal and disallowed-type refusal appear only in the M1-06 and M3-01 criteria. T-11 and T-39 don't include them.
   3. **Receiving a video, voice note and file** — M3-03 criterion only. T-50 covers photo and voice note on web.
   4. **100-member cap** (D-58) — M2-07 criterion only. T-38 omits it.
   5. **Attachment-forward notice** (MVP) — a derived check in M3-04 (10.7 "Requirements with no test").

---

## Flagged Assumptions not yet verified

1. `react-native-markdown-display` works with the Expo SDK (3.2; M2-06).
2. Web `react-markdown` shows HTML tags rather than dropping them (3.2; T-12).
3. Supabase default Auth sign-in rate limits apply (F1; M0-06).
4. Storage checks the declared Content-Type, not the file bytes (5.3, D-90). Accepted as-is, so no check is planned.
5. Firebase needs no billing account for FCM (6.1, M5-10).
6. The netinfo version matches the Expo SDK (6.3).
7. Supabase recommends Broadcast over Postgres Changes at scale (6.4, D-43).
8. 2 million Realtime messages per month, from third-party guides (7.1, D-41).
9. A Free project pauses after 1 week of inactivity (7.1).
10. SMS providers charge per message (D-04). Low impact, because phone sign-in is removed.
11. RLS-performance guidance was recalled, not re-checked (D-44).
12. The Admin API ban works as documented (D-61; M1-08).
13. The `react-native-webrtc` Expo plugin supports the SDK (D-73; M6-01).
14. Supabase permits a BEFORE UPDATE trigger on `auth.users` (D-78; M1-03).
15. The Management API returns usage and settings and can restore a paused Free project (D-107; M4-08).
16. Admin API user deletion cascades to messages (D-108; M4-08). See the conflict in §4.2.
17. MediaRecorder, IndexedDB and the online event behave alike in the supported browsers (D-109(9); T-50).
18. Supabase Expo session storage and auto-refresh work as the guide says (M2-04; D-85(11)).

(D-52's S3-endpoint Assumption is superseded by D-74 and no longer applies.)
