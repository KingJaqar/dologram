# Search Phase 0 execution report

2026-11-11, Asia/Manila. **Complete: 3/3 items, 100%.** Only Phase 0 was executed.
Search-plan progress is 3/12 predefined work items, **25%** by item count; broader
DoloGram project progress has no defined denominator. Phase 1 is ready on its
source/unit prerequisites and was not started.

## Requirements and acceptance

| Phase 0 requirement | At entry | Final evidence/status |
| --- | --- | --- |
| P0.1 instructions, phase/context/dependencies | Partially done in historical audit | Met: applicable mobile/Supabase AGENTS read fully; hidden/ancestor discovery found no additional applicable instructions. Phase 0 has no earlier phase dependency. |
| P0.1 working copy and ownership | Partially done historically | Met: fresh status, tracked/staged patches, tracked-file inventory and HEAD captured under baseline. Most code is untracked user work. |
| P0.1 recoverable snapshots/hashes | Not started | Met: 72 relevant pre-edit files, 1,176,525 bytes; all snapshot hashes verified; restore-to-scratch rehearsal passed. See recovery.md and sources.json. |
| P0.1 context freshness/framework contracts | Partially done | Met: 74/75 historical identities matched initially; separate calling plan changed. Current query/field/routes/tests/config packet read completely; relevant original contracts and SDK/RN docs verified. |
| P0.2 exact V00/V10 baseline and toolchain | Not started | Met: exact commands, times, exits/timeouts and full logs captured. Initial failures remain recorded; all six existing targeted suites passed in diagnosed, split runs. |
| P0.2 named MuMu identity | Not started | Met: current playerName/config ADB mapping confirms dologram, MuMuPlayerGlobal-12.0-3, serial 127.0.0.1:16480; Android 12, x86_64, com.dologram.app 1.0.0/code 1. Other discovered devices untouched. |
| P0.2 artifact/native inventory | Partially done historically | Met: installed/local APK hashes captured. Installed client runs current unchanged query on native RN/SQLite. Whole product UI/calling compatibility is not claimed. No demonstrated search-native rebuild need. |
| P0.2 service/process preservation | Not started | Met: pre-existing Metro PIDs/ports and reverse mappings identified; only task-owned server trees stopped, fixture app stopped, only added 8084 reverse removed. |
| P0.3 public reference/adaptation checklist | Partially done | Met: screen-checklist.md finalizes all Section 4 states; excludes wrong-product reference and records inaccessible assets/build-identity limitations. Exact current Messenger parity remains unverified under B01. |
| P0.3 safe disposable fixtures/isolation | Not started | Met through permitted offline alternative: no account/session/storage reads or connected writes, ephemeral native SQLite with synthetic identities; network fence probe passed. Connected V11 fixtures remain unverified. |
| P0.3 existing search timing | Not started | Met: unchanged native query returned 30+5 old matches in 45.51/51.34 ms first-page/total wall time. See native-timing.json. End-to-end screen timing and stress acceptance remain later work. |
| Phase 0 gate: recoverable inputs, explicit constraints, unambiguous code contracts; gaps assigned | Not started | Met: the single context index links source/packet/check evidence and preserves the limitations below. No later-phase feature assertion is credited. |

## Changed

- Added local recovery snapshots, Git baseline, source/packet identities and full
  check logs under this directory. Application code, dependencies, lockfile,
  migrations and external configuration were not changed by this task.
- Added an evidence-only native fixture and bounded baseline supervisor. The
  fixture imports the existing query; it adds no search UI, query implementation,
  production route or dependency. Its custom main is outside workspace globs.
- Updated only Phase 0 progress in the search plan and execution findings in the
  existing central context index. No commits, pushes, builds, deployments, remote
  migrations or third-party messages were performed.

## Verification results

| Check | Actual result | Evidence |
| --- | --- | --- |
| Workspace typecheck baseline | Passed, exit 0, 43.44 s | baseline/checks/typecheck.log |
| Mobile lint baseline | Passed, exit 0, 7.82 s, no lint findings | baseline/checks/lint.log |
| Shared Vitest | Passed, exit 0: 20 files / 149 tests | baseline/checks/shared.log |
| First targeted mobile command | Failed, exit 1 before assertions: sandbox temporary-cache rename EPERM | baseline/checks/targeted-mobile.log |
| Targeted mobile with writable cache | Timed out at 120 s after four suites printed PASS; no final summary. Cleanup initially denied by sandbox; elevated inventory confirmed no remaining task Jest processes. | baseline/writable-cache/targeted-mobile.json and .log |
| Jest --showConfig / --listTests | Both passed, all six requested existing files discovered | baseline/jest-diagnostics/ |
| Four isolated feature suites | Passed, exit 0: 4 suites / 23 tests | baseline/feature-suites/feature-suites.log |
| Pressable source accessibility | Passed, exit 0: 1 test | baseline/isolated-accessibility/pressable-source.log |
| Rendered accessibility labels | Passed, exit 0: 5 tests, 87.07 s command wall time | baseline/isolated-accessibility/render-labels.log |
| Final workspace typecheck | Passed, exit 0, 28.75 s; rerun justified by concurrent source changes | final-checks/typecheck.log |
| Final mobile lint | Failed, exit 1: 13 errors / 3 warnings in seven untouched application files. Initial invocation returned 0; the cause of that difference is unconfirmed. No application source was edited by this task. | final-checks/lint.log; lint-diagnostic-sources.json |
| Strict evidence-fixture typecheck / explicit ESLint | Passed, exit 0 | final-checks/fixture-typecheck.log; runtime/fixture-lint.log |
| Native offline query fixture | Passed: 35/35 old matches, 200/60/5-row native reads, cancelled request zero reads; final process console zero errors/warnings | runtime/native-timing.json; runtime/fixture-native-no-dev.log |
| Snapshot/XML/scope/link validation | See validation.json; restore rehearsal and all 72 saved hashes verified | validation.json; pre-final-integrity.json |
| Full mobile suite/native build/export | Not run: Phase 0 uses existing targeted baseline; full suite is Phase 4 and native builds are conditional | No pass claimed |

