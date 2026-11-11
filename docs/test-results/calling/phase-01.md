# Calling Phase 1 execution result

2026-11-11, Asia/Manila. **Complete locally. Phase 1 is 100% complete.
Verified calling-plan progress is 22% (10/45 required items).** The disposable
local Supabase target passed V1 with real database roles and separate PostgreSQL
connections. The shared DoloGram database was outside this execution.

## Changed

- Migration 029 now checks actor and runtime binding, reevaluates access and
  deadlines at admission finalization, and assigns provisioning ownership to one
  request. Terminal and deletion paths preserve cleanup metadata and fence late
  callbacks. A claim can be recovered after lease expiry without letting the
  prior worker complete it. Reconciliation changes participant revisions only
  when connection state or identity generation changes.
- The worker applies expiry, duration, flags and access loss, bounds queue claims
  and pruning, and deduplicates live reconciliation jobs. The configured
  missed-call cooldown uses recent indexed outcomes for the pair.
- Shared history validates filter inputs, retains microsecond precision in
  the strict tuple cursor, and uses one lookahead row to identify another page.
  Two history tests run the actual pinned Supabase client with a stub transport.
  Calling table and RPC types were matched against fresh generated output.
- The SQL test uses synthetic accounts and rolls back. The Python concurrency
  runner uses independent psql processes in the named disposable local container.
  The scheduler procedure records SQL-only measurement and later hosted steps.

No dependencies were added. The phase used PostgreSQL 17.6 and Supabase CLI
2.111.0 locally, with the repository's Supabase JS and PostgREST JS 2.119.0.
No mobile API or native artifact changed.

## Verification

| Check | Result |
| --- | --- |
| Root typecheck | Passed before and after, mobile and shared workspaces. |
| Shared Vitest | Baseline 147/147. Final 149/149 across 20 files. The existing Vite config warning remains. |
| Mobile lint baseline | Pre-existing failure with 13 errors and 3 warnings. |
| Original V1 SQL baseline | Migration applied. The old test failed because it tried to update private settings as service_role. The revised fixture sets up state as owner and tests the actual roles separately. |
| Final Supabase V1 | Migration 029 applied on a fresh local stack. The SQL suite passed with anon/authenticated/service roles, private grants, former-member and restricted-account checks, deadline and rate limits, provisioning ownership, independent leases, reconciliation, expired-job recovery, deletion and a late provisioning result. |
| Parallel PostgreSQL sessions | Six actual lock waits were observed for request replay, opposite directions, a shared callee, competing acceptance, simultaneous hang-up, and accept after expiry. Two overlapping workers obtained distinct jobs. |
| SQL-only Cron | 26/26 successful runs, zero overlaps, 24.651 ms maximum runtime and 10.030209 s maximum start gap. A 30-second unanswered call expired in 31.002024 s and left zero reservations. The probe was disabled. |
| Generated public types | Both calling tables and all nine calling RPCs matched in both TypeScript assignability directions. Unrelated database types were preserved. |
| Local database lint | Public and private schemas passed. |
| Local Supabase security advisors | No warnings reported. |

## Phase 1 acceptance

| Requirement | Status |
| --- | --- |
| CALL-03 lifecycle and terminality | Met for SQL. Role, deadline and terminal replay checks passed. |
| CALL-04 reservations, idempotency and session ownership | Met for SQL. Contending requests and the first accepting runtime were verified with real parallel sessions. |
| CALL-05 authorization and access loss | Met for SQL. Participant-only reads, direct mutation and RPC denials, restriction, membership loss and bound end were verified. |
| CALL-06 admission fencing and credential isolation | Met for SQL. Wrong sessions, restricted actors and terminal calls failed admission. Provider token minting and revocation are later gates. |
| CALL-11 durable scheduling and recovery | Met for SQL. Expired leases, overlapping claims, cascade survival and scheduled ring expiry passed. Hosted HTTP and provider recovery are later gates. |
| CALL-12 history query and access | Met for Phase 1. RLS, zero-media timestamps, cursor ties and invalid cursor handling passed. The screen and call-again UI are Phase 5. |
| CALL-17 flags, limits, and scheduling budget | Met for Phase 1. Default-off, create/cooldown, max duration, and local scheduler budget were verified. Provider quotas and hosted timings remain later gates. |

## Reproduce and recover

Use a dedicated local Supabase CLI project with unused ports. Copy the
repository migrations through 029, excluding 009–011 because they seed existing
project-specific accounts. The actual Supabase Auth and Storage schemas are
initialized by the local CLI. Run the following from the repository with the
disposable project ID substituted where necessary.

```powershell
Get-Content -Raw supabase/tests/calling_phase_1.sql |
  docker exec -i supabase_db_dologram-calling-phase01-v1 psql -X -U postgres -v ON_ERROR_STOP=1
python supabase/tests/calling_concurrency.py supabase_db_dologram-calling-phase01-v1
supabase --workdir <disposable-project-dir> gen types --local --schema public
supabase --workdir <disposable-project-dir> db advisors --local --type security --level warn
npm run typecheck
npm run test --workspace @dologram/shared
```

Run the concurrency script before installing the temporary Cron probe. Its
committed fixtures belong only in the disposable target. Use the [scheduler
procedure](phase-01/scheduler.md) to collect and disable the probe. Preserve
applied schema and history if recovering a test. Disable new calls via the
server flag, drain jobs, then disable the scheduler.

The existing direct-key trigger treats a one-member direct chat as Saved
Messages. The membership-loss fixture first removed its synthetic caller's
Saved Messages chat within the rollback transaction to avoid that pre-existing
key collision. The general chat trigger remains outside Phase 1.

**Next phase is ready for independent implementation when authorized.** Hosted
Cron/Vault and provider acceptance depend on the authorized isolated target and
Phase 2 worker. MuMu and media verification start with the applicable mobile
phase.
