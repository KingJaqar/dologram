# Phase 5 — Local database and queue core

Date: 2026-11-10
Scope: M2-02, M2-03, LS-1 to LS-3, LS-7 to LS-9, D-06, D-10, D-27, D-77, D-93, D-109, T-09, T-18.

## Environment

- Repository root `G:\codebase\DoloGram`, branch `main`. The whole tree is untracked in git (no commit was made; none was authorized).
- Device: `emulator-5560` (SM-S908B, Android 12) — the running instance that has `com.dologram.app` installed and was the Phase 3 device. The plan names `emulator-5554` (MuMu); that instance is **not running** on this computer now (`adb devices` lists 5556, 5558, 5560 only). 5556 (Android 9) and 5558 were not touched.
- Metro on port 8082 with `adb -s emulator-5560 reverse tcp:8082 tcp:8082` (the Phase 0 port deviation: something else owns 8081).

## Files

Shared (`packages/shared/src/queue/`):

| File | Purpose |
| --- | --- |
| `types.ts` | `QueueItem` (`temp_id`, `payload`, `status`, `retry_count`, `next_attempt_at`, `row_may_exist`, `last_error`, `created_at`), LS-2 statuses, `LocalQueueStore`, `QueueTiming`, `EnqueueResult` |
| `backoff.ts` | D-27 exponential backoff with ±20 % jitter and the 60 s cap; D-77 rate-limit delay |
| `core.ts` | state machine: enqueue (200-item limit), per-chat head selection, beginAttempt, applyResult (sent / failed / retrying / deferred), Retry, Discard, makeAllDue, startup reset |
| `runner.ts` | single-flight drain loop with injected `deliver`, connectivity handler |
| `memoryStore.ts` | in-memory `LocalQueueStore` used by the Vitest suites |
| `index.ts` | barrel (platform-free; no React Native import) |
| `__tests__/queue-core.test.ts` | 16 tests |
| `__tests__/queue-runner.test.ts` | 5 tests with a real Supabase client and an injected fetch |

Mobile (`apps/mobile`):

| File | Purpose |
| --- | --- |
| `src/queue/db.ts` | single `dologram.db` expo-sqlite database, `PRAGMA user_version` migration; queue table, cache tables of 6.2, `sync_state` |
| `src/queue/store.ts` | `LocalQueueStore` adapter over expo-sqlite |
| `src/queue/localQueue.ts` | `enqueueTextMessage`, `getUnsentItems`, `retryQueueItem`, `discardQueueItem`, cached core |
| `src/queue/worker.ts` | `startQueueWorker` (AppState + NetInfo + 15 s timer, foreground only) and `deliverQueueItem` |
| `app/_layout.tsx` | starts the worker while `signedIn`, stops it otherwise |
| `app/dev/queue.tsx` | dev-tools screen (D-160): enqueue, status list, Retry, Discard |

Supporting change outside the queue files: `classifyError(error, responseStatus?)` in `packages/shared/src/errors.ts`, and `insertMessage` / `softDeleteMessage` now pass the response `status`. Reason: supabase-js returns status `0` beside the error object when the fetch itself throws, and the repositories dropped it, so a lost connection was classified as a server error instead of `network` (D-77, LS-7 labels). One test was added to `classify-error.test.ts`.

## Baseline before editing

| Check | Baseline | Final | Delta |
| --- | --- | --- | --- |
| `npm --workspace @dologram/shared run typecheck` | exit 0 | exit 0 | none |
| `npm --workspace @dologram/mobile run typecheck` | exit 0 | exit 0 | none |
| `npm --workspace @dologram/shared run test` | 66 passed | 88 passed | +22 (21 queue, 1 classify) |
| `npm --workspace @dologram/mobile run test` | 6 failed / 38 passed (signIn, signUp) | 6 failed / 38 passed (same suites) | none |
| `npm --workspace @dologram/mobile run lint` | not captured before the first edit; the two errors and one warning that remain are all in `app/sign-up.tsx`, which this phase did not touch | 3 problems, all in `app/sign-up.tsx` | my own `dev/queue.tsx` error was found and fixed |
| `npx expo export --platform android` | — | exit 0, bundle 6.4 MB | new modules resolve |

