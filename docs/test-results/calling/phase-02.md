# Calling Phase 2 execution result

2026-11-11, Asia/Manila. **Partially complete.** Phase 2 authoring is complete
for the scoped backend path, but the plan's completion gate remains pending:
the isolated SQL target, deployed Edge Functions, dedicated LiveKit project,
provider credentials, and permitted real media peer were not available in this
execution environment. No remote migration, function deployment, provider
configuration, or third-party upload was performed.

## Scope and ownership

- Read the complete calling plan context and Phase 2 subsection before editing.
- `supabase/AGENTS.md` applies to migrations; `apps/mobile/AGENTS.md` was read
  and is not applicable because Phase 2 does not touch Expo/React Native code.
- The repository has no root `AGENTS.md`/`CLAUDE.md`; the `.claude/worktrees`
  files are separate worktree contents, not ancestor instructions.
- The working tree is substantially untracked. Existing files were treated as
  user-owned; no reset, checkout, cleanup of unrelated files, commit, push,
  deployment or remote configuration was performed.

## Changed

- Added shared Edge validation/auth/error helpers under
  `supabase/functions/_shared/`, with measured 8 KiB request limits, strict
  request keys and UUIDs, verified Supabase JWTs, safe error envelopes,
  capability/snapshot validation and metadata-only diagnostics.
- Added `call-action` for create/lifecycle/snapshot RPCs and safe busy/error
  handling.
- Added `call-token` for admission fencing, idempotent room creation/lookup,
  exact five-minute LiveKit grants, finalization fencing and in-memory token
  return only.
- Added `livekit-webhook` for raw-body signature verification and normalized
  event handoff; added `reconcile-calls` for scheduler-authenticated bounded
  reconciliation and cleanup jobs.
- Added migration 030 for service-only webhook event recording/deduplication and
  stale room-generation rejection. Updated the generated public function type,
  function JWT configuration, and mobile-bundle scanner patterns for LiveKit
  secret names.
- Added focused Deno tests and a transactional SQL webhook/security test. No
  new npm dependency was added; the exact Phase 0-selected Deno imports are
  pinned to Supabase JS 2.119.0 and LiveKit server SDK 2.19.3.

## Verified

| Check | Result |
| --- | --- |
| Baseline root typecheck | Passed before edits. |
| Baseline shared tests | Passed: 20 files / 149 tests, with the existing Vite config warning. |
| Phase 2 Deno typecheck | Passed with cached Deno 2.9.6 and a separate frozen scratch lock/cache for the selected Supabase/LiveKit graph. |
| Focused Phase 2 Deno tests | Passed: 8/8. Covers real token claims/source grants, lost room-create response, current revocation cutoff, outstanding provisioning, provider missing-room observation, input/body rejection and URL normalization. |
| Phase 0 pinned SDK probes | Passed: 4/4, including raw webhook tamper rejection and bigint removal serialization. |
| Existing push payload probes | Passed: 4/4. |
| Final root typecheck | Passed. |
| Final shared tests | Passed: 20 files / 149 tests, same existing Vite warning. |
| SQL migration 030 / V2 SQL suite | Not run: Docker access is denied in this environment and no usable isolated SQL target/psql was available. |
| Deployed Edge auth/RLS/provider checks | Not run: no dedicated target, LiveKit project, or approved function credentials were available. |

## Acceptance status

| Requirement | Status | Evidence / remaining gate |
| --- | --- | --- |
| CALL-03 lifecycle/terminality | Pending provider/backend verification | Phase 1 SQL lifecycle is verified; deployed action/webhook/reconciliation race checks remain. |
| CALL-04 reservations/session ownership | Pending provider/backend verification | Phase 1 SQL fencing is verified; token/provisioning response-loss and provider retry checks remain. |
| CALL-05 authorization/access loss | Pending provider/backend verification | Phase 1 SQL RLS/access checks are verified; function JWT and deployed RPC attack checks remain. |
| CALL-06 server-only credentials and post-end revocation | Pending provider verification | SDK claims/grants and strict cleanup cutoff are unit-tested; fresh/refreshed-token removal and real end/delete races remain. |
| CALL-11 outage/reconciliation/cleanup convergence | Pending provider/scheduler verification | SQL jobs/cap/retries are Phase 1 verified; hosted scheduler, provider outage and cleanup confirmation remain. |
| CALL-17 flags/limits/budget | Pending provider/target verification | Phase 1 flags/rate limits are verified; provider quotas and hosted timing budget remain. |
| CALL-18 release artifact/rollout | Not met | Owned by later Phase 8; deliberately not started. |

## Blockers and remaining

- The Phase 2 live gate needs a dedicated isolated Supabase target with
  migration 030 applied and a dedicated LiveKit project/secrets/webhook target.
  The plan's OWNER-01/OWNER-02 access boundary remains unresolved; secrets were
  neither requested in chat nor printed.
- The assigned Docker API is inaccessible, so the authored SQL test is ready
  but not claimed as passed. The existing Phase 1 local evidence was not reused
  as a live Phase 2 pass because migration 030 was not applied there.
- A permitted real media peer is still required by the plan for provider
  admission/removal proof; Phase 2's mocked/provider-contract tests do not
  replace that gate.
- Phase 3 and later phases were not started. Expo docs were not re-read for
  this phase because no Expo/React Native code was changed.

## Progress

Current execution phase: **Phase 2 — LiveKit backend and termination integrity —
0% completion credit.** Completed: scoped implementation, source/type checks,
focused SDK/provider-contract tests and regression checks. Remaining: every
item's required isolated-target or real-provider verification.

Overall verified calling-plan progress: **22% (10/45 required items)**.

Next phase ready to start: **no** — Phase 2's required voice/security gate is
pending, and later-phase work was intentionally not started.
