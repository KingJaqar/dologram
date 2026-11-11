# Phase 15 context index

Date: 2026-11-10

## Baseline and ownership

- Git baseline: branch `main`; all repository content was untracked at inspection time and there was no tracked diff. Existing files and changes were treated as user-owned and preserved.
- Existing phase records include the recoverable Phase 14 baseline snapshot; no commit, push, deployment, remote migration or external configuration change was made for Phase 15.
- Phase scope was limited to Android settings/theme/sign-out behavior and the documentation required to record this phase.
- A post-review race guard was added in the settings sign-out flow; the existing user-owned Phase 15 implementation was otherwise preserved.

## Verified source inputs

- `apps/mobile/AGENTS.md` read completely; no `CLAUDE.md` found.
- `Plans/DoloGram_Android_Implementation_Plan.md` read completely. Its overview listed Phase 15, but its body ended at Phase 14; the Phase 15 section was reconstructed and appended only for this selected phase.
- Phase 14 exit evidence was read from `docs/test-results/android/phase-14.md` and its context index; Phase 14 source dependencies were rechecked rather than trusted only from its status.
- Expo v57 documentation checked before implementation: [SDK v57 Constants](https://docs.expo.dev/versions/v57.0.0/sdk/constants/), [Expo SQLite v57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) and [Expo Router v57](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
- Version sources confirmed: `apps/mobile/package.json` pins Expo `~57.0.32`, expo-router `~57.0.30`, expo-constants `~57.0.23`, expo-sqlite `~57.0.4`, React Native `0.86.3`; local installed Supabase auth types confirm `signOut({ scope: 'local' })`.

## Requirement-to-source index

- Settings UI and all rows: `apps/mobile/app/(main)/(tabs)/settings.tsx` (`SettingsRow`, `ThemeSheet`, `SettingsScreen`).
- Theme storage and resolution: `apps/mobile/src/theme/ThemeProvider.tsx`; low-signal preference remains `apps/mobile/src/net/lowSignalPreferences.ts`.
- Sign-out wipe: `apps/mobile/src/storage/localData.ts` (`clearLocalData`); queue attachment removal in `apps/mobile/src/queue/attachmentFiles.ts`; SQLite schema/store in `apps/mobile/src/queue/db.ts` and `apps/mobile/src/queue/store.ts`.
- Lifecycle cleanup: `apps/mobile/src/queue/worker.ts` (`stopQueueWorker`) and `apps/mobile/src/sync/lifecycle.ts` (`stopSync`).
- Shared wording and contrast: `packages/shared/src/strings/index.ts`, `packages/shared/src/theme/tokens.ts`, `packages/shared/src/theme/contrast.test.ts`.
- Requirements: overview Phase 15 row in the plan; v14 `M4-02`, `AND-14`, `D-83`, `D-109` and `T-40` entries in `docs/_v14_dump.txt`.

## Changed-source identities

- `apps/mobile/app/(main)/(tabs)/settings.tsx`: `472722415867A1D2ED05E7213F0F19B800D73BE8CD6CB7FED85C143637CAB3B4`.
- `apps/mobile/src/storage/localData.ts`: `1EE6E0BA8C929A9D29CCA3551029DBAF7AC634AF8F7064ADCFA4D777EE866A44`.
- `apps/mobile/src/queue/worker.ts`: `63ED7C4DD5E953E3B35256A34410F077546FBACA00EE01098F69BB8C409BCE3F`.
- `apps/mobile/src/sync/lifecycle.ts`: `EE3AB3E84390B70637D5F7877943DCB132A75F26BE0F991250A833C2A8E70825`.
- `packages/shared/src/strings/index.ts`: `60F8FA37EE64CD237C4327295A61E85A0FE5DC83F6994D0CFB242F0AF92B3D1A`.

## Repomix packet

- Historical pre-edit packet: `repomix-phase15.xml`, generated with Repomix 1.18.1 from the confirmed Phase 15 scope.
- Final packet: `repomix-phase15-final.xml`, generated with Repomix 1.18.1 after edits.
- Final scope: 35 explicitly selected files covering instructions, plan, settings route, theme/provider/tokens/contrast, auth, lifecycle, queue/cache/storage, shared strings and v14 requirements; no suspicious files were detected.
- Final packet reported 197,555 tokens / 750,396 characters; packet size is a transport metric, not a claim about model usage.
- Final packet identity: SHA-256 `178046D31B01D806D48C355DAE3298223A2CB4B9651EAC607440FF7D575F2BF5`.
- Supplemental post-fix packet: `repomix-phase15-execution-final.xml`, generated with Repomix 1.18.1; SHA-256 `6023F5903599FAE41BC5C6E7822C63D25A2317569C77D2501C7DEEFE5BE1FB04`. Its changed settings and strings entries were read in bounded continuations and verified against original sources.
- Final XML manifest was checked for all intended entries, including the new `apps/mobile/src/storage/localData.ts` and its queue/event/store dependencies; changed entries were read in bounded continuations before original-source verification.

## XML reading record

- Pre-edit packet entries were read in bounded chunks at XML lines 154–353, 353–552, 1148–1758, 1759–2660 and 5328–5650, with requirement matches located separately in the plan/v14 dump.
- Final packet manifest was read first; final changed entries were read at XML lines 105–387 (settings), 2629–2871 (queue worker), 2872–2917 (local data), 2943–3095 (sync lifecycle), 3118–3263 (ThemeProvider), 5921–6268 (strings and contrast), then verified against original files.
- The large v14 dump and plan entries were not silently truncated: the relevant M4-02/AND-14/D-83/D-109/T-40 rows were located with ripgrep and read from the original source/packet context.

## Verification index and unresolved items

- Typecheck: final pass.
- Shared tests: final pass, 19 files / 138 tests.
- Changed-file ESLint: final pass.
- Full mobile lint: pre-existing `sign-up.tsx` failures only.
- Android export: final host-authorized pass; 3,799 modules bundled.
- MuMu smoke: settings/theme rows and Dark restart persistence observed; System restored; recent logcat had no fatal/React Native errors.
- Mobile Jest: baseline/focused runs stopped after no output; not claimed as passing.
- Unresolved optional check: live unsent-queue warning and post-sign-out wipe with a fixture account/queued attachment; no suitable unsent fixture was available without changing unrelated test data.
- Post-fix source hashes were refreshed after the sign-out count-loading guard; post-fix typecheck, shared tests, scoped lint and Android export passed, with full-lint findings unchanged and pre-existing.

## Final packet identity

- `Get-FileHash repomix-phase15-final.xml -Algorithm SHA256`: `178046D31B01D806D48C355DAE3298223A2CB4B9651EAC607440FF7D575F2BF5`.
