# Phase 17 context index

Date: 2026-11-10

## Packet identity

- Packet: `repomix-phase17.xml`
- Selector: plan, applicable mobile instructions, Expo/EAS/app config and manifests, mobile routes/source, shared source, bundle scanner, Phase 16 evidence, build/version records.
- Omitted by selector: tests, generated native folders, `.expo`, `apps/mobile/dist`, `node_modules`; these were validated directly where needed.
- Result: 119 included files; 92,878-token estimate; Repomix security check passed.
- SHA-256: `7885D80716FBDBADAF7E2B839738C549A4E103C658681015EA509A709E9D8F6F`.
- Final post-documentation supplemental packet: `repomix-phase17-final.xml`, SHA-256 `A50A285A8A47EBAE8EF0D760E34698152612128525AC92AAB33B876B2388B3D2`, 120 included files, 96,154-token estimate; security check passed. It includes the reconstructed Phase 17 plan section and report, while omitting this context index to avoid a self-referential packet.

## Required reads and source validation

- `apps/mobile/AGENTS.md`: read completely. Only repository instruction file found; no `CLAUDE.md`.
- `Plans/DoloGram_Android_Implementation_Plan.md`: read overall context, conflicts/gaps, prerequisites, phase overview, Phase 16 evidence and reconstructed Phase 17 requirements.
- `docs/_v14_dump.txt`: verified M4-07’s forty-test list, R-6 APK/internal-distribution requirements, PF-22 standalone-build requirement, D-53/D-66 cloud-only EAS restriction and Section 10.7 environments.
- Expo SDK 57 Router page: `https://docs.expo.dev/versions/v57.0.0/sdk/router/`.
- Expo Build/APK/EAS profile pages: `https://docs.expo.dev/build/introduction/`, `https://docs.expo.dev/build-reference/apk/`, `https://docs.expo.dev/build/eas-json/`.
- Original source verification: `apps/mobile/eas.json`, `apps/mobile/app.json`, `apps/mobile/package.json`, `package.json`, `scripts/scan-mobile-bundle.ps1`, Phase 16 evidence, and the current exported `apps/mobile/dist`.

## Verified findings

- `preview` is already an internal APK profile; no config edit was necessary.
- Expo public config resolves to SDK 57 and Android package `com.dologram.app`.
- Local export succeeded with host authorization and generated 63 scan-able files.
- The assigned MuMu installation is a development build from 2026-11-08; no local APK candidate exists under `apps/mobile/android`.
- EAS CLI is installed (`25.0.0`), but starting the EAS build would require prohibited third-party source egress. No workaround or local EAS build was attempted because the plan explicitly requires cloud EAS only.

## Verification results

- Typecheck: pass.
- Shared tests: pass, 19 files / 138 tests.
- Full mobile lint: pre-existing `sign-up.tsx` findings only.
- Full mobile Jest: known no-output hang; stopped once, not claimed passing.
- Local Android export: pass with host authorization.
- Real local bundle secret scan: pass, 63 files.
- Assigned MuMu launch smoke: pass to `MainActivity`; no fresh app crash signatures.
- Standalone APK install and M4-07 hosted gate: not completed; blocked/pending as described in the phase report.

## Context boundaries

- No application source, dependencies, migrations, remote configuration, commits, pushes or deployments changed.
- Phase 18 and Phase 19 were not started.
