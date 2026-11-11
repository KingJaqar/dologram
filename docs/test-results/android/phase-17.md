# Phase 17 Android MVP release gate

Date: 2026-11-10

## Scope

Phase 17 only: M4-07, R-6, PF-22 and the Android share of 3.1. Phase 18 and Phase 19 were not started.

## Repository and plan validation

- Working tree baseline: branch `main`; repository work was already untracked. Existing files were treated as user-owned and were not reset, reformatted or overwritten.
- Applicable instructions: `apps/mobile/AGENTS.md`; no `CLAUDE.md` exists. Its `src/app` route wording is stale; the repository uses `apps/mobile/app`.
- Plan discrepancy: the overview lists Phase 17, but the supplied plan had no Phase 17 body. The body was reconstructed only from M4-07, R-6, PF-22, 3.1, C-2 and v14 Section 10.7.
- Phase 16 dependency: its recorded status is Complete. The current source, phase evidence and release inputs were rechecked before this phase.
- Expo/RN versions: Expo `~57.0.32`, React Native `0.86.3`, React `19.2.3`; no package versions changed.

## Baseline

- `npm run typecheck`: pass; mobile and shared workspaces typechecked successfully.
- `npm --workspace packages/shared run test`: pass; 19 files / 138 tests. Existing Vite config warning only.
- `npm --workspace apps/mobile run lint`: pre-existing failure only; `app/sign-up.tsx` has 2 errors and 1 warning.
- `npm --workspace apps/mobile test -- --runInBand`: reproduced the known no-output hang and was stopped after 30 seconds; not claimed passing.
- `npx expo export --platform android` from `apps/mobile`: baseline sandbox run failed only when Hermes attempted to write its temp `.hbc` file outside the sandbox.

## Release checks

- Expo config: pass. `npx expo config --type public --json` resolved SDK `57.0.0`, package `com.dologram.app`, version `1.0.0`, and the expected Android permissions/plugins.
- Release profile: source-verified. `apps/mobile/eas.json` has `preview.distribution = internal` and `preview.android.buildType = apk`, with `environment = preview`.
- Local Android export: pass with host authorization for the Hermes temp directory; Metro bundled 3,803 modules, 61 assets and one 7 MB Hermes bundle into `apps/mobile/dist`.
- Bundle scan: pass. `npm run scan:mobile-bundle` scanned 63 files and found no forbidden secret variable names or long `sb_secret_` tokens.
- EAS standalone build: blocked before start. `eas build --platform android --profile preview --non-interactive` could not be authorized because it would upload private application source/configuration to Expo, which is prohibited by the current task authorization. No cloud build ID or APK exists.

## MuMu smoke check

- ADB was unavailable in the sandbox but worked with host authorization.
- Only assigned MuMu `127.0.0.1:16480` was inspected; no unrelated emulator was modified.
- `com.dologram.app` is installed as the Phase 0 development build: `versionName=1.0.0`, `versionCode=1`, `firstInstallTime=2026-11-08 19:50:46`.
- Force-stop and launch via `monkey` reached `com.dologram.app/.MainActivity`.
- Fresh app log scan found no `FATAL EXCEPTION`, `ReactNativeJS` or `AndroidRuntime` errors. Emulator/system warnings were not attributed to the app.
- This is not standalone-build verification because no Phase 17 APK was installed.

## M4-07 Android-share matrix

| Tests | Status |
| --- | --- |
| T-01, T-02, T-03, T-04, T-06, T-07, T-08, T-12, T-13, T-15, T-17, T-20, T-21, T-36, T-37, T-38, T-39, T-41, T-51, T-52 | Pending manual verification: standalone APK plus hosted fixtures and, where required, the web client. |
| T-09, T-18 | Pending manual verification for the device half; shared automated portions passed in prior phases. |
| T-05, T-10, T-11, T-14, T-16, T-22 | Out of Android UI scope; hosted API/Auth/Storage/RLS shares not claimed here. |
| T-19, T-50 | Out of Android scope; web-only. |
| T-40 | Pending manual verification on the standalone Android build; source and hardening checks passed in Phase 16. |
| T-42 | Pending complete cross-client bundle gate; local Android scan passed, web/admin shares are outside this phase. |
| T-43, T-44, T-45, T-46, T-47, T-48, T-53 | Out of Android scope; admin-web/API shares. |
| T-49 | Pending owner-attended Android Section 11 flow; source and automated checks passed in Phase 16. |

## Acceptance status

- M4-07 / 3.1: pending manual/integration verification; no hosted release-candidate run was claimed.
- R-6: not met; no standalone APK was built or installed.
- PF-22: not met; daily-use standalone build remains unavailable.
- Local release safety checks: met.

## Remaining blocker and exact next step

The only implementation-independent blocker is authorization to upload the private app source to Expo for the required EAS cloud build. If that authorization is granted, run:

```powershell
Push-Location apps/mobile
eas build --platform android --profile preview
Pop-Location
```

Then install only the resulting APK on MuMu `127.0.0.1:16480`, launch it, rerun the standalone bundle scan, and execute the pending Android-share rows above. No store submission, deployment, migration or commit is part of this phase.

Phase status: Partially complete / Blocked. Current-phase progress: 60%. Phase 18 is not ready to start.
