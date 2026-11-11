# Phase 0 compatibility and resource inventory

Verified 2026-11-11 (Asia/Manila). **Candidates selected; nothing installed.**
SDK 57/RN 0.86.3/React 19.2.3 are unchanged. Package peer acceptance and config
evaluation do not certify native compilation or media on an actual artifact.

## Exact package selection

| Candidate | Exact version | Published peers / compatibility evidence |
| --- | --- | --- |
| `@livekit/react-native` | 3.1.0 | React/RN `*`, livekit-client `^2.20.0`, LiveKit WebRTC `^150.1.0`; Node ≥20. |
| `@livekit/react-native-webrtc` | 150.1.1 | RN ≥0.60; Android minSdk 24; published build uses prefixed WebRTC 150.7871.04. |
| `@livekit/react-native-expo-plugin` | 1.1.0 | Expo/React/RN `*`, LiveKit RN `^2.1.0 || ^3.0.0`. |
| `@config-plugins/react-native-webrtc` | 15.0.2 | Expo ≥56, accepts installed 57.0.32. |
| `livekit-client` | 2.23.0 | Satisfies ^2.20.0; published peer `@types/dom-mediacapture-record:^1` must be resolved/locked during later install. |
| `livekit-server-sdk` | 2.19.3 | Server only; exact Deno import `npm:livekit-server-sdk@2.19.3`. Node engine ≥19. Deno 2.9.6 typechecked and executed four contract probes. |

Registry metadata and SHA-512 tarball integrity: [package-candidates.json](package-candidates.json).
Actual candidate sources are cached under `.tmp/calling-phase00/vendor`, outside
the delivered context packet. They were not added to node_modules or lockfile.
LiveKit RN's Gradle file explicitly handles AGP 9's built-in Kotlin plugin and
its module source mentions RN ≥0.80 New Architecture synchronous-method rules.
The WebRTC README lists x86_64. These are source-level evidence, **not** proof
that this candidate set compiles on SDK 57's current New Architecture toolchain.
Its README still says WebRTC M144 although its Gradle dependency is M150; use
the actual package build and verify the dependency tree in the later cloud build.

LiveKit RN 3.1.0 requests prefixed WebRTC 150.7871.01 while its WebRTC peer
150.1.1 requests 150.7871.04. Gradle resolution must select one compatible
150.7871.04 artifact; record the actual cloud-build dependency result in Phase 3.
Do not call the static wildcard peer range a tested binary guarantee.

Current root overrides/lockfile contain no LiveKit. Existing
react-native-url-polyfill is 4.0.0; LiveKit RN depends on ^3.0.0, so later lockfile
resolution may include both. Do not silently override/upgrade unrelated packages.
Run Expo installation and inspect its resolved peer/transitive diff before a build.

## Exact later configuration changes

In Phase 3, from `apps/mobile`, use repository-mandated Expo installation:

```powershell
npx expo install @livekit/react-native@3.1.0 @livekit/react-native-webrtc@150.1.1 @livekit/react-native-expo-plugin@1.1.0 @config-plugins/react-native-webrtc@15.0.2 livekit-client@2.23.0
```

This is a recorded future command, **not run in Phase 0**. Keep server SDK out
of mobile/shared dependencies. Resolve the client type peer through the same
Expo installation workflow only if the resolved graph requires it. No broad
`expo install --fix`, peer suppression, stack upgrade or hand edits to native files.

Append these plugin entries without replacing existing plugins:

```json
[
  ["@livekit/react-native-expo-plugin", {
    "android": {"audioType":"communication", "enableScreenShareService":false}
  }],
  ["@config-plugins/react-native-webrtc", {
    "cameraPermission":"DoloGram uses your camera for video calls.",
    "microphonePermission":"DoloGram uses your microphone for calls."
  }]
]
```

The Expo plugin includes a native ApplicationLifecycleListener calling
LiveKitReactNative.setup; no MainApplication edit is needed. Plugin option
names above were read in the exact published source. Screen-share service stays
off. Do not enable background recording or add Telecom/CallKeep in this phase.
Phase 7 bridge selection remains pending, independent of foreground feasibility.

