# Android Phase 13 — Low Signal Mode

Date: 2026-11-10 (Asia/Manila)
Status: Complete for implementation, automated checks and available device verification; optional manual verification remains.

## Scope and discrepancy

The plan overview defines Phase 13 as Low Signal Mode, but the supplied plan had no Phase 13 section. Requirements were reconstructed from the overview and v14 M3-05, M3-06, M3-07, M3-08, LS-5, LS-6, D-13, D-17, D-28, D-77 and D-117. The implementation stayed in `apps/mobile` and the existing platform-neutral queue in `packages/shared`; no backend migration or later phase was started.

`apps/mobile/AGENTS.md` was the only applicable repository instruction file. No `CLAUDE.md` was found. Its `src/app` route description is stale; the established Expo Router root is `apps/mobile/app`, so the existing route was extended in place.

## Changed behavior

- Added pure LS-5 classification and attachment policy with an injectable NetInfo subscription provider. No connection overrides Automatic and Forced; unknown cellular generation is Normal.
- Added the persisted `Force Low Signal Mode` setting using the existing AsyncStorage 2.2.0 dependency, including the settings row, accessible switch, Low Signal chip integration and restart persistence.
- Captured the Force preference in every newly queued text/attachment payload. Queue deserialization preserves it across restarts.
- Added first-class Wi-Fi deferral to the shared queue. A message row is stored before a deferred attachment, the item remains queued without consuming a retry attempt, and a Wi-Fi connectivity event makes it due immediately. A waiting item does not block later messages once its row is stored.
- Added SDK-57 JPEG compression for photos in the existing private queue copy. It uses quality 0.7, caps the long edge at 1280 px without enlarging, changes the MIME/size metadata, persists the compressed path and cleans generated cache files.
- Added visible `waiting for Wi-Fi`, `sending (low signal)` and DG429 countdown labels to pending chat messages.
- No dependency was added; `expo-image-manipulator` was already pinned at `~57.0.22`.

## Acceptance criteria

| Criterion | Status and evidence |
| --- | --- |
| M3-05 network wrapper, injectable provider and pure LS-5 matrix | Met in `src/net/netState.ts`, `src/net/lowSignal.ts` and 9 passing table/policy tests. Real 2G/3G device spike is optional, pending. |
| M3-06 persisted Force toggle, per-item snapshot and labels | Met in source, queue serialization/deserialization, render wiring and MuMu UI. The switch rendered with the required accessible label, persisted across one force-stop/reopen, and was restored to off. |
| M3-07 policy, photo compression and Wi-Fi deferral | Met in source/type validation, pure policy tests and shared queue deferral test. Native 2G/3G compression/upload observation is optional, pending. |
| M3-08 client DG429 wait without attempt counting | Met by the existing DG429 classifier/queue path, 138 shared tests, the new waiting-state handling and visible countdown label. Hosted rate-limit integration is optional, pending the absent M3-08 migration. |
| T-03, T-08, T-21 and T-41 Android/hosted flows | Optional, pending manual verification. They require a real 2G/3G network and/or the hosted `rate_limits` migration and fixtures. They do not block this phase under the plan’s 2026-11-10 manual-verification rule. |

## Verification

Baseline before edits:

- `npm run typecheck`: passed.
- `npm run lint --workspace @dologram/mobile`: pre-existing failure in `app/sign-up.tsx` (2 errors, 1 warning).
- `npm test --workspace @dologram/mobile -- --runInBand`: 13 suites passed, 2 suites failed; 70 passed tests and the same 6 sign-in/sign-up failures recorded by Phase 12.
- `npx expo export --platform android`: sandbox-only failure because Hermes could not write its temporary bytecode file; no source diagnostic was reported.

After implementation:

- `npm run typecheck`: passed for both workspaces.
- `npm test --workspace @dologram/shared`: 19 files, 138/138 tests passed. The existing Vite CommonJS/ESM warning remains.
- `npm test --workspace @dologram/mobile -- --runInBand src/net/__tests__/lowSignal.test.ts`: 1 suite, 9/9 passed.
- `npm test --workspace @dologram/mobile -- --runInBand src/media/__tests__/enqueue.test.ts src/components/__tests__/MediaComposer.test.tsx`: 2 suites, 5/5 passed.
- Scoped ESLint over all Phase 13 changed mobile source/routes: passed with no findings.
- Full `npm run lint --workspace @dologram/mobile`: retained only the baseline `app/sign-up.tsx` findings (2 errors, 1 warning); no Phase 13 lint findings were added.
- Full `npm test --workspace @dologram/mobile -- --runInBand`: 14 suites passed, 2 pre-existing sign-in/sign-up suites failed; 79 tests passed and the same 6 baseline failures remained.
- `npx expo export --platform android` under the authorized host environment: passed; Android bundle exported to the temporary export directory. The earlier sandbox-only Hermes temp-file failure was not reproduced outside the sandbox.
- MuMu `dologram`, ADB `127.0.0.1:16480`, package `com.dologram.app`: settings section and switch observed; checked state persisted across app restart; original off state restored. No other emulator was operated.

## Optional remaining verification

1. On the assigned MuMu instance or an Android device with injected/real 2G or 3G, enable Force Low Signal Mode, queue a photo and a video, and confirm the photo is JPEG/compressed and both media items show `waiting for Wi-Fi` until Wi-Fi returns.
2. With the hosted M3-08 migration and test fixtures available, run T-21 and verify DG429 waits preserve queue order and retry count.
3. Run T-03 and T-41 with the documented A/B fixtures, including a large video before a later text, and verify the stored message row/placeholder ordering.

Phase status (2026-11-10): **Complete.** Current-phase implementation progress: **100%**. Overall Android phase progress: **14 of 20, 70%**. No Phase 14 or later work was started.