Pre-existing failures (unchanged, not fixed — outside this phase's scope):

- `src/__tests__/signIn.test.tsx` (4 tests) and `src/__tests__/signUp.test.tsx` (2 tests): the tests query the accessibility label `Email`, but the Phase 4 rev. 2026-11-09 screen labels the field `Email or username`. Test/spec drift from Phase 4.
- `app/sign-up.tsx`: `no-restricted-syntax` color literal at 55:33 (D-138/M4-02), `react-hooks/set-state-in-effect` at 221:7, unused `data` at 287:15. Phase 4 code.

## Shared test coverage (Vitest)

`packages/shared/src/queue/__tests__/queue-core.test.ts` (16):

- item written to the store with `status: queued`, `retry_count: 0`, `row_may_exist: false` before any delivery;
- the 201st unsent item is refused with `queueFull`, and queued/sending/failed all count toward the 200 limit;
- only the oldest unsent item of each chat is due;
- a backing-off or failed head blocks the rest of its chat;
- backoff 2 s / 4 s / 8 s, capped at 60 s, jitter inside ±20 %;
- `delivered` (23505) marks the item sent;
- DG429 defers by 17 s without incrementing `retry_count`;
- eight failures end in `failed` with `retry_count = 8`, then Retry resets the count and makes it due;
- `init()` returns a leftover `sending` item to `queued` (LS-9);
- `makeAllDue` makes a future-dated item due (D-77);
- Discard: allowed offline while the row cannot exist, refused offline once an attempt was made, soft-deletes online, and keeps the item when the soft delete fails on the network.

`packages/shared/src/queue/__tests__/queue-runner.test.ts` (5), using `createDgClient` with an injected fetch and the real `insertMessage`:

- T-09: the first POST stores the row and the response is lost (fetch throws); the retry receives `409 / 23505`; the second drain reports `sent`, exactly one server row exists and the item is never sent again; `last_error` is `network` and `retry_count` 1;
- T-18: every attempt fails with a 500 until the cap; the item stays `failed` and visible, blocks its chat, and a further drain attempts nothing;
- DG429 with `details: "17"`: deferred, `retry_count` unchanged, not due before 17 s, then delivered;
- `handleConnectivity(true)` makes a future-dated item due and delivers it;
- `handleConnectivity(false)` attempts nothing (no request leaves the device).

## Device verification

Reached:

- The app builds and loads from Metro on `emulator-5560` with the new `app/_layout.tsx` import and the dev queue screen in the bundle (`expo export` exit 0; the sign-in screen renders after a force-stop and relaunch).
- No JavaScript error or native crash in `adb logcat` after the relaunch.

Blocked (no session): the queue only runs for a signed-in user, and the dev queue screen sits behind the auth guard, so every on-device queue check needs a session. Two backend prerequisites fail:

1. **Email confirmation is ON.** `/auth/v1/settings` reports `mailer_autoconfirm: false`, contradicting M0-05 ("email confirmation OFF for now", D-163). A self-service sign-up for `dg.phase5.one@gmail.com` returned `429 over_email_send_rate_limit` after GoTrue refused to send the confirmation mail, and `token?grant_type=password` answers `400 invalid_credentials`, so the account does not exist. No confirmed test account password is available in the repository or the supplied materials (there is no root `.env.test`), and the admin API would need the `service_role` key, which must not enter this repository or a client bundle.
2. **The hosted schema does not match the contract.** `GET /rest/v1/messages?select=message_id` answers `42703 column messages.message_id does not exist`, and the same for `chats.chat_id`. The migrations in `supabase/migrations` create `messages(id, chat_id, sender_id, content, image_url, reply_to, created_at)` and `chats(id, ...)`; they have no `message_id`, `attachment_count`, `seq`, `sync_seq`, `edited_at` or `deleted_at`. Even with a session, `insertMessage` cannot store a row against this project, so the exit gate's "drains a queued text item end-to-end" cannot be demonstrated until M1-01 to M1-03 are applied as v14 6.2 defines them.

Recorded as **optional, pending manual verification** (owner instruction 2026-11-10; plan §1 rule), with the exact device steps in the plan. Neither item needs a client change, so neither blocks Phase 5 or Phase 6.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Text item persisted before any network attempt (LS-1, D-10) | met (code + Vitest) |
| Exactly-once delivery, 23505 = delivered (LS-7 to LS-9) | met (Vitest T-09, injected fetch) |
| Exponential backoff with jitter, stop at `maxAttempts`, `maxUnsent` cap (D-27, D-93) | met (Vitest) |
| DG429 defers by `retryAfterSec` (D-77, C-1) | met (Vitest; M3-08 still absent on H) |
| T-09 and T-18 exercise the queue paths | met (automated halves) |
| Typecheck, lint, tests with no new errors | met (no new errors; pre-existing failures listed above) |
| Worker drains a queued item end-to-end on the device | **optional, pending manual verification** — needs M0-05 and the M1 6.2 schema on H |

## Phase status

**Complete.** Code, automated checks and documentation are done: shared suite 88/88, both workspaces typecheck, `expo export` bundles, no new mobile test or lint failure. One optional device item stays pending manual verification for backend reasons.
