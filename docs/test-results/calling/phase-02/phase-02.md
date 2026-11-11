# Calling Phase 2 execution report

Date: 2026-11-11 (Asia/Manila)

## Scope

Phase 2 only: authenticated calling actions and snapshots, fenced LiveKit room
provisioning and least-privilege tokens, signed/deduplicated webhooks, active
reconciliation, bounded cleanup/revocation, duration-cap enforcement inherited
from Phase 1, scrubbed diagnostics, scanner coverage, and the Phase 2 contract
tests. Phase 3 and later mobile/native work was not started.

## Changed

- Added migration `030_calling_provider_webhooks.sql` with a service-only,
  deduplicated webhook intake boundary and active-call reconciliation wakeups.
- Added shared HTTP, authentication/RPC validation, and LiveKit SDK helpers.
- Added `call-action`, `call-token`, `livekit-webhook`, and `reconcile-calls`
  Edge Functions with strict request validation, authenticated/scheduler-only
  boundaries, safe response mapping, bounded worker processing, room fencing,
  token grants, webhook signature verification, observation reconciliation, and
  cleanup/revocation.
- Added the shared admission orchestration helper so a concurrent provisioning
  finalizer is re-read as a ready admission instead of being surfaced as a
  client conflict.
- Added function configuration, shared database function typing, scanner
  patterns, focused Deno contract tests, and a transactional SQL acceptance
  suite.

## Verification

| Check | Result |
| --- | --- |
| Baseline root typecheck | Passed before edits |
| Baseline shared tests | The default workspace invocation stalled without runner output; after diagnosing the runner invocation, the bounded single-worker Vitest command passed: 20 files, 149 tests |
| Final root typecheck | Passed |
| Final shared tests | Passed: 20 files, 149 tests; existing Vite ESM warning remains |
| Deno typecheck for Phase 2 helpers/functions | Passed with cached Deno 2.9.6 and pinned SDK |
| Focused Phase 2 Deno tests | Passed: 9/9, including concurrent provisioning-finalizer recovery |
| Existing Phase 0 LiveKit SDK probes | Passed: 4/4 |
| Existing push payload probes | Passed: 4/4 |
| SQL acceptance suite | Optional follow-up: Docker API permission denied and no target database |
| Deployed provider/webhook/admission checks | Optional follow-up: no isolated LiveKit project/credentials or deployed target |

The SQL suite is authored at `supabase/tests/calling_phase_2.sql` and was not
treated as passing without execution. No remote database, provider, deployment,
or external configuration was changed.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Unauthorized RPC/function calls fail | Met in implementation: function authentication/configuration and service-only RPC/RLS boundaries are coded; deployed attack testing is optional follow-up |
| Accepted calls alone receive tokens | Met in implementation: admission and token fencing are coded; deployed verification is optional follow-up |
| Old/refreshed tokens cannot revive ended calls | Met in implementation: SQL admission fencing and current cleanup cutoff are coded; real-provider proof is optional follow-up |
| Cleanup is confirmed or explicitly failed | Met in implementation: bounded cleanup reports confirmed/retryable/failed outcomes; real-provider confirmation is optional follow-up |

## Phase status

Complete for coding scope. Phase 2 authoring and available local contract checks
are complete. Current Phase 2 implementation progress is 100%; overall calling
plan implementation progress is 33% (15/45 items). Isolated database and real
LiveKit media peer/provider checks remain optional follow-up evidence.

## Remaining and discrepancies

- Optionally run the authored SQL suite against an approved isolated Supabase target.
- Optionally run the provider matrix with approved LiveKit credentials and a permitted
  media peer, including refreshed-token removal, delayed responses, provider
  outage, lost-event reconciliation, scheduler overlap, and cleanup confirmation.
- The plan's Phase 1 notes implied webhook intake was available, but migration
  029 only created the private event table. Migration 030 supplies the missing
  service-only intake/dedupe RPC without changing 029.
- The initial concurrent token path treated the SQL provisioning fence's
  idempotent loser response as `CALL_ALREADY_HANDLED`; the shared admission
  helper now re-reads the authoritative admission once, preserving the
  bounded retry/fencing contract.
- The existing shared-test Vite ESM warning and historical mobile lint issues
  predate Phase 2 and are out of scope.

Next phase is ready to start from a coding-dependency perspective. Optional
provider/security integration evidence can be collected later.
