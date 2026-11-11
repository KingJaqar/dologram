# Calling Phase 1 context index

## 2026-11-11 completion pass

The entries below this section describe the prior authoring pass. Current
verification supersedes its pending-target findings.

- **Scope and prerequisites.** Read the plan's shared rules, calling requirements,
  state/security/scheduler contracts, Phase 0 evidence, and the full Phase 1
  subsection. Confirmed the chat/member and private-schema contracts in migrations
  016–018 and verified the actual Supabase Auth columns on the disposable stack.
  Only `supabase/AGENTS.md` applies to the changed database files. The mobile
  instructions were reviewed for integration boundaries. No instruction conflict
  or native API change required adaptation.
- **Git and ripgrep.** Tracked and staged diffs were empty at baseline. The
  application and all Phase 1 implementation were already untracked. Relevant
  inputs and the old progress/report files were copied without secrets before
  editing. Targeted discovery found 029, both SQL tests and the shared history
  consumer. No Repowise index was needed.
- **Reader and Repomix.** All 13 prior source/packet identities matched their
  recorded hashes. Repomix 1.18.1 packed seven allowlisted entries (migration 029,
  both existing SQL tests, the three shared call source files and the Supabase
  instructions). The security scan found no suspicious files. Initial packet
  SHA-256 is `569eac7b2f58d69546b5736970cb17c17384580e0e0fcbf1b209b3c721ff7fbc`.
  The XML was parsed, its files matched to working sources, and the SQL was read
  in 200-line continuations through line 1554. Shared source, test and instruction
  entries each fit one chunk. The supplemental XML contains six changed code
  inputs, with exact file hashes and extraction boundaries in its manifest.
  Both packets used the default security scan and uncompressed XML. No environment
  files, credentials, account seed files or build outputs were included.
- **Original-source verification.** The schema and RLS checks are in 029 lines
  39–356. The lifecycle/session, admission and scheduling paths begin at
  `call_create` (774), `call_transition` (905), `call_prepare_admission` (1120),
  `call_finalize_admission` (1226), and `call_worker_tick` (1368). Original
  definitions, scoped diffs, and the final XML's changed entries were checked
  against the exercised SQL paths. The current database client behavior was
  verified with pinned Supabase JS/PostgREST JS 2.119.0 and TypeScript.
- **Baseline and acceptance.** Root typecheck and 147 shared tests passed before
  editing. Mobile lint failed with the same 13 errors and 3 warnings as the
  prior pass. The original SQL test failed at its private settings fixture.
  Final V1 SQL, real transaction races, generated types, database lint, local
  security advisors, root typecheck, and 149 shared tests passed. SQL-only Cron
  passed 26 consecutive runs, zero overlaps, and a 31.002024-second scheduled
  ring expiry with no residual reservations. See the [phase report](../phase-01.md).
- **Evidence.** The [resume evidence directory](../../../../.tmp/calling-phase01-resume)
  contains the baseline copies, Git inventory, XML packets and manifests, SQL
  output, Cron sample, generated types, and check logs. Final packet SHA-256 is
  `cfcbbc3c484466f27ad6b007e13d6ae3a7937d308bcfb122f70158c7b7d54447`.
  The final plan diff is confined to the selected Phase 1 progress section.
  Hosted Cron/Vault, provider and app flows remain later integration gates.

## Prior authoring pass

2026-11-11, Asia/Manila. Phase 1 offline implementation pass. Entry points:
[phase report](../phase-01.md), [plan](../../../../Plans/DoloGram_Voice_Video_Calling_Implementation_Plan.md),
[Phase 0 contracts](../phase-00/contracts.md), [scheduler procedure](scheduler.md).

## Checklist

- [x] Read every applicable AGENTS.md/CLAUDE.md; only `apps/mobile/AGENTS.md` and
  `supabase/AGENTS.md` apply. No root/hidden instruction file was found.
- [x] Git baseline, ownership inventory, and secret-free recoverable baseline
  saved before edits. Existing untracked work was preserved.
- [x] Narrow ripgrep discovery confirmed migration 028, no existing call schema,
  RPC, shared call type, or call repository.
