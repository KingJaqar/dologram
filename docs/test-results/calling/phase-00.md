# Calling Phase 0 execution result

2026-11-11, Asia/Manila. **Complete: Phase 0 100%; overall calling plan11%
(5/45 equal-weight required items).** Phases1–8 have not started.

Phase0's deliverable is feasibility, an executable baseline and finalized
contracts. No production calling code, dependencies, migrations, native config,
build/upload, deployment or external service changes were made. No commits/pushes.

## Five required acceptance items

| Item | Status | Direct evidence |
| --- | --- | --- |
| 1. Current baseline, harness/results and recoverable inputs classified | Met | [54-file snapshot/identities](phase-00/baseline/sources.json), [Git inventory](phase-00/baseline/git-status.txt), [checks](phase-00/baseline/checks/results.json), failures classified below. |
| 2. Exact native/server candidates, peer/module-loading and audio/permission contracts established | Met for Phase0 discovery | [compatibility](phase-00/compatibility.md), [fixed registry identities](phase-00/package-candidates.json), [SDK probes](phase-00/sdk-probe.log), [in-memory Expo plugin probe](phase-00/config-probe.log). Static selection is not native/media acceptance. |
| 3. Schema/service RPC/wire/error/admission-fencing contracts finalized | Met | [contracts revision1](phase-00/contracts.md): explicit names/types/grants, UUID/revision encoding, action ownership, unique admission leases and deletion-safe cleanup; no later implementation. |
| 4. Targets, accounts, peer, scheduler, artifacts/upload/quota inventoried with gated uncertainties | Met for discovery | [resource table](phase-00/compatibility.md#runtime-target-owner-and-budget-inventory), [MuMu identity](phase-00/assigned-runtime.json), [EAS quota](phase-00/eas-usage.log), [build inventory](phase-00/eas-build-inventory.json). Unconfirmed resources remain later gates. |
| 5. Version/config/build changes and deterministic verification/rollback procedures recorded | Met | [versions](../../versions.md), [procedures](phase-00/procedures.md), [source-cache reconstruction](phase-00/prepare-sdk-sources.py), exact public API contracts and known unsupported observations. |

## Checks actually performed

| Check | Result | Evidence / limit |
| --- | --- | --- |
| npm run typecheck | Pass, mobile+shared | [log](phase-00/baseline/checks/typecheck.log) |
| Shared Vitest | Pass:19 files/147 tests | [log](phase-00/baseline/checks/shared.log); existing Vite config-loader warning remains. |
| Mobile lint | Pre-existing failure:13 errors/3 warnings | [full log](phase-00/baseline/checks/lint.log); group-name, info, nicknames, new-group, chat preferences, MessageFocusOverlay and Toast tests; not repaired. |
| Full mobile Jest, default cache | Environment failure:41 suites could not start,0 tests | [log](phase-00/baseline/checks/mobile.log); sandbox EPERM on atomic cache rename. |
| Diagnosed writable-cache Jest run | Timed out180s,10 suites printed PASS; full suite unverified | [log](phase-00/baseline/checks/mobile-writable-cache.log), [status](phase-00/baseline/checks/mobile-writable-cache.json). Timeout cleanup wrapper also encountered sandbox taskkill restriction; later process inventory showed no task-owned Jest/python/cmd process. No further full-suite run. |
| Existing Deno push tests | Pass:4/4 | [log](phase-00/baseline/checks/deno-existing.log) |
| Pinned LiveKit server SDK/Deno contract probes | Pass:4/4, typechecked | [log](phase-00/sdk-probe.log), [locked result](phase-00/sdk-probe-locked.log), [test](phase-00/sdk-contract.test.ts); synthetic keys/stubbed HTTP only. Narrow BUF_BIGINT_DISABLE permission resolved initial denial. Later locked run freezes transitive identities. |
| Candidate Expo plugin evaluation | Pass, in memory only | [log](phase-00/config-probe.log); no filesystem native mods/prebuild or compilation. Initial relative-source path issue corrected. |
| Expo public config | Pass, SDK57/package com.dologram.app | [resolved config](phase-00/expo-config.json) |
| Expo install --check | Pre-existing/offline compatibility failure | [log](phase-00/expo-install-check.log): RNGH3.5.0 vs local SDK map ~2.32.0. No fix/install. |
| Scoped Repomix/XML/original comparisons | Pass:14/14 entries, security check passed, all434 lines read | [manifest](phase-00/packet-manifest.json), [context index](phase-00/context-index.md). The appended versions section supersedes its baseline packet entry. |
| MuMu/artifact/resource discovery | Pass for identity/inventory | Both inspected APKs lack LiveKit/WebRTC. No media flow was run. EAS Android used6/15,9 remaining; no build quota consumed. |
| Fresh release export/bundle scan, SQL/RLS/concurrency, provider revocation, real media, rollback rehearsal | Not run: future-phase gates | No matching release artifact or isolated integration target. Existing scanner lacks LiveKit patterns until Phase2. No stale dist scan presented as current. |
| Phase-local document/source preservation checks | See final validation artifact | [validation.json](phase-00/validation.json); verifies scoped plan edit, links, unchanged protected inputs and known concurrent source changes. |

Baseline runner invocation mistakenly began one directory above the repo; those
ENOENT outputs are retained under baseline/runner-path-error and excluded from
repository failure counts. CLI --account usage flag error is retained; inspected
installed EAS command source established the correct positional account syntax.
Read-only corrected quota query succeeded. EAS25 emitted existing version/punycode
notices; no CLI upgrade or warning suppression was added.

No runtime code changed, so application checks were not repeated solely for
documentation edits. Phase-local SDK/config/document validation covers the owned
changes. No new runtime/type/lint regression is claimed from unperformed runtime
tests; source preservation establishes that this phase changed no app behavior.

## Remaining and readiness

Live verification remains pending at its actual owning phase: isolated Supabase
target/history/Auth columns/accounts and scheduler; accessible LiveKit project/
approved secret store; actual two-endpoint media; compatible new native artifact
and cloud-upload authority; actual audio-route observation; Phase7 native bridge.
These are inventoried Phase0 outcomes, not counted as passed live checks.

Recorded discrepancies: local migrations now end028; historical build ledger
understates current account usage; installed APK differs from local dev APK;
older doctor/lint/Jest reports no longer describe current inputs; existing Expo
RNGH mismatch; SDK lacks public current-output confirmation; generic AGENTS route
path differs from the working app directory. Plan Phase0 progress records them.
Concurrent MediaPickerPanel preview edits were preserved and not certified.
No dependency was added and no theme/UI/account workflow was changed.

**Next phase ready to start: yes for independent Phase1 authoring, not live
integration.** The contract input is complete; remote integration still needs the
disposable target and authorization for any external writes. This request ends
at Phase0; no next-phase files were created.
