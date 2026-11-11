# Phase 0 — Toolchain, repository skeleton and first EAS development build

Date: 2026-11-08
Environment: Windows, Node 24.13.1, npm 11.8.0, EAS CLI 27.4.1 (logged in as `alex123superman`),
MuMu Player 6 (Android 12, SDK 32, x86_64, `emulator-5554`) as device D.

## Scope and prerequisites

| Prerequisite (plan section 3.1) | Status |
| --- | --- |
| M0-01 accounts and tools (Supabase, Expo, GitHub private repo) | Expo/EAS and Git confirmed. Supabase account itself not exercised in this phase. |
| M0-03 hosted project recorded (D-56) | **Not verifiable.** `jsyqtfsidtfahytcwutp.supabase.co` does not resolve in DNS (NXDOMAIN) and returns no HTTP response, so the hosted project does not appear to exist yet. Phase 0 only checks that `EXPO_PUBLIC_SUPABASE_URL` starts with `https://`, which passes with the recorded URL. Phase 1 (type generation) and Phase 4 need a real project. |
| M0-05, M0-06, M0-07, M1-01 to M1-09 | Not needed by Phase 0. Not checked. |

Section 3.2 tools: Node 24.13.1 (>= the SDK 57 minimum 22.13.x), npm 11.8.0, Git 2.56.0, EAS CLI 27.4.1,
adb 1.0.41. Inkscape was **not** installed (see Decisions below).

## What was executed

1. Repository skeleton: root `package.json` (private, `apps/*` + `packages/*` workspaces, `typecheck` and
   `test` scripts), `.npmrc` (`save-exact=true`), `.gitignore`, `tsconfig.base.json`, `docs/versions.md`,
   `docs/builds.md`, `docs/test-results/android/`.
2. `packages/shared` stub: `package.json` (`@dologram/shared`, `main: src/index.ts`, `typecheck`, `test`),
   `tsconfig.json`, `src/index.ts` exporting `sharedReady = true`. Dev dependencies `typescript@6.0.3`,
   `vitest@5.1.0` added with `npm install --save-dev --workspace packages/shared`.
3. `npx create-expo-app@latest apps/mobile --template blank-typescript@sdk-57 --no-install`, then
   `npm install`. Renamed to `@dologram/mobile`, set `main: expo-router/entry`, added `@dologram/shared`,
   added the `typecheck` script. `App.tsx` and `index.ts` were removed because the expo-router entry
   replaces them.
4. All MVP native modules installed with `npx expo install` and the JavaScript libraries with `npm install`
   (exact versions in `docs/versions.md`). `expo-audio` 57.0.5 and `expo-video` 57.0.5 installed for the
   pinned SDK; `expo-av` is not present.
5. `apps/mobile/app.json`: name DoloGram, slug dologram, scheme dologram, portrait, `userInterfaceStyle`
   automatic, icon, `com.dologram.app`, adaptive icon `./assets/adaptive-icon.png` on `#0B6E69`, plugins
   `expo-router`, `expo-status-bar`, `expo-splash-screen`, `expo-sqlite`, `expo-audio`, `expo-video`,
   `expo-sharing`, `expo-font`, `expo-image-picker` (with `photosPermission`). `eas init` added
   `extra.eas.projectId` and `owner`.
6. App icon per 12.1 (see Decisions).
7. `apps/mobile/.env.example` with the four public variables; `apps/mobile/.env` created from it with the
   URL and `EXPO_PUBLIC_DG_DEV_TOOLS=1`. `EXPO_PUBLIC_SUPABASE_KEY` is **empty** — the publishable key is
   not in the repository or the supplied materials, so it was not invented.
8. `apps/mobile/eas.json` with the `development` and `preview` APK profiles. `eas init
   --account alex123superman --non-interactive` created `@alex123superman/dologram`
   (projectId `95bc3ce9-004a-43f2-97c1-05f9c609b466`). `EXPO_PUBLIC_SUPABASE_URL` set for the
   `development` and `preview` environments (plaintext). `EXPO_PUBLIC_SUPABASE_KEY` **not set** (no value).
9. Placeholder routes: `app/_layout.tsx` (root Stack), `app/(main)/(tabs)/_layout.tsx` (expo-router `Tabs`
   with Chats and Settings), `app/(main)/(tabs)/index.tsx` (the three diagnostic lines),
   `app/(main)/(tabs)/settings.tsx`.