- [x] Phase 0 context index/contracts/report were read and reused; current target
  migration history was independently checked read-only.
- [x] Scoped Repomix 1.18.1 packet generated with default security checks and
  parsed; all 53 included entries were enumerated and relevant entries were read
  in bounded continuations.
- [x] Relevant baseline checks ran once before editing; affected typecheck/shared
  tests reran after editing.
- [ ] Isolated V1 SQL/RLS/concurrency/deletion gate; target unavailable without
  mutating the shared DoloGram project.

## Ownership and baseline

The repository contains substantial untracked user work. A Phase 1 baseline copy
of the instructions, plan, manifests, current database types, migration 001–028,
and existing SQL tests is in `phase-01/baseline/source`; no credentials, `.env`,
keys, or signing material were copied. The exact pre-edit Git status is in
`phase-01/baseline/git-status.txt`; hashes are in `phase-01/baseline/hashes.json`.

Phase 1-owned edits are the 029 migration, calling tests, shared call types/repository/
exports/database contract, this phase report/index/scheduler procedure, and the
selected Phase 1 progress subsection in the plan. No unrelated user changes were
reverted, reformatted, or overwritten.
Current SHA256 identities for the owned sources and final packet are recorded in
`source-hashes.json`.

## Repomix packet

- Command: Repomix 1.18.1, XML, parsable style, security checks enabled, no
  compression, no Git sorting.
- Selectors: plan, Phase 0 contracts/context/report, applicable instructions,
  shared DB types/client/repositories/index/package manifests, Supabase config,
  all migrations 001–028, and all existing SQL tests.
- Actual included files: 53; packet manifest: `packet-manifest.json`; packet:
  `context.xml`; packet size: 294,272 bytes / 65,699 tool-estimated tokens.
- Exclusions: dependencies/build output/scratch/baseline copy and secret-like
  `.env`, `.pem`, `.key` files. Repomix reported no suspicious files.
- Read boundaries: XML metadata and directory structure (first bounded chunk),
  all file entry identities, Phase 0 contracts in three bounded chunks, and the
  migration/RLS/shared type entries needed for Phase 1. Original source was then
  re-read for all edited implementation inputs. No compression gaps were used.
- Packet token-count cache could not persist due sandbox EPERM; XML output itself
  was written successfully and is the source packet for this phase.
- After the final test/type-contract edits, supplemental Repomix XML packets were
  generated as `context-final.xml`, `context-final-2.xml`, and `context-final-3.xml`.
  The final supplemental packet has two entries (`supabase/tests/calling_phase_1.sql`
  and `packages/shared/src/db/database.types.ts`, 24,428 characters total); both
  entries were parsed and read completely in bounded continuations. The final test
  packet confirms the service-only RPC assertion runs under `authenticated`, not
  `service_role`.

## Confirmed findings and unresolved questions

- Current local and read-only DoloGram target migration history both end at 028;
  029 is the correct next local filename.
- Target is Postgres 17.11 and exposes pg_cron, pg_net, Vault, and pgTAP; it has
  no development branches and contains shared data, so it is not a valid V1 target.
- Target `auth.users` includes `banned_until`, `deleted_at`, and
  `raw_app_meta_data`, resolving the Phase 0 Auth-column uncertainty. The
  migration now checks these values without trusting user metadata.
- Calling RPCs intentionally require a verified Edge actor forwarded through a
  service-role request. The SQL layer does not decode or trust an unverified JWT.
- No provider, LiveKit, Edge Function, scheduler credential, or remote schema was
  changed. Phase 2 owns provider effects.

## Verification identities

- Pre-edit baseline checks: root typecheck and shared tests passed; mobile lint
  reproduced the pre-existing 13-error/3-warning failure.
- Post-edit root typecheck passed with exit code 0.
- Post-edit shared tests passed: 19 files / 147 tests, with the existing Vite
  config warning.
- `git diff --check` produced no whitespace errors; the only displayed Git message
  was the existing CRLF normalization warning for tracked `README.md`.
- Live target SQL, generated type output, Supabase advisors after 029, Cron timing,
  and concurrency are unresolved pending a disposable target.
