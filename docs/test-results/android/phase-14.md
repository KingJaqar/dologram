# Phase 14 — Folders, archive and mute

Date: 2026-11-10

## Scope and discrepancies

The Android plan overview lists Phase 14 as “Folders, archive and mute”, but the supplied plan body ends after Phase 13 and contains no Phase 14 section. This execution reconstructed the selected phase from the overview row, Documentation v14 requirements F9/M4-01/AND-13/D-09/D-24/D-94/D-109/T-36, and the existing Phase 7/8 deferrals. No Phase 15 or later work was started.

`apps/mobile/AGENTS.md` is the only repository instruction file found. Its `src/app` route wording is stale; the current Expo Router app uses `apps/mobile/app`, which is the established repository convention. Local Supabase migrations currently stop at 009 and do not contain the contract-derived `folders`/`folder_chats` tables. This phase therefore adds the Android client, typed repository calls and local cache against the existing generated contract, but does not add or apply backend migrations. Hosted-schema/RLS and second-device checks remain manual verification.

Folder ordering uses `folder_id` because the contract has no `created_at` column for folders. This is a deliberate adaptation to the current schema, not a new field or migration.

## Implementation checklist

- [x] Added typed folder repository operations and public shared exports for list/create/rename/delete and folder-chat add/remove.
- [x] Added SQLite schema version 5 with per-user folder and folder-chat caches, cache replacement, and chat-leave cleanup.
- [x] Added `useFolders` with local-first loading, connected refresh, focus refresh, cache-change subscription, and offline-disabled mutations.
- [x] Added AND-13 folders screen with loading, empty, error/retry, create, rename, edit chats, delete, 1–32 validation/counter, ten-folder guard, and offline controls.
- [x] Wired folder tabs into the main chat list; selected folders filter active non-archived chats while the archive row remains available from “All”.
- [x] Added long-press organization actions on the main and archive lists: archive/unarchive, mute/unmute, mute durations, and folder membership.
- [x] Added the same mute/archive controls to chat info and exposed the per-user archived/muted state in the shared chat model.
- [x] Added visible loading, empty, error and mutation-error handling; network-required controls are disabled offline and show the existing connection messaging.
- [x] Added focus-based remote refresh so foregrounding a screen reloads current folder/member settings.
- [x] Added no new dependencies and made no backend, deployment, commit or push changes.

## Verification

### Baseline before edits

- `npm run typecheck`: passed for mobile and shared.
- `npm --workspace @dologram/shared run test`: passed, 19 files / 138 tests.
- `npm --workspace @dologram/mobile run lint`: failed only on pre-existing `apps/mobile/app/sign-up.tsx` findings (2 errors, 1 warning).
- Mobile Jest baseline produced no output for 60 seconds and was stopped; it was not reported as passing.

### Final checks

- `npm run typecheck`: passed for mobile and shared.
- `npm --workspace @dologram/shared run test`: passed, 19 files / 138 tests.
- Scoped Phase 14 ESLint: passed for all changed routes and modules.
- `npm --workspace @dologram/mobile run lint`: still reports only the pre-existing `app/sign-up.tsx` 2 errors and 1 warning; no Phase 14 lint findings.
- `npx expo export --platform android`: passed with host temp-file access; Metro bundled 3,798 modules and exported `apps/mobile/dist` with the Android Hermes bundle.
- Focused mobile Jest invocation using Jest 30’s `--testPathPatterns` option produced no output for 30 seconds and was stopped; this is environment-blocked, not a passing result.

## Acceptance status

- AND-13 folder management UI: **met in code and automated checks**.
- F9 archive/mute/file-chat behavior and per-user chat-info controls: **met in code and automated checks**.
- D-24 offline controls disabled with visible connection state: **met in code**; emulator interaction remains manual.
- D-94 active/archive/folder filtering and ordering: **met in code**; live cached data remains manual.
- D-09 mute timing/state: **met in code**; live notification behavior remains manual.
- T-36 cross-device sync, RLS isolation, 10-folder/32-character server enforcement: **pending manual verification** because the local repository has no Phase 14 backend migration and no second-device/hosted test fixture was available in this run.

## Manual verification still available

1. On the assigned `dologram` MuMu emulator, install the exported/dev Android build, sign in with a fixture account, open Folders, create/rename/edit/delete a folder, long-press an active and archived chat, and repeat the actions from chat info. Toggle offline and verify all network-required controls are disabled and “No connection” is visible.
2. With the Phase 14 hosted schema/RLS present, create folders and memberships for accounts A/B/C. Verify A’s folder changes appear after foreground on a second device, archived chats remain in Archive after new messages, muted chats retain position with their indicator, deleting a folder leaves chats intact, the 11th folder and 33-character name are rejected, and C cannot read or mutate A’s folders.

## Status

Phase 14 Android client scope: **Complete**. Optional live/backend/device acceptance is recorded above as pending manual verification and does not block this Android phase under the plan’s completion rule.

Current-phase progress: **100%**.

Overall project progress after this phase: **75% (15 of 20 overview phases)**.

Next phase: **ready to start, but intentionally not started per request**.