10. `eas build --profile development --platform android` — build
    `76224190-109e-4596-87bf-979a45a8654f`, finished 2026-11-08T08:49:30Z, APK artifact
    `U2vRxOUGLkLDdmmGVSUohaegBgM3glH-Aifjz4jGOCs.apk` (267 MB, ABIs arm64-v8a, armeabi-v7a, x86, x86_64).
    Installed on `emulator-5554` with `adb install -r` → `Success`.
11. `npx expo start --dev-client --localhost --port 8082` (8081 is used by an unrelated node process),
    `adb reverse tcp:8082 tcp:8082`, dev client launched with
    `dologram://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082`. Metro bundled
    `node_modules\expo-router\entry.js` (1414 modules) with no errors.
12. Results and screenshots below.

## Verification results

| Check | Command / method | Result |
| --- | --- | --- |
| Typecheck (baseline and after) | `npm run typecheck` | exit 0 (`@dologram/mobile` and `@dologram/shared`). No code existed before this phase, so the pre-edit baseline is "no package.json". |
| Expo config validity | `npx expo config --type public` | exit 0, `sdkVersion: 57.0.0`, scheme and plugins as configured. |
| JS bundle builds for Android | `npx expo export --platform android` | exit 0, one Hermes bundle (2.7 MB), `@dologram/shared` resolved by Metro (A-03 holds; no `metro.config.js` needed). `dist-android` removed afterwards. |
| Dependency health | `npx expo-doctor@latest` | 21/21 checks passed after the overrides described below. |
| Secret search (M0-10, step 12) | `git grep --untracked -n -I -E "sb_secret_\|service_role\|SUPABASE_SECRET_KEY=.+\|SUPABASE_DB_URL=.+" -- . ":(exclude)*.md"` | no output (exit 1). `--untracked` was added because nothing is committed yet; without it the search would pass vacuously. |
| `.env` handling | `git status --porcelain -uall apps/mobile` | shows `?? apps/mobile/.env.example`; `apps/mobile/.env` is ignored by `.gitignore`. |
| EAS build | `eas build --profile development --platform android` | FINISHED, `error: null`. |
| App install (A-01) | `adb install -r` | `Success`; `pm list packages` shows `com.dologram.app`. |
| Three diagnostic lines | `uiautomator dump` + screenshots | `shared: true`, `netinfo: wifi`, `env: present`. See `phase-00-chats.png`. |
| Tab switching (D-142) | `adb shell input tap` on each tab + `uiautomator dump` | Chats → Settings shows the "Settings" header and "Settings placeholder"; back to Chats shows the three lines again. See `phase-00-settings.png`. |
| Runtime console | `adb logcat` filtered for `ReactNativeJS` errors and `FATAL EXCEPTION` | no JS errors, warnings or native crashes during launch and tab switching. |

## Acceptance criteria

- [x] The development APK installs and opens the dev client. (M0-08) — installed on device D, app launches
      and loads the bundle from Metro.
- [x] `npx expo start --dev-client` loads the placeholder, which shows `shared: true`. (M0-02)
- [x] The placeholder shows the netinfo line with a connection type. (D-85 item 14) — `netinfo: wifi`.
- [x] The two placeholder tabs switch. (D-142 Assumption) — expo-router `Tabs` works in the development
      build; the `@react-navigation/bottom-tabs` fallback is not needed.
- [x] `docs/versions.md` lists the SDK, Node, npm and every package of step 4. (D-65)
- [x] The step 12 search prints nothing. (M0-10)
- [x] `npm run typecheck` exits with code 0.

## Exit gate

Met: on device D, the development build opened against `npx expo start --dev-client` shows
`shared: true`, `netinfo: wifi` and `env: present`.

## Decisions and deviations

- **SDK pin.** `create-expo-app@latest` would default to SDK 57 during the SDK 58 transition. SDK 57 was
  pinned explicitly (`blank-typescript@sdk-57`) and recorded in `docs/versions.md` (M0-08).
- **Icon tool.** Inkscape is not installed on this computer, so `icon.png` (1024×1024, `#0B6E69`
  background, white Inter Bold "D") and `adaptive-icon.png` (same glyph on transparency) were rendered with
  Windows GDI+ from `node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf`. Measured glyph box
  464×552 px, centred at (512,512), inside the adaptive-icon safe zone. No tool was added to the repository.
