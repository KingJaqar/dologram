# Calling Phase 0 context index

2026-11-11, Asia/Manila. Phase 0 only; contracts/baseline/discovery complete.
Entry points: [report](../phase-00.md), [contracts](contracts.md),
[compatibility](compatibility.md), [procedures](procedures.md).

## Checklist and workflow

- [x] Scope: CALL-05/06/15/18 feasibility only, five equal-weight work items.
- [x] Prerequisite: explicit execution request. No earlier calling phase exists;
  no prerequisite completion was inferred from a checkbox.
- [x] Read applicable mobile/Supabase AGENTS entirely; root/ancestor/hidden
  discovery found no additional AGENTS/CLAUDE. No delegation required or used.
- [x] Git baseline → ripgrep discovery → existing Reader context validation →
  scoped Repomix → bounded XML analysis → original-source verification.
- [x] Baseline scripts, dependency/config checks, SDK probes, resource inventory.
- [x] Five acceptance gates linked in report; unmet live gates assigned forward.

Shared requirements remain in the parent plan Section 0. This index records
identities/reads; it doesn't duplicate the full implementation narrative.

## Baseline, ownership and freshness

HEAD96d0fca/main is not the application baseline: most app/config/Plans/docs files
are untracked. [Git status](baseline/git-status.txt) contains full path inventory;
tracked/staged binary patches are empty. [sources.json](baseline/sources.json)
records 54 SHA-256 identities and exact pre-edit copies in baseline/source,
including package-lock, instructions, configuration and migrations001–028.
No credential/signing files were copied. `.env` names/presence only were inspected;
account/session contents and private keys were not read or exported.

Owned changes: Phase 0 progress subsection in the plan, appended candidate
section in docs/versions.md, phase report and this evidence directory, plus
scratch under `.tmp/calling-phase00`. No app source, lockfile, migration or
external configuration was changed. Existing ignored APKs were read separately.
Installed test APK was pulled via ADB into scratch, not published.

Prior plan-polish S0–S7 index was read. Its old test/doctor/Jest statuses were
not reused as current passes. Stack/config/instruction identities were verified
afresh; latest local migration is028. [source-refresh.json](source-refresh.json)
captures supplemental originals used in this pass. Concurrent MediaPickerPanel
sendPreview/onSend additions (7 added/1 removed lines) were found after baseline,
read and preserved. They don't change Phase 0 contracts; no UI verification for
those new edits is claimed. Later executors must refresh changed callers.

## Repomix packet and complete read boundaries

Cached/pinned global Repomix1.18.1, no compression, parsable XML, default security
checks/ignore rules retained. Selectors/actual entries and SHA-256s are in
[packet-manifest.json](packet-manifest.json); generation log [repomix.log](repomix.log).
Exactly14 intended entries included, no unexplained omissions. Packet22771 bytes,
6778 tool-estimated tokens. These are packet metrics, **not measured model usage
or a claim of savings**. Packet SHA-256:
136f4ed3074495fcfcde0d976122e5cee5580f1d0c9298179248e3db8fdcf7b4.

All434 XML lines read in full: [1–140](packet-read-1.txt),
[141–280](packet-read-2.txt), [281–420](packet-read-3.txt),
[421–434](packet-read-4.txt). Each extraction ≤140 lines and ≤12000 characters.
Parsed XML contained14 entries; every decoded entry was compared against its
original source before editing. No compression gaps. After appending versions.md,
that single packet entry is historical to its baseline hash; do not reuse it for
the new candidate section. Unchanged other entries remain verified. No redundant
whole packet regeneration was needed. Repowise was not available/needed.

Fully read packet entries: both AGENTS; root/mobile/shared package manifests;
mobile app.json/app.config.js/eas.json/jest.config.js; shared vitest config;
docs/builds.md and pre-edit versions.md; scanner script; supabase/config.toml.
Findings: no native calling dependencies, existing Expo audio/native-notification
patterns, source-upload/build constraint, service-only backend boundary and stale
typegen arguments. Security scanner currently lacks LiveKit patterns; Phase2 owns
that extension, Phase8 owns a fresh release scan.

## Original sources and official contract reads

