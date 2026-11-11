# Phase 16 Android hardening

Date: 2026-11-10

## Scope

Phase 16 only: M4-03, M4-04, 3.5 cross-cutting, D-54, D-95, D-134, D-136, T-40, T-42 and T-49 Android hardening. Phase 17 release-gate work was not started.

## Baseline

- `git status --short`: the repository was on `main` with the existing repository work untracked. Those files were treated as user-owned; no reset, checkout, cleanup, commit or push was performed.
- `npm run typecheck`: passed before edits.
- `npm --workspace packages/shared test`: passed, 19 files / 138 tests.
- `npm --workspace apps/mobile run lint`: failed only on pre-existing `apps/mobile/app/sign-up.tsx` findings at lines 55, 221 and 287 (2 errors, 1 warning).
- `npm --workspace apps/mobile test -- --runInBand`: produced no output and was stopped after the existing hang; the repository’s `test-output.txt` already records the pre-existing `MessageText.test.tsx` and `a11yLabels.test.tsx` failures.
- Android export from the correct `apps/mobile` directory reached Hermes but the sandbox could not write its temporary `.hbc` file. The same export was rerun with host authorization after implementation and passed.

## Changed behavior

- Added the shared 300 ms delayed-loading hook and delayed spinner component. Applied them to route loading, buttons, chat pagination, media loading, forwarding, reset-password exchange, and attachment/share states.
- Standardized repeatable chat load errors on `strings.common.couldNotLoad` with the shared Retry button.
- Added Pressable label coverage as a TypeScript source test and added compact-control `hitSlop` coverage. Refactored the bottom-sheet content wrapper so only the scrim is interactive. Dialogs use the React Native 0.86-supported `alert` role with modal semantics.
- Added incoming-message and failed-message accessibility announcements in the chat route.
- Updated shared motion tokens to the v14 timings and made reduced-motion fades use 100 ms; skeleton shimmer stops under reduced motion. Action toasts use the 6000 ms action duration.
- Added test-build latency capture in the queue and cache paths with bounded samples and p95 summary.
- Added `npm run scan:mobile-bundle`, which scans the exported Android bundle for forbidden secret variable names and long `sb_secret_` tokens.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass; mobile and shared TypeScript checks passed. |
| `npm --workspace packages/shared test` | Pass; 19 files / 138 tests. |
| Targeted Jest: latency + delayed-loading + Pressable source tests | Pass; 3 suites / 4 tests. |
| Scoped ESLint excluding pre-existing `app/sign-up.tsx` | Pass. |
| Full mobile ESLint | Pre-existing failure only: `sign-up.tsx` lines 55 and 221 errors, line 287 warning. |
| Full mobile Jest | Pre-existing environment hang: no output after 60 seconds; stopped. Not claimed as passing. |
| `npx expo export --platform android` from `apps/mobile` | Pass with host authorization; Metro bundled 3,802 modules and exported `apps/mobile/dist`. |
| `npm run scan:mobile-bundle` | Pass; scanned 63 exported files. |
| `adb devices` | Pass with host authorization. `127.0.0.1:16480` contains `com.dologram.app`; no other emulator was modified. |

## Acceptance status

- M4-03 / D-95 / T-40 Android loading, errors and labels: met in source and targeted checks. Full mobile Jest remains a pre-existing harness issue.
- D-54 / D-136 accessibility roles, announcements and touch-target coverage: met in source and the Pressable scan.
- D-134 motion and reduced-motion rules: met in shared tokens, ThemeProvider, skeleton and animated component usage.
- M4-04 latency capture: met in code and unit tests. The two-client 100-message p95 run is optional manual verification.
- T-42 bundle secret scan: met for the current exported Android bundle.
- T-49 Android source share: met in changed source; the hosted D + W flow is optional manual verification.

## Optional remaining verification

1. On MuMu `127.0.0.1:16480`, install/load the current development JavaScript, enable TalkBack, exercise a slow/error path and confirm delayed loading, Retry, touch targets and chat announcements; check logs for new errors.
2. With hosted fixtures and the web client, run the T-01 100-message latency capture and verify p95 is below 2,000 ms.
3. Repeat the secret scan on the standalone EAS bundle when Phase 17 creates it.

Phase status: Complete. Current-phase progress: 100%. Overall Android progress: 17 of 20 phases (85%). Phase 17 is ready to start; it was not started here.
