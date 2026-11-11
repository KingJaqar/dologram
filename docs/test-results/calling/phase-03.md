# Calling Phase 3 — Foreground voice flow

Date: 2026-11-11 (Asia/Manila)

Status: Complete for coding scope (100% of five Phase 3 implementation items).
Overall calling-plan implementation progress: 20/45 items (44%). Phase 4 and
later phases were not started.

## Scope delivered

- Added a guarded, account-scoped call runtime under `apps/mobile/src/calls/`.
- Added the Expo Router foreground voice route at `apps/mobile/app/call/[callId].tsx`.
- Added the direct-chat voice launcher, global notification tap routing, and a
  minimized active-call return banner.
- Added LiveKit SDK 57-compatible dependencies and config plugins using the
  exact Phase 0 versions. Native modules are detected before dynamic imports;
  old clients retain messaging/account switching and receive a clear calling
  availability message.
- Added pre-session call teardown to all discovered sign-out, account-removal,
  and account-switch paths.
- Added audio ownership registration for voice recording, voice playback, and
  video playback. A call waits for those consumers to stop/pause before taking
  microphone ownership.
- Added local blocked-chat auto-decline, preference-change recheck while
  ringing, microphone permission gating, actual available audio-route handling,
  and voice-only source restrictions.

## Baseline and verification

| Check | Result |
| --- | --- |
| `npm run typecheck` before edits | Passed (mobile and shared). |
| Mobile lint before edits | Failed with 13 pre-existing errors and 3 warnings. |
| Full mobile Jest baseline | Not a pass: initial cache run hit sandbox EPERM; bounded writable-cache run produced no usable completion after the historical harness stall. |
| `npm run typecheck` after edits | Passed (mobile and shared). |
| Focused call Jest tests | Passed: 2 suites, 4 tests, `audioOwnership.test.ts` and `state.test.ts`. |
| Mobile lint after edits | Same 13 pre-existing errors and 3 warnings; no new Phase 3 diagnostics. |
| `npx expo config --type public` | Passed; SDK 57 config resolved both LiveKit/WebRTC plugins and Android Bluetooth permission. |
| `npm ls` pinned LiveKit packages | Passed: `@livekit/react-native` 3.1.0, `@livekit/react-native-webrtc` 150.1.1, `@livekit/react-native-expo-plugin` 1.1.0, `@config-plugins/react-native-webrtc` 15.0.2, `livekit-client` 2.23.0. |
| Source restrictions | Passed: no `setCameraEnabled`, camera source, or camera publication path in the Phase 3 call adapter/route; LiveKit imports are dynamic and native-module guarded. |
| Auth teardown coverage | Passed: all discovered app `auth.signOut` callers and `activateAccountSession` call the narrow teardown hook before losing the old session. |
| ADB/emulator | `adb devices` initially listed three devices, but subsequent serial interrogation could not restart the ADB daemon. No emulator flow is claimed as passed. |

## Acceptance status

The coded implementation gate is met. Real two-endpoint audible media, native
permission-dialog behavior on a rebuilt artifact, provider-backed Realtime
delivery, and MuMu navigation/cleanup evidence remain pending manual or
optional follow-up verification. The existing APKs were not treated as proof
of LiveKit support, and no native build, installation, deployment, migration,
or external configuration change was performed.

## Out of scope

Video publication/rendering, call history, push invitation delivery, and
Android background/lock-screen behavior remain Phase 4-7 work. Existing mobile
lint failures, the full Jest harness issue, and unrelated repository changes
were preserved.
