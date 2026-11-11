# Phase 4 — Complete foreground video flow

Date: 2026-11-11 (Asia/Manila)

## Status

Complete for coding scope: 100% of the five Phase 4 implementation items.
Overall calling-plan implementation progress is 56% (25/45 equal-weight items).
Phase 5 was not started.

## Delivered

- Added typed video-call creation, guarded LiveKit camera publication, camera
  device enumeration/switching, remote/local track collection, adaptive stream,
  dynacast and conservative video publish defaults.
- Camera publication starts only for an accepted outgoing video call. Incoming
  video calls answer with the camera off; microphone permission remains required.
- Added camera on/off and switch-camera controls, local mirrored PiP and remote
  video rendering, with truthful native/permission/device-unavailable states.
- Camera off unpublishes and stops the local capture track; media listeners,
  audio ownership and the room are cleaned up on terminal/error/account paths.
- Preserved voice controls and added focused video/state teardown coverage. No
  dependency, migration, generated-native, deployment or external-service
  configuration changes were made.

## Verification

| Check | Result |
| --- | --- |
| Pre-edit root typecheck | Pass: mobile and shared packages |
| Pre-edit focused calls | Pass: 2 suites, 4 tests, after using the workspace-local Jest cache following the baseline cache EPERM |
| Post-edit root typecheck | Pass |
| Post-edit focused calls | Pass: 3 suites, 6 tests |
| Voice regression (`VoiceRecordButton`) | Pass: 1 suite, 4 tests |
| Mobile lint | Pre-existing failure only: 13 errors and 3 warnings in unrelated files; no Phase 4 diagnostics |
| Expo public config | Pass: SDK 57, LiveKit/WebRTC plugins and camera/microphone permissions present |
| Pinned LiveKit dependency tree | Pass |
| Scoped source checks | Pass: no pre-accept camera publication; caller/callee camera policy and capture teardown covered |
| Assigned MuMu ADB inventory | Observed; available APK predates LiveKit/WebRTC native modules, so no media flow was claimed |

## Acceptance status

- CALL-02: Met for implementation/source checks; real two-peer media and camera
  capture remain pending manual verification with a compatible native artifact.
- CALL-06: Met for the client/source boundary; Phase 2 source grants remain
  intact. Provider-backed issuance remains pending integration evidence.
- CALL-07: Met in code and tests for mute/camera controls and unsupported states;
  hardware route/camera observations remain pending.
- CALL-08: Met in code for permission ordering, labels, theme contrast, reduced
  motion and 48 dp controls; native prompt/settings/large-text exercise remains
  pending.
- CALL-10: Met in code for generation-aware teardown, capture release and audio
  ownership; process-loss/access-loss exercise remains pending.
- CALL-11: Met in code for bounded reconnect/error convergence; provider outage
  and timing-budget exercise remains pending.
- CALL-15: Met for pinned versions, config and guarded fallback; a compatible
  source-matched native artifact remains pending.

## Discrepancies and remaining work

The plan refers generically to `src/app`; this repository's Expo Router routes
are under `apps/mobile/app`, so the implementation follows the repository
instruction and actual layout. No standalone camera module was added because
the existing LiveKit adapter owns capture permissions and the repo has no
`expo-camera` dependency. Phase 5–8 work is out of scope and was not started.

Next phase ready to start: yes — Phase 5 has the Phase 4 coding contracts and
automated evidence; the optional native/provider checks can remain pending.