| Identity/source | Inspected boundaries | Finding |
| --- | --- | --- |
| Calling plan | Overall Sections0–15/context/dependencies; complete Phase0 and reporting/verification rules | Discovery gates permit later blockers while requiring exact resolution steps; no runtime calling stubs. |
| Migration016 | 32–73,133–161; targeted FK/RLS/key discovery through remainder | chats.chat_id/type, membership tuple/private helper. |
| Migration018 | 1–55 | Saved Messages may be one-member direct chat; reject separately. |
| Current migrations | filenames plus snapshot/hashes001–028 | No call schema/RPCs;028 is user work. Remote history unknown. |
| pushNotifications.ts | 1–39, prior S5 lifecycle findings only where unchanged | requireOptionalNativeModule pattern is for Expo modules; RN LiveKit module names must come from SDK source. |
| send-push index.ts | 32–39 | Auth admin ban/password-change checks, no copied secrets. |
| SQL chat-member test | 1–32 | Existing arbitrary-profile fixture unsafe on an unconfirmed shared target. |
| Existing Deno payload tests | header, then all4 executed | Deno runner usable without external credentials. |
| ChatComposer.tsx | props/render1–126 | Existing VoiceRecordButton callback integration; no composer rewrite needed. |
| MediaPickerPanel.tsx | gallery/cleanup203–236, preview concurrent diff around291/487 | Preserve concurrent preview behavior. |
| BottomSheet.tsx | 1–45 | Reanimated/RNGH conventions; no Phase0 change. |
| VoiceRecordButton.tsx | recording/prepare/finally35–end | Later call ownership must wait for preparation and audio reset. |
| Exact npm metadata/tarballs | six full manifests; SHA-512 verified | Candidate/version/peer graph in compatibility.md; source cache in .tmp. |
| LiveKit RN3.1.0 | src/index.tsx bootstrap/exports; LKNativeModule.ts entirety; AudioSession.ts1–80,120–160,210–305; EventEmitter.ts entirety; Gradle/native methods | Correct module name, register-once requirement, communication preset, no selected-route observation API. |
| LiveKit Expo plugin1.1.0 | plugin/src/index.ts entirety, native lifecycle/package sources entirety, expo-module.config.json | Actual options and Android setup; no hand-edited MainApplication. |
| WebRTC150.1.1 | README1–65; Gradle entirety; src/index.ts1–45; Permissions.ts1–100; getUserMedia/peerConnectionInit sites | RN module name, x86_64, dangerous permissions, current build vs stale README revision. |
| WebRTC config plugin15.0.2 | built withWebRTC/withPermissions and declaration entirely | Exact permission options, added legacy/overlay permissions; no BLUETOOTH_CONNECT. |
| livekit-client2.23.0 | LocalParticipant450–485,615–652; LocalVideoTrack130–169,264–288 | Mic/camera controls, camera-off capture stop, public restartTrack candidate. |
| server SDK2.19.3 | AccessToken1–100,170–end; grants.ts; WebhookReceiver entire; RoomService options/removal; TwirpRPC timeout/failover request path | TTL, actual source serialization, raw-body signature verification, bigint seconds and explicit bounded/no-failover option. Four real SDK probes passed. |
| Tool runtime sources/help | cached Deno test/version/help; Supabase CLI version/gen/query/migration help; EAS usage/build-list source/flags | Supported exact runner commands; telemetry opts; read-only account/build inventory. |
| Emulator/artifacts | named MuMu config/port mapping; explicit ADB package/OS/ABI/hash; local+installed DEX/native symbol scan | Assigned instance confirmed; two different APKs both lack native calling. |

Version-matched Expo57 index/audio/dev-client, Expo llms index, RN0.86 permission
docs and official LiveKit/Supabase contracts were browsed this session. Exact
URLs live beside conclusions in contracts.md/compatibility.md. Public registry
network initially failed under sandbox DNS; approved read-only fetching succeeded
outside it. No app source/credentials were sent. No companion/browser/desktop UI
automation was used to operate the emulator.

## Verification and unresolved gates

Baseline/results and diagnostic commands are linked in the report. SDK test
permissions were narrowed after the protobuf environment-read denial; config
probe path was fixed after confirming relative require resolution. Failed first
outputs remain retained. No unchanged failed command was retried. Full Jest was
not repeated after its diagnosed writable-cache run timed out; no passing summary
was manufactured from partial output. A process inventory showed no owned test
process left. Pre-existing services/emulators were not stopped.

Unresolved source **behavior** belongs to named future gates: real SQL roles,
parallel transactions, Auth columns and scheduler on isolated target; provider
revocation/clock/refreshed-token behavior; native compilation/media/audio routes;
Chrome/native simultaneous capture; cloud source upload; Phase7 bridge. See the
single resource table in compatibility.md for exact next steps. No Phase1 work
was authored/applied. Fresh source identities invalidate only dependent findings.
