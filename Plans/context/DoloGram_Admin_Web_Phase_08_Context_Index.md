# Phase 8 context index — 2026-11-16 (Asia/Manila)

**Complete locally: 7/7 steps (100%). Overall: 68/137 (50%).** All five Phase 8 acceptance criteria are met on disposable services and the source-matched W client. Phase 9 is ready for separately authorized work and was not started. Migration 043 and the three approved Edge prerequisites are now applied/deployed and verified on the linked project; hosted user/device release checks remain pending Phase 18. See the dated hosted note below.

Evidence roots (repository-relative): current `supabase/repomix/admin-phase-08-backend-20261116/` (E), preceding `admin-phase-08-resume-20261115/` and `admin-phase-08-20261115/`. Historical indexes are preserved in their baseline/source trees. Earlier blocked statements describe superseded source, not the current local result.

## Scope, instructions and workflow

- [x] Read overall plan and full Phase 8, prior notes and dependency sources. Root/admin/web/Supabase AGENTS.md apply; no further applicable AGENTS.md/CLAUDE.md or instruction conflict was found. Repository instructions win. No Expo/RN change, so Expo docs are not applicable.
- [x] Git baseline → narrow ripgrep discovery → Reader validation → scoped cached Repomix → bounded XML analysis → original-source verification. Repowise was unnecessary. Reuse unchanged verified entries; invalidate only affected conclusions.
- [x] Preserve existing tracked/untracked contributions, including the earlier Phase 8 implementation. Baselines represent the working copy, not just HEAD. No real credentials or environment files enter context packets. The supplied admin account was not used.
- [x] Record baseline checks before edits; make scoped implementation; verify acceptance; inspect owned changes; update only Phase 8 status/progress in the main plan.
- [x] Owner explicitly authorized the local AB-02 backend repair. Remote migrations, deployment/configuration, real account mutations, commits/pushes and external delivery remain excluded.

Baseline HEAD: `d906bff38ea932c1cab6410b13c6d102e9069067`. E/baseline contains status, HEAD, SHA-256 identities, source snapshots and check logs. Earlier continuation snapshots preserve changes made before this approval. Later-read inputs (admin Auth source/tests, memo handlers, W session, README) were copied before their edits. recoverCreation.test.ts's pre-change snapshot was reconstructed by reversing the single exact assertion change; this provenance is distinct from an untouched original snapshot. Unrelated user work was never reset/reformatted. E/owned-diff.patch and working-copy-manifest.json distinguish this approval's modifications and additions. Main-plan prefix before Phase 8 and suffix beginning Phase 9 were compared with the baseline and remain identical.

## Dependency verification and discrepancies

Verified guards/session/action registry and core Auth perform Host/Origin, live Auth, current profiles.roles and revoked-session checks. Audit writes accept stable event IDs and safe typed details. Phase 7 list/status consumers and actual routes pass browser regression. Migrations 012/018 supply normal profiles and Saved Messages; 041 defaults/protects roles=user; 042 supplies private admin audit. None of these alone supplied AB-02 clearing/global denial. M1.md and initial_passwords are absent; no fallback was invented.

Scoped discovery confirmed 10 client SECURITY DEFINER RPCs needing guards, plus service reminder recipients. Their original source identities and completely inspected line spans are in E/rpc-source-identities.json; migration 043 preserves those bodies plus the gate. Contract diagnostics exposed 036 re-granting the worker claim RPC to clients; 043 restores its service-only grant. No applied migration was edited/renumbered. W session selected premium_flags despite no current migration defining it; removing this nonexistent selection was a necessary Phase 8 verification prerequisite, with no premium feature work.

## Requirement map

| Step | At entry | Final evidence |
|---|---|---|
| 8.1 | done | Crypto generator and transient session-bound one-use drafts preserved; core tests cover boundary mapping, expiry, regeneration, foreign/replay/client-password refusal. |
| 8.2 | done | Existing bounded nonpersistent SDK client and confirmed isolation configuration; actual application and wrappers use it. |
| 8.3 | partial | Live migration contract; actual Auth creation with trusted operation marker/default user; verify profile/Saved Messages; safe uniqueness errors; stable audit; uncertain/partial recovery without duplicate account/password rotation; denial persists through pending init/audit. |
| 8.4 | done | Create/generate/recover actions use existing guards; field/general errors and cache-refresh warning preserve applied result. |
| 8.5 | partial | Actual enabled ADM-04 creates from server draft, preserves transient preview, lists Must change password, supports Copy/Regenerate and freezes after uncertainty; real field errors and recovery states tested. CSV remains a navigation link. |
| 8.6 | partial | Actual npm create-user and PowerShell create-accounts succeeded in a real PTY; script-source audit/default user/Saved Messages and plaintext exclusions verified in memory. Redirection refused. Recovery accepts only operation identity and never redisplays passwords. |
| 8.7 | partial | Every one of 26 browser/API cases has final relevant passing evidence, including actual W sign-in/change/main transition, API denial/clearing, stale JWT, role guard, signup, RPC/Storage/Realtime authorization, init/audit recovery and Edge handlers. See exact run accounting below. |