- **Duplicate native packages.** npm hoisted a second React (19.3.1), a second `expo-asset` (58.x) and
  SDK-mismatched `react-native-reanimated`/`react-native-worklets` next to the SDK 57 ones; `expo-doctor`
  reported them as duplicate native modules and `expo-modules-core` rejected worklets 0.13. Root
  `overrides` now pin `react`/`react-dom` 19.2.3, `expo-asset` 57.0.21, `expo-constants` 57.0.23,
  `react-native-reanimated` 4.5.1 and `react-native-worklets` 0.10.1 (the SDK 57 bundled versions), and
  doctor reports 21/21 passing. Reanimated and worklets are installed as peers of `expo-router`, not as
  direct dependencies.
- **Plugins kept.** `expo install` added `expo-status-bar`, `expo-splash-screen` and `expo-sharing` plugins
  to `app.json`; they are kept because later phases need the splash hold (12.10) and sharing (AND-09).
  `eas init` had also written an explicit `android.permissions` list; it was removed because the
  `expo-audio` plugin generates those permissions during prebuild and the plan's app.json does not list
  them.
- **Metro port.** An unrelated node process already listens on 8081, so Metro runs on 8082 with
  `adb reverse tcp:8082 tcp:8082`. No file depends on the port.
- **Device.** The plan names a physical phone (device D, v14 10.2). This session's authorised test
  environment is the MuMu Player emulator `emulator-5554`; every device check above ran there.
- **Repository instruction conflict.** The template-generated `apps/mobile/AGENTS.md` says routes live in
  `src/app/`. The plan (and 12.6) fixes `apps/mobile/app/…` for all 20 phases; the plan layout was used
  because it is the documented route map for every later phase. Recorded here rather than silently
  changing either document.
- **Not done, pending the owner.** `EXPO_PUBLIC_SUPABASE_KEY` (publishable key) is needed in
  `apps/mobile/.env` and in the EAS `development` and `preview` environments. It is public, but it is not
  in the repository or the supplied materials and was not invented. Phase 1 type generation and Phase 4
  sign-in cannot run until the hosted project exists and that key is provided.

## Re-verification (2026-11-08, independent pass)

Phase 0 was re-checked from the working tree without changing application code. Every step and acceptance
criterion still holds; two prerequisite facts changed since the first pass.

