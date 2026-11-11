# Phase 0 deterministic checks and later operator gates

2026-11-11. Run from `G:\codebase\DoloGram` unless stated otherwise. No command
below authorizes a later phase, upload, remote migration or configuration change.

## Current local checks

`python docs/test-results/calling/phase-00/run-checks.py baseline/checks` ran the
existing scripts once with bounded subprocesses and retained full logs. Do not
overwrite the baseline or rerun it without a relevant change/diagnosis.
The early runner path error is retained separately and is not a repository failure.

Exact Deno runner discovered:

```powershell
$deno = 'C:/Users/User/AppData/Local/npm-cache/_npx/05b6ef7b13673c57/node_modules/deno/deno.exe'
$env:DENO_DIR = 'G:/codebase/DoloGram/.tmp/calling-phase00/deno-cache'
$env:BUF_BIGINT_DISABLE = '0'
& $deno test --no-config --cached-only --node-modules-dir=none --lock=docs/test-results/calling/phase-00/deno.lock --frozen-lockfile --allow-env=BUF_BIGINT_DISABLE docs/test-results/calling/phase-00/sdk-contract.test.ts
& $deno test --no-config --cached-only supabase/functions/send-push-notifications/payload_test.ts
node docs/test-results/calling/phase-00/config-probe.cjs
```

The recorded passing locked run generated [deno.lock](deno.lock) to freeze the
server SDK's transitive graph; subsequent runs use --frozen-lockfile. See
[locked probe result](sdk-probe-locked.log). No dependency was added to the app.

No --allow-net/--allow-all or real credential environment is supplied to SDK
tests. The only permitted environment read is protobuf's BUF_BIGINT_DISABLE.
The initial denied-environment diagnostic is retained; narrowed permission fixed
the cause. Four SDK cases cover real SDK token signatures/TTL/source grants,
seconds/bigint removal serialization and raw webhook body tampering. HTTP is
stubbed; this does not prove LiveKit revocation/media. Config probe needs the
integrity-verified source cache; [prepare-sdk-sources.py](prepare-sdk-sources.py)
reconstructs it from the fixed metadata if missing (public network download).

## Later SQL/type-generation execution

Use the cached CLI, with telemetry disabled:

```powershell
$supabase = 'C:/Users/User/AppData/Local/npm-cache/_npx/b96a6bd565c470ce/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
```

Help/version output was verified and retained. **Do not use the current root's
linked project for fixtures**: it is not confirmed isolated. After the owner
identifies the test project and Phase 1 is authorized, use a separate explicitly
linked test workspace (`$isolatedRoot` below). Verify its project-ref matches
`$testProjectRef` before any query. These variables are future verified inputs,
not literal credentials/placeholder parameters to execute now.

```powershell
& $supabase --workdir $isolatedRoot migration list --linked
& $supabase --workdir $isolatedRoot db query --linked --file $readOnlyInspectionFile
& $supabase --workdir $isolatedRoot db query --linked --file $callingSqlTestFile
& $supabase gen types --project-id $testProjectRef --schema public --lang typescript
```

Proposed inspection/test filenames aren't created here: Phase 1 authors them.
Inspection must read target migration history; current chat/member/Auth contracts;
installed extensions/versions; cron job identities; worker grants; Realtime
publication. Don't print secret values or query unrelated accounts.

New V1 fixtures must create their own A/B/outsider/restricted accounts/chat IDs
and abort if those IDs already belong to nonfixtures. Transactional cases begin
and roll back; parallel races require separate real database sessions and barriers,
not an in-memory database or a single serialized SQL request. The selected CLI
provides a SQL execution facility, but parallel-session semantics still need
verification on that target before V1 can pass. No pgTAP runner is assumed.
Use captured explicit IDs; don't run existing arbitrary-profile fixtures on the
linked app database. Remote schema application remains separately unauthorized.

Capture generated type output to a temporary file, inspect/diff it and preserve
unrelated exports before replacing database.types.ts. Do not run root gen:types:
its `--project-id dologram --ref none` arguments are stale/invalid for this contract.

Phase 2 adds adjacent Deno tests, run through the discovered runner with exact
files and minimal permissions/fake secrets; integration uses only the confirmed
provider/test database and separately authorized deployed functions. No ambient
production credentials in unit processes.

## Later artifact/media and rollback procedure

1. Prepare/review actual dependency/lockfile/plugin diff, reconcile the existing
   Expo RNGH mismatch, and rerun Expo/type/lint/affected tests. Gate SDK imports
   before testing old-APK fallback. Never treat current APKs as LiveKit-capable.
2. Recheck EAS Android allowance and source-upload authority. Batch voice/video
   native support into one justified development cloud build; no local native
   build. Record source hashes, lockfile, config, resolved native dependency
   graph, EAS fingerprint and APK hash. No build was started here.
3. Install only the authorized source-matched APK through explicit ADB serial
   `127.0.0.1:16480`; do not reset another emulator. Create/login disposable test
   accounts autonomously using the confirmed isolated target. Use the permitted
   test-only Chrome/native peer candidate first, while recording any shared-
   microphone/audio-focus limitation; unavailable two-way evidence stays pending.
4. V2 must test initial/refreshed/same-second credentials after termination and
   across the provider revocation window. V5 must observe actual two-way media,
   permissions, capture teardown and supported routing; an icon isn't evidence.
   Configure provider webhook/scheduler only under later explicit authorization.
5. Phase 8 exports fresh Android JS from the matching source to a unique directory
   and runs scripts/scan-mobile-bundle.ps1 -Path against that directory. Phase 2
   adds LiveKit patterns first. Old dist is not a source-matched security result.
6. Rollback: disable server new create/accept/admission flags, drain existing
   calls through normal terminal transitions, keep webhook/reconciler/jobs/history
   alive until all cleanup is confirmed (or explicitly failed/alerted). Retain
   compatible schema/history and ship a client fix; no destructive down migration,
   deleted call history or rotation of working credentials. Record this rehearsal
   on isolated targets in Phase 8, not as a Phase 0 pass.

Local Phase 0 recovery needs no runtime rollback: only documentation/evidence was
added. Pre-edit plan/versions and all relevant untracked inputs are recoverable in
baseline/source. Restore only individually owned document edits after checking
for concurrent user changes; never reset the working tree or remove user files.