The WebRTC plugin contributes CAMERA, RECORD_AUDIO, network/audio settings,
WAKE_LOCK, legacy BLUETOOTH and SYSTEM_ALERT_WINDOW. Its permission text options
are iOS Info.plist values, **not Android prompt text**. It does not add Android 12
BLUETOOTH_CONNECT. Phase 3 must add that normal app-config permission and request
it in context when Bluetooth routes are used; do not request overlay access for
foreground calling. Evaluate whether to remove SYSTEM_ALERT_WINDOW only after
checking the existing development-client needs. Existing Expo audio playback
foreground-service permissions are not a calling-background implementation.

The in-memory [config probe](config-probe.cjs) passed on the installed Expo
config-plugin API, registering Android manifest/iOS plist/podfile mods and the
expected camera/microphone permissions. It performs no prebuild or native write.
It does **not** execute all filesystem-backed mods or compile an app.

Module/loading, media, permissions and routing contracts are fixed in
[contracts.md](contracts.md#native-import-permissions-and-audio-contracts).
Important gap: available route enumeration + void route selection does not
report actual selected output; CALL-07's real output verification remains gated.

## Runtime, target, owner and budget inventory

| Resource | Current evidence | Gate / exact next resolution |
| --- | --- | --- |
| Assigned emulator | MuMu config identifies instance `MuMuPlayerGlobal-12.0-3`, name `dologram`, ADB 16480; NEMU port mapping also maps 5561. Connected explicitly to `127.0.0.1:16480`, Android 12, x86_64. No app launch/reset/login/install/data mutation. | Identity resolved. Use this explicit ADB serial; other discovered devices were not operated. |
| Installed APK | com.dologram.app 1.0.0 (code 1), minSdk24/target36, installed APK SHA-256 fb5aef22cee1a524e1e8063e11335c9a86df606ac93213b82808e6e30f090331, 105,754,324 bytes. Pulled to local scratch and inspected DEX/native filenames: no LiveKit/WebRTC symbols. | B2: incompatible with calling. Native fallback tests/new artifact in Phase 3. [runtime identity](assigned-runtime.json) |
| Existing development APK | 279,719,965 bytes, SHA-256 db12369a518004d6ceabbf34c325545c4540be635768a1ef7e7d07d9153df17b. Also lacks required native symbols. Different from installed APK; not source-matched by assumption. | Cannot reuse for media. [APK inventory](apk-inventory.json) |
| EAS artifacts | Read-only latest-build query returned one finished development build, 76224190-109e-4596-87bf-979a45a8654f, SDK57/code1, fingerprint b89cf35f6e987cbcc89706b931f2b46b503be573. | No compatible calling artifact evidenced. [sanitized build inventory](eas-build-inventory.json) |
| EAS account/quota | Authenticated read-only query: alex123superman, Free; November Android used6/limit15 (**9 remaining**); total used6/limit30. No billing overage. [actual query](eas-usage.log) | Recheck before a build; this isn't a quota reservation. Ledger's one-build count was stale. Use development profile once when native changes are batched; preview only for a justified later need. |
| Source upload | Current prompt excludes deployments and sending private material to third parties; historical report also records an upload restriction. No build/upload performed. | B2/OWNER-03: request specific cloud source-upload authorization only after concrete native diff/build input is reviewable in Phase 3; EAS login is already usable. No local native workaround. |
| Linked Supabase | Cached project `jsyqtfsidtfahytcwutp`, name DoloGram; cached Postgres17.11.0.011. Cache is not current remote inspection or proof of isolation. Mobile .env contains public Supabase config; values weren't copied or printed. | B1/OWNER-02: **no dedicated disposable target confirmed**. Confirm a separate test project/ref, migration history, Auth schema and designated fixtures before remote tests. No remote DB query/write/type generation was run. |
| SQL facility | Cached Supabase CLI2.111.0 works with SUPABASE_TELEMETRY_DISABLED=1; help confirms db query --file/--linked/--db-url, migration list, gen types. Docker29.8.1 client present, daemon unavailable. No psql on PATH. Existing PGlite scratch fixture exists but cannot establish real parallel sessions/Auth/RLS/Cron. | B4 runner discovery complete; V1 still needs an isolated full Postgres/Supabase target. Never substitute PGlite/mocked roles for live concurrency acceptance. |
| Deno | Cached Deno2.9.6/V8 15/TS6.0.3 found outside PATH. Existing push tests4/4 pass; pinned SDK probes4/4 pass. | B4 Deno blocker resolved; no tooling installation required. Cache-only deterministic commands in procedures.md. |
| LiveKit target/secrets | No LiveKit CLI config in the checked conventional local locations; no LIVEKIT credential environment variables. No LiveKit config in app/manifests. No connected project tool is available. | B5/OWNER-01: **owner action required before real provider integration**: identify accessible dedicated project/secret-store access. Secrets themselves must not be posted in chat. Account/project quota and webhook remain unverified. |
| Scheduler | Official Cron supports seconds on eligible hosted Postgres; cached Postgres version alone doesn't prove pg_cron/pg_net/Vault installed. | B1/B5: inspect extension/job/secret-reference state in the dedicated target in Phase 1; configuration changes require separate authorization. |
| Test accounts/chat | No dedicated calling account IDs or pair are confirmed. Existing SQL tests select arbitrary profiles; they are unsafe on an unidentified shared target. No account was created during discovery. | B1: create the disposable A/B/outsider/restricted fixtures autonomously once the isolated target is confirmed. Never reuse arbitrary real profiles. |
| Permitted peer | Chrome installed on assigned MuMu. Candidate: test-only browser endpoint served over localhost via ADB reverse, with an independently authenticated disposable account. This remains inside the assigned emulator, with no new product web client. | B3: simultaneous browser/native capture and audio focus are **unverified**; try a bounded two-endpoint fixture in Phase 3. If Android cannot supply independent media, obtain one specifically permitted second endpoint. Don't use another named emulator silently. |
| FCM | No local google-services.json was discovered and resolved public config has no googleServicesFile. Existing push infrastructure remains present; cloud FCM credential state wasn't inspected. | OWNER-04: not needed for foreground; inspect/configure only in Phase 6 with authorization. Missing file alone isn't proof that EAS file credentials are absent. |
| Android native bridge | No bridge selected/installed. | B6: not needed for this milestone; select/verify in Phase 7 before background claims. |

OWNER-01: owner action required at the real-provider gate; OWNER-02: owner target
identity/isolation confirmation required at live SQL gate; OWNER-03: account
access already satisfied, upload authorization later required; OWNER-04: not
needed for foreground. These are later gates, not incomplete Phase 0 discovery.

## Baseline discrepancies carried forward

- `expo install --check` (local/offline dependency map) reports RNGH3.5.0 vs
  expected ~2.32.0. No downgrade performed. This pre-existing mismatch requires
  version-matched Expo guidance and the user's concurrent gesture work to be
  reconciled before claiming a supported new native build. It is unrelated to
  selecting the peer-compatible LiveKit candidates.
- Lint13 errors/3 warnings; full Jest cache EPERM, then writable-cache invocation
  exceeded180s after10 suites printed PASS. No full-suite pass is claimed.
- Vite/Vitest config emits a pre-existing native-config-loader warning; EAS25
  emits its existing punycode deprecation/version notice. No suppressions added.
- Concurrent MediaPickerPanel send-preview change detected and preserved. It
  doesn't affect Phase 0's dependency/contracts outputs; old UI test results
  are not evidence for its new behavior.

Official discovery links: [LiveKit Expo](https://docs.livekit.io/transport/sdk-platforms/expo/),
[Expo57](https://docs.expo.dev/versions/v57.0.0/),
[RN0.86 permissions](https://reactnative.dev/docs/0.86/permissionsandroid),
[LiveKit quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/).
Published allowances are not the selected project's remaining budget.