| Check | Command / method | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | exit 0 for `@dologram/mobile` and `@dologram/shared` |
| Root test script | `npm run test` | exits 1 with `No test files found` (vitest). Expected: 7.2 defines no Phase 0 tests and `packages/shared` gains its first test file in Phase 1 step 9. Not a regression. |
| Dependency health | `npx expo-doctor@latest` | 21/21 checks passed |
| Installed versions vs `docs/versions.md` | `node -p require('<pkg>/package.json').version` for all 30 packages of step 4 | every row matches exactly |
| Icon assets (step 6) | PNG header + `System.Drawing` pixel probe | `icon.png` and `adaptive-icon.png` are 1024×1024 8-bit RGBA. Icon: white Inter Bold `D` on `#0B6E69`. Adaptive foreground: glyph on transparency, opaque box 278,234 → 746,790 (centred at 512,512, inside the 66 % adaptive safe zone); the transparent sample at the exact centre is the glyph counter, as intended. |
| Secret search (step 12) | `git grep --untracked -n -I -E "sb_secret_\|service_role\|SUPABASE_SECRET_KEY=.+\|SUPABASE_DB_URL=.+" -- . ":(exclude)*.md"` | no output (exit 1) |
| `.env` contents (no values printed) | `awk` name/length/shape checks on `apps/mobile/.env`, re-run 2026-11-08 after the owner supplied a key | `EXPO_PUBLIC_SUPABASE_URL` is an `https://` URL (40 characters); `EXPO_PUBLIC_DG_DEV_TOOLS=1`; `EXPO_PUBLIC_SUPABASE_KEY` is a `sb_publishable_…` key of `jsyqtfsidtfahytcwutp` (46 characters); `EXPO_PUBLIC_DG_LATENCY_LOG` is empty (off). The file also holds `EXPO_PUBLIC_ANON_SUPABASE_KEY` (JWT, 208 characters), which the app does not read; the two privileged keys seen in an intermediate version (`EXPO_SERVICE_ROLE_SUPABASE_KEY`, `EXPO_SECRET_SUPABASE_KEY`) are gone. |
| EAS environment variables | `eas env:set … --visibility plaintext` then `eas env:list --environment development` and `--environment preview` | `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are present in both environments and the stored key is the working one: SHA-256 prefix `594c319b114b38be` and length 46 match `.env` in both, so no rejected value remains. |
| Project identity | response headers of every probe | `sb-project-ref: jsyqtfsidtfahytcwutp`, so the host answered by `/auth/v1/*` and `/rest/v1/*` is the intended project |
| Key validity, anon JWT | `curl` `/auth/v1/health`, `/auth/v1/settings` and `/rest/v1/profiles?select=id&limit=1` with `EXPO_PUBLIC_ANON_SUPABASE_KEY` | 200, 200 and `404 PGRST205 Could not find the table 'public.profiles'`: Auth and the Data API both accept this key, and only the table is missing because M1-01 is not applied |
| Key validity, publishable | the same three endpoints with `EXPO_PUBLIC_SUPABASE_KEY` | `/auth/v1/health` 200 (`GoTrue v2.197.0`), `/auth/v1/settings` 200, `/rest/v1/profiles?select=id&limit=1` `404 PGRST205 Could not find the table 'public.profiles'` — the key is accepted and only the table is missing. An earlier 45-character value failed these probes with `401 Invalid API key` (tested as `apikey` header, `apikey` query parameter and `Authorization: Bearer`) and was replaced. |
| Data API root endpoint | `curl /rest/v1/` with either public key | `401 UNAUTHORIZED_INVALID_API_KEY_TYPE`, hint "Only the `service_role` API key can be used for this endpoint". The restriction covers the OpenAPI root only; table paths accept the anon key and the app never requests the root. |
| EAS build record | `eas build:list --platform android` | `76224190-109e-4596-87bf-979a45a8654f`, status `finished`, profile `development`, SDK 57.0.0, artifact `U2vRxOUGLkLDdmmGVSUohaegBgM3glH-Aifjz4jGOCs.apk` — matches `docs/builds.md` |
| Installed APK | `adb -s emulator-5554 shell dumpsys package com.dologram.app` | `versionName=1.0.0`, installed 2026-11-08 16:50:41 |
| Exit gate on device D | `adb reverse tcp:8082 tcp:8082`, deep link to `localhost:8082`, `uiautomator dump` | `shared: true`, `netinfo: wifi`, `env: present` |
| Tab switching (D-142) | `adb shell input tap` on each tab + `uiautomator dump` | Chats → Settings shows `Settings` + `Settings placeholder`; Settings → Chats shows the three lines again |
| Runtime console | `adb logcat` after `logcat -c`, filtered for `ReactNativeJS`, `FATAL EXCEPTION`, `AndroidRuntime` | no JavaScript errors, warnings or native crashes; the only `AndroidRuntime` lines are `uiautomator`'s own process |

### Corrected prerequisite facts

- **M0-03 is closer than recorded above.** `jsyqtfsidtfahytcwutp.supabase.co` now resolves
  (`172.64.149.246`, `104.18.38.10`) and answers: `GET /auth/v1/health` returns 401 and
  `GET /rest/v1/` returns `{"message":"No API key found in request",...}`, which is the response of a live
  Supabase project. The earlier NXDOMAIN is gone, so the hosted project exists, and the publishable key
  supplied later the same day completes M0-03 for the Android client (see the key-validity rows above).
  Phase 1 type generation still needs M1-01…M1-06 applied and a `SUPABASE_ACCESS_TOKEN`, not this key.
- **Supabase CLI is not installed locally.** `npx --no-install supabase` reports the package is missing and
  `npx` refuses to install without confirmation. Phase 1 step 1 downloads `supabase` on first use with
  `npx supabase`; this needs no action in Phase 0.
- **Device identity.** `adb devices` lists `emulator-5554` and `127.0.0.1:16384` as the same MuMu Player
  instance (identical `ro.build.fingerprint` `Asus/AI2203/AI2203:12/V417IR/669` and install timestamps).
  `emulator-5554` is device D; `emulator-5556` is an unrelated Android 9 emulator without the app.
- **Device-work constraint (owner instruction, 2026-11-08).** Device checks use MuMu Player
  `emulator-5554` with `com.dologram.app` only: no other emulator, no other installed app, no
  computer-use or desktop automation. Restarting the emulator and reinstalling or clearing DoloGram data
  are allowed.
- **Privileged keys were present and are now removed.** An intermediate version of `apps/mobile/.env`
  also held `EXPO_SERVICE_ROLE_SUPABASE_KEY` (JWT, 219 characters) and `EXPO_SECRET_SUPABASE_KEY`
  (`sb_secret_…`, 41 characters). Expo inlines only `EXPO_PUBLIC_*` variables, so neither reached the
  bundle, and `.env` is git-ignored; both are gone from the file now. They must never be added back to a
  client environment file, copied into `eas env:set`, or committed.
