# Phase 0 recovery and safe fixture procedure

2026-11-11. Working copy, not HEAD, is authoritative. Do not reset/clean Git.

## Recovery

`baseline/sources.json` identifies 72 pre-existing user inputs with SHA-256 and
byte counts. `baseline/source/` holds exact copies, including the existing plan,
context index, feature contracts, tests, manifests, lockfile and relevant schema.
Tracked/staged patches are empty. Git inventories are in `baseline/`.

Before restoring a file, compare its current hash and changes with the saved
copy. Preserve any newer user edits separately. Restore **only** an individually
owned edit from its exact `baseline/source/<repository-relative-path>` copy;
never copy the whole baseline over the repository. Phase 0 edits only the Phase 0
section of the search plan and appends its execution context to the existing
context index. Application sources were not edited by this task. Future code
changes require a freshness check and snapshots of any newly touched inputs.

The integrity validation rehearses copying the saved plan to a task-owned scratch
path and comparing its SHA-256, without overwriting the live plan. Snapshot hashes
are independently checked against every saved file. This establishes recoverable
bytes; it does not authorize reverting concurrent work.

`.env*`, credentials, signing material, saved sessions/accounts, Google service
configuration, private message data and APK payloads are excluded from snapshots
and Repomix. APKs are inventoried by hashes/native-library names only.

## Isolated native fixture

`runtime-app/` is an evidence-only custom Expo entry, outside application routes
and npm workspace globs. It reuses installed Expo 57.0.32, RN 0.86.3, React 19.2.3
and SQLite 57.0.4 without installation, lockfile edits or new dependencies. It
imports the **unchanged** `searchCachedMessages` source, not a reimplementation.

Its only fixture database is `:memory:`. `PRAGMA database_list` must report an
empty file path. Synthetic account/chat IDs start `search-p0-`; 260 messages
contain 35 keyword matches older than the newest 200. It never imports mobile
AuthProvider, Supabase client, queue/sync workers, notifications or account stores.
Its fetch/XHR/WebSocket guards reject fixture-originated outbound traffic. A
deliberate external fetch probe must fail before data is seeded. No real account
is logged in and no connected data is created. Closing the database and stopping
the fixture activity removes all fixture data; no production database is opened.

The SDK's development HMR and SQLite DevTools also use WebSocket. The initial
development-mode fixture correctly fenced these calls but produced console
errors. That diagnostic is retained in `runtime/fixture-native.log`. The final
run uses `--no-dev` to omit those clients; its native console has zero warnings
and errors. This is a **native query baseline in non-development JS mode**, not
screen/UI timing, an entire-app compatibility pass or the Phase 4 stress gate.

To reproduce only when a source/environment change warrants another measurement:

1. Recheck MuMu's `MuMuPlayerGlobal-12.0-3/configs/extra_config.json` name and
   `vm_config.json` ADB port. Confirm `adb devices -l` and package path on serial
   `127.0.0.1:16480`; do not operate other devices.
2. Set `EXPO_NO_TELEMETRY=1`, `CI=1`, and start the installed CLI from repository
   root: `node node_modules/expo/bin/cli start docs/test-results/search/phase-00/runtime-app --dev-client --offline --no-dev --port 8084 --max-workers 2`.
   Do not combine `--offline` with `--localhost` in SDK 57.
3. Add only `adb -s 127.0.0.1:16480 reverse tcp:8084 tcp:8084`. Launch with
   `adb -s 127.0.0.1:16480 shell am start -W -a android.intent.action.VIEW -d 'dologram://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8084' -p com.dologram.app`.
4. Capture that app PID's `DG_SEARCH_PHASE00_RESULT` marker and console. Keep
   synthetic timings only. Capture screenshots with `adb ... exec-out screencap -p`
   using binary-safe output; hierarchy via `uiautomator dump`.
5. Stop only this fixture's CLI process tree, force-stop its app activity, and
   remove only `reverse --remove tcp:8084`. Preserve all pre-existing services,
   mappings and account data. Do not clear application data.

Connected test target is configured as `jsyqtfsidtfahytcwutp.supabase.co`, matching
the supplied test-account script. Configuration identity does **not** establish
disposable connected chats or memberships. Connected V11 account/data isolation
must be established when those flows are executed; no connected fixture pass is
claimed here. Supplied credential material remains in its original location,
outside evidence packets. This phase used the permitted offline alternative.
