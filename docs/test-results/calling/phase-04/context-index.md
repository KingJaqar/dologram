# Phase 4 context index

Date: 2026-11-11 (Asia/Manila)

## Repository and instructions

- Working copy: `G:/codebase/DoloGram`; branch `main`; the repository is an
  untracked working copy, so all pre-existing files and changes were preserved.
- Read `apps/mobile/AGENTS.md` and `supabase/AGENTS.md` completely. No bounded
  root `AGENTS.md` or `CLAUDE.md` was present. Repository instructions win over
  the plan's generic `src/app` wording; actual routes are under `apps/mobile/app`.
- A selected-source baseline snapshot and hashes were saved under
  `docs/test-results/calling/phase-04/baseline/source/` before editing.

## Versioned documentation and dependencies

- Read the Expo SDK 57 Audio and app-config pages before editing Expo/RN code.
- Verified Expo `~57.0.32`, React Native `0.86.3`,
  `@livekit/react-native` `3.1.0`, `@livekit/react-native-webrtc` `150.1.1`,
  `@livekit/react-native-expo-plugin` `1.1.0`, `@config-plugins/react-native-webrtc`
  `15.0.2`, and `livekit-client` `2.23.0` from the repository manifests/tree.
- Read the installed LiveKit declarations and official client/RN documentation
  for `VideoTrack`, camera/microphone publication, device switching, room track
  events, adaptive stream, dynacast and audio session lifecycle.

## Repomix packets

- The first stdin packet was invalid because it contained only the root manifest;
  it was superseded and not used as implementation context.
- Pre-edit scoped packet: `repomix-phase4-execution.xml`, 46 entries,
  471,626 bytes, SHA-256
  `18133C89F3996C1E8D23042C675C3FA3AC8C33A587E8F374ECC085E2C2F184CF`.
- Final scoped packet: `repomix-phase4-execution-final.xml`, 47 entries,
  461,049 bytes, SHA-256
  `04FCDF73B86BA0CF05D2A7AEEFADFF8293233F6674C3731C913830BCE588232A`.
  Its selector list covers the plan, applicable instructions, mobile calling/
  auth/media/preferences sources and tests, shared call contracts/copy/types,
  and Phase 1/2 server contracts. `.env`/credential files, generated native
  output, Phase 4 evidence files and unrelated directories are excluded.

## Verified implementation context

- Phase 2 server contracts preserve distinct voice and video source grants;
  video requires microphone and camera while voice requires microphone only.
- Phase 3 foreground voice provider, lifecycle teardown, audio ownership and
  guarded LiveKit bootstrap were confirmed in source before Phase 4 edits.
- Phase 4 edits are limited to the calling media/API/state/provider/UI, shared
  call strings, focused video tests, this evidence and the Phase 4 plan note.

## Verification and unresolved evidence

- Root typecheck passed before and after edits. Focused calls passed 3 suites/
  6 tests after edits; the focused voice regression passed 1 suite/4 tests.
- Mobile lint retains the Phase 3 baseline of 13 unrelated errors and 3 warnings;
  no Phase 4 diagnostic was introduced. Expo public config and the pinned
  dependency tree passed.
- The assigned MuMu device was discoverable, but its installed APK inventory
  predates LiveKit/WebRTC native modules. Real peer media, permission dialogs,
  hardware camera/route behavior, provider outage budgets and source-matched
  artifact checks remain pending manual/integration verification.