## Backend contract and security decisions

043 adds private.account_access_allowed(uuid): live Auth deletion/ban/strict boolean flag check, plus profile/Saved Messages/successful operation audit for marked admin creations. Restrictive ALL authenticated policies veto existing permissive policies across non-extension public tables, storage.objects and realtime.messages. Existing ownership conditions remain. Ten client RPCs call/check the same gate; the legacy metadata seed helper is revoked; reminder recipients exclude denied accounts. A real changed encrypted Auth password clears the initial flag; the profile mirror follows it. GoTrue rejects reusing the initial password. Self-service normal signup remains permitted; user metadata cannot forge the trusted flag or promote roles.

public.account_access_allowed(uuid) is executable only by service_role. Shared authenticate obtains fresh verified Auth user metadata, rejects forced/malformed flags, then calls the bounded service RPC before returning a privileged client. Calls and both memo entry points share this authentication. Memo handlers expose 403 MEMO_NOT_ALLOWED and retryable 503 availability errors. Admin portal Auth also refuses currently forced accounts. No privileged client guard was weakened.

getCreationCapability reads the actual private.admin_creation_contract_version() on each call. Missing/error/version mismatch or incomplete RLS/policies/triggers/RPC coverage keeps creation/recovery disabled. No environment override or cached successful capability. getAccountCapability/getPasswordFlagMode remain closed for later reset/ban work.

Operation markers contain ID, actor, session hash, source and username, never passwords. Recovery verifies ownership, skips initialized profiles, and uses unchanged user metadata to invoke the existing initialization trigger only for an existing denied, non-admin, non-banned identity. It also works after password clearing while initialization/audit still denies access. Stable audit IDs make lost acknowledgements idempotent. Recovery returns no password; original previews/protected terminal delivery are transient. No polling/retry loop or growing password store was added.

## Reader and Repomix identity ledger

