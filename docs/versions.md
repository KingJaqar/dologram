# DoloGram Android versions

Policy (plan section 1): v14 fixes no package versions except through the Expo SDK pin (M0-08). Every
package below was pinned to its current stable version at install time and recorded here with its
install date.

## SDK pin (M0-08)

| Item | Version | Notes |
| --- | --- | --- |
| Expo SDK | 57.0.0 | Pinned through `expo@57.0.32`. SDK 58 was released 2026-10-15 and is in its transition period; SDK 57 is the version this plan targets and the version the Expo v57 docs describe. |
| expo | 57.0.32 | |
| React Native | 0.86.3 | |
| React | 19.2.3 | SDK pin from `expo/bundledNativeModules.json`; enforced through a root `overrides` entry so npm hoists exactly one copy. |
| @types/react | 19.2.18 | |
| TypeScript | 6.0.3 | |
| Node.js | 24.13.1 | Meets the SDK 57 minimum of 22.13.x. |
| npm | 11.8.0 | Workspaces driver (D-100). |
| vitest | 5.1.0 | `packages/shared` unit tests (D-100). |

## Native and JavaScript packages (Phase 0 step 4)

Installed 2026-11-08. Native packages were added with `npx expo install` inside `apps/mobile`.

| Package | Version | Why |
| --- | --- | --- |
| expo-dev-client | 57.0.21 | Development build launcher (D-11). |
| expo-router | 57.0.30 | Navigation and route tree (12.6). |
| react-native-safe-area-context | 5.7.0 | Safe areas (12.7). |
| react-native-screens | 4.26.2 | Native navigation primitives. |
| expo-linking | 57.0.13 | Deep links, `Linking.openSettings()`. |
| expo-constants | 57.0.23 | App version for About, EAS project id. |
| expo-status-bar | 57.0.1 | Status bar (template default, kept). |
| expo-splash-screen | 57.0.11 | Hold the splash until fonts load (12.10). |
| expo-sqlite | 57.0.4 | Local queue and cache (D-06). |
| @react-native-community/netinfo | 12.0.1 | Network state (D-13). |
| @react-native-async-storage/async-storage | 2.2.0 | Session and device preferences (D-83, M2-04). |
| expo-crypto | 57.0.4 | UUID v4 ids (D-100). |
| expo-file-system | 57.0.7 | App-private attachment copies (D-100). |
| expo-image-picker | 57.0.21 | Photos and videos (F5). |
| expo-document-picker | 57.0.3 | Files (F5). |
| expo-audio | 57.0.5 | Voice notes; replaces the removed `expo-av` (D-85 item 10). |
| expo-video | 57.0.5 | Video playback; replaces the removed `expo-av`. |
| expo-image-manipulator | 57.0.22 | Photo compression (6.3). |
| expo-sharing | 57.0.25 | Open a file in another app (AND-09). |
| expo-clipboard | 57.0.2 | Copy text (AND-06). |
| expo-font | 57.0.4 | Bundled fonts (D-130). |
| @expo-google-fonts/inter | 0.4.2 | Inter 400/500/600/700 (D-130). |
| @expo-google-fonts/jetbrains-mono | 0.4.1 | JetBrains Mono 400 (D-130). |
| react-native-svg | 15.15.4 | Icon rendering (D-131). |
| lucide-react-native | 1.70.0 | Icon set (D-131). |
| @supabase/supabase-js | 2.119.0 | Supabase client (M2-04). |
| react-native-url-polyfill | 4.0.0 | URL polyfill for supabase-js. |
| base64-arraybuffer | 1.0.2 | Upload bodies (Phase 11). |
| tus-js-client | 4.3.1 | Resumable uploads above 6 MB (D-153). |
| react-native-markdown-display | 7.0.2 | Message text formatting (M2-06). |

## Transitive natives installed as peers

npm installs `expo-router`'s optional peers, so three native modules exist without being direct
dependencies. They are pinned to the SDK 57 versions through root `overrides` so the native build
contains one compatible copy of each.

| Package | Version | Source |
| --- | --- | --- |
| react-native-reanimated | 4.5.1 | Optional peer of `expo-router`; SDK 57 bundles 4.5.1. |
| react-native-worklets | 0.10.1 | Peer of `react-native-reanimated`; SDK 57 bundles 0.10.1. |
| @expo/ui | 57.0.26 | Dependency of `expo-router` 57. |

`overrides` also pin `react`/`react-dom` to 19.2.3 and `expo-asset` 57.0.21 / `expo-constants` 57.0.23,
because npm otherwise hoists a second, newer React and a second `expo-asset` (SDK 58) next to the SDK
57 ones. `npx expo-doctor` reports 21/21 checks passing after these pins.

## Calling Phase 0 — candidates verified 2026-11-11

These are exact **selected candidates, not installed packages or verified native
build support**. Expo 57.0.32, React Native 0.86.3 and React 19.2.3 remain unchanged.

| Candidate | Exact version | Intended location |
| --- | --- | --- |
| @livekit/react-native | 3.1.0 | Mobile; Phase 3 native integration. |
| @livekit/react-native-webrtc | 150.1.1 | Mobile; Phase 3 native integration. |
| @livekit/react-native-expo-plugin | 1.1.0 | Mobile Expo configuration. |
| @config-plugins/react-native-webrtc | 15.0.2 | Mobile Expo configuration. |
| livekit-client | 2.23.0 | Mobile transport; native imports capability-gated. |
| livekit-server-sdk | 2.19.3 | Edge only, exact Deno npm import. |

Published peer ranges, integrity-verified package sources and in-memory Expo
plugin evaluation were checked. Deno 2.9.6 executed four pinned-server SDK probes.
Native build/media/real token revocation remain later gates. No dependency or
lockfile changed. See [compatibility and resource inventory](test-results/calling/phase-00/compatibility.md)
and [finalized contracts](test-results/calling/phase-00/contracts.md).

Current `expo install --check` using the offline SDK map reports an existing
react-native-gesture-handler mismatch (installed 3.5.0, expected ~2.32.0). The
historical doctor pass above is not current evidence for that changed dependency.
No downgrade, broad dependency fix or native build was performed in calling Phase 0.
