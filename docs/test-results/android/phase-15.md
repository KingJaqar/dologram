# Phase 15 — Settings and themes

Date: 2026-11-10

## Scope and discrepancies

The Android plan overview lists Phase 15 as “Settings and themes”, but the supplied plan body ended after Phase 14 and contained no Phase 15 section. This execution reconstructed the selected phase from the overview row and v14 M4-02, AND-14, D-83, D-109 and T-40. Phase 14 was confirmed complete in source and checks before editing. No Phase 16 or later work was started.

`apps/mobile/AGENTS.md` is the only repository instruction file found; no `CLAUDE.md` was found. Its `src/app` route wording is stale; the current Expo Router app uses `apps/mobile/app`. Expo SDK v57 documentation was checked before touching the React Native code, including Constants, SQLite and Router references. Expo SQLite’s documented database persistence and close/delete behavior informed the decision to clear account-scoped rows after stopping lifecycles while preserving per-device preferences, rather than deleting the shared database file.

## Implementation checklist

- [x] Completed the AND-14 settings screen with profile card, Appearance/Theme, Messages/Force Low Signal, Chats/Folders, Account/Change password/Sign out and About version/build.
- [x] Added accessible System/Light/Dark radio choices wired to the existing `ThemeProvider` and `dg.theme` AsyncStorage persistence.
- [x] Added process-wide queue-worker and sync-lifecycle stop helpers and `clearLocalData()` for queued attachment files plus queue/cache/sync SQLite rows.
- [x] Added unsent-item sign-out warning, visible failure toast, and confirmed `scope: 'local'` fallback after a remote sign-out error.
- [x] Guarded sign-out while the asynchronous unsent-item count is loading or retrying, so the warning cannot be bypassed by an immediate tap.
- [x] Kept settings code on theme tokens and added the required settings strings without adding dependencies.
- [x] Generated and analyzed the post-edit scoped Repomix packet; original-source verification followed packet analysis.

## Verification

### Baseline before edits

- `npm run typecheck`: passed for mobile and shared.
- `npm --workspace @dologram/shared run test`: passed, 19 files / 138 tests.
- `npm --workspace @dologram/mobile run lint`: failed only on pre-existing `apps/mobile/app/sign-up.tsx` findings (2 errors, 1 warning).
- Mobile Jest produced no output and was stopped; it was not reported as passing.
- Initial sandboxed `npx expo export --platform android` reached bundling but failed on the environment temp-file permission; this was re-run with host temp-file access after editing.

### Final checks

- `npm run typecheck`: passed for mobile and shared.
- `npm --workspace @dologram/shared run test`: passed, 19 files / 138 tests.
- Scoped Phase 15 ESLint for `settings.tsx`, `localData.ts`, `worker.ts` and `lifecycle.ts`: passed.
- `npm --workspace @dologram/mobile run lint`: still reports only the pre-existing `app/sign-up.tsx` 2 errors and 1 warning; no Phase 15 findings.
- `npx expo export --platform android`: passed with host temp-file access; Metro bundled 3,799 modules and exported `apps/mobile/dist`.
- Post-fix `npx expo export --platform android`: passed again with host temp-file access; Metro bundled 3,799 modules and exported `apps/mobile/dist`.
- MuMu `127.0.0.1:16480`: settings labels, System/Light/Dark radio options, Dark persistence after force-stop/reopen, Sign out and About rows were observed through the Android UI hierarchy; System was restored afterward.
- Recent assigned-emulator logcat: no `FATAL EXCEPTION`, `AndroidRuntime: FATAL` or React Native error lines.
- Mobile Jest remains environment-blocked because the prior baseline/focused invocations produced no output and were stopped; it is not claimed as passing.

## Acceptance status

- AND-14 settings surface: **met** in source, automated checks and assigned-emulator UI smoke verification.
- D-83/T-40 theme choices and restart persistence: **met** in source and assigned-emulator verification; shared contrast tests passed.
- D-109 sign-out warning and local wipe: **met in implementation**, including the count-loading race guard; live warning/wipe confirmation with an unsent fixture is **pending manual verification**.
- M4-02 token/accessibility requirements: **met** for the changed Android scope; full mobile lint has only pre-existing sign-up findings.
- T-40 web/cross-client parity and hosted RLS behavior: **out of scope for this Android phase**; optional manual follow-up only.

## Manual verification still available

1. On the assigned emulator, sign in with a fixture account, create one queued/unsent message with an attachment, open Settings → Sign out, verify the count-aware warning, cancel once, then confirm sign-out and inspect that queue/cache/sync rows and attachment copies are gone.
2. With hosted fixtures available, verify sign-out data isolation after a new sign-in; web parity remains for the future web plan.

## Execution update (2026-11-10)

- Changed `apps/mobile/app/(main)/(tabs)/settings.tsx` and `packages/shared/src/strings/index.ts` to make the unsent-count loading/error state visible and retryable before sign-out.
- Post-fix verification passed: root typecheck, shared Vitest (19 files/138 tests), Phase 15 scoped ESLint, and host-authorized Android export (3,799 modules). Full mobile lint retained only the pre-existing `app/sign-up.tsx` findings (2 errors, 1 warning).
- Supplemental Repomix packet: `repomix-phase15-execution-final.xml`, SHA-256 `6023F5903599FAE41BC5C6E7822C63D25A2317569C77D2501C7DEEFE5BE1FB04`.

## Status

Phase 15 Android client scope: **Complete**. The optional unsent-fixture and hosted checks do not block completion under the plan’s manual-verification rule.

Current-phase progress: **100%**.

Overall project progress after this phase: **80% (16 of 20 overview phases)**.

Next phase: **ready to start, but intentionally not started per request**.