Shared-test baseline emitted the existing Vitest config-loader warning; mobile
tests emitted Node SQLite experimental and punycode deprecation warnings. They
were retained without suppressions. No production source was changed by this
phase. The initial harness blocked its development tooling's WebSocket calls,
creating fixture-only errors; the corrected non-development run is clean.

## Runtime evidence and limits

Installed APK SHA-256:
`fb5aef22cee1a524e1e8063e11335c9a86df606ac93213b82808e6e30f090331`.
Local ignored APK SHA-256:
`db12369a518004d6ceabbf34c325545c4540be635768a1ef7e7d07d9153df17b`.
They differ and lack the newer calling native libraries in prior/current local
inventory; search itself introduces no new native dependency. Installed RN/SQLite
compatibility was exercised directly by the isolated fixture, not inferred from
version labels. The calling fallback is guarded in existing media.ts and was not
changed or certified here.

The original Metro endpoint 8082 initially answered status, then refused requests.
The client showed unexpected-end-of-stream loading failure, with no captured
missing-native-module signature. It is not an artifact-mismatch diagnosis. The
task used its own offline 8084 server rather than restarting pre-existing servers.

Native query wall times in the final non-development sample: first page 45.51 ms;
both pages 51.34 ms; native reads 20.77/10.65/5.56 ms. These are not isolated JS CPU
times, first-visible screen latency, an average, full-message counting, or proof
of the proposed 100 ms stress gate. The 150 ms screen debounce was read in source
but not included in this query-only measurement. Database closure and activity
termination release the in-memory fixture. No emulator networking/theme/account
settings or application data were cleared.

## Discrepancies and remaining later-phase work

- Mobile AGENTS' route-location sentence says src/app; actual routes are app.
  Phase 0 creates/edits no product route, so no routing directive is overridden.
  Future work must preserve existing route discovery and callers.
- The saved iPhoneLife reference is Apple Messages. Messenger references do not
  provide a verified current Android build or exact dimensions; DoloGram's
  Section 4 adaptation remains the implementation target.
- Historical lint failures/Jest hangs were not reused as current failures.
  Initial lint returned success; the final run reports 13 errors / 3 warnings
  in group-name, info, nicknames, new-group, chats/preferences, MessageFocusOverlay
  and Toast tests. Captured info/preferences/config bytes match their pre-edit
  snapshots. Other diagnostic sources were not snapshotted at entry; no edit to
  any of them was performed by this task. The differing lint outcomes have no
  confirmed cause and must not be described as a clean overall lint result.
  These fresh diagnostics were captured before any product implementation. They
  are outside Phase 0 repair, whose gate requires truthful baseline capture.
  The actual Jest cache failure/combined timeout and passing split-suite results
  are retained separately.
- Concurrent user work added ChatScreen video actions and calling strings during
  execution. Their diffs were read and saved separately; search focus/navigation,
  matching and search strings were unchanged. Preserve both baseline and refreshed
  copies. A later shared-string refresh changed the missing-native call wording
  and carriage-return bytes; its normalized diff is retained. No calling changes
  were made by this task.
- Cleanup succeeded for the task-owned server/activity and 8084 mapping. A later
  read-only observation found the emulator process and mapping recreated under a
  different ADB host connection, with no task fixture server or port listener.
  That later state was left untouched. See runtime/cleanup.json; a current app
  process alone is not evidence that the closed in-memory fixture remains active.
- V11 product screens, both themes/accessibility/Back/retained scroll, connected
  disposable account/chat setup, full current-app native compatibility and
  10,000-message stress observations remain **pending later-phase verification**.
  These are not Phase 0 implementation acceptance passes. Exact steps are in the
  plan's V11 and recovery.md. No owner input is required for Phase 1 source work.

**Next phase ready: yes, on source/unit prerequisites. Phase 1 was not started.**