Pinned cached Repomix **1.18.1**, run from repository root with repomix.config.json, security checks/exclusions retained. All packets/logs under supabase/repomix. Selectors, actual entry lists, source/packet SHA-256 and reuse decisions are in E/*.txt, packet-identities.json and supplement-identities.json. All intended current selectors were included; no unexplained omission. The runner's disposable credential literals were excluded from earlier packets by security scanning and inspected directly; no security bypass was used.

| Packet | Actual contents and complete analysis |
|---|---|
| Earlier original/resume packets | Full reads and continuation ranges retained in historical indexes/manifests. Reused only for unchanged entries/dependencies. |
| E/context.xml | 7 entries, 5,903 estimated tokens, 24,498 chars. Read 0–11999, 12000–23999, 24000–24497. Root/Supabase instructions, modes, shared calling and storage/profile/search contracts. |
| E/contract.xml | 3 entries, 6,767 estimated tokens, 29,440 chars. Read 0–11999, 12000–23999, 24000–29439. Historical first 043/modes/accountAccess; changed bodies superseded below. |
| E/final.xml | 10 entries, 21,266 estimated tokens, 88,619 chars, clean scan. Entry bodies matched original source. Unchanged previously read content reused by exact comparison; changed SQL/modes/core/Auth/calling/memo hunks plus complete new denial/Edge harness entries extracted to final-analysis.txt (23,091 chars), read 0–11999 and 12000–23090. Identity ledger records full-entry vs verified diff analysis. |
| E/supplement.xml | 3 entries, 7,378 estimated tokens, 32,626 chars, clean scan. Source-matched full backend-schema/recovery helper plus current W session. Complete helper entries and changed W hunks extracted to supplement-analysis.txt (14,009 chars), read 0–11999 and 12000–14008; unchanged W source previously inspected. |

Packet sizes are estimates, not model-usage measurements; no savings claim. No compression used. Original-source comparison resolved all new/changed bodies; no required continuation remains. Full RPC source definitions, SQL gates/triggers/grants/probe, UI/action/recovery/script branches, harness host adapters/privacy and W profile selection were reviewed. E/web-copy-identities.json verifies all 127 W source files in the isolated copy equal current originals. Existing original W dev lock/server was preserved.

## Versioned documentation consulted

Next **16.4.6** bundled server-actions and revalidatePath docs; React **19.2.3** installed types/patterns. Supabase JS/Auth **2.119.0** installed GoTrueAdminApi.ts/AdminUserAttributes and [official createUser reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser); installed PostgrestTransformBuilder.ts abortSignal signature. Node **24.13.1** crypto, PostgreSQL **17** [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [function](https://www.postgresql.org/docs/17/sql-createfunction.html) and [trigger](https://www.postgresql.org/docs/17/sql-createtrigger.html) semantics and pg_isready, exact cached postgres **17.6** entrypoint, GoTrue **2.197.0** configuration source. postgres **4.1.1** array-removal implementation/types. TypeScript **6.0.3** --ignoreConfig help. Existing esbuild **0.25.12** build/onResolve type declarations and pinned SDK import; its Go-regex parser rejected /u, corrected only in the Node host adapter. Playwright **1.65.1** source confirmed hostname-only proxy bypass and PLAYWRIGHT_NO_COPY_PROMPT, plus installed Next dev host/config APIs. Vitest **5.1.0**, tsx **4.23.15**, Zod **4.6.7** existing conventions reused. No new dependency.

## Checks and diagnostic accounting

| Check | Actual result / evidence under E |
|---|---|
| Approved-repair baseline | core94/94, focused admin17/17, core tsc and W session35/35 PASS; verified unchanged full admin138/lint/build/CSS baselines reused from preceding continuation. |
| Final core | **97/97 PASS**, core-verified.log; typecheck PASS, core-types-verified.log. |
| Full admin units | **138/138 PASS**, admin-tests-final.log. Prior unchanged theme-lint load timeout preserved historically; no timeout/assertion relaxation. |
| W affected tests | **49/49 PASS**, web-tests.log; session/AuthForm suites. W typecheck PASS, web-typecheck.log. |
| Adapted Edge strict TypeScript | **PASS**, edge-types-verified.log; ambient Deno env/serve and pinned npm import types bridged to the installed SDK. Initial invocation omitted Node types required by existing assetIntegrity.ts; explicit installed --types node resolved TS2591. No Deno runtime typecheck claimed. |
| Shared flag test | **1/1 PASS**, edge-test.log; fresh boolean/malformed flag denial. |
| Final types/lint | admin-types-final.log, admin-lint-contract.log, web-lint-final.log PASS; unchanged CSS passing baseline reused. An incorrect workspace cwd invocation was corrected from repository root; not a source failure. |
| Final production build | **PASS**, build-verified.log after last production source edit. Earlier sandbox prerender mkdir EPERM resolved by host build; no source workaround. |
| Full browser before final audit hardening | **26/26 PASS**, browser-verified.log. Superseded for changed contract cases below. |
| Final broad browser/API | **25/26 PASS**, browser-contract-final.log; the one failure was the newly added Node/esbuild host adapter rejecting /u before any handler request. W real source/HTTP sign-in → change-password → main PASS with zero console errors/warnings. |
| Corrected affected Edge case | **1/1 PASS**, edge-contract-verified.log. Actual memo-sync and memo-pin-reset handlers execute against real Auth/REST with only Deno env/serve/npm imports adapted to Node. Forced/stale/audit-pending denial and completed account access pass. |
| Strengthened affected recovery case | **1/1 PASS**, recovery-contract-verified.log. Lost Auth response, session binding, initialization after password already changed, unchanged hash, script audit lost acknowledgement/idempotence all pass. |
| Actual terminal wrappers | **Both PASS** in observed real PTY session64606, exit0. terminal-verification.json: no isTTY mutation; generated passwords intercepted in memory before console capture; verified matching Auth hash, normal user, Saved Messages, one script audit, no plaintext in audit/actual isolated BACKUP_DIR. Normal production wrapper path unchanged by final denial hardening. |
| Cleanup/privacy | cleanup.json: no owned containers/network/listeners; owner3100 untouched, original W dev lock present. artifact-privacy.json: no retained failure DOM contexts/password previews; traces/screenshots/video and copy prompt disabled. |

All 26 browser/API cases have passing evidence on their final relevant source, with affected recovery/Edge cases run after changes. This is not a claim of a new single 26/26 run after the final helper edit. No unchanged failing command/fix was repeated. All earlier diagnostic logs retained: temp PostgreSQL socket readiness, fixture GoTrue default role, nonexistent W column, proxy bypass hostname, session reuse avoiding the intended sign-in limit, and test-only esbuild regex. Each cause was identified before a changed follow-up. No production limiter or guard was disabled. W realtime is a private test socket stub outside the Auth flow; genuine Storage HTTP and Realtime network release behavior were not tested.

## Acceptance gates

| Criterion | Status | Direct evidence |
|---|---|---|
| Server draft creates and appears Must change password; invalid drafts refused | **met** | Actual ADM-04→ADM-03 browser; core/action/UI tests cover foreign, expired, replay, arbitrary password and role input. |
| W sign-in forces Change password; API rows denied until actual password change | **met locally** | Real W source browser + disposable live Auth/REST; stale JWT/forgery/same-password refusal and post-change profile read verified. |
| Generated password absent from private audit/BACKUP_DIR | **met locally** | Actual wrappers' memory-only matching/scans of real isolated audit and backup tree; browser/core audit checks. No plaintext stored in test output. |
| Short username and duplicate email return field errors | **met** | Actual form/direct action plus core tests. |
| Actual create-user provisions and audits source=script | **met locally** | Real PTY entry point and direct SQL verification; PowerShell compatibility entry also verified. |

## Remaining release work and limits

No local Phase 8 implementation blocker. The separately authorized hosted rollout is now complete for migration 043 and existing call-action/call-token/memo-sync guard updates; see the dated note and hosted verification ledger below. All three deployed sources were compared with reviewed staging; the unrelated hosted call-token body was preserved. The configured admin direct SQL authentication still returns 28P01 and needs owner correction; no credential was reset. Remaining hosted user/device/Storage/Realtime release checks require their own authorized test run.

Pending manual release verification: real hosted Storage downloads/uploads and Realtime join/message flows before/after forced change, source-approved native clients/platform matrix and Phase18 H/W release checks. No real Deno runtime/deployment, public bucket byte delivery or native client result is claimed. User-web release shares belong to its owning plan. Later admin detail/reset/ban/premium/CSV/maintenance work remains out of scope. No next phase was implemented.

## Authorized hosted rollout

**Hosted application — 2026-11-16 (Asia/Manila), explicitly authorized**

Owner requested applying 043 and separately approved the three prerequisite Edge deployments. Linked project `jsyqtfsidtfahytcwutp` had exactly 001–042 applied; all 11 target RPC bodies matched their verified original sources. Direct configured SQL authentication returned 28P01, so the existing Management API token was used without changing credentials or connection security. A rollback-only dry run rejected redundant ALTER TABLE on already-RLS-enabled managed Storage. Since 043 was not yet applied to the hosted target, its RLS loop was corrected to skip that redundant command while preserving policy creation and the fail-closed contract. The second hosted rollback-only dry run passed, including the contract and sequential history insert.

Downloaded hosted sources were preserved in isolated staging. The existing call-token differs from the working copy beyond Phase 8; its hosted body was retained unchanged. Only the shared access guard/new helper and memo denial mapping were deployed to call-action, call-token and memo-sync. All three are ACTIVE version 2 with original JWT verification settings (true/true/false). Independent per-function downloads matched every reviewed staged source file. No undeployed memo-pin-reset or other function was deployed, and no unrelated call-token change was published.

Migration 043 and its version/name/exact SQL statement history entry were committed atomically after the live contract returned 43. Hosted post-verification: latest history version 043; exact SQL SHA-256 `d202b2fed847fcfc8fb9b78dc094e089dfc197bcc1ac842a7b6cf35ef8d67369`; contract 43; 27 restrictive policies; access-check RPC denied to anon/authenticated and granted to service_role; harmless missing-identity API check returned false. No existing account/data was modified for testing. The first local follow-up stopped before tests because the current user-web source now imports an assets/logo file absent from the isolated copy; the harness now also copies existing assets, leaving user source unchanged. Affected denial/clearing/Edge/signup/Storage/Realtime contract checks then passed 2/2 on the revised SQL. Prior build/unit evidence remains applicable because no production TypeScript changed during this rollout.

Evidence: `supabase/repomix/admin-phase-08-hosted-043-20261116/` (baseline, migration/Reader identity, compatibility/deployment diffs, history/schema comparisons, dry-run diagnostics, deployment/source verification, hosted checks, local tests and cleanup). Pinned Repomix 1.18.1 packet: one entry, 6,417 estimated tokens / 27,795 chars, clean scan; old unchanged SQL reused by source identity, changed loop read completely from XML and checked against original. Earlier Phase 8 packet hashes now describe historical pre-compatibility SQL. 043 is now applied and must not be edited/renumbered. Phase 8 remains 7/7 (100%); overall 68/137 (50%); no later phase started. Hosted user/device/Storage-byte/Realtime-socket release flows remain pending Phase 18. The configured admin direct SQL password still needs owner correction (28P01); this was not changed by applying the migration.

