# DoloGram Admin Web Implementation Plan

## Authoritative access-model revision — 2026-11-15

**User decision:** admin access comes from an existing DoloGram account whose application role is changed in the database from `user` to `admin`. There is no separate admin passcode and no environment-configured owner user ID. This instruction supersedes v14 D-104's passcode model, AC-2's old resolution, proposed D-164's passcode portion, D-165's anonymous passcode sessions, D-167, AG-1/AG-4, and every retained passcode/owner-ID instruction or historical acceptance claim below. Historical execution records remain evidence of the retired implementation only; they do not prove the new model works.

An application admin retains all existing normal-user capabilities: mobile/user-web sign-in, chats, Saved Messages, memos and other account features continue under the same UUID and credentials. Admin-web access is an additional authorization checked from `public.profiles.roles`; no second identity is created.

The admin signs in using the existing account's username or email plus password. Username lookup resolves privately on the server from `public.profiles.username` joined to `auth.users.email`; Supabase Auth verifies the account password for either path. The server obtains the authenticated UUID and checks the current database application role before every privileged page, API read, action and job-control entry point. Normal users cannot grant themselves admin access. Changing a role back to `user` denies subsequent privileged requests, including requests from an existing session. Keep loopback Host/Origin enforcement, HttpOnly/SameSite cookies, idle expiry and local sign-out. Login and privileged operations fail closed when identity/role cannot be verified; offline passcode Unlock is cancelled. Local sign-out must still clear/revoke local state during a backend outage.

**Profile role contract, confirmed by the user:** use `public.profiles.roles` (plural), a single non-null text value constrained to `user` or `admin`, default `user`. An admin is the same normal DoloGram account with additional admin-web permission, not a second account or a replacement identity. Promotion/demotion changes only this column on the existing profile, preserving Auth UUID, credentials, profile fields, chat/memo memberships, messages and normal mobile/user-web access. The earlier `private.account_roles` proposal is cancelled. Migration `041_add_profile_roles.sql` adds the column/check and an invoker trigger blocking untrusted SQL roles from changing it; existing profile RLS and normal-user permissions remain in place. Application admins still use SQL role `authenticated` for normal app requests and cannot edit roles through profile updates. Trusted database operators (postgres/supabase_admin/service_role) may promote or demote; user metadata, JWT claims and ordinary client requests are not authority. Do not alter `auth.users.role` or chat/memo membership roles. Local and linked migration history 001–040 matched before execution. After the user explicitly approved applying only 041, migration 041 was applied and verified on the linked Supabase project. Hosted roles is text, NOT NULL, default user, with the two-value check and enabled invoker protection trigger. Existing RLS/policies and normal profile-update permissions are unchanged. All seven existing profiles remain user; no account was promoted. The hosted Auth projection fingerprint matches the source tested against metadata self-promotion and admin-role preservation. The earlier automatic-review rejection is resolved by the explicit scoped approval.

`ADMIN_PASSCODE_HASH` and `ADMIN_OWNER_USER_ID` are removed from `apps/admin/.env.local` and its example. Retain backend connection settings. The original revision reopened Phase 4 to replace the passcode code, environment parsers, helper command and fixtures. That replacement is now implemented; the Phase 4 execution record below retains its isolated acceptance evidence. A previously running process retains its loaded environment/session state until restarted; no unrelated process is stopped by this document/configuration change.

Cross-phase contract: replace the Owner pill with a database-derived Admin pill; refuse Ban/Delete for any currently-admin target, including the acting administrator, unless it is first demoted through trusted database access. Never substitute an invented owner UUID. Audit writes must identify the authenticated actor UUID; later audit/schema work must include that actor identity. Settings/Overview must not request the removed variables. Phase 17/18 authentication/security gates must cover ordinary-user denial, self-promotion denial and immediate role-demotion enforcement. Do not add role-management UI or start these later phases in this revision.

**Current status — connection/sign-in follow-up, 2026-11-15 (Asia/Manila):** existing-account admin authentication is implemented, and the running loopback sign-in page accepts username or email. The six-setting admin environment passes format validation and the configured Supabase Auth admin API key works. Hosted sign-in remains operationally blocked: after fixing database certificate trust, the configured database connection returns PostgreSQL `28P01` (credentials rejected). No successful hosted account login or role verification is claimed. The latest numbered-phase progress remains **Phase 8: 3/7 steps (43%); overall 64/137 steps (47%)**, with its existing AB-02 and provisioning gates unchanged. This maintenance follow-up adds no completed phase weight; Phase 9 is not ready and was not started.

Official design references: [Supabase application RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) and [RLS/authentication caveats](https://supabase.com/docs/guides/database/postgres/row-level-security). These inform the proposed contract; future execution must verify APIs against the pinned supabase-js version and current target schema.

### Connection and username/email sign-in follow-up — 2026-11-15

This chat's maintenance changes supersede email-only login instructions below. Historical phase/build/browser results retain their original scope; they do not establish hosted connectivity or production acceptance for these edits.

- **Environment:** the initial three-variable simplification of both web/admin local files was incompatible with the admin backend. The admin local file was subsequently configured with its six required server-only settings and `getAdminConfigStatus` returned `ready: true`, with no missing or invalid names. Keep those six settings; the user-web three-variable convention does not replace the admin configuration. No credential values belong in this plan or evidence output.
- **Username or email:** `packages/admin-core/src/auth/account.ts` and the sign-in action/form now accept a bounded `identifier`. Trim/lowercase the identifier, preserve the exact password, and validate an email or the existing username pattern (`^[a-z][a-z0-9_]{4,31}$`). Username resolution uses parameterized server-side SQL, then Auth verifies the password. Unknown username and incorrect password share a fixed credential error. Both paths retain the current protected `profiles.roles = admin` and live Auth-session checks; no role selector, self-promotion or separate identity is added. Related action/component/E2E selectors were updated.
- **Verified database TLS:** `packages/admin-core/src/databaseTls.ts` bundles the public Supabase Root 2021 CA obtained over HTTPS from Supabase's certificate download host. Both the account-auth SQL client and shared database client use it with `rejectUnauthorized: true`; hostname verification remains enabled. Confirmed isolated loopback fixtures retain their existing non-TLS setting. This resolves the observed `SELF_SIGNED_CERT_IN_CHAIN` failure without disabling verification. Certificate renewal/rotation must update the bundled CA before it expires in April 2031. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
- **Live evidence and remaining blocker:** host-network checks confirmed resolving endpoints, Auth health HTTP 200 and a successful Auth admin API request. With the CA fix, the database advances past certificate verification but rejects the configured credentials with `28P01`. A check found brackets in the password but no safely correctable template wrapper, so no speculative database URL correction was saved. Copy the exact URI from the intended project's Connect panel; replace the whole password placeholder with the URL-encoded project database password. Restart the admin process, then repeat verified-TLS SQL, authorization-schema and real-account login checks. Supabase account login password, project database password, API key and personal access token serve different purposes.
- **Validation:** core suite **88/88 PASS**; focused admin sign-in component/action suites **7/7 PASS**; admin and core TypeScript checks PASS; scoped sign-in ESLint PASS. New core cases cover normalized usernames, email authentication, private username resolution, indistinguishable unknown-user/wrong-password errors and ordinary-role denial with new-session revocation. The running `http://127.0.0.1:3100/sign-in` returned HTTP 200 and the new “Username or email” field. No new full production build or E2E run was performed for this follow-up, and no hosted schema/data/account changes, promotion, commit, push or deployment occurred.

Source document: DoloGram_Documentation_v14.docx (cited as "v14"). Scope: the admin web only (`apps/admin` and its server package `packages/admin-core`), Section 6.6, Section 11.4 (ADM-01 to ADM-08), Section 12.9 (CMP-24 to CMP-31) and task M4-08. Implementation includes local admin/core, audit migration and provisioning/maintenance integration. Mobile/user-web implementation and prerequisite backend repairs belong to their owning plans. Section 0 records current integration constraints.

## 0. Current working-copy baseline and execution contract

Refined on 2026-11-14, Asia/Manila. Implementation and runtime acceptance remain pending. This pass inspects sources and evidence and updates the plan and supporting context only.

The source and context record is `Plans/context/DoloGram_Admin_Web_Context_Index.md`. Context artifacts are under `supabase/repomix/admin-plan-polish-20261114/`. Section 0 records current findings and governs execution prerequisites throughout this plan.


### 0.1 Verified working-copy findings

| ID | Evidence inspected on 2026-11-14 | Execution consequence |
|---|---|---|
| AV-01 | HEAD was d906bff38ea932c1cab6410b13c6d102e9069067. Extensive tracked changes and untracked inputs exist. The admin plan had no pre-existing diff. | Preserve user work. A commit hash alone does not identify this baseline. Context manifests identify working-copy sources. |
| AV-02 | apps/admin, apps/web and packages/admin-core are absent. Root workspaces already cover apps/* and packages/*. Admin/tokens scripts are absent. | Admin paths/commands below are proposed until their creating steps pass. User-web shares remain release dependencies. |
| AV-03 | Shared package is @dologram/shared. Account validators and dgTrim exist. Mobile pins Expo ~57.0.32, RN 0.86.3 and React 19.2.3. Root overrides pin React/React DOM 19.2.3. Shared uses TypeScript 6.0.3 and supabase-js 2.119.0. | Reuse validators and choose compatible admin dependencies. Existing mobile dependency changes require a concrete compatibility need and impact review. |
| AV-04 | Shared TS tokens/icons/contrast tests exist. tokens.css and generator/command are absent. Current semantic names include color.error, color.text.inverse and color.separator. Several v14 admin tokens/icons are missing. | Phase 1 owns the minimal CSS projection and checked mappings/aliases, preserving current mobile values and validating contrast/consumers. |
| AV-05 | Local migrations run through 040_add_global_people_search.sql. The 2026-11-14 memo report records hosted 001–040 matching then. config.toml contains function JWT settings, without local stack/Auth/ports setup. | Recheck target history during execution. Use next available sequential migration. Configuration does not establish local isolation or hosted Auth settings. |
| AV-06 | Migration 018 creates profiles/Saved Messages, initializes profiles.must_change_password false and updates profile identity from Auth metadata. Mobile guards read app_metadata.must_change_password and expect server clearing after password change. No local migration defines initial_passwords, disabled_users, the D-78 clearing trigger or admin_audit. | Original automatic fallback/table joins would fail. AB-02 gates real create/reset/ban acceptance. UI guards do not establish denied API access. |
| AV-07 | Migration 016 takes message sequences on content/deletion updates, without clearing content. Reaction sequence trigger runs on INSERT. Ownership handoff on group-member deletion and premium_flags were not found in inspected migrations/types. | AB-02/03 gate deletion. Phase 19 stays conditional on verified premium schema/RLS. |
| AV-08 | Mobile has signup/reset-password flows. Android plan D-163 enables self-service signup and temporarily disables email confirmation. D-181 covers redirects. | Settings must use current recorded policy, with target values independently verified. Preserve self-service signup. |
| AV-09 | Publication additions include chat_members (026), calls/call_participants (029), memo_changes (036). Attachment tombstones exist in 024. avatars exists since 019. Memo assets have independent privacy/retention rules. | Derive publication checks from supported applied migrations. Include attachment tombstones in chat purge and discover buckets for copy. Avoid applying chat-orphan rules to memo assets. |
| AV-10 | Actual provisioning callers are scripts/create-accounts.ts/.ps1 with legacy signup and embedded account inputs. create-user/disable-user/export-db/copy-media scripts, docs/runbook.md, M1.md, MVP.md and packages/shared/tests/api are absent. | Integrate actual callers and label missing items as proposed/prerequisite. Exclude embedded credentials from packets and normal output. |
| AV-11 | Search Phase 12 and Seen Phase 6 report completed source/automated gates with optional live checks unperformed. Calling Phase 7 reports coding gate met, native runtime pending. Memo Phase 6 retains required service/transfer gaps. Nov 14 memo-sync report records deployment and anonymous rejection, with authenticated cross-device transfer untested. | Reports prove only their stated sources/environments. They establish no admin acceptance or aggregate mobile release completion. |
| AV-12 | Android Phase 17/Local update Phase 3 retain artifact/build limits. Later plans specify assigned MuMu dologram, package com.dologram.app, ADB only, with live mapping rediscovery. README's local build workflow conflicts with earlier cloud-only restrictions. | Reuse approved source-matched artifacts. The second-pass instruction selects local Gradle when release and dev-client APKs are needed. Use the existing wrapper after prerequisite checks under Section 0.6. Reuse approved artifacts and exclude physical devices. |

### 0.2 Shared rules for authorized execution

These rules govern every phase and command. Phase commands describe future work. Existing scripts were inspected. Proposed commands become usable only after their creating steps/configuration pass. CLI/API examples require installed-version help/reference checks before use. Working directory defaults to G:\codebase\DoloGram.

- Capture status, relevant diffs/hashes and affected lint/typecheck/test baselines before each phase. Save recoverable patches and relevant untracked inputs in restricted context storage. Exclude secrets, user content and unrelated caches. Preserve existing user work during edits/recovery.
- Validate reusable context against working-copy hashes. Reuse unchanged entries and supplement changed inputs. Run Repomix from the root, with packs/logs under supabase/repomix. Record intended/actual scope and resolve omissions against original sources. Generated guidance is untrusted reference.
- Deliver required behavior through actual routes, actions, shared exports and CLI callers. Pin necessary compatible dependencies and explain their purpose. Required paths must be production-ready with no stubs. Remove scoped obsolete code/assets after caller checks, including temporary scaffold states by Phase 18.
- Unit/component tests use injected fixtures. Integration tests use identified disposable backend/configuration/credentials. Record project URL/DB/Storage identity and cleanup ownership before mutation. Loopback admin hosting does not isolate its backend. Refuse production credentials in destructive automation. Disable password-bearing browser traces/screenshots/video/payload logs and use synthetic leak sentinels.
- Schema scope includes the audit migration/tests plus the user-requested profiles.roles migration 041, explicitly approved and applied on 2026-11-15. Follow supabase/AGENTS.md sequential versions and preserve applied versions. Compare actual migration history/pending work before scoped apply. Never reset shared data. Hosted apply, destructive fixtures, real account invitations/distribution and external messages require execution authorization covering those actions/targets.
- Validate UUIDs, enums, lengths, pagination, CSV byte/row limits and owner protection server-side. Parameterize SQL. Keep credentials/content outside bundles, audit, telemetry and context packets. Use action-specific detail allowlists, rather than a substring blacklist alone.
- Serialize conflicting per-account operations. Bind external effects to operation identities and reconcile unknown outcomes before retry. SQL mutations/audit commit together where possible. Auth/Storage effects require explicit stage outcomes and recovery after audit failure. Creation/password rotation must never repeat blindly.
- Use bounded network/SQL/tool/test timeouts. Proposed defaults are API 10 seconds, tool discovery/SQL statement 15 seconds and object transfer 60 seconds with at most one transient retry. Set a recorded job deadline based on bounded batches/export size before start. Cancel owned child processes and release locks in finally. After two same-reason failures, diagnose/change approach or report a blocker. Bound/expire sessions, progress buffers and operation state. Polling backs off and stops on unmount/lock/expiry/terminal/deadline. Stop task-created services when finished.
- Verify success, invalid input, denial, offline/timeout, duplicates, concurrency and recovery for affected behavior. Record passed/failed/blocked/not run with evidence. Preserve pre-existing failures. Never weaken assertions. Retain diagnostics and rerun affected checks after relevant changes. Broaden checks for shared contracts/dependencies or a concrete regression reason.
- Account sign-in and privileged access require verified Auth identity/current database admin role and fail closed during backend outages. Local Sign out must still revoke its own local session/cookie during an outage. Every privileged server entry point validates identity and role directly; layout/Proxy checks supplement this. Background polling never extends idle expiry. No passcode or env owner-ID fallback.

### 0.3 Requirements and observable acceptance

ADM-R identifiers are stable requirements for this plan. ADM/CMP/D/T references retain their source meanings. Appendix A's historical D-164–D-180 proposals are plan-local because later mobile decisions overlap those numbers. AT identifiers stay plan-local, with no automatic allocation to global T numbers.

| Requirement | Observable acceptance | Work | Verification |
|---|---|---|---|
| ADM-R01 | Loopback-only admin entry point, compatible workspaces and no secrets in client assets/responses. | Phases 0, 17 | AT-01/02/16, T-42, negative client-import build |
| ADM-R02 | Existing-account Auth plus current protected database role controls every privileged entry. Ordinary users/self-promotion/demoted admins are denied; Host/Origin, idle expiry and Sign out work. | Revised Phases 4–5, 17 | Revised T-44/AT-04, database grants/RLS and direct page/API/action/RSC tests |
| ADM-R03 | Nine routes including account Sign in meet system theme/navigation/keyboard/contrast/target/loading/error rules. | Phases 1–5, 16 | AT-03/12/13/14/15, navigation/keyboard E2E, 200% zoom, both schemes |
| ADM-R04 | Search/filter/counts agree, 50-row pagination is stable, owner identity is reliable, missing optional schema produces no query error. | Phases 7, 13 | AT-06, absent optional fields/relations, ties/stale-page fixtures |
| ADM-R05 | Single/CSV creation validates inputs, creates Saved Messages, shows generated passwords once and denies API access until change. Invalid rows stay uncreated. | Phases 8–9 | T-45/46, AT-07/08, uniqueness/429/interrupted-import/leak tests |
| ADM-R06 | Reset rejects old credentials and forces change. Ban denies live-session reads/new joins, unban restores allowed access, owner ban is refused server-side. | Phase 10 | T-47, Auth/RLS/Realtime plus partial-reset/metadata tests |
| ADM-R07 | Requested exact-username deletion rejects owner, erases identity/content, removes active reactions, leaves groups with handoff and permanently denies access. Retry completes cleanup. | Phase 11 | T-53, interrupted deletion/rename/concurrency tests, mobile/API convergence |
| ADM-R08 | Safe audit outcomes exist per action, filters retain deleted targets, external effect/audit outages report recoverable applied state. | Phase 6 and mutating phases | AT-05, RLS/grants, atomicity/outage/redaction tests |
| ADM-R09 | Settings use current signup/publication contracts. Unknown values show Check by hand. Overview shows source/time and exact thresholds. | Phases 12–13 | AT-09/10, T-48 display, invalid-token/timeout/partial-panel fixtures |
| ADM-R10 | Restorable export includes required audit/schema/data coverage. Copy handles discovered buckets safely. Jobs serialize and expose bounded recoverable progress. | Phase 14 | AT-11, T-48, path/changed-object/disk-full/restart/timeout tests |
| ADM-R11 | Unique purge preview includes attachment tombstones, excludes live/unrelated memo files and refuses stale/changed objects. Counts reconcile and restore drill uses a real runbook. | Phase 15 | T-48, isolated restore, reference/expiry/race/partial-batch fixtures |
| ADM-R12 | Actual provisioning/maintenance callers delegate to core, scoped obsolete paths are removed and source-matched release shares are documented. | Phases 8, 10, 14, 17–18 | AT-17, caller/discovery review, scoped regression and T-42–48/53 |
| ADM-R13 | After verified M5-08/schema/RLS, each premium switch changes one allowed flag, preserves others and audits success. | Phase 19 only | AT-18, T-31, denied self-edit/concurrent independent flags |

### 0.4 Execution prerequisites and unresolved decisions

| ID | Evidence and affected requirements | Resolution and independent work |
|---|---|---|
| AB-01 | Admin/user-web/core and M1/MVP records are absent. User-web release shares cannot run. ADM-R05/06/07/12. | Build admin only during authorized execution. Obtain owning workstream/backend/web evidence before shared release gates. Isolated UI/core fixtures can proceed. |
| AB-02 | No verified D-78 clearing/denial or disabled-users fallback. Calling eligibility checks cover calling only. ADM-R04/05/06/07. | Backend owner supplies verified forced-password/ban contracts across normal API, Storage, Realtime, calls and memo entry points. Admin consumes that contract and disables unsupported mutations. Backend repairs need their own scope. Read-only/scaffold/fixture work continues. |
| AB-03 | No verified content-clear/reaction-UPDATE-sync/group-handoff chain. Auth profile sync can overwrite deletion alias. ADM-R07/08. | Verify final trigger chain and ordered recoverable SQL/Auth/Storage stages including profiles.email erasure/final alias. Block real Delete until isolated invariants pass. Other screens continue. |
| AB-04 | Missing token CSS/generator and admin semantic names. ADM-R03. | Phase 1 owns minimal projection/mapping, missing aliases and freshness/contrast/mobile-consumer checks. M4-02 is not assumed complete. |
| AB-05 | Missing M4-05 scripts/runbook/restore evidence. Memo-assets has separate privacy/retention. ADM-R10/11. | Establish runbook/restore contract before Phase 14. Proposed copy scope is every discovered bucket as opaque bytes in protected owner storage. Confirm memo backup privacy/retention with its owning plan. Chat purge stays limited to two buckets. |
| AB-06 | Management usage/plan/restore coverage, actual Auth settings, isolated backend, owner UUID and installed CLI flags remain unverified. ADM-R01/02/04/09/10. | Read-only target/version discovery during execution, documented unavailable/manual fallback and owner-sensitive mutation refusal on invalid config. No hardcoded production target in tests. |
| AB-07 | D-110 forbids hard DELETE on published tables while explicitly removing group members. chat_members is now published. New memo/call data exceed the original erasure inventory. ADM-R07. | Treat group removal as the narrow explicit D-110 exception and verify member-snapshot reconciliation. Obtain the account-erasure disposition for newer memo/call data before complete modern erasure is claimed. Preserve those systems pending the contract. No admin content UI is added. |

These gates permit completing the polishing pass. Proposed owner UUID config, minimum passcode length, overdue thresholds and Last sign-in interpretation retain proposed status. The specific ADM-03/05 requirement supports showing Last sign-in only. Resolve material backup/privacy/erasure policy before the affected irreversible action.

### 0.5 Phase inputs, baselines and execution progress

Every phase inherits Section 0.2. Goal/Depends on/Implements define its scope and prerequisites. Steps/Deliverables identify affected proposed components. Acceptance criteria/Exit gate define its verifiable outcome. Context inputs are Section 0.1, the compact index, cited v14 sections, previous-phase evidence and current original sources for named components. Before edits record baseline statuses for relevant lint/typecheck/tests, then only invalidate results whose sources/environment changed.

Use numbered steps as equal-weight work items. Count a step only when its work and associated verification finish. Assign every acceptance/exit gate to its corresponding step before execution, so an unmet gate leaves required weight open. Record legitimate scope/weight changes and their effect. Compute completed weight divided by required weight times 100, rounded to a whole percentage. Current-phase and overall-project progress are separate. After each authorized execution session use the required format and state whether the next phase is ready.

> Current execution phase: [name] — [X]% complete. Completed: [verified work]. Remaining: [required work]. Blockers: [none or specific blocker].

Never report 100% while required work or an acceptance/exit gate is failed, blocked or unrun. Map evidence to stable step IDs and preserve the denominator. If rounding yields 100 with required work open, report 99% and name the open gate. Optional observations remain unverified and cannot satisfy required behavior. This polishing pass reports no implementation percentage.

### 0.6 Second-pass audit and execution readiness

The second pass reused the prior 45 source identities after a read-only hash comparison found no changes. No context packet was regenerated. Original reads were limited to the existing local build wrapper and release signing init script to resolve the new Gradle preference. Document checks are planning evidence. Operational verification remains pending.

**Ready for execution** means Phase 0 can start after a separate implementation instruction. No unresolved material decision prevents scaffold/configuration work. Phase 0 owns tool/version compatibility discovery as its first work item. An unavailable compatible tool blocks that item and must be reported. This classification supplies no implementation authorization, waives no later gate and establishes no production readiness.

Later gates remain explicit. AB-02 requires tested backend forced-password/ban contracts before real account actions. AB-03/07 require deletion sync/recovery and memo/call disposition before Delete. AB-01 requires user-web release shares. AB-04 is Phase 1 CSS integration. AB-05 requires the runbook/backup/memo scope before Phase 14. AB-06 requires isolated target, owner identity and API/CLI discovery before dependent integration. For an unavailable resource record the blocked requirement, exact next action and independent work. Unrun or blocked evidence cannot pass a gate.

Reuse approved compatible mobile APKs. When release and dev-client APKs are needed, use the local Gradle workflow during authorized execution. The inspected wrapper accepts Debug/Release, refreshes Expo configuration without a clean prebuild and invokes assemble with two workers. From the repository root the candidate commands are ./scripts/build-android-local.ps1 -Variant Debug and ./scripts/build-android-local.ps1 -Variant Release. Before invoking them, snapshot relevant native/configuration inputs, record signing identities while preserving credential material in its protected location, and confirm dependencies, JDK, Android SDK, disk and intended ABI. Release requires existing apps/mobile/credentials.json and its keystore. Inspect identities without revealing values. Missing tools/signing material block the artifact, while independent admin work continues. Do not create a replacement signer or substitute an EAS upload. Preserve package/versionCode/ABI/signer continuity and record source manifest/APK hashes. Install only on rediscovered assigned MuMu dologram through ADB. Preserve build quotas, artifact reuse, local data and process cleanup safeguards. No build is run in this audit.

## 1. Purpose and how to use this plan

Purpose: give a developer, or a coding agent in a fresh session, an ordered set of phases that build the owner's local admin web exactly as v14 defines it (F12, D-102 to D-110, D-137), using accepted scope and current Section 0 evidence. Proposed details retain their recorded status.

How to use it:

1. Run one phase per work session, in order. Do not start Phase N+1 until the exit gate of Phase N passes and its acceptance items are all "yes".
2. Every command is PowerShell on the owner's Windows computer, run from the repository root `G:\codebase\DoloGram` unless a step names another folder. Assumption: the repository root is `G:\codebase\DoloGram` and follows the layout of 10.2 (D-100).
3. Phase 0 establishes the local launch command. Later phases retain it, with required behavior complete at its owning gate. Section 0 governs authorization and service cleanup.
4. IDs in this plan (D-nn, F-nn, Mn-nn, T-nn, PF-n, PR-n, R-n, LS-n, ADM-nn, CMP-nn) are the IDs of v14. New items proposed here carry the prefixes listed in Appendix A to D and are not yet part of v14.
5. Where a package is named without a version, select and pin a compatible supported version at execution time and record it in `apps/admin/README.md` under "Pinned versions" (D-65 practice).
6. Never write the value of a key, token, connection string, passcode or generated password into this plan, the repository, a log or an audit row (D-56, D-105, D-106).

## 2. Conflicts and gaps found

The plan preserves accepted v14 scope. Verified later mobile decisions and repository instructions update stale integration assumptions in Section 0.

### 2.1 Conflicts between the request and v14

| ID | Request said | v14 says | Plan follows |
|---|---|---|---|
| AC-1 | Deploy on Vercel Hobby or run locally. | The admin web runs only on the owner's computer at `http://127.0.0.1:3100`, started with `npm run admin`, never deployed (6.6, D-102, 7.1). Vercel Hobby is for `apps/web` only (D-115). | Local only. Phase 18 has no Vercel step for the admin web. |
| AC-2 | Email/password admin sign-in with database role gating. | The 2026-11-15 user instruction supersedes v14 single-passcode access: existing Auth account plus live protected application role `admin`. | Database promotion/demotion and account sign-in in revised Phase 4; no separate passcode/env owner ID. |
| AC-3 | Frontend only; backend is a fixed contract built by M0 and M1. | M4-08 builds `apps/admin` and `packages/admin-core` (server code that uses `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` and `SUPABASE_ACCESS_TOKEN`) and the migration `<next-sequential>_admin.sql` that creates `private.admin_audit`. M4-08 depends on M1-08 and M4-05, and the UI depends on `packages/shared` (M2-01, M4-02). | The plan builds `apps/admin` and `packages/admin-core` (server-side TypeScript, never in a client bundle) and applies only the one migration M4-08 names. Prerequisites are M0, M1, M2-01, M4-02 and M4-05, each tied to the phase that needs it (Section 3). |
| AC-4 | Reports and content views the contract allows. | The admin web reads no messages, media, reactions, polls, chat titles, secret keys or per-user activity and cannot sign in as a user (D-103, 11.4 "Not in the admin web"). | Only usage, account totals, the account identity fields listed in ADM-03 and ADM-05, and the audit log. No report or content view is built. |
| AC-5 | A theming phase. | The admin web follows the system theme only; there is no theme setting (D-109 item 13, D-138, 12.10). | Phase 16 verifies light and dark through `prefers-color-scheme`; no theme switcher. |
| AC-6 | NEXT_PUBLIC_ variables for the publishable key. | The admin web uses no publishable key; its variables are `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `ADMIN_PASSCODE_HASH` and `BACKUP_DIR` (10.2). | `apps/admin` defines no `NEXT_PUBLIC_` variable and creates no browser Supabase client (proposed D-169, test AT-02). |
| AC-7 | Reuse the shared packages that the Android plan creates. | `DoloGram_Android_Implementation_Plan.md` exists at `G:\codebase\DoloGram\Plans\` (verified at plan-polish time). The shared package names come from v14 and the Android plan; see AF-1 for the package name confirmation step. | The plan reuses `packages/shared` by the paths v14 gives: `src/theme/tokens.ts`, `src/theme/icons.ts`, `src/theme/tokens.css` (generated by `npm run tokens`), `src/theme/contrast.test.ts`, `src/config` and the validation module of M2-01 (12.10, D-138). See AF-1 (now PF-38). |
| AC-8 | Prerequisites are M0 and M1 only. | 10.6 step 10: the admin web "starts once M1-08 and M4-05 exist and finishes before the MVP gate M4-07". | Section 0 gates affected integration. Tooling/shared validators enable Phase 0. Phase 1 owns CSS projection. Backend contracts gate Phases 8–11 and M4-05 gates Phase 14. |

### 2.2 Conflicts inside v14

| ID | Where | Conflict | Plan follows |
|---|---|---|---|
| DC-1 | D-103 and 6.6 versus ADM-03 and ADM-05 (11.4, CMP-24) | D-103 forbids "per-user activity"; ADM-03 and ADM-05 show "Last sign-in". | 11.4 and 12.9, the more specific text: Last sign-in is shown, nothing else about activity. Recorded as AF-3 for the owner to confirm. |
| DC-2 | T-43 versus ADM-06, D-74, D-75 and D-110 | T-43 says no read of message_media or chat media objects exists in the admin source, but the media copy downloads every object (D-74), the purge preview selects message_media rows and Storage objects (D-75) and account deletion updates messages (D-110). | The documented jobs stay. T-43's search allowlists exactly `packages/admin-core/src/maintenance/mediaCopy.ts`, `packages/admin-core/src/maintenance/purge.ts` and `packages/admin-core/src/accounts/deleteAccount.ts`; none of them returns message text or file bytes to the UI (proposed D-180). Recorded as AF-4. |
| DC-3 | ADM-06 (11.4) versus M4-05 | ADM-06 names one export file `BACKUP_DIR/db/YYYY-MM-DD.sql`; M4-05 asks for roles, schema and data. | Three files in `BACKUP_DIR/db`: `YYYY-MM-DD.sql` (schema), `YYYY-MM-DD.roles.sql` and `YYYY-MM-DD.data.sql` (AF-5). |
| DC-4 | 12.10 versus D-109 item 13 | 12.10 says `tokens.css` holds light values in `:root` and dark values under `[data-theme="dark"]`, and that apps/admin "uses the media query only"; it does not say that `tokens.css` also emits a `prefers-color-scheme` block the admin can use without `data-theme`. | Verified CSS/generator absence. Phase 1 creates the system projection from current TS tokens and verifies it under AB-04. |
| DC-5 | 12.10 component table versus 11.4 and 12.9 | CMP-23 Menu is marked "Admin: Yes", but no ADM screen in 11.4 or 12.9 opens a menu. | CMP-23 is not built for the admin web (AF-6). |
| DC-6 | Admin plan proposed D-147-D-163 versus Android plan proposed D-147-D-162 | Both plans independently proposed new decisions starting at D-147 (the first number after D-146, the last v14 decision). The admin plan's D-148-D-160 collide with the Android plan's D-148-D-160 on different subjects. | The admin plan decisions are renumbered to D-164-D-180 in Appendix A and throughout this plan. Later mobile decisions now overlap these numbers, so Section 0 keeps these historical proposals plan-local. The Android plan is unaffected. |

### 2.3 Gaps (the admin web needs something the contract does not define)

Each gap is recorded in Appendix B with its handling. No backend change is invented.

| ID | Gap | Handling |
|---|---|---|
| AG-1 | Static owner identity is retired by the user revision. | Auth verifies the acting UUID; protected database role derives Admin identity/pill and protects currently-admin Ban/Delete targets. No env UUID fallback. |
| AG-2 | `packages/admin-core` needs the project URL for the Auth Admin and Storage APIs; 10.2 assigns `SUPABASE_URL` to "scripts, tests" only. | `admin-core` reads `SUPABASE_URL`, because the scripts call admin-core (proposed D-168). |
| AG-3 | D-107 Assumption: the Management API may not return usage, the Auth and Realtime settings, the plan or a restore action for a Free project. | Every such panel uses CMP-30 with a Dashboard link, and usage can be entered by hand into `private.admin_audit` (D-107). Checked in Phases 12 and 13. |
| AG-4 | The passcode has no minimum length in v14. | At least 12 characters, checked by the hash helper (proposed D-164). |
| AG-5 | No audit action names are defined. | Fixed list in `packages/admin-core/src/audit/actions.ts` (proposed D-172). |
| AG-6 | `private.admin_audit` column types are not given; 6.2 lists only the names id, at, action, target_user_id, result, detail. | Types chosen in Phase 6 (Appendix C, AS-9). |
| AG-7 | D-123 gives the capacity action for database, storage, Realtime peak connections, Realtime messages and egress, but none for the monthly-active-users bar of ADM-02. | The bar shows "The Pro plan is the only option beyond the Free plan." (D-41). |

## 3. Prerequisites and environment checklist

### 3.1 Milestone prerequisites (contract built by other plans)

| Prerequisite | Needed by | Proof that it is done |
|---|---|---|
| Relevant M0 contracts | Phase 0 | Record actual tool versions, environment names and target identity under Section 0. |
| Relevant M1 security/schema | Account integration/release | M1.md is absent. Resolve AB-02/03 with targeted source/runtime evidence. Independent scaffold/UI fixtures can proceed. |
| M1-03 result for the D-78 trigger | Phase 8 | `docs/test-results/M1.md` records whether the BEFORE UPDATE trigger on auth.users was accepted or the D-86 initial-password fallback applies. |
| Provisioning callers and disposable fixtures | Phases 8 and 10 | Existing create-accounts.ts/.ps1 need core integration. create-user/disable-user are proposed wrappers. Discover isolated fixtures without embedded credentials. |
| M2-01 `packages/shared` validation, config and id modules | Phase 0 | `packages/shared` typechecks; its validation exports username, display name and email checks (D-89, D-116). |
| Shared theme and missing CSS projection | Phase 1 | TS tokens/icons/contrast exist. Generator/CSS/tokens command are proposed Phase 1 integration deliverables. |
| M4-05 `docs/runbook.md`, export script and media copy script | Phase 14 | The runbook exists and the export and restore half of T-48 has passed once by script. |
| M5-08 (V2 premium) | Phase 19 only | M5-08 is marked done in the V2 test log. |

### 3.2 Tools on the owner's computer

| Tool | Why | Check |
|---|---|---|
| Node.js (a version supported by the pinned Next.js release, 10.2) and npm with workspaces (D-100) | Build and run apps/admin. | `node --version; npm --version` |
| Supabase CLI | `supabase db dump`, migrations, local stack (10.2, ADM-06). | `supabase --version` |
| Docker Desktop | Local stack and `supabase db dump` (10.2). | `docker info --format "{{.ServerVersion}}"` |
| Git | Repository. | `git --version` |
| Current Chrome, Edge or Firefox on desktop | The owner's browser for the ADM screens (12.7). | Manual. |

```powershell
node --version; npm --version; supabase --version; docker info --format "{{.ServerVersion}}"; git --version
```

### 3.3 Environment variables of the admin web

The six backend settings below live in the ignored `apps/admin/.env.local`. Admin authorization is the authenticated account plus its protected database application role; there is no passcode hash or owner-ID environment setting. Phase 4 removed the retired parser requirements. The connection/sign-in follow-up above records current validation and live-connectivity limits.

| Name | Secret | Read by | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | No | `packages/admin-core` (server) | Project URL `https://jsyqtfsidtfahytcwutp.supabase.co` (D-56, AG-2). |
| `SUPABASE_PROJECT_REF` | No | admin-core | `jsyqtfsidtfahytcwutp`, for Management API calls (D-107). |
| `SUPABASE_SECRET_KEY` | Yes | admin-core | Auth Admin API and Storage API (D-102). |
| `SUPABASE_DB_URL` | Yes | admin-core | Verified-TLS PostgreSQL URI with the URL-encoded project database password, including sign-in username/role/session checks; SQL for the audit log, the ban fallback, settings checks, deletion, the purge preview and `supabase db dump` (D-102, 10.5). |
| `SUPABASE_ACCESS_TOKEN` | Yes | admin-core | Supabase account personal access token for the Management API (D-107). Currently required by environment validation; no active runtime consumer yet. |
| `BACKUP_DIR` | No | admin-core | Folder for exports and media copies (D-74). |

Rules: no variable in `apps/admin` starts with `NEXT_PUBLIC_` (AC-6); only files under `packages/admin-core/src` and `apps/admin/src/server` read `process.env` (proposed D-169).

### 3.4 Fixed values used throughout

| Value | Source |
|---|---|
| Origin `http://127.0.0.1:3100`, Host `127.0.0.1:3100` | D-104 |
| Idle timeout 8 hours; bounded existing-account sign-in abuse protection, with passive polling excluded from activity | Revised Phase 4 account-role contract; retired passcode lockout is not the new login acceptance gate |
| Generated password: 16 characters from a 56-character alphabet without look-alikes | D-105 |
| CSV import: at most 100 rows | D-81, D-105 |
| Tables: 50 rows per page | ADM-03, ADM-07, CMP-24 |
| Usage bar: amber at 80%, red at 100% | D-45, D-123 |
| Export due after 7 days; media copy and purge due after 31 days | ADM-02 |
| Free plan limits: 500 MB database, 1 GB storage, 5 GB egress, 200 Realtime peak connections, 2 million Realtime messages per month, 50,000 monthly active users | 7.1, D-41, D-125 |
| Units: 1 MB = 1,048,576 bytes; 1 GB = 1,073,741,824 bytes | D-116 |
| Loading indicator after 300 ms | D-95, D-134 |
| Admin targets at least 32 by 32 px; buttons and fields 36 high | D-136, 12.9 |
| Admin designed from 1024 px; the sidebar collapses to a 64 px rail below 1024 px | D-135, 12.7 |

## 4. Phase overview

| Phase | Name | Goal | Depends on | Document IDs covered |
|---|---|---|---|---|
| 0 | Prerequisites and workspace scaffold | A runnable empty admin app bound to 127.0.0.1:3100 with a server-only core package. | Relevant tools and existing shared validators per Section 0 | 6.6, 10.2, D-100, D-102, M4-08 |
| 1 | Tokens, fonts, icons and base components | Admin styling from the shared tokens and the base components at admin sizes. | Phase 0 and TS theme inputs; this phase creates CSS | 12.2, 12.3, 12.4, 12.10, D-129 to D-131, D-136, D-138, CMP-01 to CMP-04, CMP-18 to CMP-20 |
| 2 | Admin data components | Data table, filter bar, unavailable panel and status pill. | Phase 1 | 12.9, D-137, CMP-24, CMP-25, CMP-30, CMP-31 |
| 3 | Admin action components | Dialogs, toasts, admin form, audit view, usage bar and job panel. | Phase 2 | 12.9, D-134, D-137, CMP-16, CMP-17, CMP-26 to CMP-29 |
| 4 | Account sign-in and database admin authorization | Existing account sign-in, trusted database user/admin promotion, current-role enforcement and secure sessions. | Phase 3; role-schema prerequisite in revised 4.1 | 2026-11-15 user revision, ADM-01, revised T-44/AT-04 |
| 5 | Admin shell and navigation | Sidebar, header with Lock now, the routes of 12.6 and the 64 px rail. | Phase 4 | 11.4 Navigation, 12.6, 12.7, D-135, CMP-21 |
| 6 | Audit trail and Audit log | `private.admin_audit`, the audit writer and ADM-07. | Phase 5 | ADM-07, D-106, CMP-28, M4-08 |
| 7 | Accounts list | ADM-03 with search, filters, pagination and the Owner pill. | Phase 6 | ADM-03, D-102, D-103, CMP-24, CMP-25, CMP-31 |
| 8 | Create account: single | ADM-04 single form with a server-generated password shown once. | Phase 7, M1-08 | ADM-04, D-47, D-78, D-86, D-89, D-105, D-116, T-45 |
| 9 | Create account: CSV import | ADM-04 CSV preview, creation of the valid rows and Download as CSV. | Phase 8 | ADM-04, D-81, D-105, T-46 |
| 10 | Account detail: reset, ban, unban | ADM-05 identity, Reset password, Ban and Unban; the scripts call admin-core. | Phase 9, M1-08 | ADM-05, D-61, D-78, D-86, D-105, D-108, D-114, T-47 |
| 11 | Account detail: delete on request | ADM-05 typed-confirm deletion per D-110. | Phase 10 | ADM-05, D-108, D-110, PR-20, T-53 |
| 12 | Settings check | ADM-08 Pass, Fail or Check by hand for each 10.2 setting. | Phase 11 | ADM-08, D-107, D-114, 10.2 |
| 13 | Overview: status, usage and capacity | ADM-02 project, usage bars, account totals, maintenance and settings summary. | Phase 12 | ADM-02, 7.1, D-41, D-45, D-107, D-123, D-125, PR-19 |
| 14 | Maintenance: runner, export, media copy | ADM-06 job runner, database export and media copy. | Phase 13, M4-05 | ADM-06, D-29, D-52, D-74, M4-05 |
| 15 | Maintenance: purge and restore drill | ADM-06 purge preview, purge and the restore-drill checklist. | Phase 14 | ADM-06, D-75, D-123, PF-18, T-48 |
| 16 | Theme, states and accessibility pass | System theme, loading and error states, keyboard and contrast checks on every ADM screen. | Phase 15 | D-95, D-109, D-134, D-136, 12.8, 11.6 |
| 17 | Hardening and security tests | Bundle scan, server-action audit, origin tests, headers and error redaction. | Phase 16 | T-42, T-43, T-44, 7.1, D-102 to D-104 |
| 18 | M4-08 exit and release gate | T-42 to T-48 and T-53 pass on the hosted project; R-7 and R-8 are done through the admin web. | Phase 17 | M4-08, M4-07, 10.8, R-7, R-8 |
| 19 | V2 premium switches | ADM-05 premium switches and ADM-03 premium pills after M5-08. | Phase 18, M5-08 | ADM-05, D-72, D-87, D-119, T-31, M5-08 |

## 5. Phases

### Phase 0: Prerequisites and workspace scaffold

**Profiles.roles revision — 2026-11-15:** Configuration/schema contract: remove passcode/owner-ID parser requirements in reopened Phase 4. Use `public.profiles.roles`, not a private role table or environment UUID. Preserve the same six backend settings and server-only boundary; migration 041 is the only new schema change in this follow-up.

- **Goal:** Create a runnable, empty admin app that listens only on 127.0.0.1:3100, plus a server-only `packages/admin-core` that loads and validates the admin environment.
- **Depends on:** relevant tooling/shared contracts from Section 0. M1 security prerequisites gate real account integration, with independent fixture work permitted.
- **Implements:** 6.6, 10.2 (repository layout, environment variables), D-100, D-102, D-104 (address only), M4-08 (deliverables `apps/admin`, `packages/admin-core`, `apps/admin/.env.local.example`).

**Steps**

- [x] 0.1 Read Section 0 and establish component-specific prerequisites. Inspect tools/packages/lockfile, relevant diffs and hashes. Capture affected lint/typecheck/test baselines with bounded timeouts and diagnostics. M1.md is absent. AB-02/03 gate real account integration. Independent scaffolding uses fixtures. Verify owner UUID/backend identity before privileged operations.

- [x] 0.2 Select a supported pinned Next.js/tooling set compatible with root React/React DOM 19.2.3, TypeScript 6.0.3 and installed Node. Check version-matched official setup docs/scaffold help and record exact flags before creating apps/admin with App Router, TypeScript, ESLint, CSS Modules and src. Review lockfile impact on mobile. Avoid an unpinned latest scaffold.

- [x] 0.3 Make `apps/admin` a workspace member and set its package name and scripts. In `apps/admin/package.json` set `"name": "@dologram/admin"`, `"private": true` and these scripts (proposed D-166): `"dev": "next dev -H 127.0.0.1 -p 3100"`, `"build": "next build"`, `"start": "next start -H 127.0.0.1 -p 3100"`, `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. Root workspace globs already discover both packages. Add only the root scripts `"admin": "npm run build --workspace apps/admin && npm run start --workspace apps/admin"` and `"admin:dev": "npm run dev --workspace apps/admin"` (6.6: "started with npm run admin"). Note: `&&` in `package.json` scripts is sh syntax executed by npm, not PowerShell; this is correct and intentional.

  ```powershell
  npm install  # Start admin:dev after steps 0.4–0.8 are wired.
  ```

- [x] 0.4 Create `packages/admin-core` with `package.json` (`"name": "@dologram/admin-core"`, `"private": true`, `"type": "module"`, `"main": "src/index.ts"`), a `tsconfig.json` extending `../../tsconfig.base.json`, and `src/index.ts`. Packages: `server-only` (makes any client import of admin-core a build error, so the secret key cannot enter a client bundle, D-102); `zod` (validates the environment at startup); `@supabase/supabase-js` (Auth Admin and Storage APIs with the secret key); `postgres` (SQL over `SUPABASE_DB_URL`, proposed D-170). The first line of src/index.ts is import "server-only". Add admin-core typecheck/test scripts and compatible TypeScript/Node typings/test tooling before invoking commands. Guard every privileged subpath. Provide a tested Node CLI export condition that preserves the browser import barrier.

  ```powershell
  New-Item -ItemType Directory -Force packages\admin-core\src | Out-Null; npm install server-only zod @supabase/supabase-js postgres --workspace packages/admin-core
  ```

- [x] 0.5 Create packages/admin-core/src/env.ts with separate lazy parsers. getPasscodeEnv validates ADMIN_PASSCODE_HASH only for unlocking. getAdminEnv validates backend fields from Section 3.3 only inside backend operations, including owner UUID, absolute BACKUP_DIR and URL/project/database identity. Hosted URLs require HTTPS. Confirmed isolated loopback targets may use HTTP and a target identity instead of the hosted 20-letter-ref restriction. getAdminConfigStatus returns missing/invalid variable names without values or network calls, tolerating unset backend credentials/hash during scaffold startup. The bootstrap page uses it. Never invoke the all-required parser from the root layout. Missing backend settings disable affected authenticated features without preventing Unlock/Lock now. Test missing/hash-only/backend-only/invalid-target synthetic fixtures.

- [x] 0.6 Create `apps/admin/.env.local.example` (M4-08 deliverable) naming the eight variables with empty values and a one-line comment each, taken from Section 3.3. Add `apps/admin/.env.local` to `.gitignore` unless the M0-10 rules already ignore `.env.local` everywhere. Copy the example to `.env.local` and fill it in by hand; the hash is set in Phase 4. Earlier checks use synthetic fixtures/safe missing-hash presentation. Phase 0 must not depend on the Phase 4 helper. Load backend config at runtime without forced prerendering.

  ```powershell
  if (-not (Test-Path apps\admin\.env.local)) { Copy-Item apps\admin\.env.local.example apps\admin\.env.local }; git check-ignore apps/admin/.env.local
  ```

- [x] 0.7 Wire the workspace packages into Next.js. In `apps/admin/next.config.ts` set `transpilePackages: ["@dologram/shared", "@dologram/admin-core"]` and `poweredByHeader: false`. Add `"@dologram/shared": "*"` and `"@dologram/admin-core": "*"` to the dependencies in `apps/admin/package.json`. Assumption: M0-02 named the shared package `@dologram/shared`; if `packages/shared/package.json` uses another name, use that name and record it.

  ```powershell
  npm install; npm run typecheck --workspace apps/admin
  ```

- [x] 0.8 Replace the scaffolded `apps/admin/src/app/page.tsx` with a server component reading getAdminConfigStatus without a backend connection and rendering "DoloGram Admin" with missing configuration names; set `metadata.title = "DoloGram Admin"` in `apps/admin/src/app/layout.tsx` (12.1 tab title). Delete the scaffold's demo CSS and images.

  ```powershell
  npm run admin
  ```

- [x] 0.9 Create `apps/admin/README.md` with the sections "Run" (`npm run admin`, `npm run admin:dev`), "Environment" (link to `.env.local.example`), "Pinned versions" (Next.js, React, TypeScript, supabase-js, postgres, zod, server-only) and "Never deployed" (D-102).

  ```powershell
  Get-Content apps\admin\README.md
  ```

**Deliverables:** `apps/admin` (Next.js App Router), `packages/admin-core` with `src/index.ts` and `src/env.ts`, `apps/admin/.env.local.example`, the root scripts `admin` and `admin:dev`, `apps/admin/README.md`.

**Acceptance criteria**

Tests: AT-01; prepares T-42 and T-44.

- [x] `npm run admin` builds and serves "DoloGram Admin" at `http://127.0.0.1:3100`. (Yes or no.)
- [x] The listening socket is bound to 127.0.0.1 only, not 0.0.0.0 or `::`. (Yes or no; prerequisite of T-44.)
- [x] With `SUPABASE_SECRET_KEY` removed from `.env.local`, the page names `SUPABASE_SECRET_KEY` as missing and shows no value. (Yes or no.)
- [x] Importing `@dologram/admin-core` from a file marked `"use client"` fails the build. (Yes or no; prerequisite of T-42.)
- [x] `git status` shows no `.env.local` file. (Yes or no.)

**Exit gate**

```powershell
npm run admin  # then, in a second PowerShell window:
Get-NetTCPConnection -LocalPort 3100 -State Listen | Select-Object -ExpandProperty LocalAddress; (Invoke-WebRequest http://127.0.0.1:3100 -UseBasicParsing).StatusCode
```

The gate passes when the only address printed is `127.0.0.1` and the status is `200`.

**Risks and fallbacks**

- create-next-app flags change between releases: run `--help` and map the same choices (App Router, TypeScript, src folder, no Tailwind).
- npm workspaces do not hoist `server-only`: install it in both `packages/admin-core` and `apps/admin`.
- `packages/shared` does not exist yet (AF-1): stop. The admin web must not duplicate the validation rules (M2-01, D-116), so Phase 0 waits for M2-01.

**Progress and status — 2026-11-14 (Asia/Manila)**

Current execution phase: **Phase 0 — Complete, 100% (9/9 steps)**. All five acceptance criteria and the exit gate are verified. Overall admin-plan implementation progress: **7% (9/137 numbered steps, rounded)**; this is not an aggregate DoloGram release percentage. Phase 1 is ready to start and was not started in this execution.

Evidence and initial done/partial/not-started classification are in `Plans/context/DoloGram_Admin_Web_Phase_00_Context_Index.md`; recoverable working-copy baseline, exact scope/hashes, analyzed Repomix XML and command logs are under `supabase/repomix/admin-phase-00-20261114/`. Followed Git baseline → ripgrep → Reader validation → scoped cached Repomix 1.18.1 → complete bounded XML analysis → original-source verification. Repository instructions introduce no Phase 0 conflict; generated packets/logs remain under supabase/repomix. Existing user changes and concurrent apps/web work were preserved.

Verified: shared prerequisite typecheck/215 tests; admin lint without warnings; root typecheck across current workspaces; 2 bootstrap and 38 core tests; production build with empty environment; real use-client build rejected for both core exports; native Node CLI imports allowed only with react-server; root npm run admin production launch; exclusive 127.0.0.1 listener and HTTP 200/title/heading; missing SUPABASE_SECRET_KEY with configured synthetic values absent; .env.local ignored and example visible. The final test server was stopped and the probe removed. Server logs contain no runtime errors or warnings. Browser-console/real-backend verification is not claimed.

Pre-existing checks: mobile lint has 14 errors/4 warnings, with byte-identical final diagnostics. Mobile tests required a workspace cache after temp-cache EPERM: 87 suites/563 tests pass and 5 suites/16 tests fail. Shared tests retain existing Vite-config/SQLite warnings. These were preserved, not attributed to Phase 0. Sandbox networking initially prevented live requests; host execution resolved it without application changes. Early checks during overlapping dependency extraction were rerun after installation completed. Ten transitive TypeScript ESLint packages resolved from 8.72.1 to 8.72.2; mobile/shared runtime pins and source remain unchanged by this task.

Implementation notes: pinned Next.js/scaffold 16.4.6 supports the installed Node 24.13.1 and repository React 19.2.3; scaffold React 19.3 defaults were corrected before install. Lazy passcode/backend parsers preserve startup without credentials and expose names only. Hosted API/project/database identities must agree; isolated HTTP loopback fixtures require explicit caller confirmation. Native Node TypeScript execution with --conditions=react-server supplies the tested CLI contract without adding tsx. Manual real credentials/owner/backend identity remain AB-06 before privileged operations; no such operation was attempted. All eight example values stay empty. Root existing ignore already covered .env.local; the scaffold local ignore needed an exception for .env.local.example. Phase 1 retains token styling. No commits, pushes, deployments, remote migrations or external configuration changes occurred.

### Phase 1: Tokens, fonts, icons and base components

- **Goal:** Style the admin web only from the shared tokens and provide the base components of 12.4 at the admin sizes of 12.9.
- **Depends on:** Phase 0 and existing TS tokens/icons/contrast tests. Step 1.1 supplies the missing CSS generator/output within this phase.
- **Implements:** 12.2, 12.3, 12.4, 12.10, D-129, D-130, D-131, D-134, D-136, D-138, CMP-01, CMP-02, CMP-03, CMP-04, CMP-18, CMP-19, CMP-20.

**Steps**

- [x] 1.1 Establish the missing CSS projection from shared tokens.ts, typography.ts, icons.ts and contrast.test.ts. Proposed outputs are a deterministic generator, tokens.css and root tokens script. Inventory every semantic name used by Phases 1–3/5 and record exact current mapping, alias or missing definition. Project current values to --dg-* variables including system dark-mode, loading and motion. Reuse color.text.inverse/color.error/color.separator where appropriate. Add only required aliases/icons in shared sources, preserve current mobile values and verify affected consumers/contrast. Gate on deterministic regeneration without diff and resolved variables/icons in both schemes. npm run tokens is proposed until created.

- [x] 1.2 Import the tokens once in `apps/admin/src/app/layout.tsx` with `import "@dologram/shared/src/theme/tokens.css";`, plus a new `apps/admin/src/app/globals.css` that sets `html { color-scheme: light dark; }` and `body { margin: 0; background: var(--dg-color-bg-app); color: var(--dg-color-text-primary); font-family: var(--dg-font-sans); }`. The admin web never sets `data-theme` on `<html>` (D-109 item 13, D-138).

  ```powershell
  npm run build --workspace apps/admin
  ```

- [x] 1.3 Fonts. In `apps/admin/src/app/fonts.ts` load `Inter` and `JetBrains_Mono` from `next/font/google` with `subsets: ["latin"]`, `display: "swap"` and the variables `--dg-font-sans` and `--dg-font-mono`, and apply both class names to `<html>` (12.10, D-130). next/font downloads the files at build time and serves them itself, so the running app makes no font request.

  ```powershell
  npm run build --workspace apps/admin
  ```

- [x] 1.4 Icons. Install `lucide-react` (ISC, D-131). Create `apps/admin/src/components/Icon/Icon.tsx` with props `name` (a semantic name from `packages/shared/src/theme/icons.ts`, for example `admin.overview`), `size` (`"xs" | "sm" | "md" | "lg" | "xl"`, mapping to icon.xs 14, icon.sm 16, icon.md 20, icon.lg 24 and 48 with the strokes of 12.3) and `label` (when present the icon gets `role="img"` and `aria-label`; otherwise `aria-hidden="true"`). Screens never import from `lucide-react` directly (12.10).

  ```powershell
  npm install lucide-react --workspace apps/admin
  ```

- [x] 1.5 Lint guards (12.10). In `apps/admin/eslint.config.mjs` add `eslint-plugin-jsx-a11y` with its recommended rules (D-95) and a `no-restricted-syntax` rule that rejects string literals matching `#[0-9a-fA-F]{3,8}`, `rgb(` and `rgba(`. Add `stylelint` with `stylelint-config-standard` and the rule `color-no-hex: true` in `apps/admin/stylelint.config.mjs`, and the script `"lint:css": "stylelint \"src/**/*.css\""`.

  ```powershell
  npm install -D eslint-plugin-jsx-a11y stylelint stylelint-config-standard --workspace apps/admin; npm run lint --workspace apps/admin; npm run lint:css --workspace apps/admin
  ```

- [x] 1.6 Strings. Create `apps/admin/src/strings.ts` (11.6: the admin web has its own strings module), exporting one object `strings` grouped by screen with camelCase keys (12.10). Initial keys: `common.retry = "Retry"`, `common.cancel = "Cancel"`, `common.copy = "Copy"`, `common.copied = "Copied"`, `common.unavailable = "unavailable"`, `common.openDashboard = "Open Dashboard"`, `common.enterByHand = "Enter by hand"`, `common.checkByHand = "Check by hand"`, `common.refused = "Request refused."`. Later phases add their keys with the exact text quoted in 12.9 and 11.4.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [x] 1.7 Test tooling. Install `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react` and `@testing-library/user-event` for component tests (D-100 names Vitest) and create `apps/admin/vitest.config.ts` with `environment: "jsdom"` and `include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/security/**/*.test.ts"]`.

  ```powershell
  npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event --workspace apps/admin
  ```

- [x] 1.8 CMP-01 `Button` and `IconButton` in `apps/admin/src/components/Button/Button.tsx` and `Button.module.css`. Variants: Primary (fill color.brand.primary, text color.brand.onPrimary, pressed color.brand.pressed), Secondary (1 px color.border.strong, text color.text.primary), Danger (fill color.danger, text color.danger.onDanger), Text (text color.brand.primary). Height 36, horizontal padding space.6, minimum width 88, radius.md, label label.lg (12.4, 12.9). IconButton: 32 visual and target, with a required `label` prop used as `aria-label`. States: Pressed fills color.bg.pressed for Secondary and Text; Focused shows 2 px color.focus.ring with a 2 px offset (D-136); Disabled uses color.text.disabled on color.bg.disabled; Loading replaces the label with a 16 px spinner and sets `aria-busy="true"`.

  ```powershell
  npm run test --workspace apps/admin -- Button
  ```

- [x] 1.9 CMP-02 `TextField` (`apps/admin/src/components/TextField/`): a `<label>` above an `<input>` 36 high, padding 12 horizontal, radius.md, text body.lg, placeholder color.text.secondary, 1 px color.border.strong and a 2 px color.focus.ring on focus. Props `label`, `value`, `onChange`, `error` (helper text in color.danger with the status.failed icon at icon.xs, wired with `aria-describedby` and `aria-invalid`), `type`, `autoComplete` and `mono` (uses `--dg-font-mono` for passwords and ids, D-130).

  ```powershell
  npm run test --workspace apps/admin -- TextField
  ```

- [x] 1.10 CMP-03 `SearchField` (`apps/admin/src/components/SearchField/`): `<input type="search">` 36 high, radius.full, fill color.bg.surface, body.md, with a debounced `onSearch` after 150 ms without a keystroke (12.4); the screen passes the placeholder ("Search by username or email" or "Filter by target").

  ```powershell
  npm run test --workspace apps/admin -- SearchField
  ```

- [x] 1.11 CMP-04 `SwitchRow` (`apps/admin/src/components/SwitchRow/`): `<button role="switch" aria-checked>` with a label. A `pending` prop replaces the thumb with a 16 px spinner and ignores input, and the value changes only after the caller reports success (12.4, the admin premium rule). Used in Phase 19.

  ```powershell
  npm run test --workspace apps/admin -- SwitchRow
  ```

- [x] 1.12 CMP-18 `Skeleton`, CMP-19 `EmptyState` and CMP-20 `ErrorState` in `apps/admin/src/components/`. Skeleton: `<div aria-busy="true">` with color.skeleton.base and color.skeleton.highlight, shimmer motion.duration.shimmer, stopped under `prefers-reduced-motion: reduce` (D-134); the `adminTable` variant draws 10 rows with a block height of 12 (12.4). The hook `useDelayedFlag(loading, 300)` in `apps/admin/src/components/Skeleton/useDelayedFlag.ts` shows the skeleton only after motion.delay.loading, 300 ms (D-95). EmptyState: `<section>` with an icon in a color.bg.surface circle, a title in title.md and body text in body.md color.text.secondary. ErrorState: `<section role="alert">` with the error text and an optional Retry Button (D-95).

  ```powershell
  npm run test --workspace apps/admin; npm run lint --workspace apps/admin
  ```

**Deliverables:** token and font wiring in `apps/admin/src/app/layout.tsx`, `globals.css` and `fonts.ts`; the components Icon, Button, IconButton, TextField, SearchField, SwitchRow, Skeleton, EmptyState and ErrorState with tests; `strings.ts`; the ESLint and Stylelint guards.

**Acceptance criteria**

Tests: AT-03; T-40 (shared-token contrast part).

- [x] Both linters pass, and `Get-ChildItem apps\admin\src -Recurse -Include *.ts,*.tsx,*.css | Select-String -Pattern "#[0-9a-fA-F]{3,8}\b"` finds no color literal. (Yes or no.)
- [x] With the operating system in dark mode, `getComputedStyle(document.body).backgroundColor` equals the dark value of color.bg.app. (Yes or no.)
- [x] The running app requests nothing from fonts.googleapis.com or fonts.gstatic.com (DevTools Network). (Yes or no.)
- [x] Every component test passes, including: an IconButton without `label` fails the typecheck, and the Skeleton is not rendered when loading ends before 300 ms. (Yes or no.)
- [x] `npm run test --workspace packages/shared -- contrast` passes (D-95; the shared-token part of T-40). (Yes or no.)

**Exit gate**

```powershell
npm run lint --workspace apps/admin; npm run lint:css --workspace apps/admin; npm run test --workspace apps/admin; npm run admin
```

**Progress and status — 2026-11-15 (Asia/Manila)**

Phase 1 is **Complete — 100% (12/12 steps)**. All five acceptance criteria and the exit gate are met. Overall admin-plan implementation progress is **15% (21/137 numbered steps, rounded)**, not an aggregate DoloGram release percentage. Phase 2 is ready to start and has not been started.

The initial requirement classification, compact checklist, Git ownership/snapshots, source identities, complete scoped Repomix XML analysis, semantic inventory, version references and verification evidence are in [the Phase 1 context index](context/DoloGram_Admin_Web_Phase_01_Context_Index.md). Artifacts and generation logs are under `supabase/repomix/admin-phase-01-20261114/`. Execution began November 14 and finished November 15.

Verification: admin ESLint and Stylelint pass without warnings; 23 admin tests pass, including negative guard tests and timer cleanup. A real negative TypeScript probe rejects IconButton without label and was removed. Workspace typecheck passes across admin/mobile/web/core/shared. Shared tests pass (26 files, 272 tests, including 63 explicit contrast checks); the existing shared Vitest config and experimental SQLite warnings remain. Production build passes using the plan's local-font fallback. Chrome verifies both system themes, local-only font requests, no data-theme attribute, 32/36 px targets, 2 px focus/offset, keyboard switch/input flows and reduced motion; no browser warnings/errors. Original mobile token values and icon mappings are unchanged, and every admin CSS variable resolves. Mobile theme-consumer tests pass (8/8). Mobile lint's existing failures are recorded separately in the context index. No full mobile test/build was repeated for additive shared tokens.

Decisions/discrepancies: the Google build-time font fetch failed, so next/font/local now serves the existing licensed Inter and JetBrains Mono release files. Current shared palette/spacing/elevation values supersede the historical v14 palette; aliases reuse inverse/error/separator and current semantic colors. New success colors, 1200 ms shimmer and added admin icons are checked against v14 and contrast. The working ESM Vitest config remains .mts, rather than creating a duplicate .ts config. A system-color favicon prevents the scaffold's missing-icon request. No repository-instruction conflict was found. The sandbox listener is isolated from host Chrome; production browser acceptance used an owned host-loopback server, stopped after verification. Existing dependency versions were preserved; audit advisories affect baseline-identical packages. No commits, pushes, deployments, remote migrations or external configuration changes occurred.

**Risks and fallbacks**

- `tokens.css` has no media-query block (DC-4): apply AF-2; the admin web does not continue with copied color values.
- `next/font/google` cannot download at build time (offline build): use `next/font/local` with the Inter and JetBrains Mono release files in `apps/admin/src/app/fonts/` (both SIL Open Font License 1.1, D-130).
- A semantic icon name is missing from `icons.ts`: add it to `packages/shared/src/theme/icons.ts` with the Lucide name from 12.3 in the same commit; never import Lucide directly in a screen.

### Phase 2: Admin data components

**Profiles.roles revision — 2026-11-15:** Role-display contract: retain reusable status components, but future account screens derive an Admin pill from `profiles.roles = admin`; normal member/chat roles and generic status pills are unrelated. Assign the label/consumer integration to Phase 7, without treating historical Owner-pill checks as role authorization evidence.

- **Goal:** Build the read-only admin components that every list and panel uses.
- **Depends on:** Phase 1.
- **Implements:** 12.9, D-137, CMP-24, CMP-25, CMP-30, CMP-31.

**Steps**

- [x] 2.1 CMP-31 `StatusPill` (`apps/admin/src/components/StatusPill/`) with the prop `value: "active" | "banned" | "mustChangePassword" | "owner" | "pass" | "fail" | "due" | "overdue" | "success" | "failed" | "premiumBadge" | "premiumExtraReactions" | "premiumStickers"`. Height 22, padding 2 by 8, radius.sm, label.sm, and an icon at icon.sm before the text. Mapping (12.9): Active and Pass are color.success on color.bg.surface with admin.pass; Banned, Fail and Overdue are color.danger on color.danger.bg with admin.fail; Must change password and Due are color.warning.text on color.warning.bg with admin.warning; Owner is color.info.text on color.info.bg with person.badge; premium flags are color.text.primary on color.bg.surface. Success and Failed follow CMP-28 (Success styled as Pass, Failed as Fail). Texts: "Active", "Banned", "Must change password", "Owner", "Pass", "Fail", "Due", "Overdue", "Success", "Failed", "badge", "extra_reactions", "premium_stickers".

  ```powershell
  npm run test --workspace apps/admin -- StatusPill
  ```

- [x] 2.2 CMP-24 `DataTable` (`apps/admin/src/components/DataTable/DataTable.tsx`, the path 12.10 gives). Generic props: `columns: { key: string; header: string; widthPercent: number; align: "left" | "right"; mono?: boolean; render?: (row) => ReactNode }[]`, `rows`, `rowKey`, `onRowOpen?: (row) => void`, `page` (1-based), `pageSize` (fixed at 50), `total`, `onPageChange`, `state: "ready" | "loading" | "error" | "empty"`, `emptyText` and `errorContent`. Layout: a card with fill color.bg.app, 1 px color.border.subtle, radius.md and elevation.1; a sticky header row 40 high (z.sticky) with fill color.bg.surface in label.md color.text.secondary; body rows 48 high in body.md with 1 px color.border.subtle separators and padding 12; a footer with "<first>-<last> of <total>" in body.sm and Previous and Next Secondary Buttons, disabled at the ends. Clickable rows have `tabIndex=0`, open on Enter, fill color.bg.pressed on hover and press, and show an inset 2 px color.focus.ring on focus. Loading shows the Skeleton `adminTable` after 300 ms; error renders `errorContent` (CMP-30 with Retry); empty renders EmptyState with `emptyText`. Columns are not sortable (12.9). Below 1024 px the table scrolls horizontally inside its card (12.7).

  ```powershell
  npm run test --workspace apps/admin -- DataTable
  ```

- [x] 2.3 CMP-25 `FilterBar` (`apps/admin/src/components/FilterBar/`) with props `search: { placeholder: string; value: string; onSearch(v) }`, `chips?: { id: string; label: string }[]`, `selectedChip?`, `onChip?` and `select?: { label: string; options: string[]; value; onChange }`. Height 36, gap 8, SearchField 320 wide; chips are 32 high with padding 12, radius.full and label.md; an unselected chip has 1 px color.border.strong; a selected chip has fill color.bg.selected, 1 px color.brand.primary, text color.brand.primary and `aria-pressed="true"`; focus shows 2 px color.focus.ring with radius.full.

  ```powershell
  npm run test --workspace apps/admin -- FilterBar
  ```

- [x] 2.4 CMP-30 `UnavailablePanel` (`apps/admin/src/components/UnavailablePanel/`) with props `dashboardUrl: string`, `onEnterByHand?: () => void`, `onRetry?: () => void` and `variant: "panel" | "row"`. The panel variant has fill color.bg.surface, 1 px dashed color.border.strong, radius.md and padding 16, the word "unavailable" in label.md color.text.secondary, the Text Button "Open Dashboard" (an `<a target="_blank" rel="noopener noreferrer">`), and "Enter by hand" when `onEnterByHand` is given (D-107). The row variant renders "Check by hand" with the same link, for ADM-08.

  ```powershell
  npm run test --workspace apps/admin -- UnavailablePanel
  ```

- [x] 2.5 Add `apps/admin/tests/unit/components.test.tsx` (tests only, no app route): DataTable with 120 sample rows shows "101-120 of 120" on page 3 with Next disabled; FilterBar shows exactly one chip with `aria-pressed="true"`.

  ```powershell
  npm run test --workspace apps/admin
  ```

**Deliverables:** StatusPill, DataTable, FilterBar and UnavailablePanel with tests.

**Acceptance criteria**

Tests: AT-03.

- [x] DataTable shows exactly 50 rows on a full page and "1-50 of 120" in the footer. (Yes or no.)
- [x] A focused DataTable row opens on Enter and shows a visible 2 px focus ring. (Yes or no.)
- [x] Every StatusPill value shows both its icon and its text, so color is never the only signal (12.8). (Yes or no.)
- [x] The UnavailablePanel link opens in a new tab with `rel="noopener noreferrer"`. (Yes or no.)
- [x] `npm run lint --workspace apps/admin` reports no jsx-a11y error. (Yes or no.)

**Exit gate**

```powershell
npm run test --workspace apps/admin; npm run lint --workspace apps/admin
```

**Risks and fallbacks**

- The sticky header fails inside a horizontally scrolling card: keep it sticky only from 1024 px and let it scroll with the body below 1024 px.

**Phase 2 progress — 2026-11-15 (Asia/Manila)**

Phase 2 is **Complete — 100% (5/5 steps)**. All five acceptance criteria and the exit gate are met. Overall admin-plan implementation progress is **19% (26/137 numbered steps, rounded)**; aggregate DoloGram project progress is not established by this admin-only phase. Phase 3 is ready to start and has not been started.

Implemented the four token-based data components, centralized their strings and extended the existing components.test.tsx without replacing Phase 1 coverage. DataTable consumes at most 50 current-page rows plus the matching total; the 120-account fixture supplies each page, including 101–120 on page 3. This resolves the plan's previously unspecified row-input contract for later SQL consumers. Default column keys are constrained to row properties for type safety; render functions support custom cell contents. Optional accessible table label/empty icon allow reuse. Premium icons reuse person.badge, emoji.heart and emoji.laugh because the plan does not assign those three icons. Admin follows system theme per D-109 and shared typography/color tokens; no account preference controls were added.

Workflow and source identities: Plans/context/DoloGram_Admin_Web_Phase_02_Context_Index.md. Recoverable snapshots, baseline patch/status, scoped Repomix 1.18.1 packet and generation log, check diagnostics and browser evidence: supabase/repomix/admin-phase-02-20261115/. Packet security scan clean; all 25 entries analyzed with original-source verification. No repository-instruction conflict. The named test file already existed, and individual plan test commands filter file names rather than describe names: use the full suite or `npm run test --workspace apps/admin -- components.test.tsx -t DataTable` (substitute the component name).

Verification: baseline lint/CSS lint/typecheck/build PASS. Baseline tests: 22 passed, one pre-existing ESLint-guard timeout at 10 seconds during concurrent checks. Final isolated suite PASS, 57/57 tests including 34 added Phase 2 cases; the unchanged lint guard passes. Final ESLint (including jsx-a11y), Stylelint, typecheck and Next production build PASS with no diagnostics. Browser component fixture outside app routes PASS in Chrome in light/dark with actual local Inter/Mono fonts: 50 rows and first/final ranges, Enter opening, visible inset 2 px focus ring, sticky 40 px header/48 px rows, all 13 icon/text pills at 22 px, single selected chip, debounced search/select callbacks, retry/manual-entry callbacks, safe new-tab link attributes, minimum 32 px controls and horizontal scrolling at 800 px without page overflow. Zero browser console errors/warnings or page errors. Screenshots visually reviewed. Loading delay/cleanup, passive/nested actions, invalid inputs, zero/stale pages and error/empty states verified by component tests. No required manual criterion remains. Browser/server cleanup is in finally; no persistent service remains.

Initial implementation diagnostics (wrong premium semantic name and noninteractive scroll-container tabIndex) were corrected before final checks, without suppressions. Fixture-only import-depth and production-environment/font setup errors were corrected; sandbox networking required host execution for the local browser check. Prior diagnostics are retained; final passing files are identified in the context index. No new dependencies, shared/mobile changes, routes, commits, pushes, deployments, migrations, backend mutations or external configuration changes. Existing mobile lint failures/workspace advisories remain outside scope; this phase did not rerun or alter those systems. Later backend/backup/release prerequisites remain governed by Section 0.

### Phase 3: Admin action components

**Profiles.roles revision — 2026-11-15:** Actor/session contract: dialogs and job/audit views receive only already-authorized results. Future audit data records the verified acting account UUID; client status, a profile role prop or a dialog cannot grant authorization. Existing reusable-component completion is unchanged.

- **Goal:** Build the dialogs, toasts and admin components that change data or run jobs.
- **Depends on:** Phase 2.
- **Implements:** 12.4 (CMP-16, CMP-17), 12.9, D-105, D-108, D-134, D-137, CMP-26, CMP-27, CMP-28, CMP-29.

**Steps**

- [x] 3.1 CMP-16 `Dialog` (`apps/admin/src/components/Dialog/`): a `<dialog>` opened with `showModal()` (12.10), 400 wide for confirms and 520 for forms, with fill color.bg.elevated, elevation.3, radius.lg, padding space.7, the color.scrim backdrop and z.dialog. Escape and Cancel close it; focus moves to the first field or to Cancel and returns to the opener on close (12.8). An error slot renders ErrorState inside the dialog.

  ```powershell
  npm run test --workspace apps/admin -- Dialog
  ```

- [x] 3.2 CMP-17 `Toast` and `ToastProvider` (`apps/admin/src/components/Toast/`): a root `<div role="status">` at z.toast with fill color.toast.bg, text color.toast.text and action color.toast.action, lasting motion.toast.duration (4000 ms, or 6000 ms with an action, D-134). Mount `ToastProvider` in `apps/admin/src/app/layout.tsx`. It is used for "Copied".

  ```powershell
  npm run test --workspace apps/admin -- Toast
  ```

- [x] 3.3 CMP-27 `ConfirmDialog` (`apps/admin/src/components/ConfirmDialog/`), built on Dialog, with props `title`, `body`, `actionLabel`, `tone: "danger" | "primary"`, `typedConfirmation?: string`, `disabledReason?: string` and `onConfirm: () => Promise<{ ok: true } | { ok: false; message: string }>`. Standard confirm: Cancel and the action Button (Danger for Ban, Reset password and Purge; Primary for Unban, Restore and Create). Typed confirm: a TextField labeled "Type <username> to confirm" and an action that stays disabled until the value equals `typedConfirmation` exactly. Loading: the action shows its loading state and Cancel is disabled until `onConfirm` settles. Error: the message appears in the dialog's ErrorState. With `disabledReason`, the action is disabled and the reason is shown, for example "The owner's account can't be banned or deleted." (D-108).

  ```powershell
  npm run test --workspace apps/admin -- ConfirmDialog
  ```

- [x] 3.4 CMP-26 `AdminForm` and `GeneratedPasswordPanel` (`apps/admin/src/components/AdminForm/`). AdminForm: a card with a maximum width of 560, padding space.7 (24), a title.md heading, fields stacked 16 apart and right-aligned buttons. GeneratedPasswordPanel: fill color.warning.bg, radius.md, padding 16, the admin.warning icon and "This password is shown once. Copy it now." in body.sm color.warning.text; the password in mono 16 color.text.primary on color.bg.app with padding 8 and radius.sm; buttons Copy and Regenerate (before Create) or Copy and "Download as CSV" (CSV). Copy uses `navigator.clipboard.writeText` and shows the "Copied" toast. The password exists only in the screen's React state and is dropped when the screen unmounts (D-105).

  ```powershell
  npm run test --workspace apps/admin -- AdminForm
  ```

- [x] 3.5 CMP-28 `AuditView` (`apps/admin/src/components/AuditView/`): a FilterBar with an Action select ("All actions" plus the action names of proposed D-172) and the "Filter by target" search, above a DataTable with the ADM-07 columns and widths 18%, 18%, 18%, 12% and 34%: Time (`YYYY-MM-DD HH:mm:ss` in the local time zone), Action (mono), Target username, Result (StatusPill Success or Failed) and Detail (body.sm). Each row has an IconButton "Show detail" or "Hide detail" that expands the full detail text in mono body.sm on color.bg.surface.

  ```powershell
  npm run test --workspace apps/admin -- AuditView
  ```

- [x] 3.6 CMP-29 `UsageBar` and `JobPanel` (`apps/admin/src/components/UsageBar/`, `apps/admin/src/components/JobPanel/`). UsageBar props: `name`, `used`, `limit`, `unit: "bytes" | "count"`, `action?: string`, `enteredByHandOn?: string`. It shows "<used> of <limit> (<p>%)" in body.sm and an 8 high bar with radius.full on a color.border.subtle track; the fill is color.brand.primary below 80%, color.warning.bar from 80% to 99% with the admin.warning icon and "80%+", and color.danger at 100% or more with the status.failed icon and "Limit reached" (D-45). Under an amber or red bar it shows the `action` text in body.sm color.text.primary, and "Entered by hand on <date>" when that prop is set (D-107). Byte values use the D-116 units (MB and GB with two decimals). JobPanel props: `title`, `lastRun?: string`, `due: "ok" | "due" | "overdue"`, `running: boolean`, `blockedReason?: string`, `logLines: string[]`, `failed: boolean`, `onRun`, `onRetry`, `onRetryFailed?`. It is a card with "Last run <date>" and a Due or Overdue StatusPill and the run Button; while running, an indeterminate 4 high bar and an 8-line mono 12 log area; on failure, a Failed pill, the last log lines and Retry; when blocked, "Another job is running" or the missing-tool text.

  ```powershell
  npm run test --workspace apps/admin -- UsageBar JobPanel
  ```

**Deliverables:** Dialog, Toast, ToastProvider, ConfirmDialog, AdminForm, GeneratedPasswordPanel, AuditView, UsageBar and JobPanel with tests.

**Acceptance criteria**

Tests: AT-03, AT-10; T-48 (usage display half).

- [x] UsageBar with 400 of 500 shows "80%+" with the admin.warning icon; 499 of 500 is still amber; 500 of 500 shows "Limit reached". (Yes or no; display half of T-48.)
- [x] ConfirmDialog with `typedConfirmation="testuser"` keeps the action disabled for "TestUser" and enables it for "testuser". (Yes or no.)
- [x] After GeneratedPasswordPanel unmounts, no element shows the password (`screen.queryByText` returns null). (Yes or no.)
- [x] Dialog returns focus to the opener after Escape. (Yes or no.)
- [x] Under `prefers-reduced-motion: reduce`, the running JobPanel bar does not move; only a 100 ms fade remains (D-134). (Yes or no.)

**Exit gate**

```powershell
npm run test --workspace apps/admin; npm run lint --workspace apps/admin; npm run admin
```

**Risks and fallbacks**

- `navigator.clipboard` needs a secure context. Assumption AS-4: browsers treat `http://127.0.0.1` as a secure context. Fallback: select the password text and show "Press Ctrl+C to copy".

**Phase 3 progress — 2026-11-15 (Asia/Manila)**

Phase 3 is **Complete — 100% (6/6 steps)**. All five acceptance criteria are met. Overall admin-plan implementation progress is **23% (32/137 numbered steps, rounded)**; aggregate DoloGram project progress is not established by this admin-only work. Phase 4 is ready to start and remains untouched.

Implemented Dialog; Toast/ToastProvider (mounted at the root); ConfirmDialog; AdminForm/GeneratedPasswordPanel; AuditView; UsageBar/JobPanel. All use shared semantic tokens and system theme per D-109. Confirmations enforce exact typed matching, disable dismissal/duplicate calls while pending, reset per opening and show returned errors or a safe exception message. Clipboard denial selects the password and shows the prescribed keyboard fallback; passwords remain caller-owned React state with no persistence and disappear on unmount. Toasts replace rather than accumulate, expire at 4000/6000 ms and clean up timers; while a native modal is open the toast portals into its top layer, then returns to the body. Its bounded-lifetime observer disconnects on unmount. AuditView consumes caller-controlled pages/filters and safe text, with hydration-safe browser-local timestamps and expandable detail. Usage thresholds use the unrounded ratio; job progress waits 300 ms, displays only the latest eight log lines and stops motion under reduced motion.

Workflow, classification and evidence mapping: `Plans/context/DoloGram_Admin_Web_Phase_03_Context_Index.md`. Evidence under `supabase/repomix/admin-phase-03-20261115/` contains recoverable working-copy snapshots/patch/status, scoped cached Repomix 1.18.1 XML/log/selectors, input/final hashes, original-source comparisons, exact check logs, screenshots and browser results. All 24 uncompressed packet entries were read in bounded continuations and verified against original sources; security scan clean. No repository-instruction conflict. The existing admin workspace and Phase 2 prerequisites were confirmed in code and baseline tests, superseding the historical scaffold-absent context. Shared space.7 is 28 px, so that token wins over the stale 24 px parenthetical. AuditView accepts action names from its caller because the server-only D-172 registry belongs to Phase 6; its fixture verifies all 17 plan names without creating a competing production registry. Individual plan commands filter test filenames; the new component coverage is `actions.test.tsx` or the full suite.

Verification: baseline admin ESLint, Stylelint, typecheck, 57 tests and production build PASS. Final ESLint/Stylelint/typecheck PASS with zero diagnostics; final suite PASS **83/83 tests** (26 new). Final production build PASS. Chrome component fixture PASS in light/dark using actual local fonts: native modal/400 and 520 px widths, initial field/Cancel focus, Escape and opener restoration, exact typed matching, pending dismissal protection/error display, toast layering, clipboard write/selected-text fallback and unmount removal, action/search/pagination/detail controls, browser-local time, 79.9/80/99.9/100 percent colors plus icons/text, 8/4 px bars, eight-line log and reduced-motion static bar with 100 ms fade. Zero browser warnings, console errors or page errors; screenshots visually inspected. The five acceptance criteria map respectively to steps 3.6, 3.3, 3.4, 3.1 and 3.6 and all PASS.

Exit-gate accommodation: `npm run admin` built successfully, but its startup encountered an existing unrelated listener at 127.0.0.1:3100 (EADDRINUSE). That process was preserved. Production startup/HTTP 200/title/root-provider integration were instead verified against the final build with the installed Next CLI on temporary **127.0.0.1:3113**, in both schemes, with zero console diagnostics. This changes only the verification port, not application scripts/binding or phase scope; production behavior and source checks satisfy the exit gate. The literal port-3100 launch is recorded as an environment conflict, not as passed. Before the owner's next `npm run admin`, release that port through the owning service or use the existing intended admin process. No manual feature acceptance remains. Temporary browser/fixture/production processes closed successfully; the pre-existing service remains untouched.

Diagnostic history is retained: an invalid semantic icon name and CSS class naming violation were corrected; test-only missing jsdom dialog methods and cleanup ordering were diagnosed and fixed without weakening native acceptance. The browser fixture's extra Shift+Tab containment assertion incorrectly treated Chrome's browser-chrome focus as an app escape; native modal state, Tab navigation and Escape/focus restoration pass. Sandbox loopback denial was resolved with host execution. Final review confirms 22 unchanged packet entries, only additive strings/root provider edits to existing source, 15 new component files and one test file; selected-phase-only plan changes. No dependencies, new routes, mobile/shared changes, backend mutations, migrations, commits, pushes, deployments or external configuration changes. Later backend/backup/release gaps and existing mobile checks/advisories remain outside scope and were not rerun.

### Phase 4: Account sign-in and database admin authorization

**Profiles.roles revision — 2026-11-15:** Authoritative storage: `public.profiles.roles` is the only application-admin role source. `admin` extends the existing normal account; promotion/demotion changes only this column. Migration 041 is applied and verified remotely after explicit scoped user approval; all seven existing profiles remain user. No `private.account_roles` table is to be created.

- **Goal:** Sign in with an existing DoloGram account and grant admin access only while its protected database application role is `admin`. No separate admin passcode or owner-ID environment setting.
- **Depends on:** Phase 3 and the protected account-role prerequisite established in 4.1. Remote application/promotion remains a separately authorized step.
- **Implements:** the 2026-11-15 user access-model revision, ADM-01, loopback exposure controls, account-based T-44/AT-04 replacements. Supersedes the retired passcode implementation and its completion claims.

**Steps — nine equal-weight items retained**

- [x] 4.1 Establish and verify `public.profiles.roles`. Migration 041 adds non-null text with default `user` and a check allowing only `user`/`admin`; existing and new normal profiles receive `user`. The invoker trigger permits role changes only to trusted database SQL roles, rejects ordinary-client promotion/demotion and spoofed claims, and leaves normal profile RLS/edit permissions unchanged. Preserve the same Auth/profile UUID and all ordinary-account capabilities when promoted. Existing Auth metadata projection must neither grant admin on signup nor overwrite an existing admin role during profile sync. Local/remote history 001–040 and the absent hosted column were confirmed; 041 and isolated PostgreSQL permission/default/metadata/identity tests pass. The user explicitly approved applying only 041. It is now applied to the linked target and hosted column/default/check/trigger/RLS, unchanged seven-profile count and normal update grant are verified. All seven profiles are user. This step is complete; the remaining application sign-in work is not. No private role table and no remote fixture promotions.

- [x] 4.2 Document and verify promotion/demotion on the existing `public.profiles` row. After migration 041 is applied, a trusted operator locates the existing profile by verified `user_id` and changes `roles` from `user` to `admin`, or back to revoke additional admin access. Do not create another Auth user/profile or alter normal chat/memo memberships, credentials, content or account identity. The plural column holds one application role; `admin` includes the same normal-account capabilities as `user`. No admin signup UI, separate passcode, env owner UUID or private role table. Test only disposable account promotions; obtain the intended real account identity and authorization before changing a real row. Never edit `auth.users.role` or user-editable metadata to grant application admin.

- [x] 4.3 Replace passcode verification with existing-account Supabase Auth sign-in. Read version-matched docs for the pinned SDK and Next release before implementation. Validate bounded username-or-email/password input server-side, resolve usernames privately to Auth emails through parameterized SQL, authenticate through Auth, obtain the verified UUID, and query its protected current application role. Unknown/ordinary/disabled accounts and unavailable identity/role sources fail closed with fixed user-facing errors. Keep authentication-client session state separate from privileged service clients. Keep all tokens, credentials and service keys out of bundles, logs, audit and browser-readable state. Backend configuration stays server-only and lazy; remove both retired variables from active parser/config-status requirements.

- [x] 4.4 Bind bounded local admin sessions to the verified Auth account. Preserve opaque random cookie IDs, HttpOnly/SameSite=Strict, loopback HTTP cookie behavior, eight-hour idle expiry, bounded state and explicit activity semantics; passive API/RSC/prefetch requests must not extend idle time. Keep any necessary Auth tokens server-side, with bounded expiry/refresh behavior. Verify current Auth identity and the live `public.profiles.roles = 'admin'` authorization before privileged requests so a demotion is effective without waiting for a stale claim/token or a local restart. Old anonymous passcode cookies must be rejected, including across the upgrade. Restart ends local sessions. Local sign-out revokes/removes its own cookie/session even when Supabase is unavailable.

- [x] 4.5 Adapt request guards, action registry and Proxy. Keep exact Host `127.0.0.1:3100` and mutation Origin `http://127.0.0.1:3100`, including sign-in and local sign-out. Unknown action names fail closed. Public sign-in accepts credentials but performs its own identity/admin-role validation before minting a session. Every privileged action/page/query/API/job-control call requires the current verified admin identity/role directly; layout and Proxy remain supplementary. The local sign-out exception may validate/revoke local state without a database lookup, but cannot perform privileged business work. APIs use typed 401/403, not HTML redirects. Bound sign-in abuse/rate limits and state without enabling one ordinary account to indefinitely lock out every administrator. Test denial before application mutations.

- [x] 4.6 Replace ADM-01 with an account sign-in screen. Use existing themed accessible components, a text field labeled “Username or email” with username autocomplete, a password field with current-password autocomplete and a pending submit state. Show validation, invalid credentials, ordinary-user denial and backend-unavailable errors clearly without exposing credentials or internal diagnostics. Prefer the explicit `/sign-in` route; retire `/unlock` or retain only a safe legacy redirect. Already-authorized admins may enter the application. No passcode helper or owner-ID setup instruction appears in the UI. Verify keyboard operation, light/dark schemes and edge states.

- [x] 4.7 Replace Lock now with account Sign out. Revoke local admin-session state, clear the cookie and navigate to sign-in. Put the temporary button on the existing bootstrap/Overview page; Phase 5 later places it in the header. Guard the bootstrap data itself before querying configuration. Verify that the old cookie cannot re-enter, sign-out works during a backend outage, and no background activity revives the old session. Derive actor/target identity from Auth plus database role; no env UUID fallback.

- [x] 4.8 Remove superseded passcode paths only after caller/source discovery and replacement verification. This includes the passcode verifier/helper, `admin:hash`, obsolete bcrypt-only dependencies, old environment parser requirements, public-passcode registry policy, Unlock UI/messages and retired fixtures/tests. Reuse shared Host/Origin, cookie, session and themed-component behavior where valid. Update README/example and later-phase identity/audit/Admin-pill contracts. Do not remove another consumer's bcrypt dependency or weaken any guard merely to make checks pass.

- [x] 4.9 Run the role-based acceptance suite against an identified isolated backend and final production build. Use existing-account ordinary/admin fixtures, protected database role changes, explicit process/config identity, synthetic credentials, no password-bearing traces/screenshots/video/payload diagnostics, no existing-server reuse, bounded requests and no production clock/backdoor endpoints. Cover promotion, normal-user denial, self-promotion denial via every client path, demotion with a still-live cookie/token, identity expiry/revocation, forged-cookie/direct-action/API/RSC bypasses, wrong Host/missing or foreign Origin, idle/activity behavior, sign-out and backend outage. Run affected baseline/final lint/CSS/type/tests/build once with justified repeats only. Preserve existing user services, clean owned processes/fixtures and record actual results. Physical/remote-owner-only gates stay pending rather than passed.

**Acceptance criteria — new-model evidence required**

- [x] An existing account promoted in the protected database role source signs in with its normal account credentials and opens admin routes; no account recreation or env admin identity is required.
- [x] An authenticated ordinary user and every unauthenticated/forged/expired session are denied on pages, RSC, APIs and direct actions. The application never trusts a client-supplied role.
- [x] Ordinary users cannot self-promote through signup/user metadata, profile updates, direct API/table writes or RPCs; only trusted database access changes roles.
- [x] Demoting a signed-in administrator to `user` denies its next privileged request despite the still-live cookie/token; role/identity verification failures and backend outages fail closed.
- [x] Wrong Host and missing/foreign mutation Origin are refused before effects, including sign-in/sign-out. Exact loopback binding and cookie protections remain intact.
- [x] Eight-hour idle expiry, explicit activity extension and passive polling semantics pass; Sign out revokes local state, including during a backend outage, and old/passcode-era cookies cannot re-enter.
- [x] Both removed variables, separate passcode setup, obsolete auth paths and unused dependencies are absent from the completed implementation's active configuration/UI/callers; authenticated actor identity and Admin target protection come from the account/database role.
- [x] Loading/error/empty/pending states, input bounds, both system schemes and actual browser/server diagnostics pass with no introduced regressions or credential leakage.

**Exit gate:** all nine revised steps and all eight acceptance criteria above have verified evidence, including isolated database permission/demotion tests and final production/browser checks. Establish runnable commands from the actual implementation; old passcode-test success alone cannot pass this gate. No Phase 5 work before this gate.

**Progress / status — 2026-11-15 (Asia/Manila)**

**Complete: 9/9 revised steps, 100% of Phase 4. All eight acceptance criteria met in the identified isolated environment.** Overall verified admin-plan progress is **41/137 steps (30%)**; aggregate DoloGram project progress remains undetermined. Phase 5 is ready to start and was not started. No real account was promoted, no hosted migration/configuration changed, and no commit/push/deployment occurred.

**Dated execution note — 2026-11-15:** Replaced the retired access model with existing-account email/password sign-in, server-only Auth state, current profiles.roles authorization, account-bound opaque sessions and local Sign out. Privileged entry points verify Auth UUID, current role, Auth session existence/deadline and account ban/deletion state. Host/Origin checks and unknown-action denial remain direct guards. Ordinary-account normal access is unchanged; trusted promotion changes only roles. Removed the obsolete verifier/helper/script/dependencies/parser/UI/fixtures after caller discovery. /unlock is only a compatibility redirect. README documents verified existing-row promotion/demotion and future actor/Admin-target contracts; no later business operation or navigation shell was implemented.

Workflow: Git baseline → scoped ripgrep → reusable Reader context validation → root-config cached Repomix 1.18.1 → complete XML analysis → original-source/versioned-doc verification. Recoverable working-copy snapshots/patches and source identities are under supabase/repomix/admin-phase-04-account-20261115/. The uncompressed 22-entry packet was completely read in bounded ranges 1–200, 201–400, 401–600, 601–800, 801–877; all bodies matched original sources. No instruction conflict. Stale passcode statuses and the earlier 11% synopsis above are historical; this selected-phase status supersedes them. Only this phase's progress/checklists changed in this execution.

| Verification / acceptance | Actual result |
|---|---|
| 1: existing account promoted in place enters admin | MET — Chrome fixture uses the same UUID/password before/after trusted promotion; ordinary denial first, then successful admin sign-in; profile fields and Saved Messages unchanged; normal Auth/profile access retained |
| 2: ordinary/unauthenticated/forged/expired denial | MET — direct page/RSC/API and every business registry guard tested; no client role authority; actor contains only verified UUID/local session ID |
| 3: no self-promotion | MET — existing isolated SQL permission suite PASS; actual Auth signup/user metadata, Data API profile writes and RPC attempts denied; application admin still cannot edit roles |
| 4: demotion/revocation/outage | MET — live cookie immediately denied after trusted demotion, deleted Auth session, ban or Auth deadline; unavailable backend fails closed |
| 5: Host/Origin | MET — real browser action replays reject missing/foreign Origin for sign-in/sign-out; wrong Host denied including assets and forwarded spoof; unit guards deny before effects |
| 6: expiry/activity/sign-out | MET — exact eight-hour idle boundary and passive API semantics, explicit activity extension, token expiry units, forged/restarted/evicted/revoked IDs, concurrent sign-out safety, offline local revocation and old-cookie denial |
| 7: retired paths / actor identity | MET — source discovery confirms both removed variables/helper/passcode policy/dependencies absent from active implementation; /unlock redirects; future Ban/Delete protection remains a later-phase contract, without speculative mutations |
| 8: UI/states/diagnostics | MET — bounded/duplicate/file input validation, pending/failed/retry states, password clearing, keyboard order, both system schemes/fonts/400px card; browser success flow has zero console/page warnings/errors; final server startup has no warnings or credential payload diagnostics |
| Baseline / final checks | Baseline lint/CSS/admin+core types/core 41 tests PASS. Default admin suite: baseline 107 pass + 1 pre-existing theme-lint 10s timeout; final 106 pass + same timeout (retired tests replaced). Theme test independently PASS 2/2 with bounded 30s allowance, no source suppression/timeout change. Final core 36/36 PASS; final lint/CSS/types PASS. Initial build prerender EPERM was a filesystem sandbox denial; final host production build PASS. No new failures |
| Production browser / isolation | PASS 6/6 Chrome tests in 24.2s against final build; PostgreSQL 17.6, GoTrue 2.197.0 and PostgREST 14.5 are disposable and explicitly identified. No traces/screenshots/video, production test routes or existing-server reuse. Owned runner removes its containers/network/services. Existing 127.0.0.1:3100 owner service preserved; testing transport retains exact logical Host/Origin on owned 3114/3115 |

Non-obvious decisions: local sessions retain only the access token, never a refresh token. Eight hours is the maximum idle window, further bounded by Auth access-token expiry; fresh sign-in is required then. No background refresh/polling extends it. Sign out always revokes local state and does not sign normal mobile/user-web sessions out. Sign-in has a fixed per-normalized-identifier five-attempt/five-minute window (updated from email-only in the connection/sign-in follow-up), four concurrent attempts and bounded limiter/session storage, without a process-wide failure lockout. The upgraded cookie and global-store names reject anonymous passcode-era sessions. SQL uses verified TLS for hosted targets, parameterized queries and bounded timeouts. No dependencies added; bcrypt-only dependencies removed, unrelated tsx retained.

Remaining/manual: real account selection/promotion and hosted owner sign-in were intentionally not performed; they require the owner's verified target and separate authorization. They are operational setup/release checks, not substituted for isolated acceptance. Mobile/device, business mutations, full release matrix and later routes remain their owning phases. The pre-existing default theme-test timeout remains separately recorded. Evidence: context-index.md, identities-before.json, baseline-0..6.log, permission-tests.log, final-0..5.log, theme-bounded-check.log, build-final.log, browser-final.log, review-lint.log and review-types.log under the evidence root. The exact reproducible browser command is documented in apps/admin/README.md.

Historical schema/restart evidence follows unchanged.

**Schema/restart execution evidence — 2026-11-15:** identified and stopped the old DoloGram admin dev process, restarted it hidden in apps/admin on loopback 3100, verified HTTP 200 with passcode input disabled and no retired hash settings. Prepared 041_add_profile_roles.sql and supabase/tests/profile_roles.sql; isolated PostgreSQL 17 tests pass for default/backfill, constrained values/null rejection, trusted promotion/demotion, normal profile access, unchanged identity/fields, preserved Saved Messages, metadata sync and self-promotion/claim-spoof denial. Shared baseline/final 289 tests pass with unchanged pre-existing Vite/SQLite warnings; all five workspace typechecks pass. Linked history 001–040 matches and remote dry-run selects only 041. Automatic approval review initially rejected remote apply under earlier limits; the user then explicitly approved only 041, which applied successfully. Hosted catalog verifies the required default/check/invoker guard, unchanged RLS/policies/normal update grant, seven user profiles, recorded migration 041 and matching tested Auth-projection source. No real account was promoted and no later phase was implemented. Full artifacts: supabase/repomix/profile-roles-20261115/.


**Approved completion evidence — 2026-11-15:** only 041_add_profile_roles.sql was applied after an approval-scoped dry run reconfirmed its exclusive pending scope. No seeds/custom DB roles/account promotions were applied. Read-only hosted verification passes; no production data fixtures or test promotions were run. The requested dev server remains running and API/session denial returns 401; the isolated test container was removed, other Docker workloads preserved. User-facing account sign-in replacement remains Phase 4 work.

### Phase 5: Admin shell and navigation

**Profiles.roles revision — 2026-11-15:** Use account Sign in/Sign out and a server-derived acting identity. Admin-web routes require a current verified Auth account with `profiles.roles = admin`, while the same account continues normal mobile/user-web use. Legacy Unlock/Lock-now navigation is retired: the shell exposes account Sign out only; no env owner ID or cached client role is used.

- **Goal:** Provide the shared layout of every unlocked screen and the eight routes of 12.6.
- **Depends on:** Phase 4.
- **Implements:** 11.4 Navigation, 12.6 (admin routes and shell), 12.7 (admin row), D-135, D-136, CMP-21 (admin header variant).

**Steps**

- [x] 5.1 Route group. The Overview page moved to `apps/admin/src/app/(admin)/page.tsx`, which keeps the Phase 4 account/config bootstrap body until Phase 13 replaces it. `apps/admin/src/app/(admin)/layout.tsx` is a server component that calls `requirePageSession()` first and then renders the shell; the exported guard is `requirePageSession`, not the `requireSession()` the step named. The seven route files of 12.6 exist under `(admin)`: `accounts/page.tsx`, `accounts/new/page.tsx`, `accounts/import/page.tsx`, `accounts/[userId]/page.tsx`, `maintenance/page.tsx`, `audit/page.tsx` and `settings-check/page.tsx`. Each shows its page title in title.lg through `PageTitle` and the EmptyState "Built in Phase <n>" until its phase replaces it. Verification: `npm run build --workspace apps/admin` lists `ƒ /`, `ƒ /accounts`, `ƒ /accounts/[userId]`, `ƒ /accounts/import`, `ƒ /accounts/new`, `ƒ /audit`, `ƒ /maintenance` and `ƒ /settings-check`.

- [x] 5.2 `Sidebar` (`apps/admin/src/components/Sidebar/`): 240 wide, fill color.bg.surface, "DoloGram Admin" in title.md at the top, and the items Overview (`admin.overview`, `/`), Accounts (`admin.accounts`, `/accounts`), Maintenance (`admin.maintenance`, `/maintenance`), Audit log (`admin.audit`, `/audit`) and Settings check (`admin.settingsCheck`, `/settings-check`). Items are 40 high with an icon at icon.md and body.md text; the current item has fill color.bg.selected, text color.brand.primary and `aria-current="page"`. It is a `<nav aria-label="Admin">` client component that reads `usePathname()`; `isCurrentPath` keeps every `/accounts` path on Accounts and matches Overview exactly. Verification: `npm run test --workspace apps/admin -- admin-shell` (3 Sidebar cases).

- [x] 5.3 Rail below 1024 px. `Sidebar.module.css` uses `@media (width <= 1023px)` — stylelint's standard config requires range notation, and behavior is identical to `max-width: 1023px` — to set width 64, keep item labels as accessible names through clip-based hiding, and show an `aria-hidden` tooltip in `position: fixed` at `--dg-z-sticky` on hover and keyboard focus. Shared tokens define no `z.menu`, so the recorded risk fallback uses the sticky layer. No JavaScript width check decides the layout. Verification: build plus the browser suite's 1024/1023 width, hover and keyboard tooltip assertions.

- [x] 5.4 `AdminHeader` (CMP-21 admin header variant, `apps/admin/src/components/AdminHeader/`): a `<header>` 56 high with the project label on the left in mono and, at the right, the Secondary Button account Sign out wired to the guarded `signOut` action. Per the 2026-11-15 revision and Phase 4 step 4.7 the retired "Lock now"/`lockNow` control is not restored; the header renders the existing `SignOutButton` (Secondary, `action.signOut` icon, pending and failure states) through an `action` slot, and the duplicate temporary button was removed from the Overview body. The project label comes from `apps/admin/src/server/projectLabel.ts`, which reads `SUPABASE_PROJECT_REF` inside the server-only boundary (D-169) and shows "Project not configured" when unset; Phase 13 replaces it with `getProjectSummary()`. Supabase calls in this phase: none. Verification: `npm run test --workspace apps/admin -- admin-shell` (2 AdminHeader cases).

- [x] 5.5 Content area: padding space.8 (32), maximum width 1200 and `#admin-content` as the skip target. The "Skip to content" link is the first focusable element, is visually hidden until focused, and moves focus to the focusable `<main>`; the shell applies the 12.8 focus-order rule. Verification: browser keyboard test.

- [x] 5.6 `apps/admin/tests/e2e/navigation.spec.ts` passes. It signs in with a disposable existing account (the retired Unlock step no longer exists), then checks each destination opens its route with `aria-current`, the 1024/1023 widths, rail tooltip visibility on hover and keyboard focus, 32 by 32 px targets, the 1280 px Tab order (Skip link, five items, Sign out, then the content) and that all eight admin routes redirect to `/sign-in` without a session.

**Deliverables:** the `(admin)` layout, the eight routes, Sidebar, AdminHeader, PageTitle and `navigation.spec.ts`.

**Acceptance criteria**

Tests: none in v14; navigation.spec.ts.

- [x] Each of the eight routes of 12.6 renders behind the account-session gate. (Yes; `navigation.spec.ts` "every admin route stays behind the account session gate" plus the build route table.)
- [x] The sidebar is 240 wide at 1024 px and 64 wide at 1023 px. (Yes; computed-width assertions in `navigation.spec.ts`; D-135.)
- [x] Every sidebar item and the header Sign out have a target of at least 32 by 32 px. (Yes; measured boxes in `navigation.spec.ts`; D-136.)
- [x] The browser tab title is "DoloGram Admin" on every route. (Yes; asserted per route in `navigation.spec.ts`; 12.1.)

**Exit gate**

```powershell
npm run build --workspace apps/admin; npx --workspace apps/admin playwright test
```

Passed: build exit 0 and 10/10 browser tests (6 Phase 4 access tests plus 4 Phase 5 navigation tests) in 27.3 s, rerun after the nested-`<main>` fix. The harness PostgreSQL/Auth/PostgREST containers and network were created under the `admin-phase-05-navigation-20261115` label and removed in `finally`; the owner's 127.0.0.1:3100 service was neither reused nor stopped.

**Risks and fallbacks**

- The sidebar's overflow clips the rail tooltips: render them with `position: fixed` at z.menu. Applied with `--dg-z-sticky`, because shared tokens define no `z.menu`.

**Progress / status — 2026-11-15 (Asia/Manila)**

**Complete: 6/6 steps, 100% of Phase 5. All four acceptance criteria met; the exit gate passes against the identified disposable backend and the final production build.** Overall verified admin-plan progress is **47/137 steps (34%)**. Phase 6 is ready to start and was not started. No real account was promoted, no hosted migration or configuration changed, and no commit/push/deployment occurred.

Workflow: Git baseline (`apps/admin` and `packages/admin-core` are untracked work from earlier phases; the plan already carried user edits) → scoped `code_search` discovery in `apps/admin` and `packages/shared/src/theme` → reuse of Phase 4 source context for guards, session, request policy and tests → bundled Next 16.4.6 route-group and `usePathname` documents → original-source verification. A scoped Repomix 1.18.1 packet (38 files, 11,942 tokens) was generated to `supabase/repomix/admin-phase-05-20261115/phase-05.xml` and read in bounded ranges; its directory structure and file bodies matched the working-copy sources with no unexplained omission, and `.env` files, fonts and unrelated directories were correctly excluded. Pre-existing user changes outside this phase were not modified.

| Verification | Actual result |
|---|---|
| Baseline before edits | Partial — `lint`, `lint:css`, `typecheck` (apps/admin and packages/admin-core) all exit 0. The unit-suite baseline was not separately captured before editing; see the final row. |
| Final lint / CSS / typechecks | PASS — `lint`, `lint:css`, `typecheck --workspace apps/admin` and `typecheck --workspace packages/admin-core` all exit 0 |
| Unit suite | PASS — 112/112 tests in 9 files (~8.9 s), including the previously timing-sensitive theme-lint test (~6.0 s) |
| Production build | PASS — exit 0; route table contains all eight admin routes plus `/sign-in`, `/api/session`, `/unlock`, `/icon.svg` |
| Browser exit gate | PASS — `playwright test` 10/10 (6 Phase 4 regression, 4 Phase 5) in 27.3 s; disposable PostgreSQL 17.6 / GoTrue 2.197.0 / PostgREST 14.5 on 3120–3123 plus the transport/production ports 3114/3115 |
| Owner service preserved | `http://127.0.0.1:3100/sign-in` returns 200 and `/` returns the expected 307 redirect to `/sign-in` after the production build |

Non-obvious decisions: the layout guard is supplementary (every privileged page and action keeps its own verification), so the Overview page retains its Phase 4 `requirePageSession()` call and bootstrap body. `AdminHeader` receives the session control through an `action` slot so `components/` never imports from `app/`. The temporary Overview Sign out button was removed in favour of the header control, which is the single "Sign out" element the Phase 4 action-replay and shell assertions expect.

Discrepancies recorded: step 5.1 named `requireSession()` (actual `requirePageSession()`); step 5.4 named "Lock now"/`lockNow` (retired by the 2026-11-15 revision in favour of account Sign out, per Phase 4 step 4.7); step 5.3 named `max-width: 1023px` (stylelint requires the equivalent range notation); the risk fallback named `z.menu`, which does not exist in the shared tokens; step 5.6 referred to unlocking (now account sign-in). No repository instruction conflicts with this phase.

Remaining/manual: none for this phase. The Overview body, the header project summary and the accounts/maintenance/audit/settings bodies remain their owning phases (6–15). Real-account promotion and hosted owner sign-in remain owner-attended operational steps recorded under Phase 4.

### Phase 6: Audit trail and Audit log

**Profiles.roles revision — 2026-11-15:** Audit schema/actions must include the authenticated acting account UUID now that multiple existing accounts may be administrators. Authorization is checked from current profiles.roles before privileged writes. Direct trusted database role changes are not fabricated as actions of an app user; any future operator audit records must preserve their actual actor provenance.

- **Goal:** Create `private.admin_audit`, give admin-core one audit writer that every later action uses, and build ADM-07.
- **Depends on:** Phase 5.
- **Implements:** 6.2 (`private.admin_audit`), 6.6 Audit, ADM-07, D-106, CMP-28, M4-08 (migration `<next-sequential>_admin.sql`), 10.5 (the private schema is written over `SUPABASE_DB_URL`).

**Steps**

- [x] 6.1 Inspect target ledger/catalog for private.admin_audit. Local sources have no table. If present remotely, compare columns, constraints, indexes, schema/table/sequence grants and RLS before reuse. Existence cannot skip security tests. Resolve mismatches in a new sequential scoped migration during authorized execution.

- [x] 6.2 Create the M4-08 migration. Column names are those of 6.2 and D-106; the types are chosen here (AS-9). Contents of `supabase/migrations/<next-sequential>_admin.sql`:

  ```sql
  create table private.admin_audit (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    action text not null,
    target_user_id uuid,
    result text not null check (result in ('success', 'failed')),
    detail jsonb not null default '{}'::jsonb
  );
  alter table private.admin_audit enable row level security;
  revoke all on private.admin_audit from anon, authenticated;
  create index admin_audit_at_idx on private.admin_audit (at desc, id desc);
  create index admin_audit_target_idx on private.admin_audit (target_user_id);
  ```

  RLS is enabled with no policy, and the private schema is not exposed (D-106). The table is in the weekly export because `supabase db dump` covers every schema the dump includes (D-106; checked in Phase 14).

  ```powershell
  # Discover next sequential version per supabase/AGENTS.md during authorized execution.
  ```

- [x] 6.3 Add proposed admin_audit.test.sql covering RLS/no policies, schema/table/sequence grants and no client endpoint. Apply/test only on the confirmed disposable target. Before hosted apply obtain target/action authorization, take runbook backup, compare all pending versions and review exact migration. Generic db reset/db push against a linked/shared target is not a shortcut. Record additive recovery/audit preservation.

- [x] 6.4 Database client `packages/admin-core/src/db.ts`: `getSql()` returns one `postgres(getAdminEnv().SUPABASE_DB_URL, { max: 2, prepare: false, idle_timeout: 30 })` client cached on `globalThis` (proposed D-170; `prepare: false` because Assumption AS-5: the connection string may point at the Supavisor transaction pooler). Errors are re-thrown as `AdminDbError` with the Postgres `code` and a fixed message; the connection string never appears in an error.

  ```powershell
  npm run typecheck --workspace packages/admin-core
  ```

- [x] 6.5 Action names `packages/admin-core/src/audit/actions.ts` (proposed D-172): `session.unlock`, `session.lockout`, `account.create`, `account.import_csv`, `account.reset_password`, `account.ban`, `account.unban`, `account.delete`, `premium.set`, `project.restore`, `usage.manual_entry`, `settings.check`, `job.export`, `job.media_copy`, `job.purge_preview`, `job.purge`, `drill.done`. Each name has a TypeScript detail type; for example `account.create` has `{ username: string; source: "admin" | "script" }` and `job.media_copy` has `{ copied: number; skipped: number; failed: number }`.

  ```powershell
  npm run typecheck --workspace packages/admin-core
  ```

- [x] 6.6 Writer `packages/admin-core/src/audit/write.ts`: `writeAudit({ action, targetUserId, result, detail })` inserts one row with `getSql()`. Validate detail with action-specific allowlists, bounded values and fixed errors. Permit safe counts like pushTokens without credential values. SQL effects/audit commit together. Auth/Storage effects use operation identities/reconciliation under Section 0. On audit outage report applied effects and recovery, never blindly repeat creation/rotation. Session audit outages preserve Unlock/Lock now and reconcile afterward.

  ```powershell
  npm run test --workspace packages/admin-core -- audit
  ```

- [x] 6.7 Test setup for admin-core, performed immediately after 6.4 and before 6.5/6.6 tests. Add `vitest` to `packages/admin-core` and `packages/admin-core/vitest.config.ts` with `resolve.alias: { "server-only": "./tests/empty.ts" }` (an empty module), because the real `server-only` throws outside the React server environment. Tests supply the action/schema. account.create accepts its allowed username/source. Unknown/nested credential fields are rejected, while the declared safe pushTokens count is accepted. Inject SQL rollback and external-effect/audit outages and verify recovery. Configure the test-only server-only alias for apps/admin server unit tests too, preserving production import guards.

  ```powershell
  npm install -D vitest --workspace packages/admin-core; npm run test --workspace packages/admin-core
  ```

- [x] 6.8 Wire Phase 4 into the audit log: a successful unlock writes session.unlock and the fifth failure writes session.lockout with null target/empty detail. Audit outage uses a bounded owner-only pending event journal without session IDs/passcodes and reconciles by event identity. It must preserve local Unlock/Lock now availability. Test outage/restart reconciliation and no duplicate events.

  ```powershell
  npm run build --workspace apps/admin
  ```

- [x] 6.9 Reader `packages/admin-core/src/audit/list.ts`: `listAudit({ page, action, target })` runs

  ```sql
  select a.id, a.at, a.action, a.result, a.detail, p.username as target_username
  from private.admin_audit a
  left join public.profiles p on p.user_id = a.target_user_id
  where ($1::text is null or a.action = $1)
    and ($2::text is null or p.username ilike '%' || $2 || '%' escape '\')
  order by a.at desc, a.id desc
  limit 50 offset ($3 - 1) * 50;
  ```

  plus the matching `count(*)`. The target filter escapes wildcards and supports validated target IDs. A deleted/missing profile falls back to its target UUID or safe operation identity so rows remain filterable. It reads only permitted identity fields, never chats/messages. Validate page/action bounds and verify tied timestamps/deleted targets.

  ```powershell
  npm run test --workspace packages/admin-core -- listAudit
  ```

- [x] 6.10 ADM-07 screen `apps/admin/src/app/(admin)/audit/page.tsx`: a server component that reads `searchParams` `page`, `action` and `target`, calls `listAudit`, and renders AuditView (CMP-28). AuditView changes the URL with `router.replace` so the server re-renders; there is no client-side data cache. Empty: EmptyState with the admin.audit icon and "No actions yet" (12.5). Error: CMP-30 with Retry (`router.refresh()`). Data source: SQL over `SUPABASE_DB_URL` (no Supabase API call).

  ```powershell
  npm run admin
  ```

**Implementation record (2026-11-15)**

- 6.1 Local migrations, `supabase/tests` and shared database types contained no `private.admin_audit`; grep covers every migration. No hosted catalog was read because no hosted operation was authorized, so a remote table with a different shape stays an owner-attended check before any hosted apply.
- 6.2 Migration `042_admin.sql` (next sequential after 041). AS-9 types are `bigint` identity, `timestamptz`, `text`, `jsonb`; two audited columns were added by the 2026-11-15 revision and step 6.8: `actor_user_id` (verified account UUID, null only before authentication succeeds) and `event_id` (unique, defaulted, the reconciliation identity). `detail` is constrained to a JSON object. RLS is enabled with no policy; `public`, `anon` and `authenticated` lose all table and identity-sequence rights; both readers' indexes exist.
- 6.3 `admin_audit.test.sql` verifies RLS/no policies, table and sequence grants, idempotent `event_id` reconciliation, retained actor UUID, the result and detail constraints, and denial of an `authenticated` read/write. Run on disposable PostgreSQL 17.6 with a session marker, as the repository's plain-SQL tests are.
- 6.4 `db.ts` returns one process-global `postgres` client (`max: 2`, `prepare: false`, bounded connect/queue/query/statement timeouts, certificate-verified TLS except a confirmed isolated loopback target) and caches it before any later configuration read. `asAdminDbError` keeps only a bounded SQLSTATE in a fixed message.
- 6.5 All 17 D-172 names with one strict schema each. Detail is allowlisted, not blacklisted: unknown or nested fields such as `password` are refused while the declared `pushTokens` count is accepted.
- 6.6 `writeAudit` validates the event identity/result/actor/target/detail before any statement, inserts one row with `on conflict (event_id) do nothing`, accepts a transaction-scoped handle so SQL effects commit with the row, and maps failures to `AdminDbError`.
- 6.7 The existing `vitest.config.mts` was extended (not duplicated) with the test-only `server-only` alias to `tests/empty.ts`; the same alias was added to the admin test config. Coverage: 17 new core tests and 4 journal tests.
- 6.8 The retired passcode Unlock/Lock now flow is replaced by account sign-in, so a verified admin sign-in writes `session.unlock` with the authenticated actor UUID, and a refusal from the bounded per-email sign-in limiter writes `session.lockout` with no actor. `apps/admin/src/server/auditLog.ts` journals only retryable database failures in bounded (20) process-local state, never blocks the result, and reconciles by `event_id` on the next audit write or page load.
- 6.9 `listAudit` uses identical predicates for the page and the count, escapes LIKE metacharacters, accepts an exact target UUID, falls back to the retained target UUID when the profile is gone, bounds the page and ignores an unregistered action, and renders only allowlisted detail as `key=value` text.
- 6.10 The server page reads `page`/`action`/`target`, requires the account session, reconciles the journal and calls `listAudit`; `AuditClient` re-renders the server page with `router.replace` and shows CMP-30 with Retry when a hosted project reference provides a Dashboard link, otherwise ErrorState with Retry.

**Deliverables:** `supabase/migrations/042_admin.sql`, `supabase/tests/admin_audit.test.sql`, `db.ts`, `audit/actions.ts`, `audit/write.ts`, `audit/list.ts`, the admin-core test setup (`tests/empty.ts`, server-only alias), `apps/admin/src/server/auditLog.ts`, the ADM-07 page with its client view, and `apps/admin/tests/e2e/audit.spec.ts`.

**Acceptance criteria**

Tests: AT-05; prepares T-45 to T-48 and T-53 (audit rows).

- [x] `supabase test db` passes, including RLS on with no policy for `private.admin_audit`. (Yes; CLI 3.1.0 `test db` is pgTAP/local-stack only and this repository's SQL tests are plain psql, so `admin_audit.test.sql` passed on a disposable PostgreSQL 17.6 container applying the exact migration.)
- [x] An API read of `admin_audit` with user A's session fails or returns no rows (the private schema is not exposed). (Yes; a normal user's PostgREST request is refused, and the SQL test proves no client table/sequence grants.)
- [x] Unlocking writes one `session.unlock` row, which ADM-07 shows newest first. (Yes; the revised account model replaces passcode unlocking with a verified admin sign-in. The browser suite asserts exactly one row for the actor and that `/audit` shows it on the first row.)
- [x] Filtering by action `session.unlock` shows only those rows; 51 rows produce two pages. (Yes; the browser suite filters, checks `1-50 of <total>` and 50 rows with no `session.lockout`, then `page=2` with the remaining rows.)
- [x] `writeAudit` refuses a detail containing a `password` key. (Yes; unit test, with no statement executed and no submitted value in the error.)

**Exit gate**

```powershell
# Disposable target only; the CLI's pgTAP runner needs a local stack this repository does not configure.
# Equivalent acceptance: apply 042_admin.sql to an isolated PostgreSQL 17.6 container, then
psql -c "set dologram.test_target = 'admin-audit-disposable'" -f supabase/tests/admin_audit.test.sql
npm run test --workspace packages/admin-core; npm run admin
```

Then sign in as a verified admin at `http://127.0.0.1:3100` and confirm that `/audit` lists the `session.unlock` row.

Passed: the SQL acceptance test on disposable PostgreSQL 17.6; admin-core 53/53 unit tests; the production build; and a 13/13 Chrome run (6 Phase 4 access, 4 Phase 5 navigation, 3 Phase 6 audit) in 33.4 s. The owner's `127.0.0.1:3100` service held the port, so the production build was served on the harness's 3115 behind the 3100-preserving transport; sign-in wrote `session.unlock` and `/audit` listed it first. Harness PostgreSQL/Auth/PostgREST containers and ports 3114/3115/3120–3123 were released in `finally`; the owner's service was neither reused nor stopped.

**Risks and fallbacks**

- `supabase db push` would also push unrelated pending migrations: run `supabase migration list` first and push only when every pending migration belongs to M4-08.
- The direct database connection is refused from the owner's network (IPv6 only): use the Supavisor session-pooler connection string in `SUPABASE_DB_URL` (AS-5).

**Progress / status — 2026-11-15 (Asia/Manila)**

**Complete: 10/10 steps, 100% of Phase 6. All five acceptance criteria are met; the exit gate passes in the adapted form recorded above against disposable infrastructure and the production build.** Overall verified admin-plan progress is **57/137 steps (42%)**. Phase 7 is ready to start and was not started. No real account was promoted, no hosted migration or configuration changed (migration 042 is authored but not applied remotely), and no commit/push/deployment occurred.

Workflow: Git baseline (`apps/admin` and `packages/admin-core` are untracked work from earlier phases; the plan carried user edits before this session) → ripgrep discovery in `supabase/migrations`, `supabase/tests`, `apps/admin` and `packages/admin-core` → reuse of Phase 4/5 verified context for guards, sessions and the harness → scoped cached Repomix 1.18.1 packet to `supabase/repomix/admin-phase-06-20261115/phase-06.xml` → complete packet analysis → original-source verification. The packet contains 14 entries read in bounded range and each entry body matches its working-copy source; `actions.test.ts` and `write.test.ts` were excluded by the security scanner (synthetic credential sentinels) and were reviewed directly in source. No repository instruction conflicts with this phase; `supabase/AGENTS.md` sequential naming is respected (042).

| Verification | Actual result |
|---|---|
| Baseline before edits | PASS — admin ESLint, Stylelint, admin/core typechecks, core 36/36 tests, admin 112/112 tests |
| Final lint / CSS / typechecks | PASS — admin ESLint, Stylelint, admin and admin-core typechecks exit 0 |
| Unit suites | PASS — admin-core 53/53 (17 new) and admin 117/117 (5 new) |
| SQL acceptance | PASS — disposable PostgreSQL 17.6; RLS/no policy, grants, sequence, idempotent identity, actor retention, constraint and authenticated denial |
| Production build | PASS — route table keeps all eight admin routes plus `/sign-in`, `/api/session`, `/unlock`; `/audit` is dynamic |
| Browser exit gate | PASS — 13/13 Chrome tests in 33.4 s; no console warning, console error or page error |
| Cleanup / ownership | Owned containers, network and ports 3114/3115/3120–3123 released; owner's 3100 service PID 47056 still answers 200 |

Non-obvious decisions: audit rows carry the verified actor UUID and a unique `event_id` (required by the 2026-11-15 revision and step 6.8's reconciliation), so the table is deliberately wider than AS-9's six columns. `session.lockout` is written when the bounded sign-in limiter refuses credentials because that is the replacement for the retired passcode lockout. The audit write is best-effort: a database outage journals at most 20 events without identifiers and reconciles them by identity, while a refused detail is dropped rather than retried forever. `getSql()` returns a seeded process-global client before reading configuration, which keeps the isolated harness on its disposable database; production still validates configuration on the first real call and a configuration change needs a restart.

Discrepancies recorded: `supabase test db` (pgTAP/local stack) is not configured in this repository, so the equivalent plain-psql runner is used; step 6.8's passcode Unlock/Lock now is retired in favour of account sign-in (implemented per the revision); step 6.10 asked for the DataTable empty text "No actions yet" (12.5) while the Phase 3 string said "No audit events found", so the shared string and its assertion were updated; `AuditView` needs a client wrapper for `router.replace`, so the page renders `AuditClient`; CMP-30 is used when a hosted project reference exists and ErrorState otherwise, including the isolated harness. The hosted migration apply, hosted catalog comparison and a real-account sign-in remain owner-attended steps and are explicitly *not* claimed.

Remaining/manual: apply `042_admin.sql` to the linked project only after the owner authorizes the hosted operation (compare pending migrations first); confirm the hosted catalog has no conflicting `private.admin_audit`; promote a real account before hosted admin sign-in (Phase 4 procedure).

### Phase 7: Accounts list

**Profiles.roles revision — 2026-11-15:** Select profiles.roles and show Admin for admin rows; user/admin rows are ordinary existing accounts, counted once. Derive identity from verified Auth, with no ADMIN_OWNER_USER_ID fallback/private-role join. Protect currently-admin Ban/Delete targets server-side using a fresh role read. Do not hide admins from normal profile/chat flows or equate chat/memo admin membership with global admin.

- **Goal:** Build ADM-03, the searchable and filterable list of every account.
- **Depends on:** Phase 6.
- **Implements:** ADM-03, F12, D-86, D-102, D-103, D-108 (Owner pill), CMP-24, CMP-25, CMP-31.

**Steps**

- [x] 7.1 Replace trigger-body heuristics with a verified capability contract. Obtain exact migrations/functions and isolated tests for forced-password denial/clearing and ban fallback under AB-02. Return trigger/initialPasswords only after verification, otherwise unsupported with create/reset/ban disabled and a clear prerequisite error. Read-only status can use Auth metadata. An absent trigger cannot imply an absent-table fallback.

- [x] 7.2 Create accounts/list.ts listAccounts({q,filter,page}) and getAccount(userId), reading allowlisted Auth/profile identity fields using profiles.user_id. Use Auth banned_until and raw_app_meta_data.must_change_password. Join fallback tables only if verified present. Project empty premium flags until Phase 19 because current schema lacks premium_flags. Status precedence is Banned, Must change password, Active. Parameterize/escape wildcard search, validate page/filter bounds, use identical count predicates and stable created_at desc/id order. Return 50 rows and reset page on filter change. Test older rows, missing profiles/optional schema, ties/stale pages and owner UUID. Redact failures.

- [x] 7.3 ADM-03 page `apps/admin/src/app/(admin)/accounts/page.tsx`: a server component reading `searchParams` `q`, `filter` (`all | active | banned | mustChange`) and `page`, and calling `listAccounts`. Layout (12.9): the page title "Accounts", Primary "Create account" (link to `/accounts/new`) and Secondary "Import CSV" (link to `/accounts/import`) at the right; then FilterBar with the placeholder "Search by username or email" and the chips All, Active, Banned, Must change password; then DataTable with the ADM-03 columns and widths: Username (mono, 14%, with the Owner StatusPill after it), Display name 18%, Email 22%, Created (date, 12%), Last sign-in (date and time, or "Never", 14%), Status (StatusPill, 10%), Premium (10%, empty until Phase 19). A row opens `/accounts/<user_id>`. Empty: "No accounts match" with the admin.accounts icon (12.5). Error: CMP-30 with Retry. Data source: SQL over `SUPABASE_DB_URL`.

  ```powershell
  npm run admin
  ```

- [x] 7.4 Add `apps/admin/tests/e2e/accounts.spec.ts` against the local stack with the M1-08 fixtures: the four test accounts A, B, C and G are listed; the search "user_b" (Assumption: the fixture usernames contain the test account letter; adjust the search term to the M1-08 fixture names) returns one row; the Banned filter returns zero rows on fresh fixtures.

  ```powershell
  npm run build --workspace apps/admin; npx --workspace apps/admin playwright test tests/e2e/accounts.spec.ts
  ```

**Deliverables:** `packages/admin-core/src/accounts/modes.ts`, `packages/admin-core/src/accounts/list.ts` with its shared `packages/admin-core/src/like.ts` helper, the ADM-03 server page, `AccountsClient`, `accounts.module.css`, the shared `LocalTime` component reused by ADM-07 and `accounts.spec.ts`.

**Acceptance criteria**

Tests: AT-06.

- [x] ADM-03 lists every account in auth.users with the seven columns of 12.9. (Yes; the browser suite asserts the exact header order and finds all four disposable accounts in the `auth.users` ⋈ `profiles` query.)
- [x] The owner's row shows the Owner pill. (Yes in the revised form; the 2026-11-15 revision replaces the Owner pill with the database-derived Admin pill, and the retired `strings.status.owner`/StatusPill value plus its component assertion were replaced rather than duplicated. No environment owner UUID and no client-supplied role is consulted; D-108, AG-1.)
- [x] A partial, mixed-case search on username or on email finds the account. (Yes; `USER_B` matches the username and `PHASE7-USER_A` matches the email, one row each; ADM-03.)
- [x] Each filter chip returns only accounts of that status. (Yes; Banned, Must change password and Active are exclusive buckets using the documented precedence, so an account holding both flags is Banned only; ADM-03.)
- [x] `getPasswordFlagMode()` matches the M1-03 result in `docs/test-results/M1.md`. (Verified against source, recorded discrepancy; D-86. `docs/test-results/M1.md` does not exist (AV-13), so the M1-03 document could not be read. The inspected migrations contain no trigger clearing `raw_app_meta_data.must_change_password` after a password change and no `private.initial_passwords` table, so the contract returns `unsupported` and keeps create/reset/ban disabled instead of assuming a fallback.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core; npx --workspace apps/admin playwright test tests/e2e/accounts.spec.ts
```

Passed: admin-core 62/62 unit tests (9 new) and a 16/16 Chrome run in 37.9 s (6 Phase 4 access, 3 Phase 7 accounts, 3 Phase 6 audit, 4 Phase 5 navigation). The owner's `127.0.0.1:3100` service held the port, so the production build was served on the harness's 3115 behind the 3100-preserving transport; the accounts spec ran its own disposable PostgreSQL 17.6 / GoTrue 2.197.0 / PostgREST 14.5 fixtures and released ports 3114/3115/3120–3123 in `finally`.

**Implementation record (2026-11-15)**

- 7.1 `packages/admin-core/src/accounts/modes.ts` replaces trigger-body heuristics with a verified contract. Inspected sources: migration 001 and 018 create `public.profiles.must_change_password`; 012/018 install only an AFTER INSERT/UPDATE OF `email, raw_user_meta_data` profile sync on `auth.users`; no migration clears the Auth `must_change_password` flag after a password change; no `private.initial_passwords` or `private.disabled_users` exists anywhere in `supabase/migrations`. `getAccountCapability()` therefore returns `{ passwordFlag: 'unsupported', banFallback: 'none', mutations: 'disabled', prerequisite }` and `getPasswordFlagMode()` returns `unsupported`, so create/reset/ban stay disabled with a clear AB-02 prerequisite message while read-only status still uses Auth metadata.
- 7.2 `accounts/list.ts` selects only the allowlisted identity fields from `auth.users` left-joined to `public.profiles` on `profiles.user_id = u.id`: `id`, `username`, `display_name`, email, `created_at`, `last_sign_in_at`, the `banned_until > now()` predicate, the Auth `must_change_password` metadata and `roles = 'admin'`. Status precedence is Banned → Must change password → Active in both the projection and the exclusive chip predicates. Search trims to 120 characters, escapes `%`, `_` and `\`, and matches username or email case-insensitively; the page and count queries share the identical predicate text; ordering is `u.created_at desc, u.id desc` with 50 rows per page and a bounded page number. Search or chip changes reset the page through the client. `premiumFlags` is an empty frozen list until Phase 19. `getAccount(userId)` validates the UUID before touching the client and returns the same projection or `null`.
- 7.3 The server page requires the account session (the shell guard remains supplementary), calls `listAccounts` and renders the CMP-24 layout: title, Primary "Create account", Secondary "Import CSV", FilterBar with the 12.9 placeholder and four chips, then the DataTable at the 14/18/22/12/14/10/10 percentage widths. The Admin StatusPill follows the username. Created uses a date, Last sign-in a date and time or "Never", Status a pill, Premium an empty cell. A row opens `/accounts/<user_id>`; the detail body stays Phase 10. Failure renders CMP-30 with Retry when a hosted project reference exists and ErrorState otherwise. All styling uses shared tokens, so both system schemes follow the account-level tokens.
- 7.4 `accounts.spec.ts` adapts the unavailable M1-08 fixture names to disposable `user_a`, `user_b`, `user_c` and `user_g` accounts created through the Auth Admin API with trusted SQL role promotion. It covers the seven columns, the "Never" state, mixed-case partial username and email search, the Admin pill, the exclusive status buckets with precedence, a both-flags account appearing only under Banned, a fresh-fixture empty Banned filter and row navigation. Fixture creation is idempotent so a Playwright worker restart cannot fail on duplicate emails.

**Risks and fallbacks**

- The postgres role cannot read `auth.users` over the pooler: switch the list to `supabase.auth.admin.listUsers({ page, perPage: 1000 })` plus a SQL read of profiles and `private.disabled_users`, and filter in memory. Traverse all needed API pages within a recorded bound and deduplicate IDs, with no silent first-1,000 truncation. Record fallback performance limits. Not exercised: the disposable target reads `auth.users` directly. A hosted pooler read remains an owner-attended check before hosted use.

**Progress / status — 2026-11-15 (Asia/Manila)**

**Complete: 4/4 steps, 100% of Phase 7. All five acceptance criteria are met against the disposable environment and the production build.** Overall verified admin-plan progress is **61/137 steps (45%)**. Phase 8 is ready to start and was not started. No real account was read or promoted, no hosted database/Auth/Storage operation ran, no migration changed and no commit/push/deployment occurred.

Workflow: Git baseline (HEAD `d906bff38ea932c1cab6410b13c6d102e9069067`; `apps/admin` and `packages/admin-core` remain untracked work from earlier phases and the plan already carried user edits) → narrowed ripgrep discovery in `supabase/migrations`, `packages/admin-core` and `apps/admin` → reuse of the Phase 4–6 verified context for guards, sessions, shell components and the harness → scoped cached Repomix 1.18.1 packet to `supabase/repomix/admin-phase-07-20261115/phase-07.xml` → complete packet analysis → original-source verification. The packet contains 11 of the 12 selected entries; `packages/admin-core/src/audit/list.test.ts` was withheld by the security scanner (synthetic connection-string sentinel) and was reviewed directly in source, the only omission. No repository instruction conflicts with this phase; `supabase/AGENTS.md` naming was not exercised because Phase 7 adds no migration.

| Verification / acceptance | Actual result |
|---|---|
| Baseline before edits | PASS — admin ESLint, Stylelint, admin and admin-core typechecks exit 0; admin-core 53/53 tests; admin 117/117 tests |
| Final lint / CSS / typechecks | PASS — admin ESLint, Stylelint, admin and admin-core typechecks exit 0 |
| Unit suites | PASS — admin-core 62/62 (9 new) and admin 117/117 |
| Production build | PASS — exit 0; `/accounts` is dynamic and the route table keeps all eight admin routes, `/sign-in`, `/api/session` and `/unlock` |
| Browser exit gate | PASS — 16/16 Chrome tests in 37.9 s; no page error, console warning or console error in the accounts spec |
| Cleanup / ownership | Owned PostgreSQL 17.6 / GoTrue 2.197.0 / PostgREST 14.5 containers and ports 3114/3115/3120–3123 released in `finally`; the owner's 127.0.0.1:3100 service was neither reused nor stopped |

Non-obvious decisions: the capability contract is a verified constant rather than a runtime trigger-body probe, because the step forbids trigger heuristics and the schema already proves neither supported mode exists; `unsupported` is the honest value and it is what disables create/reset/ban in Phases 8 and 10 until AB-02 is satisfied. Status precedence is applied to the chip predicates as well as the row projection, so the counts and the pills always agree. `getAccount` validates the UUID before any client is constructed, so a malformed route parameter never reaches configuration or SQL. The hydration-safe local-time renderer moved from `AuditView` into a shared `LocalTime` component instead of being duplicated for ADM-03; its rendered output is unchanged. Search matches username or email through one escaped pattern, and the page and count queries intentionally repeat the same predicate text the way `listAudit` does.

Discrepancies recorded: ADM-03/12.9 and step 7.3 named the Owner pill, which the 2026-11-15 revision replaces with the database-derived Admin pill (`strings.status.owner` became `strings.status.admin`, and the StatusPill value and its component assertion were updated); step 7.4's M1-08 fixture names A/B/C/G do not exist, so disposable `user_a`/`user_b`/`user_c`/`user_g` accounts are used; `docs/test-results/M1.md` is absent (AV-13), so criterion 5 is verified against the migrations rather than the missing log; the exit gate's single-spec Playwright command is executed through the harness runner, which covers the whole suite because shared components changed. One pre-existing Phase 4 outage assertion (access.spec.ts:167) failed identically twice and then passed three consecutive times with no source change in between; the 8 s assertion races the 10 s offline fetch abort, so it is recorded as an environment-timing flake rather than a Phase 7 regression.

Remaining/manual: none for this phase. Hosted use still requires the owner-attended steps from earlier phases (apply `042_admin.sql` after comparing pending migrations, promote the intended account). A hosted pooler read of `auth.users`, real-account listing and Phase 8 account creation remain their owning steps.

### Phase 8: Create account: single

**Profiles.roles revision — 2026-11-15:** Create only normal Auth accounts/profiles with the database default roles=user. Do not accept an admin role from form input, signup metadata or provisioning caller input. Later trusted database promotion changes the existing profile in place. Saved Messages and forced-password contracts remain the same for both role values.

- **Goal:** Let the owner create one account with a server-generated first password that is shown once.
- **Depends on:** Phase 7; M1-08 (`scripts/create-user`).
- **Implements:** ADM-04 (single), F12, D-47, D-78, D-86, D-89, D-102, D-105, D-106, D-116, T-45.

**Steps**

- [x] 8.1 Password generator `packages/admin-core/src/passwords.ts`: `generatePassword()` returns 16 characters chosen with `crypto.randomInt` from the 56-character alphabet `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789` (proposed D-164: no I, O, l, o, 0 or 1; D-105). `isGeneratedPassword(s)` checks the length and the alphabet. Unit tests verify length/alphabet and deterministic random-index boundary mapping. Test the server-draft creation, regeneration, session binding, expiration and replay rejection, and verify a client-selected valid-looking password is refused. Sampled uniqueness alone cannot prove secure generation.

  ```powershell
  npm run test --workspace packages/admin-core -- passwords
  ```

- [x] 8.2 Supabase admin client `packages/admin-core/src/supabase.ts`: `getAdminClient()` returns `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`, cached on `globalThis`.

  ```powershell
  npm run typecheck --workspace packages/admin-core
  ```

- [x] 8.3 `packages/admin-core/src/accounts/createAccount.ts`: `createAccount({ email, username, displayName, passwordDraftId?, importOperationId?, rowIndex?, source })` returns `{ ok: true, userId, password } | { ok: false, field?: "email" | "username" | "displayName", message }`. Order:
  1. Validate with the `packages/shared` validation module: the email (D-116 pattern), the username (D-89) and the display name (D-89, trimmed per D-116).
  2. SQL pre-check: `select 1 from public.profiles where username = lower($1)`, then return "This username is taken."; `select 1 from auth.users where lower(email) = lower($1)`, then return "An account with this email already exists."
  3. Use only a server-minted draft bound to session and one create operation. generatePassword returns the preview value plus opaque passwordDraftId and retains it transiently with finite expiry. Regenerate invalidates the prior draft. Resolve/consume the draft server-side and refuse unknown/expired/replayed/mismatched IDs before creation. Client-supplied passwords or alphabet checks cannot establish server generation. CLI/CSV generates internally without accepting a caller-chosen initial password.
  4. Call `getAdminClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: displayName }, app_metadata: { must_change_password: true } })` (D-47, D-78). Migration 018 supplies profile/Saved Messages creation. Verify target behavior. AB-02 still gates forced-password enforcement.
  5. In `initialPasswords` mode, run `insert into private.initial_passwords (user_id, password_hash) select id, encrypted_password from auth.users where id = $1` (D-86).
  6. Confirm `select 1 from public.profiles where user_id = $1`; if it is missing, report failure.
  7. Write `account.create` with `{ username, source }`.

  Keep passwords transient and return only to the authenticated caller. Pre-checks are advisory. Handle uniqueness conflicts atomically. Reconcile uncertain creation by operation identity/user ID before retry. If Auth succeeds but initialization/audit fails, retain denied access and resume initialization without another account or password rotation. Refresh list/totals on success.

  ```powershell
  npm run test --workspace packages/admin-core -- createAccount
  ```

- [x] 8.4 Server actions in `apps/admin/src/app/(admin)/accounts/new/actions.ts`: `generatePassword` (wrapped by `guardedAction("generatePassword")`, returns a server-generated password and bound passwordDraftId) and `createAccount` (wrapped by `guardedAction("createAccount")`, calls admin-core with `source: "admin"`). Error handling: field errors go back to their TextField; any other error shows the CMP-16 error block with Retry.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [x] 8.5 ADM-04 single screen `apps/admin/src/app/(admin)/accounts/new/page.tsx` with tabs "Single" and "CSV" (CMP-14 style: label.md tabs on a 1 px color.border.subtle line; the selected tab has a 2 px color.brand.primary underline and `aria-selected="true"`; CSV links to `/accounts/import`). AdminForm (CMP-26) holds Email, Username and Display name TextFields and the GeneratedPasswordPanel with Copy and Regenerate. Client state also carries the opaque passwordDraftId from the server preview. Submit its ID, never a caller-selected password. Email/username/displayName/password preview/fieldErrors/pending/created values remain transient. On mount it calls `generatePassword`; Create stays disabled until every field passes the shared validation (D-89, D-116). After success the form is replaced by the panel with the created password, Copy, and a link "Open account" to `/accounts/<userId>`; leaving the screen drops the state (D-105). Data flow: browser to server action, to admin-core, to the Auth Admin API and SQL.

  ```powershell
  npm run admin
  ```

- [x] 8.6 Integrate actual scripts/create-accounts.ts/.ps1 with core, preserving supported entry points after caller discovery. Replace embedded credentials with validated runtime inputs and remove superseded signup code within scope. Introduce proposed create-user.ts only for necessary single/CSV compatibility. Reuse ADM-04 validation/limits/outcomes. Verify Node/tsx conditions/env loading with harmless fixtures. Test actual wrapper entry points on disposable accounts. Show passwords once through protected interactive delivery without saved logs/transcripts. Never reuse legacy embedded accounts as fixtures.

- [x] 8.7 Create proposed create-account.spec.ts/T-45 evidence. On a verified isolated backend create disposable users through ADM-04 and use their API sessions/approved compatible mobile client to verify forced change/denied reads. User-web release shares wait for its owning plan. packages/shared/tests/api is absent, so discover safe existing helpers or add a minimal admin integration harness outside production. Use synthetic leak sentinels, keeping real passwords out of shell/SQL/diagnostics. Auth hashes in dumps are distinct from forbidden plaintext storage. Record platform shares separately.

**Deliverables:** `passwords.ts`, `supabase.ts`, `accounts/createAccount.ts`, the ADM-04 single screen and its actions, `scripts/create-user.ts` calling admin-core, `tests/e2e/create-account.spec.ts`, and the T-45 record.

**Acceptance criteria**

Tests: T-45; AT-07.

- [x] A created account uses its server-issued draft and appears in ADM-03 with status "Must change password". Caller-chosen, foreign-session, expired or replayed drafts are refused before creation. (Yes or no; D-78.)
- [x] Sign-in on W leads to Change password, and an API read returns no rows until the password changes. (Yes or no; T-45.)
- [x] The generated password appears in neither `private.admin_audit` nor `BACKUP_DIR`. (Yes or no; T-45.)
- [x] A 4-character username and a duplicate email are refused with a field error. (Yes or no; D-89.)
- [x] `npm run create-user` creates an account through admin-core and writes an `account.create` row with `source: "script"`. (Yes or no; D-102, D-106.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core; npx --workspace apps/admin playwright test tests/e2e/create-account.spec.ts
```

Plus the T-45 entry marked passed in `docs/test-results/MVP.md`.

**Risks and fallbacks**

- `tsx` does not pass `--conditions` to Node: run `node --conditions=react-server --env-file=apps/admin/.env.local --import tsx scripts/create-user.ts`.
- The Admin API rejects required create metadata. Use the verified AB-02 denied-initialization contract before creating a usable user. A create-then-flag fallback must prove there is no access window and cannot depend on a later Phase 10 helper. Otherwise block the real creation path and report the backend prerequisite.

**Current progress — 2026-11-16 (Asia/Manila), authorized AB-02 repair and Phase 8 completion**

**Complete: 7/7 steps verified (100% of Phase 8); overall verified admin-plan progress 68/137 steps (50%). All five acceptance criteria are met on disposable local services and the source-matched W client. Phase 9 is ready for a separately authorized start and was not started.** Historical blocked records below describe earlier source states; this note supersedes their current-status conclusions. Hosted release verification remains Phase 18 work and is not claimed here.

The owner approved the local backend prerequisite repair. New sequential migration `043_enforce_initial_password_access.sql` provides live Auth-based restrictive policies across ordinary public data, Storage object rows and Realtime message authorization; guarded client SECURITY DEFINER RPCs; an initial-password clearing trigger and profile mirror; and a service-only access-check RPC for shared Edge authentication. It also closes the legacy seed helper and the worker RPC whose client grant was accidentally restored by 036. Existing migration files and ownership policies remain intact. Creation/recovery enables only when the live database contract returns version 43; reset/ban/later mutations remain disabled. Admin-created identities stay denied until their profile, Saved Messages and successful operation audit exist, even after their initial password changes. Recovery resumes the same identity without a second create or password rotation. Shared memo handlers preserve explicit denial/unavailable errors. The admin session guard rejects forced identities.

Actual ADM-04 creation/list status, duplicate/short-input errors, draft/role guards, initialization and audit recovery, stale-JWT denial, normal signup and first-password change are verified. The W prerequisite query selected nonexistent `premium_flags`; only that selection/type was removed so the current schema can confirm the post-change profile. No premium feature was added. Actual npm create-user and PowerShell create-accounts entry points succeeded in a real PTY against disposable services; a test-only memory interceptor verified the generated password against Auth, one source=script audit, Saved Messages and the actual isolated BACKUP_DIR without recording the password. Supplied real credentials were not used.

Verification: core **97/97 PASS**; full admin **138/138 PASS**; W session/AuthForm **49/49 PASS**; shared Edge flag test **1/1 PASS**; core/admin/W typechecks, admin ESLint, scoped W ESLint and final production admin build **PASS**. Unchanged CSS reuses its passing baseline. The final broad browser/API run passed **25/26**; the new Edge source adapter failed before any request because esbuild rejects a JavaScript Unicode regex flag. After correcting the adapter, that affected test **1/1 PASS**, exercising both actual memo handlers against real disposable Auth/REST. The strengthened initialization-after-password-change recovery test separately **1/1 PASS**. Thus every one of the 26 browser/API cases has passing evidence on the final relevant source; no production assertion, timeout or limiter was weakened. Browser flows reported zero console errors/warnings. Earlier fixture readiness/default-role/proxy/rate-limit problems and their diagnosed resolutions are retained in the context index, not counted as successful runs.

Evidence: `supabase/repomix/admin-phase-08-backend-20261116/` contains the Git/source baseline, pinned scoped Repomix packets and complete bounded XML analysis with identity checks, original RPC source spans, owned diff, all diagnostic/final logs, protected terminal verification, W source-copy hashes and cleanup report. The context index maps each requirement and acceptance criterion. No new dependency, Expo/RN change, commit, push, deployment, remote migration or real-account operation. Cleanup confirmed no owned containers/network/test listeners; the owner's port 3100 and original W dev lock were preserved.

Release limitations: local Storage/Realtime RLS semantics were tested, not hosted Storage byte delivery, Realtime sockets or native clients. Edge source execution used a Node Deno.env/serve facade with the exact SDK; no Deno deployment is claimed. Before hosted use, compare migration history (042 is required), deploy all updated shared Edge consumers first, apply 043 with separate authorization, then run the hosted/platform release matrix. Missing RPC/contract fails closed during that transition. No further permission is needed to review this prepared local result.

**Progress — 2026-11-15 (Asia/Manila), Phase 8 continuation**

**Blocked: 3/7 steps verified (43% of Phase 8); overall verified admin-plan progress 64/137 steps (47%).** Steps 8.1, 8.2 and 8.4 are complete. Steps 8.3, 8.5, 8.6 and 8.7 remain partial; no required gate is counted from mock success alone. Phase 9 is not ready and was not started.

The pre-existing contribution already supplied the generator/drafts, SDK client, core creation, actions/form, wrappers and initial tests despite this phase's unchecked boxes. It was preserved and assessed against source. Git working-copy snapshots/patches and hashes, scoped cached Repomix 1.18.1 (14 entries; all 1,048 lines read in bounded continuations), original-source matching, owned diff and diagnostics are under `supabase/repomix/admin-phase-08-20261115/`. A 3-entry/269-line supplemental packet covers the CLI CSV parser and its tests; all entries were read and verified. Detailed requirement classification, inspected inputs, source identities, documentation versions, acceptance mapping and exact remaining steps are in `Plans/context/DoloGram_Admin_Web_Phase_08_Context_Index.md`. No repository-instruction conflict. No new dependencies, migration, hosted mutation, commit, push, deployment or external delivery.

Changes: CMP-16 Retry for draft/create errors; synchronous request exclusion; disabled Create while AB-02 is unresolved; partial-created account ID preserved to browser/CLI with a link and repeat creation disabled; actual audit failure reaches `auditRecorded` instead of being swallowed by the best-effort session journal; successful actions invalidate ADM-03. Unknown Auth outcomes warn that the account may already exist. Unverified initial-password fallback is refused. The display-name input now accommodates the shared 64-code-point rule. Actual provisioning wrappers reject redirected/noninteractive password output and use fixed safe errors; the bulk wrapper has a bounded 256 KiB read and tested quoted/multiline CSV parsing, exact header and 100-row limit. The Phase 9 CSV page was not implemented.

Baseline before edits: ESLint/Stylelint/admin and core typechecks PASS; core 79/79 tests PASS; production build PASS; admin 122 passed/1 failed because the unchanged theme-lint test exceeded 10s. Post-edit: core 83/83 PASS; admin full suite once passed 129/129, then final-source run passed 128/129 with the same pre-existing 10s theme-lint timeout under concurrent load; four new wrapper parser tests pass separately. No assertion or timeout was relaxed. Final lint/typecheck and production build results are in their logs; sandbox build hit prerender mkdir EPERM, while host execution passed. CSS was unchanged and its passing baseline reused. Full disposable browser/API suite passed 22/22; after preserving duplicate/invalid-field assertions through direct compiled action POSTs, targeted Phase 8 passed 7/7. Final Unicode/console-monitoring and wrapper-source run passed **7/7 with zero browser errors/warnings** (`browser-final.log`); final lint/typecheck passed. Cleanup verified zero owned containers, networks or test-port listeners (`cleanup.json`). Runner accepts optional TestFiles to keep adaptive follow-ups scoped. Traces/screenshots/video are off and diagnostic assertions do not print generated passwords. Owned containers/network/processes are cleaned up by the harness; the owner's port 3100 service is not adopted or stopped.

**Acceptance:** (1) server draft to actual created/listed account **not met**: rejection tests pass, but successful provisioning stays gated; (2) W forced-change and denied API reads **not met**: isolated API evidence confirms the backend permits a forced user's own-profile read and password update leaves the flag true; (3) created password absent from audit/BACKUP_DIR **pending manual verification** after enabled disposable provisioning (preview audit exclusion/source review pass); (4) 4-character username and duplicate email field errors **met** through core/component/actual direct action checks; (5) actual create-user success plus source=script audit **not met**: actual wrappers refuse unsafe output and injected core script success is verified, but real interactive success remains gated. `docs/test-results/MVP.md` now records T-45 as **BLOCKED**, never passed. W/mobile and hosted release shares are not claimed.

**Blocker/remaining:** Section 0.4 AB-02 explicitly assigns global forced-password denial/clearing repairs to the backend owning scope. No verified trigger/fallback contract is available. Obtain that contract (or authorize a separate prerequisite repair) covering API, Storage, Realtime, calls, memos and privileged RPC paths before enabling creation. Then finish 8.3 operation-identity reconciliation/resumable initialization/idempotent audit recovery, prove real profile/Saved Messages/default-user role initialization, exercise ADM-04/list/success behavior and actual interactive scripts, and run the T-45 W/API and plaintext-leak gates. Current conservative partial/unknown-state reporting is not claimed as completed reconciliation. Hosted migration apply and real accounts remain owner-authorized steps. There are no unrelated fixes or later-phase starts in this continuation.

**Progress — 2026-11-16 (Asia/Manila), Phase 8 recovery continuation**

**Blocked: 3/7 verified steps (43% of Phase 8); overall 64/137 (47%). Phase 9 is not ready and was not started.** This note supersedes the previous continuation's remaining recovery work, not its historical results. AB-02 still prevents completing steps 8.3, 8.5, 8.6 and 8.7.

Implemented the independent 8.3 recovery requirement: an Auth creation stores a server-issued operation marker atomically in app metadata; admin operations use the consumed draft ID and bind to the authenticated actor and a hash of the original local session. Recovery reconciles this identity without another createUser call or password rotation. It verifies the default-user profile and Saved Messages, resumes missing initialization through the existing 012/018 trigger using unchanged Auth user metadata only while the forced flag remains true and no admin role exists, and retries account.create with the same event ID. Completed profiles are not rewritten. The UI freezes creation/regeneration after unknown outcomes, offers guarded recovery, preserves the original transient preview and can retry an uncertain audit. A cache-revalidation failure preserves the applied identity/password and displays a reload warning. Scripts expose nonsecret recovery IDs and create-user --recover; initial-password delivery remains terminal-only, including partial outcomes, while recovery never redisplays passwords. No password is added to metadata, audit or persistent storage. No new dependency or migration.

Verification this session: baseline core 88/88 and admin 133/133 PASS; both typechecks, ESLint and Stylelint PASS. The baseline sandbox build compiled/typechecked but failed at Next prerender mkdir EPERM. The production build outside that sandbox PASS. Final core 94/94 and admin 138/138 PASS; core/admin and explicit provisioning-script typechecks PASS; ESLint PASS; unchanged CSS retains its passing baseline. The first post-edit admin run had the previously recorded theme-lint 10s timeout under concurrent build/lint load (137/138); after inspecting that unchanged test and removing the concurrent load, the final full run passed without timeout/assertion changes. The explicit script check initially required TypeScript 6's --ignoreConfig because it supplies files/options; the corrected invocation passed.

The full disposable browser/API run passed 23 checks and found one new test-helper failure. Safe substep diagnostics isolated a removed postgres 4 API (sql.array); passing the array directly fixed the test without changing production behavior. An intervening setup attempt exposed an existing temporary-server readiness race; the runner now requires TCP pg_isready, verified against the exact cached PostgreSQL 17.6 startup script. Final scoped Phase 8 browser/API run: **8/8 PASS, zero browser errors/warnings**. Real isolated Auth/SQL verified committed-but-lost creation, foreign-session refusal, resumable profile/Saved Messages initialization, unchanged password hash, default roles=user, script-source audit and one audit row after a lost acknowledgement/retry; generated passwords were absent from audit detail. Production capability stayed disabled throughout; injected fixture capability is not evidence of backend enforcement. Actual create-user recovery entry-point checks refused invalid IDs, mixed creation/recovery inputs and the unresolved backend gate with no password output. Successful interactive wrapper creation is still unrun.

Acceptance: (1) draft rejection and isolated core creation/recovery pass, but successful enabled ADM-04-to-ADM-03 integration is **not met**; (2) W forced-change/denied API is **not met** because the source-matched API again permits the forced user's own-profile read and password update leaves the flag true; (3) isolated audit plaintext exclusion passes, but full created-password/audit/BACKUP_DIR acceptance is **pending manual verification**; (4) short-username/duplicate-email field errors remain **met**; (5) actual interactive create-user success plus script audit is **not met**, although isolated core script creation/audit/recovery pass. T-45 remains BLOCKED in docs/test-results/MVP.md.

Evidence and owned diffs: supabase/repomix/admin-phase-08-resume-20261115/ (started November 15, finished November 16); the compact current index is Plans/context/DoloGram_Admin_Web_Phase_08_Context_Index.md. The required Git/ripgrep/Reader/Repomix/Reader/source workflow was followed; all packet entries were fully read, original sources checked, exclusions and superseded entries recorded. Existing contributions and unrelated working-copy changes were preserved. No repository-instruction conflict, hosted test/account mutation, deployment, commit, push or later-phase implementation occurred; the supplied real admin credentials were not used or saved.

**Remaining blocker:** Section 0.4 AB-02 assigns global forced-password denial/clearing to a separate backend scope. Obtain its verified contract or separately authorize that prerequisite repair (local implementation/migrations and isolated verification; remote apply still needs separate approval). It must cover normal API, Storage, Realtime, calls, memos and privileged RPC paths while preserving self-service signup and profiles.roles. Once verified, enable only the supported creation capability and finish the actual ADM-04/list flow, interactive wrappers, approved W-client first-password flow and backup plaintext checks. Recovery source/harness work is now complete within the independent scope; it is no longer outstanding implementation work.

**Hosted application — 2026-11-16 (Asia/Manila), explicitly authorized**

Owner requested applying 043 and separately approved the three prerequisite Edge deployments. Linked project `jsyqtfsidtfahytcwutp` had exactly 001–042 applied; all 11 target RPC bodies matched their verified original sources. Direct configured SQL authentication returned 28P01, so the existing Management API token was used without changing credentials or connection security. A rollback-only dry run rejected redundant ALTER TABLE on already-RLS-enabled managed Storage. Since 043 was not yet applied to the hosted target, its RLS loop was corrected to skip that redundant command while preserving policy creation and the fail-closed contract. The second hosted rollback-only dry run passed, including the contract and sequential history insert.

Downloaded hosted sources were preserved in isolated staging. The existing call-token differs from the working copy beyond Phase 8; its hosted body was retained unchanged. Only the shared access guard/new helper and memo denial mapping were deployed to call-action, call-token and memo-sync. All three are ACTIVE version 2 with original JWT verification settings (true/true/false). Independent per-function downloads matched every reviewed staged source file. No undeployed memo-pin-reset or other function was deployed, and no unrelated call-token change was published.

Migration 043 and its version/name/exact SQL statement history entry were committed atomically after the live contract returned 43. Hosted post-verification: latest history version 043; exact SQL SHA-256 `d202b2fed847fcfc8fb9b78dc094e089dfc197bcc1ac842a7b6cf35ef8d67369`; contract 43; 27 restrictive policies; access-check RPC denied to anon/authenticated and granted to service_role; harmless missing-identity API check returned false. No existing account/data was modified for testing. The first local follow-up stopped before tests because the current user-web source now imports an assets/logo file absent from the isolated copy; the harness now also copies existing assets, leaving user source unchanged. Affected denial/clearing/Edge/signup/Storage/Realtime contract checks then passed 2/2 on the revised SQL. Prior build/unit evidence remains applicable because no production TypeScript changed during this rollout.

Evidence: `supabase/repomix/admin-phase-08-hosted-043-20261116/` (baseline, migration/Reader identity, compatibility/deployment diffs, history/schema comparisons, dry-run diagnostics, deployment/source verification, hosted checks, local tests and cleanup). Pinned Repomix 1.18.1 packet: one entry, 6,417 estimated tokens / 27,795 chars, clean scan; old unchanged SQL reused by source identity, changed loop read completely from XML and checked against original. Earlier Phase 8 packet hashes now describe historical pre-compatibility SQL. 043 is now applied and must not be edited/renumbered. Phase 8 remains 7/7 (100%); overall 68/137 (50%); no later phase started. Hosted user/device/Storage-byte/Realtime-socket release flows remain pending Phase 18. The configured admin direct SQL password still needs owner correction (28P01); this was not changed by applying the migration.

### Phase 9: Create account: CSV import

**Profiles.roles revision — 2026-11-15:** CSV import creates normal accounts only. Reject attempted role/roles privilege fields at the boundary rather than granting admin from an import. Each profile defaults to user; a later trusted database change may promote it without duplicate accounts. Recheck the acting admin role for server-bound import batches and summary access.

- **Goal:** Let the owner import up to 100 accounts from a CSV with a preview, and copy or download the one-time passwords.
- **Depends on:** Phase 8.
- **Implements:** ADM-04 (CSV), F12, D-81, D-89, D-105, D-106, T-46.

**Steps**

- [ ] 9.1 Install `papaparse` in `apps/admin` (MIT; parses the file in the browser so the CSV text never needs a server upload; proposed D-174) and `@types/papaparse` as a dev dependency.

  ```powershell
  npm install papaparse --workspace apps/admin; npm install -D @types/papaparse --workspace apps/admin
  ```

- [ ] 9.2 `packages/admin-core/src/accounts/validateRows.ts`: `validateRows({ headers, rows }: { headers: string[]; rows: { email: string; username: string; display_name: string }[] })` returns one `{ row: number; problem?: string }` per row. Rules: the header must be exactly `email,username,display_name` (otherwise one file-level problem, "The CSV needs the columns email, username and display_name."); more than 100 rows gives "A CSV can have at most 100 rows." (12.9); each row is checked with the shared validation (D-89, D-116), for duplicates inside the file (email case-insensitive, username lowercase) and against existing accounts by SQL, as in step 8.3.

  ```powershell
  npm run test --workspace packages/admin-core -- validateRows
  ```

- [ ] 9.3 Server action validateCsv in accounts/import/actions.ts uses its registry guard and validateRows. Add proposed beginCsvImport/finishCsvImport actions in the same module, bound to the authenticated session and bounded import ID/row index. Server-observed per-row results determine the single summary audit. createAccount accepts the validated optional import identity and reuses the same core function, generating the password server-side.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 9.4 ADM-04 CSV screen `apps/admin/src/app/(admin)/accounts/import/page.tsx` (12.9 CMP-26 CSV). State: `{ fileName?: string; rows: Row[]; problems: Map<number, string>; phase: "choose" | "preview" | "creating" | "done"; progress: { done: number; total: number }; results: { email: string; password?: string; problem?: string }[] }`. Flow:
  1. The file input "Choose CSV file" reads the file with `Papa.parse(file, { header: true, skipEmptyLines: true })`.
  2. Call `validateCsv`.
  3. The preview DataTable has an extra first column Row and a last column Problem; invalid rows have fill color.danger.bg with the reason in color.danger; above the table, "<valid> valid, <invalid> invalid rows".
  4. Create opens CMP-27 "Create <valid> accounts?" (Primary).
  5. The client calls `createAccount` once per valid row, one at a time (11.4), and shows "Creating <n> of <total>" with a determinate bar (4 high, color.brand.primary on color.border.subtle).
  6. The result table shows email and password, with Copy (all rows as text) and "Download as CSV". The CSV (`email,password`) is built in the browser with `new Blob([...], { type: "text/csv" })` and saved as `dologram-accounts-YYYY-MM-DD.csv` (D-105). Quote fields/neutralize spreadsheet formula interpretation in identity cells, revoke Blob URLs and clear sensitive state on navigation/lock/expiry. Bound file bytes/rows, reject duplicate/extra headers and revalidate server-side.
  7. Use beginCsvImport to bind validated rows and finishCsvImport to derive counts from server-observed outcomes. Retry/reconnect shares the operation ID and resumes pending rows without duplicates. Report unknown outcomes. Bound/expire transient state without persisted passwords. Lost one-time results require explicit reset.

  Leaving the screen discards every result (D-105). A row that fails at creation shows its server message in Problem and does not stop the loop.

  ```powershell
  npm run admin
  ```

- [ ] 9.5 Fixture `apps/admin/tests/fixtures/t46.csv` with three valid rows (`t46a@example.test`, `t46b@example.test`, `t46c@example.test`, usernames `t46_alpha`, `t46_bravo`, `t46_charlie`) and one row with the username `bad` (too short, D-89). E2E `apps/admin/tests/e2e/import-csv.spec.ts`: the preview marks row 4 invalid; Create makes exactly three accounts; each new user has a Saved Messages chat, checked as that user through the helpers of the proposed/discovered admin integration harness from step 8.7 after a password change (T-46).

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/import-csv.spec.ts
  ```

**Deliverables:** `validateRows.ts`, the `validateCsv` action, the ADM-04 CSV screen, `t46.csv`, `import-csv.spec.ts`, and the T-46 record in `docs/test-results/MVP.md`.

**Acceptance criteria**

Tests: T-46; AT-08.

- [ ] The preview marks the invalid row with its reason. (Yes or no; T-46.)
- [ ] Create makes exactly three accounts, each with a Saved Messages chat. (Yes or no; T-46.)
- [ ] A file of 101 rows shows "A CSV can have at most 100 rows." and disables Create. (Yes or no; D-81.)
- [ ] The downloaded CSV holds email and password for the three accounts, and closing the screen clears them. (Yes or no; D-105.)
- [ ] One `account.import_csv` row and three `account.create` rows exist, none of them holding a password. (Yes or no; D-106.)

**Exit gate**

```powershell
npx --workspace apps/admin playwright test tests/e2e/import-csv.spec.ts
```

**Risks and fallbacks**

- A CSV saved by Excel has a UTF-8 BOM or semicolons: strip BOM and set an explicit comma delimiter. A semicolon-separated file fails the header check with the stated message instead of being guessed.
- The Free plan Auth rate limit throttles 100 creations in a row: honor bounded Retry-After on 429, otherwise wait 2 seconds, reconcile effects and retry pending work once; a second 429 marks the row failed with "Rate limited; retry later."

### Phase 10: Account detail: reset, ban, unban

**Profiles.roles revision — 2026-11-15:** Require the current acting profiles.roles=admin for resets/ban/unban. Preserve ordinary-account behavior for admin users. Ban is refused for a currently-admin target until trusted database demotion; no owner UUID fallback. Never include roles in normal identity/password metadata updates. Recheck target role around serialized mutations.

- **Goal:** Build ADM-05 identity, Reset password, Ban and Unban, and make `scripts/disable-user` call admin-core.
- **Depends on:** Phase 9; M1-08 (`scripts/disable-user`).
- **Implements:** ADM-05, F12, D-61, D-78, D-79, D-86, D-105, D-106, D-108, D-114, T-47.

**Steps**

- [ ] 10.1 `packages/admin-core/src/accounts/resetPassword.ts`: `resetPassword(userId)` refuses an unknown user. It generates a password and calls `updateUserById(userId, { password })` first and `updateUserById(userId, { app_metadata: { must_change_password: true } })` second (D-78 order: password first, flag second). In `initialPasswords` mode it then runs `insert into private.initial_passwords (user_id, password_hash) select id, encrypted_password from auth.users where id = $1 on conflict (user_id) do update set password_hash = excluded.password_hash` (D-86). Serialize by target and record Auth/flag/fallback stages under an operation ID. On partial reset retain denied access and resume flag setup without rotating again. Preserve unrelated metadata and prevent ban/delete races reopening deleted targets. Successful one-time results require reconciliation/audit. Lost results require explicit new reset. Preserve unrelated metadata using the verified API contract and per-target serialization. An integration test on the isolated backend checks surviving keys, with a read/merge/update fallback if replacement semantics apply.

  ```powershell
  npm run test --workspace packages/admin-core -- resetPassword
  ```

- [ ] 10.2 Implement accounts/ban.ts using verified AB-02 capability. Serialize target mutations. Refuse unknown users, owner ban and unban of an in-progress/completed deletion. Use verified Auth durations and confirm banned_until. Query/mutate private.disabled_users only if the capability proves the table and its enforcement exist. Use only an effective verified fallback after Auth failure. If no method establishes denial, return failed/unknown applied state and reconcile before retry. Unban clears every verified deny source and confirms access/audit. API success alone cannot prove existing-session denial. Test absent fallback schema, partial unban, timeout, live-session reads and delete/unban races.

- [ ] 10.3 Create proposed disable-user.ts as a thin core wrapper with --user-id/--username. Discover callers, resolve identity through core, enforce owner protection and share ban/audit/recovery. Add a version-confirmed root command after creation and test the actual entry point on a disposable user.

- [ ] 10.4 Server actions in `apps/admin/src/app/(admin)/accounts/[userId]/actions.ts`: `resetPassword`, `banAccount` and `unbanAccount`, each wrapped by `guardedAction` with its registry name, each calling `revalidatePath("/accounts")` and `revalidatePath("/accounts/" + userId)` after success.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 10.5 ADM-05 screen `apps/admin/src/app/(admin)/accounts/[userId]/page.tsx`: a server component calling `getAccount(userId)` (Phase 7 query; returns 404 with EmptyState "Account not found" for an unknown id). Identity card (12.9): a read-only definition list with labels in label.md and values in body.md: Email, Username, Display name, User id (mono, with an IconButton "Copy user id"), Created, Last sign-in ("Never" when null), Status (StatusPill). Actions card:
  - **Reset password:** Danger; CMP-27 with the title "Reset password <username>?" and the body "The current password stops working and the account must choose a new one at the next sign-in." After success, GeneratedPasswordPanel with Copy, shown once.
  - **Ban or Unban:** shown by status. Ban is Danger, with "Ban <username>?" and "The account loses access at once. Its messages stay." (D-61, D-79). Unban is Primary, with "Unban <username>?" and "The account can sign in again."
  - **Owner's account:** Ban is disabled with `disabledReason` (D-108).

  Client state per action: `{ open: boolean; pending: boolean; error?: string; password?: string }`. Data sources: SQL for identity; the Auth Admin API and SQL for the actions.

  ```powershell
  npm run admin
  ```

- [ ] 10.6 Create `apps/admin/tests/e2e/account-detail.spec.ts`. Cases: (a) open the account detail page for account G; the identity card shows Email, Username, Display name, User id, Created, Last sign-in and Status; (b) Reset password opens the ConfirmDialog and, after success, shows GeneratedPasswordPanel; (c) Ban opens the Danger ConfirmDialog; (d) Unban opens the Primary ConfirmDialog; (e) Ban and Delete are disabled with the stated reason on the owner's account.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 10.7 T-47 on H, W and API with account G (10.7):
  1. Reset G in ADM-05; sign-in with the old password fails, and the new one leads to Change password.
  2. After a password change, ban G. An API read with the live session is denied (D-86), and a new join of `chat:<chat_id>` is refused.
  3. A channel joined before the ban stops within 15 minutes (D-114).
  4. Unban G; reads work again.
  5. ADM-07 shows `account.reset_password`, `account.ban` and `account.unban` rows.

  The API and Realtime parts use the helpers of the proposed/discovered admin integration harness from step 8.7. Record the result in `docs/test-results/MVP.md` under "T-47".

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/account-detail.spec.ts
  ```

**Deliverables:** `resetPassword.ts`, `ban.ts`, `scripts/disable-user.ts` calling admin-core, the ADM-05 screen with actions, `account-detail.spec.ts`, and the T-47 record.

**Acceptance criteria**

Tests: T-47.

- [ ] After a reset, the old password fails and the account is sent to Change password. (Yes or no; T-47, D-78.)
- [ ] After a ban, the next API read with a live session is denied and a new channel join is refused. (Yes or no; T-47, D-86.)
- [ ] A channel joined before the ban stops within 15 minutes. (Yes or no; T-47, D-114.)
- [ ] After an unban, API reads work again. (Yes or no; T-47.)
- [ ] Ban is disabled on the owner's account with the stated reason. (Yes or no; D-108.)
- [ ] Each step wrote one audit row with no password. (Yes or no; T-47, D-106.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core; npx --workspace apps/admin playwright test tests/e2e/account-detail.spec.ts
```

Plus the T-47 entry marked passed in `docs/test-results/MVP.md`.

**Risks and fallbacks**

- `ban_duration` does not set `banned_until` (D-85 item 8): the `private.disabled_users` fallback applies automatically through the check in step 10.2.
- AS-7 fails (`app_metadata` is replaced, not merged): read the current `app_metadata` with `getUserById` and send the merged object.

### Phase 11: Account detail: delete on request

**Profiles.roles revision — 2026-11-15:** Delete is refused for every currently-admin target, including self, until trusted database demotion. Read profiles.roles server-side within the deletion authorization/serialization contract. Do not treat admin as a different account to erase or delete a separate role table. Existing memo/call/content-erasure gates remain unchanged.

- **Goal:** Delete an account on the user's request, by erasing and disabling it exactly as D-110 defines.
- **Depends on:** Phase 10.
- **Implements:** ADM-05 (Delete account), F12, D-61, D-91, D-108, D-110, PR-20, T-53.

**Steps**

- [ ] 11.1 Create deleteAccount.ts after AB-02/03/07 resolve. Reject invalid UUID, owner and mismatched current username server-side. Serialize account mutations and lock/recheck identity. Capture avatar identity before profile mutation in a durable owner-only recovery journal outside backups/logs with no credentials/content. Resume by operation ID/UUID with stage confirmation.

  In one SQL transaction deny access through the verified contract, explicitly clear content/set deleted_at and observable message sync sequences, preserve/deny attachment tombstones under 024, remove active reactions/optional votes with observable UPDATE sequences, leave groups with verified ownership handoff, remove push tokens and apply D-110 alias/empty premium array where supported. Keep direct/Saved Messages/Auth rows. Audit safe counts atomically. Current 016/018 alone do not establish these invariants.

  Complete Auth/avatar stages through the journal. Set email to <uuid>@deleted.invalid and an unreturned random password. Migration 018 can restore old profile fields during Auth updates. Erase profiles.email, reconcile permitted Auth metadata and verify/reapply final alias after the last Auth change. Reassert permanent ban/verified fallback and remove only the captured owned avatar path through Storage. Verify denied sessions, final identity and object absence. Keep failed stages resumable with stable counts, report applied effects on audit outage and never unban/recreate a deleted target. New memo/call erasure disposition remains AB-07. Disable real Delete until its contract/tests pass.

- [ ] 11.2 Server action `deleteAccount` in `apps/admin/src/app/(admin)/accounts/[userId]/actions.ts`, wrapped by `guardedAction("deleteAccount")`, then `redirect("/accounts")` with the toast "Account deleted".

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 11.3 ADM-05 Delete control: a Danger Button "Delete account" opening the typed CMP-27 with the title "Delete <username>?", the body "This erases the account. Its messages are soft-deleted and it is shown as 'Deleted account'. This cannot be undone." (12.9), the field "Type <username> to confirm", and a Danger action "Delete account" that stays disabled until the field matches. Disabled on the owner's account with "The owner's account can't be banned or deleted." The screen states that deletion happens only on the person's request (D-61, D-108), as one body.sm line above the button: "Delete only when the person asked for it."

  ```powershell
  npm run admin
  ```

- [ ] 11.4 T-53 on H, W, API and D (10.7):
  1. Create a throwaway account in ADM-04, change its password on W, start a direct chat and a group with A, and send a message in each and a reaction in the group.
  2. Delete it in ADM-05.
  3. On A's client, after foreground and without a manual refresh: its messages show "Deleted message", its reaction is gone and it shows as "Deleted account".
  4. An API read as A returns those messages with empty content and `deleted_at` set.
  5. `select count(*)` for its rows in messages, message_media and reactions is unchanged from before the deletion (no hard delete).
  6. Sign-in with its old email fails; ADM-07 has one `account.delete` row with the counts; Delete is disabled on the owner's account.

  Record the result in `docs/test-results/MVP.md` under "T-53".

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/delete-account.spec.ts
  ```

**Deliverables:** `deleteAccount.ts`, the `deleteAccount` action, the Delete control, `delete-account.spec.ts`, and the T-53 record.

**Acceptance criteria**

Tests: T-53.

- [ ] Every criterion of T-53 holds on the hosted project. (Yes or no; T-53.)
- [ ] The username becomes `deleted_` plus the first 8 hex digits of the user id, and the display name becomes "Deleted account". (Yes or no; D-110.)
- [ ] The account's email is `<user_id>@deleted.invalid` and `banned_until` is infinity. (Yes or no; D-110.)
- [ ] The audit row has counts and no message text. (Yes or no; D-106, D-110.)
- [ ] Delete stays disabled until the exact username is typed. (Yes or no; D-108.)

**Exit gate**

```powershell
npx --workspace apps/admin playwright test tests/e2e/delete-account.spec.ts
```

Plus the T-53 entry marked passed in `docs/test-results/MVP.md`.

**Risks and fallbacks**

- The messages UPDATE trigger rejects the soft-delete from the postgres role: diagnose role/trigger requirements with the backend owner while preserving the transaction boundary. Multi-request REST cannot establish atomic erasure/sync invariants.
- The Auth API refuses the required .invalid address. Keep access denied and obtain scoped contract resolution before changing D-110.

### Phase 12: Settings check

**Profiles.roles revision — 2026-11-15:** Settings check reports migration 041 column/default/check/trigger protection and current role-source availability, with no passcode/owner-ID setup. Query profiles.roles from the server; ordinary users cannot self-promote. Six backend configuration values remain, and account login/role lookup failure is shown clearly.

- **Goal:** Build ADM-08, which shows Pass, Fail or Check by hand for each project setting that 10.2 fixes.
- **Depends on:** Phase 11.
- **Implements:** ADM-08, F12, D-85 item 13, D-107, D-114, 10.2 (Supabase project settings), 5.2 (RLS on every public table), 6.4 (publication), PR-19.

**Steps**

- [ ] 12.1 Management API client `packages/admin-core/src/management.ts`: `mgmt<T>(path)` calls `fetch("https://api.supabase.com/v1" + path, { headers: { Authorization: "Bearer " + SUPABASE_ACCESS_TOKEN }, signal: AbortSignal.timeout(10000) })` and returns `{ ok: true, data: T } | { ok: false, reason: "unavailable" }`. Any non-2xx status, timeout or network error gives `unavailable` (D-107). The token is never logged.

  ```powershell
  npm run test --workspace packages/admin-core -- management
  ```

- [ ] 12.2 D-107 check point (D-85 item 13). Call each endpoint once from a PowerShell session and record in `apps/admin/README.md` under "Management API endpoints" which fields exist for this Free project. Endpoints to check (Assumption AS-11: paths and field names as in the current Management API reference): `GET /v1/projects/{ref}` (fields `name`, `region`, `status`) and `GET /v1/projects/{ref}/config/auth` (fields `disable_signup`, `external_phone_enabled`, `password_min_length`, `jwt_exp`). Realtime "Allow public access" has no confirmed endpoint, so it starts as "Check by hand".

  ```powershell
  $t = Read-Host "Access token"; Invoke-RestMethod -Headers @{ Authorization = "Bearer $t" } https://api.supabase.com/v1/projects/jsyqtfsidtfahytcwutp/config/auth | Select-Object disable_signup, external_phone_enabled, password_min_length, jwt_exp
  ```

- [ ] 12.3 `packages/admin-core/src/settings/check.ts`: `runSettingsCheck()` returns one row per setting, `{ setting, expected, found, result: "pass" | "fail" | "byHand", dashboardUrl }`:
  1. "Self-service sign-up enabled": expected disable_signup false under current Android D-163 policy. Record target value/policy source. Related evidence records email confirmation off for now, without another UI row.
  2. "Phone provider off": expected `external_phone_enabled = false` (D-04).
  3. "Minimum password length": expected `12` (D-47).
  4. "JWT expiry": expected `900` seconds (D-114).
  5. "Realtime public access off": `byHand` unless step 12.2 found a field for it (6.4, M0-07).
  6. "Publication tables": SQL `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`; derive from applied supported migrations. Through 040 source-declared tables are call_participants, calls, chat_members, memo_changes, message_media, messages, reactions (016/026/029/036). Report missing/unexpected tables explicitly. Preserve additions when verified V2 poll tables arrive. This screen never changes membership.
  7. "RLS on every public table": SQL `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`; expected no rows, and `found` lists the names (5.2, T-16 is the API test).
  8. "Region": expected `ap-northeast-1` (D-48).

  Dashboard links (Assumption AS-12: Dashboard URL paths): Auth rows use `https://supabase.com/dashboard/project/<ref>/auth/providers`, Realtime uses `https://supabase.com/dashboard/project/<ref>/realtime/settings`, and the others `https://supabase.com/dashboard/project/<ref>`. Separate readSettings from runSettingsCheck. readSettings returns/caches these rows with their time and never writes on page/Overview GET. The guarded runSettingsCheck action calls the reader and writes settings.check with pass/fail/byHand counts. Test prefetch/refresh produces zero mutation rows and explicit check produces one.

  ```powershell
  npm run test --workspace packages/admin-core -- settings
  ```

- [ ] 12.4 Server action `runSettingsCheck` in `apps/admin/src/app/(admin)/settings-check/actions.ts`, wrapped by `guardedAction("runSettingsCheck")`.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 12.5 ADM-08 screen `apps/admin/src/app/(admin)/settings-check/page.tsx`: a server component reading safe current results without audit writes on GET/RSC render, plus a Secondary Button "Run check again". A DataTable (12.9) with the columns Setting (30%), Expected (25%), Found (25%) and Result (20%): a Pass or Fail StatusPill, or the CMP-30 row variant "Check by hand" with "Open Dashboard". Above the table, "<pass> passed, <fail> failed, <byHand> to check by hand" in body.md. Data sources: the Management API and SQL.

  ```powershell
  npm run admin
  ```

**Deliverables:** `management.ts`, `settings/check.ts`, the ADM-08 screen, and the "Management API endpoints" section of `apps/admin/README.md`.

**Acceptance criteria**

Tests: AT-09; T-16 is the API test of row 7.

- [ ] All eight rows appear, each as Pass, Fail or Check by hand. (Yes or no; ADM-08.)
- [ ] With `SUPABASE_ACCESS_TOKEN` replaced by an invalid value, rows 1 to 5 and 8 show "Check by hand" with a Dashboard link, and rows 6 and 7 still show Pass or Fail. (Yes or no; D-107.)
- [ ] The JWT expiry row shows Pass for 900 seconds. (Yes or no; D-114.)
- [ ] On the hosted project, every row that can be read passes. (Yes or no; 10.2, R-3.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core -- settings; npm run admin
```

Then open `/settings-check` and confirm that no row shows Fail.

**Risks and fallbacks**

- An endpoint path or field name differs (AS-11): use the name the reference documents and record it; when no endpoint returns the value, the row stays "Check by hand" (D-107).

### Phase 13: Overview: status, usage and capacity

**Profiles.roles revision — 2026-11-15:** Admin/user capacity counts are based on existing Auth/profile identities: promoting a profile does not create or count another account. Read roles only for required admin labels/authorization. Remove passcode/owner-ID setup prompts; normal-user counts and usage semantics otherwise remain unchanged.

- **Goal:** Build ADM-02, one view of project status, usage against the Free plan limits, account totals, maintenance due dates and the settings summary.
- **Depends on:** Phase 12.
- **Implements:** ADM-02, F12, 7.1, D-41, D-45, D-107, D-123, D-125, PR-19, R-8.

**Steps**

- [ ] 13.1 Limits `packages/admin-core/src/limits.ts`, taken from 7.1 and D-41 (D-125 checked them), in bytes per D-116: `database: 524288000` (500 MB), `storage: 1073741824` (1 GB), `egress: 5368709120` (5 GB; cached egress is a separate 5 GB quota and is not shown, AS-13), `realtimePeakConnections: 200`, `realtimeMessages: 2000000` (per month), `monthlyActiveUsers: 50000`. Thresholds: `warnAt: 0.8`, `limitAt: 1.0` (D-45). Action text under an amber or red bar (D-123):
  - database and storage: "Run the purge in Maintenance today and record the sizes before and after."
  - Realtime peak connections: "Switch message delivery from Postgres Changes to database Broadcast."
  - Realtime messages and egress: "No change before the monthly reset. Tell your contacts."
  - monthly active users: "The Pro plan is the only option beyond the Free plan." (AG-7: D-123 gives no action for this limit; D-41 names the Pro plan.)

  ```powershell
  npm run test --workspace packages/admin-core -- limits
  ```

- [ ] 13.2 `packages/admin-core/src/overview/project.ts`: `getProjectSummary()` reads `GET /v1/projects/{ref}` for `name`, `ref`, `region` and `status`. Plan: Assumption AS-14, the plan is read from the organization of the project (`GET /v1/organizations/{organization_id}`, field `plan`); otherwise it shows "unavailable". The status maps to a StatusPill: `ACTIVE_HEALTHY` is Active; `INACTIVE` (paused) is Fail with the text "Paused". `restoreProject()` calls `POST /v1/projects/{ref}/restore` (AS-14) and writes `project.restore`.

  ```powershell
  npm run test --workspace packages/admin-core -- project
  ```

- [ ] 13.3 `packages/admin-core/src/overview/usage.ts`: `getUsage()` returns one entry per limit, `{ metric, used?, source: "api" | "hand" | "sql" | "unavailable", enteredOn? }`. Order of sources:
  1. The Management API endpoint recorded in step 13.5 for that metric (D-107).
  2. For database and storage only, an SQL aggregate (proposed D-175): `select pg_database_size(current_database())` and `select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects`.
  3. The latest `usage.manual_entry` row for the metric in the current calendar month, read from `private.admin_audit` (D-107).
  4. `unavailable`.

  `enterUsageByHand({ metric, used })` validates known metric, finite non-negative value, safe integer where needed and bounded unit conversion and writes `usage.manual_entry` with `{ metric, used, limit, month: "YYYY-MM" }`.

  ```powershell
  npm run test --workspace packages/admin-core -- usage
  ```

- [ ] 13.4 `packages/admin-core/src/overview/summary.ts`:
  - `getAccountTotals()` uses the status expression of step 7.2: `count(*) filter (where banned)`, the same for must change, and active.
  - `getMaintenanceState()` takes, for each of `job.export`, `job.media_copy` and `job.purge`, the latest `success` row in `private.admin_audit`, and computes `ok`, `due` (export after 7 days, the others after 31 days, ADM-02) or `overdue` (export after 14 days, the others after 62 days, proposed D-176). A job that never ran is `overdue`.
  - `getSettingsSummary()` returns the pass and fail counts of `lastSettingsCheck`, refreshing read-only values when older than 60 seconds and deduplicating overlap. Only the explicit guarded check action writes an audit event.

  ```powershell
  npm run test --workspace packages/admin-core -- summary
  ```

- [ ] 13.5 D-107 check point for usage. Look up in the Management API reference which endpoint returns each of the six metrics for a Free project, call each once, and record it in `apps/admin/README.md` under "Management API endpoints" as "metric: endpoint, field" or "metric: none". Assumption AS-15: at least database size and egress have an endpoint; any metric without one uses steps 2 and 3 of 13.3.

  ```powershell
  Get-Content apps\admin\README.md | Select-String "Management API endpoints" -Context 0,12
  ```

- [ ] 13.6 Server actions `restoreProject` and `enterUsageByHand` in `apps/admin/src/app/(admin)/actions.ts`, each wrapped by `guardedAction`.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 13.7 ADM-02 screen `apps/admin/src/app/(admin)/page.tsx` (12.9): four cards in a 2-column grid, 1 column below 1024 px.
  - **Project:** name, ref (mono), region, plan, a status pill, and "Restore" (CMP-27 Primary, "Restore project?", "The paused project starts again. This can take a few minutes.") shown only when the project is paused.
  - **Usage:** six UsageBars (database, storage, egress, Realtime peak connections, Realtime messages this month, monthly active users), each with the D-123 action under an amber or red bar, "Entered by hand on <date>" for hand values, and CMP-30 with "Enter by hand" (a Dialog with one numeric TextField and the unit) when the source is `unavailable`.
  - **Accounts:** three counts in title.lg, labeled Active, Banned and Must change password.
  - **Maintenance and Settings:** one row per job with "Last run <date>" and a Due or Overdue pill, linking to `/maintenance`, and the ADM-08 pass and fail counts, linking to `/settings-check`.

  Each card loads on its own inside a `<Suspense>` boundary, with a Skeleton after 300 ms, so one unavailable panel does not hold back the others. Without any connection, every card that needs Supabase shows CMP-30 (F12). The header from Phase 5 now shows the project name from `getProjectSummary()`.

  ```powershell
  npm run admin
  ```

- [ ] 13.8 Usage display test for T-48: force API/SQL unavailable in the isolated fixture, then enter by hand `858993460` bytes for storage, which is 80.0% of 1,073,741,824 bytes (1 GB, D-116), and confirm the storage bar turns amber with the purge action under it.

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/overview.spec.ts
  ```

**Deliverables:** `limits.ts`, `overview/project.ts`, `overview/usage.ts`, `overview/summary.ts`, the ADM-02 screen and its actions, `overview.spec.ts`, and the usage endpoints in the README.

**Acceptance criteria**

Tests: T-48 (bar at 80%); AT-10.

- [ ] The Overview shows the project name, ref, region and status of `jsyqtfsidtfahytcwutp`, with region `ap-northeast-1`. (Yes or no; ADM-02, D-48.)
- [ ] Six usage bars appear, each with a value, a hand-entered value or the unavailable panel. (Yes or no; D-107.)
- [ ] A value entered by hand at 80% of a limit shows that bar amber with the D-123 action. (Yes or no; T-48, D-123.)
- [ ] The account totals equal the counts of the ADM-03 filters. (Yes or no.)
- [ ] An export that last ran 8 days ago shows Due. (Yes or no; ADM-02.)
- [ ] With the network unplugged, every card that needs Supabase shows "unavailable" and the page still renders. (Yes or no; F12.)

**Exit gate**

```powershell
npx --workspace apps/admin playwright test tests/e2e/overview.spec.ts
```

**Risks and fallbacks**

- No usage endpoint exists for a metric on the Free plan (PR-19): hand entry once a month from the Supabase usage page (D-45, D-107).
- The restore endpoint is missing (AS-14): Restore is replaced by CMP-30 with the Dashboard link, and the runbook step "Unpause from the Dashboard" (R-8 rollback) applies.

### Phase 14: Maintenance: runner, export, media copy

**Profiles.roles revision — 2026-11-15:** Every job-start/result/progress route validates current admin authorization. Check the initiating account role again at bounded privileged job stages; demotion prevents further privileged stages/result access. Backups/restores must retain profiles.roles, its default/check/guard trigger and unchanged normal account identity. Do not export credentials or introduce a separate admin account store.

- **Goal:** Run the weekly database export and the monthly media copy from ADM-06, one job at a time, with live progress.
- **Depends on:** Phase 13; M4-05 (`docs/runbook.md`, export and media copy scripts).
- **Implements:** ADM-06 (export and media copy), F12, D-29, D-52, D-74, D-102, D-106, M4-05.

**Steps**

- [ ] 14.1 Job runner `apps/admin/src/server/jobs.ts` (proposed D-179): state `globalThis.__dgAdmin.job: { id: string; kind: "export" | "mediaCopy" | "purgePreview" | "purge"; state: "running" | "done" | "failed"; startedAt: string; lines: string[]; progress?: { done: number; total: number }; result?: unknown } | null`. `startJob(kind, run)` refuses with "Another job is running" while a job is running; `log(line)` keeps the last 200 lines. A finished job stays readable until the next job starts. Define cancellation/deadline/exclusive process ownership and interrupted-state recovery. Return a typed safe progress DTO without arbitrary bytes/tokens/provider errors. Polling cannot renew owner idle activity indefinitely. Lines never contain a secret: every line passes through `redact()` (Phase 17 step 17.4; until then, a local function that replaces the values of the three secret variables with `[redacted]`).

  ```powershell
  npm run test --workspace apps/admin -- jobs
  ```

- [ ] 14.2 Progress route `apps/admin/src/app/api/jobs/current/route.ts`: `GET` runs `assertLocalRequest()` and the session check, then returns the job as JSON with `Cache-Control: no-store`. Poll every 1000 ms while running with bounded error backoff/deadline. Cancel timers/requests on unmount, lock, expiry and terminal state. Reconnect reads existing job identity.

  ```powershell
  npm run build --workspace apps/admin
  ```

- [ ] 14.3 Tool detection `packages/admin-core/src/maintenance/tools.ts`: `checkTools()` runs `execFile("supabase", ["--version"])` and `execFile("docker", ["info", "--format", "{{.ServerVersion}}"])`, each with a 15-second timeout, and returns `{ supabase: boolean; docker: boolean }`. JobPanel shows "Install Docker to run the export." or "Install the Supabase CLI to run the export." and disables Run (12.9). Assumption AS-16: `supabase` and `docker` are executables on PATH; when the Supabase CLI is an npm `.cmd` shim, call it through `cmd.exe /d /s /c`.

  ```powershell
  npm run test --workspace packages/admin-core -- tools
  ```

- [ ] 14.4 Establish exportDb.ts from the verified M4-05 runbook. Check installed CLI dump help and matching official backup/restore docs before recording executable flags. Connection flags are version-dependent. Preserve three schema/roles/data outputs under BACKUP_DIR/db in a distinct run directory per repeated date. Use temp outputs, validate exit/size/coverage/manifest and publish the complete set atomically, preserving last good exports on failure.

  Discover required public/private/Auth/Storage metadata and extension handling. Managed schemas can be excluded by default. Nonempty files/admin_audit text cannot establish restore completeness. Establish dump/media consistency through a supported snapshot or write-quiescence procedure. Restore only into confirmed disposable Supabase and compare source-snapshot counts, constraints/grants/functions, audit and required Auth/Storage metadata. Protect raw backups outside repo/context packets. Create proposed export-db.ts/root wrapper and test the actual entry point. Sanitize child stderr/connection arguments before logging.

- [ ] 14.5 Create mediaCopy.ts/proposed wrapper under M4-05. Discover all buckets including existing avatars/chat media/memo-assets. AB-05 gates memo backup privacy/retention. Copy opaque bytes only into protected owner backup storage. UI receives safe counts/path metadata. Use bounded keyset inventory and streaming. Resolve each destination inside backup root, rejecting traversal, drive/UNC/rooted paths, alternate streams, reserved names, reparse/symlink escapes and case-insensitive collisions.

  Record object version/identity and checksum manifest. Same size cannot establish unchanged bytes. Use temporary files, verify length/version/digest and rename atomically. Handle source replacement, disk-full/interruption and revalidate bounded Retry failed. Audit safe counts and report unresolved/changed files. Success requires zero unresolved failures. Bytes/signed URLs never enter UI/logs. Permission errors cannot silently omit buckets.

- [ ] 14.6 Server actions `startExport`, `startMediaCopy` and `retryFailedMediaCopy` in `apps/admin/src/app/(admin)/maintenance/actions.ts`, each wrapped by `guardedAction`, each calling `startJob` and returning at once.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 14.7 ADM-06 screen part 1 `apps/admin/src/app/(admin)/maintenance/page.tsx`: JobPanel cards "Database export" and "Media copy", plus placeholders for "Purge" and "Restore drill" until Phase 15. The last run comes from `getMaintenanceState()`. The running job's card shows the progress bar and the last 8 log lines; the other cards show "Another job is running". Media copy shows "<copied> copied, <skipped> skipped, <failed> failed" after a run, and "Retry failed" when the failed count is above 0.

  ```powershell
  npm run admin
  ```

**Deliverables:** `jobs.ts`, the progress route, `tools.ts`, `exportDb.ts`, `mediaCopy.ts`, the scripts calling them, and the ADM-06 export and copy cards.

**Acceptance criteria**

Tests: T-48 (export and media copy); AT-11.

- [ ] The export writes the three files into `BACKUP_DIR\db`, and the schema file contains `admin_audit`. (Yes or no; T-48, D-106.)
- [ ] Running the media copy twice copies 0 new objects the second time. (Yes or no; T-48.)
- [ ] Starting a second job while one runs is refused with "Another job is running". (Yes or no; ADM-06.)
- [ ] With Docker stopped, Run is disabled with "Install Docker to run the export." (Yes or no; ADM-06.)
- [ ] No job log line or audit row contains the database URL or the secret key. (Yes or no; D-102.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core; npm run admin
```

Then run "Database export" and "Media copy" twice in `/maintenance` and confirm that ADM-07 shows two `job.media_copy` rows, the second with `copied: 0`.

**Risks and fallbacks**

- Connection arguments may be visible to same-user processes. Select an installed-CLI-supported protected invocation, minimize lifetime, redact output and record residual local exposure before the export gate.
- `supabase db dump` needs Docker and Docker is not running: the job fails with the missing-tool text, and the runbook's manual step stays available.

### Phase 15: Maintenance: purge and restore drill

**Profiles.roles revision — 2026-11-15:** Purge/restore-drill actions require the current initiating admin role before destructive batches and result access. Restore verification must preserve roles protection and normal account capabilities for promoted accounts. Existing purge reference/privacy/revalidation rules remain intact.

- **Goal:** Purge the files of deleted or expired messages and old orphans after a preview, and record the restore drill.
- **Depends on:** Phase 14.
- **Implements:** ADM-06 (purge, restore drill), F12, D-75, D-106, D-123, PF-18, T-48.

**Steps**

- [ ] 15.1 Create bounded metadata-only purge preview for the two chat-media buckets. Use unique bucket/path identities and canonical chat_id/media_id plus media_type bucket mapping from shared media.ts/024. Eligible objects belong to deleted messages, individual attachment tombstones or verified optional expiry. Orphans have no live/tombstoned reference and are older than 24 hours. Deduplicate reasons and protect any live shared reference. Unknown sizes stay unknown. Exclude memo-assets/avatars from chat purge. Bind 15-minute preview to owner/session/target and exact versions/eligibility. Return safe metadata/audit counts and test eligibility before Storage mutations.

- [ ] 15.2 Reject unknown/expired/wrong-session/wrong-target previews. Recheck object versions/references immediately before deletion and process at most 100 identities per bounded Storage batch. Never DELETE storage.objects directly. Skip changed/newly referenced objects and require fresh preview. Close recheck-to-delete race through verified immutable-path/conditional-delete or coordinated write-exclusion. If unavailable block destructive purge and report prerequisite.

  Reconcile preview/deleted/alreadyMissing/changed/skipped/failed counts. Retry only remaining eligible identities under the same operation ID. Record before/after estimates with source/time. Physical DB size need not shrink. Audit success only after reconciliation. Exact preview-equals-deleted uses unchanged disposable fixtures. Concurrent changes require honest differences/new preview.

- [ ] 15.3 Restore drill: `apps/admin/src/server/runbook.ts` reads `docs/runbook.md` (M4-05) at request time and returns the numbered list under the heading "Restore drill" (Assumption AS-17: M4-05 uses this heading; if it is absent, the card shows "Add a 'Restore drill' section to docs/runbook.md."). The runbook/checklist is a Phase 14 prerequisite and must exist before this gate. Missing text is a blocked state. Drill done is enabled only after the required checklist/evidence is recorded, then writes drill.done with a safe restore-run reference. A missing runbook cannot count as a finished path.

  ```powershell
  Select-String -Path docs\runbook.md -Pattern "^#+ Restore drill"
  ```

- [ ] 15.4 Server actions `startPurgePreview`, `startPurge` and `markDrillDone` in `apps/admin/src/app/(admin)/maintenance/actions.ts`, each wrapped by `guardedAction`.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 15.5 ADM-06 screen part 2 (12.9). The "Purge" JobPanel first offers "Preview". The preview shows a DataTable (columns Bucket 20%, Path 50% mono, Reason 15%, Size 15% right-aligned) and the line "<files> files, <size> in total". Purge is enabled only after a preview and opens CMP-27 Danger, "Purge?", "Deletes the <files> files listed in the preview. This cannot be undone." After the purge, the card shows "<deleted> deleted" and the storage size before and after. The "Restore drill" card shows the checklist and "Drill done".

  ```powershell
  npm run admin
  ```

- [ ] 15.6 T-48 on H and W (10.7):
  1. Run the export.
  2. Run the media copy twice; the second run copies nothing new.
  3. Run the purge preview and the purge; the preview counts equal `deleted`.
  4. The Overview shows each job as done.
  5. Restore into confirmed disposable scratch Supabase using version-confirmed runbook commands and compare the row counts per table.
  6. A usage figure entered by hand at 80% shows its bar amber (Phase 13).

  Record the result in `docs/test-results/MVP.md` under "T-48".

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/maintenance.spec.ts
  ```

**Deliverables:** `purge.ts`, `runbook.ts`, the purge and drill actions, the completed ADM-06 screen, `maintenance.spec.ts`, and the T-48 record.

**Acceptance criteria**

Tests: T-48.

- [ ] The preview lists only paths, reasons and sizes. (Yes or no; D-75.)
- [ ] Unchanged disposable fixtures yield the unique preview count. Concurrent-change fixtures refuse affected objects and report differences. (Yes or no; T-48.)
- [ ] The `job.purge` audit row holds the storage and database sizes before and after. (Yes or no; D-123.)
- [ ] A purge with a preview older than 15 minutes is refused. (Yes or no.)
- [ ] The Overview shows the export, copy and purge as done (not Due) after the T-48 run. (Yes or no; T-48.)
- [ ] The restored scratch stack has the same row count per table as the hosted project at export time. (Yes or no; T-48.)

**Exit gate**

```powershell
npx --workspace apps/admin playwright test tests/e2e/maintenance.spec.ts
```

Plus the T-48 entry marked passed in `docs/test-results/MVP.md`.

**Risks and fallbacks**

- Storage `remove` reports success for a path that no longer exists: reconcile existence/version and classify alreadyMissing separately from deleted and failed.
- `storage.objects.metadata` has no `size` key for some objects: retain unknown size and show "size unknown" in the preview row.

### Phase 16: Theme, states and accessibility pass

**Profiles.roles revision — 2026-11-15:** Include account Sign in, ordinary-user denial, revoked-admin session, backend-unavailable and Sign-out-during-outage states in both themes and accessibility checks. An admin must still navigate normal mobile/user-web account flows; no role selector/self-promotion control appears in profile settings.

- **Goal:** Verify that every ADM screen follows the system theme and meets the loading, error and accessibility rules of D-95, D-134 and D-136.
- **Depends on:** Phase 15.
- **Implements:** 11.6 (States, Accessibility, Offline), 12.7 (admin row), 12.8, D-95, D-109 item 13, D-134, D-135, D-136, D-138.

**Steps**

- [ ] 16.1 Loading per route. Add `loading.tsx` in each route folder under `apps/admin/src/app/(admin)` that renders the route's Skeleton with the CSS class `dgDelayed` (`opacity: 0; animation: dgAppear 0s var(--dg-motion-delay-loading) forwards;`, AS-18: `tokens.css` exposes motion.delay.loading as `--dg-motion-delay-loading`), so the indicator appears only after 300 ms (D-95, D-134).

  ```powershell
  npm run build --workspace apps/admin
  ```

- [ ] 16.2 Errors per route. Add `error.tsx` in each route folder that renders ErrorState with the strings text "Something went wrong. <action> did not finish." and Retry calling `reset()`. Errors never show stack traces or raw Supabase messages (D-95).

  ```powershell
  npm run build --workspace apps/admin
  ```

- [ ] 16.3 Install `@axe-core/playwright` (MPL-2.0) and add `apps/admin/tests/e2e/a11y.spec.ts`. For each of the 9 routes (Unlock plus the 8 of 12.6), in both `colorScheme: "light"` and `colorScheme: "dark"`:
  - axe reports no violation of impact serious or critical;
  - every element matching `button, a, input, select, [role=switch], [tabindex="0"]` has a bounding box of at least 32 by 32 px (D-136);
  - `getComputedStyle(document.body).backgroundColor` equals the token value of color.bg.app for that scheme (D-109 item 13).

  ```powershell
  npm install -D @axe-core/playwright --workspace apps/admin; npx --workspace apps/admin playwright test tests/e2e/a11y.spec.ts
  ```

- [ ] 16.4 Keyboard pass `apps/admin/tests/e2e/keyboard.spec.ts`: on ADM-03, Tab follows the visual order (Skip link, sidebar, Lock now, Create account, Import CSV, search, chips, rows, Previous, Next); every focused element shows the 2 px color.focus.ring with a 2 px offset; on ADM-05, Escape closes an open ConfirmDialog and focus returns to its button (12.8).

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/keyboard.spec.ts
  ```

- [ ] 16.5 Reduced motion and zoom. Run the e2e suite with `reducedMotion: "reduce"` and confirm that no transition is longer than 100 ms (D-134). Manual pass: at 200% browser zoom every function of ADM-02 to ADM-08 is usable, with tables scrolling inside their cards (12.7, 12.8). Record the manual pass in `docs/test-results/MVP.md` under "Admin accessibility".

  ```powershell
  npx --workspace apps/admin playwright test --project=reduced-motion
  ```

- [ ] 16.6 Use isolated config/injected offline and timeout failures for SQL, Auth/Storage and Management API. Verify process target with masked diagnostics. Unlock/Lock now survive session-audit outages. Data routes show independent unavailable/retry states within timeouts while healthy panels render. Test loopback validation and missing-backend config separately. Preserve owner network/active env file. Stop isolated process afterward.

- [ ] 16.7 Contrast. Run the shared contrast test (D-95) and confirm that the admin pairs used by StatusPill, UsageBar and the generated password panel (color.success on color.bg.surface, color.danger on color.danger.bg, color.warning.text on color.warning.bg, color.info.text on color.info.bg, color.warning.bar on color.border.subtle) are in the 12.2 checked set.

  ```powershell
  npm run test --workspace packages/shared -- contrast
  ```

**Deliverables:** `loading.tsx` and `error.tsx` per route, `a11y.spec.ts`, `keyboard.spec.ts`, the reduced-motion Playwright project, and the manual pass record.

**Acceptance criteria**

Tests: AT-12, AT-13, AT-14, AT-15; T-40 (shared-token part).

- [ ] axe finds no serious or critical violation on any route in either theme. (Yes or no; AT-13.)
- [ ] Every interactive element is at least 32 by 32 px. (Yes or no; D-136, AT-14.)
- [ ] The background follows the operating-system theme with no setting on the page. (Yes or no; D-109, AT-12.)
- [ ] A forced server error shows the error text and Retry. (Yes or no; D-95.)
- [ ] A response slower than 300 ms shows the Skeleton; a faster one shows none. (Yes or no; D-95.)
- [ ] With Supabase unreachable, data panels show "unavailable" and the shell works. (Yes or no; F12, AT-15.)

**Exit gate**

```powershell
npx --workspace apps/admin playwright test; npm run lint --workspace apps/admin
```

**Risks and fallbacks**

- A 12.2 token pair used by the admin fails 4.5:1 or 3:1: fix the token value in `packages/shared/src/theme/tokens.ts` with the owner of M4-02; never override a color in the admin web (D-138).

### Phase 17: Hardening and security tests

**Profiles.roles revision — 2026-11-15:** Replace passcode-specific security gates with profiles.roles protection, user/admin/forged-cookie denial, live demotion, metadata/claim/RPC self-promotion attempts and same-account normal-use regression. Keep Host/Origin, service-key bundle separation, headers and direct API/action/RSC guards. Confirm obsolete passcode/env-owner paths are removed when the replacement is implemented.

- **Goal:** Prove that no secret reaches a client bundle, that no server action exceeds 6.6, and that unauthenticated or cross-origin requests change nothing.
- **Depends on:** Phase 16.
- **Implements:** T-42, T-43, T-44, 7.1 (admin web exposure), D-102, D-103, D-104, M0-10.

**Steps**

- [ ] 17.1 Create apps/admin/scripts/scan-bundle.mjs using synthetic distinctive sentinel secrets loaded through the same effective configuration as the isolated production build/server, including environment overrides. Fail if a required sentinel is absent/empty or a required asset/output was not scanned. Scan browser assets and serialized/static HTML/RSC/body artifacts and report file names only. Also inspect actual authenticated page/action/progress responses in the isolated browser harness to catch runtime leaks that do not exist on disk. Disable diagnostic recording of payload values. Verify the scanner rejects a deliberately seeded synthetic leak, remove that fixture and rerun the clean gate. Retain source/build identity and file counts. Extend the existing mobile/web bundle checks only through confirmed caller paths. At the release gate also scan against the actual effective release secret values in memory without printing or persisting them. A scan of a different .env file or zero artifacts cannot pass T-42.

- [ ] 17.2 T-43 server-action audit `apps/admin/scripts/audit-server-actions.mjs`:
  1. Find every file under `apps/admin/src` containing `"use server"`, collect its exported names, and fail when actions lack registry entries or required guard/auth policies. Verify explicit Unlock policy, route handlers and transitive privileged imports. String matching alone is insufficient.
  2. Search `apps/admin/src` and `packages/admin-core/src` for `messages`, `message_media`, `reactions`, `polls`, `poll_votes`, `secret_keys`, `chats.title`, `title` in a SELECT, `storage.from(` and `.download(`. Classify by operation/returned data. Publication names, aggregate usage and constants require narrow metadata tests. Fail on content exposure/unreviewed privilege outside the DC-2 allowlist (`maintenance/mediaCopy.ts`, `maintenance/purge.ts`, `accounts/deleteAccount.ts`) and outside `audit/actions.ts` names.
  3. Fail on any use of `signInWithPassword`, `signInWithOtp`, `generateLink` or `setSession` (D-103: no signing in as a user).
  4. Print the registry list next to the 6.6 functions for the manual comparison T-43 asks for.

  ```powershell
  node apps/admin/scripts/audit-server-actions.mjs
  ```

- [ ] 17.3 T-44 full run. Extend `apps/admin/tests/security/origin-host.test.ts` with a page served from another port: `apps/admin/tests/security/foreign-page.mjs` serves a form on `http://127.0.0.1:3199` that posts to `http://127.0.0.1:3100/unlock` and to `/accounts/new`. Playwright opens it and submits; both requests are refused and ADM-07 gains no row. Also check that every route returns a redirect to `/unlock` without the cookie, that a request with `Host: evil.test` gets 421, and that six wrong passcodes leave the screen locked (10.7).

  ```powershell
  npm run build --workspace apps/admin; npx --workspace apps/admin playwright test tests/e2e/access.spec.ts; npm run test --workspace apps/admin -- security
  ```

- [ ] 17.4 Redaction `apps/admin/src/server/redact.ts`: `redact(text)` replaces every value of the secret variables of Section 3.3 with `[redacted]`. The job log uses it, and `apps/admin/src/instrumentation.ts` wraps `console.error` with it. A unit test feeds an error containing the database URL and checks the output.

  ```powershell
  npm run test --workspace apps/admin -- redact
  ```

- [ ] 17.5 Security headers in `apps/admin/next.config.ts` `headers()` for `/:path*`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store` on every HTML response (proposed D-178). They prevent framing of the admin web by another local page and caching of generated passwords.

  ```powershell
  npm run build --workspace apps/admin; npm run start --workspace apps/admin
  ```

- [ ] 17.6 AT-02 public-variable check: `Select-String` finds no `NEXT_PUBLIC_` and no `createBrowserClient` or `createClient(` call in any file under `apps/admin/src` that is a client component (AC-6). Put it in the T-43 script as one more rule.

  ```powershell
  Get-ChildItem apps\admin\src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "NEXT_PUBLIC_"
  ```

- [ ] 17.7 Dependency audit. Run `npm audit --omit=dev` for `apps/admin` and `packages/admin-core`; assess production reachability and resolve admin-introduced high/critical findings with compatible scoped upgrades, then record unrelated findings and release blockers in `apps/admin/README.md`.

  ```powershell
  npm audit --omit=dev --workspace apps/admin --workspace packages/admin-core
  ```

**Deliverables:** `scan-bundle.mjs`, `audit-server-actions.mjs`, `foreign-page.mjs`, `redact.ts`, `instrumentation.ts`, the security headers, and the T-42, T-43 and T-44 records in `docs/test-results/MVP.md`.

**Acceptance criteria**

Tests: T-42, T-43, T-44; AT-02, AT-16.

- [ ] None of the secret values is found in any admin client file. (Yes or no; T-42.)
- [ ] No content read exists outside the DC-2 allowlist, and every server action is one of the functions of 6.6. (Yes or no; T-43.)
- [ ] Unauthenticated, cross-origin and wrong-Host requests are refused and change nothing, and 5 wrong passcodes lock the screen for 5 minutes. (Yes or no; T-44.)
- [ ] The response headers of `/` include `X-Frame-Options: DENY` and `Cache-Control: no-store`. (Yes or no; AT-16.)
- [ ] `npm audit --omit=dev` reports no high or critical finding. (Yes or no.)

**Exit gate**

```powershell
npm run build --workspace apps/admin; node apps/admin/scripts/scan-bundle.mjs; node apps/admin/scripts/audit-server-actions.mjs; npx --workspace apps/admin playwright test
```

**Risks and fallbacks**

- `Cache-Control: no-store` on every response slows static assets: apply it to HTML and RSC responses only, and leave `/_next/static` with the Next.js default.

### Phase 18: M4-08 exit and release gate

**Profiles.roles revision — 2026-11-15:** Release requires hosted migration 041 evidence plus real existing-account sign-in, trusted promotion/demotion, ordinary-user denial, immediate demoted-session denial and preserved normal account UUID/data/access. Confirm shared/mobile/web typechecks and source-matched client normal flows. Migration 041 is applied/verified, while role-based login remains unimplemented; do not mark this exit complete from old passcode tests.

- **Goal:** Pass the M4-08 exit tests on the hosted project and complete R-7 and R-8 through the admin web.
- **Depends on:** Phase 17.
- **Implements:** M4-08 (exit), M4-07 (admin share of the MVP gate), 10.8 (R-1, R-7, R-8), 3.1, T-42, T-43, T-44, T-45, T-46, T-47, T-48, T-53.

**Steps**

- [ ] 18.1 R-1: run the local test suites and take the D-29 export from ADM-06.

  ```powershell
  supabase test db; npm run test --workspace packages/admin-core; npm run test --workspace apps/admin
  ```

- [ ] 18.2 Confirm that the admin migration is on the hosted project and in sync (R-2 check) and that ADM-08 shows no Fail (R-3).

  ```powershell
  supabase migration list
  ```

- [ ] 18.3 Run T-42 to T-48 and T-53 on the environments of 10.7 (T-42 and T-43 on L by script; T-44 on L and W; T-45, T-46, T-47, T-48 and T-53 on H with W and API, and D for T-53), with the release-candidate build of the admin web (`npm run admin`). Record each result, with date, working-copy manifest, build/environment/fixture identity and the build's commit hash, in `docs/test-results/MVP.md` under "Admin web".

  ```powershell
  git rev-parse --short HEAD; npm run admin
  ```

- [ ] 18.4 AT-17 scripts check: Actual create-accounts.ts/.ps1 callers and proposed create-user.ts/disable-user.ts/export-db.ts/copy-media.ts wrappers delegate to `@dologram/admin-core` and contain no direct `auth.admin` or `storage.from` call (M4-08: "make the scripts call it").

  ```powershell
  Select-String -Path scripts\create-accounts.ts,scripts\create-user.ts,scripts\disable-user.ts,scripts\export-db.ts,scripts\copy-media.ts -Pattern "auth\.admin|storage\.from"
  ```

- [ ] 18.5 Prepare R-7 handoff procedure and rehearse with disposable fixtures. Real accounts/password delivery/APK distribution/external messages require owner-attended rollout authorization covering accounts/recipients. Record rollout pending until performed. User-web address and source-matched approved APK must exist before handoff. Preserve D-110 irreversible limits. Account deletion is not reversible rollback.

- [ ] 18.6 R-8: open the Overview. Every usage bar is under 80%, or the D-123 action has been taken and recorded; the project is not paused; the export is not Overdue.

  ```powershell
  npm run admin
  ```

- [ ] 18.7 Update `docs/runbook.md` (M4-05) so that the weekly export, the monthly media copy, the purge and the monthly usage check (D-45) say "run from the admin web at http://127.0.0.1:3100 (ADM-06, ADM-02); the scripts remain as the fallback" (D-102).

  ```powershell
  Select-String -Path docs\runbook.md -Pattern "127.0.0.1:3100"
  ```

**Deliverables:** the "Admin web" section of `docs/test-results/MVP.md` with T-42 to T-48 and T-53, the R-7 procedure and separately authorized rollout record, and the runbook update.

**Acceptance criteria**

Tests: T-42, T-43, T-44, T-45, T-46, T-47, T-48, T-53; AT-17.

- [ ] T-42, T-43, T-44, T-45, T-46, T-47, T-48 and T-53 are recorded as passed. (Yes or no; M4-08.)
- [ ] The contacts' accounts were created through the admin web, and each contact sees Saved Messages. (Yes or no; M4-08, R-7.)
- [ ] The Overview shows no red bar, and every amber bar has its D-123 action recorded in the audit log. (Yes or no; R-8, D-123.)
- [ ] The admin web is reachable only at `http://127.0.0.1:3100` and has no deployment anywhere. (Yes or no; D-102, AC-1.)

**Exit gate:** `docs/test-results/MVP.md` lists T-42 to T-48 and T-53 as passed with matching source/build/environment identities and evidence. Search locates records, then review their status/artifacts. A text match alone cannot pass. Locate entries with:

```powershell
Select-String -Path docs\test-results\MVP.md -Pattern "T-4[2-8]|T-53"
```

**Risks and fallbacks**

- A hosted-only test fails because of a Management API change (PR-19): the panel falls back to CMP-30 and hand entry (D-107), and the test is re-run; T-48's usage criterion uses a hand-entered value in any case.

### Phase 19: V2 premium switches

**Profiles.roles revision — 2026-11-15:** Premium switches require the current acting admin role, but the target remains one normal DoloGram account. Premium flags and application roles are independent; a premium update must never change roles, create an account or grant admin access. Existing V2/schema/RLS prerequisites remain.

- **Goal:** Let the owner set the premium flags badge, extra_reactions and premium_stickers on ADM-05 and see them on ADM-03.
- **Depends on:** Phase 18; M5-08 (V2 premium), M5-03 (V2 publication tables, for step 19.5).
- **Implements:** ADM-03 (Premium column), ADM-05 (premium switches), D-72, D-87, D-119, M4-08 ("the premium switches stay hidden until M5-08"), M5-08, T-31.

**Steps**

- [ ] 19.1 `packages/admin-core/src/accounts/premium.ts`: `setPremiumFlag(userId, flag, on)` accepts only `badge`, `extra_reactions` and `premium_stickers` (D-72) and runs `update public.profiles set premium_flags = case when $3 then (select array_agg(distinct f) from unnest(coalesce(premium_flags, '{}') || array[$2]) f) else array_remove(coalesce(premium_flags, '{}'), $2) end where user_id = $1`. Audit `premium.set` with `{ flag, on }`. Removing `extra_reactions` leaves the active extra reactions in place (D-119, enforced by the database).

  ```powershell
  npm run test --workspace packages/admin-core -- premium
  ```

- [ ] 19.2 Server action `setPremiumFlag` in `apps/admin/src/app/(admin)/accounts/[userId]/actions.ts`, wrapped by `guardedAction("setPremiumFlag")`.

  ```powershell
  npm run typecheck --workspace apps/admin
  ```

- [ ] 19.3 ADM-05: in the Actions card, three SwitchRows (CMP-04) labeled "badge", "extra_reactions" and "premium_stickers". While a change is saved, the switch shows its pending state, and the value changes only after success (12.4). An error shows the toast "Could not change the premium flag." with Retry.

  ```powershell
  npm run admin
  ```

- [ ] 19.4 ADM-03: fill the Premium column with one StatusPill per flag (premiumBadge, premiumExtraReactions, premiumStickers).

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/premium.spec.ts
  ```

- [ ] 19.5 ADM-08: after verified M5-03, add poll_votes/polls to the Phase 12 migration-derived set, preserving member/call/memo additions. Update the set in `settings/check.ts` and its test.

  ```powershell
  npm run test --workspace packages/admin-core -- settings
  ```

- [ ] 19.6 T-31 on H with W and API: the owner sets each flag in ADM-05; the user cannot change their own premium_flags through the API; the badge shows for a flagged user; another member reads premium_flags through the API (D-87); an extra reaction is rejected without extra_reactions and accepted with it; after the owner removes the flag, an active extra reaction stays, and once removed it cannot be re-added (D-119). Record the result in the V2 test log.

  ```powershell
  npx --workspace apps/admin playwright test tests/e2e/premium.spec.ts
  ```

**Deliverables:** `premium.ts`, the `setPremiumFlag` action, the ADM-05 switches, the ADM-03 Premium column, the updated ADM-08 publication set, `premium.spec.ts`, and the T-31 record.

**Acceptance criteria**

Tests: T-31; AT-18.

- [ ] Each switch sets and clears exactly one flag, and the ADM-03 pills match. (Yes or no; D-72.)
- [ ] Each change writes one `premium.set` audit row. (Yes or no; D-106.)
- [ ] T-31 passes with the flags set from the admin web. (Yes or no; T-31.)
- [ ] ADM-08 shows Pass for the V2 publication set. (Yes or no; 6.4.)

**Exit gate**

```powershell
npm run test --workspace packages/admin-core; npx --workspace apps/admin playwright test tests/e2e/premium.spec.ts
```

**Risks and fallbacks**

- `premium_flags` is null on old rows: the SQL treats null as an empty array (`coalesce(premium_flags, '{}')`) in both branches.

## 6. Cross-phase test plan

### 6.1 Existing v14 tests

L means confirmed disposable local Supabase, H specifically authorized hosted target, W desktop browser, D assigned MuMu via ADB and API fixture-user sessions. Physical devices are excluded. Loopback UI hosting does not establish backend isolation. Missing user-web blocks its release shares, while independent isolated admin work continues.

| Test | What it proves for the admin web | First run | Re-run | Environments | Record |
|---|---|---|---|---|---|
| T-42 | No secret key, database URL or access token in the admin client bundle (with the web and mobile bundles). | Phase 17 (step 17.1); early check in Phase 0 | Phase 18; after every dependency upgrade | L; script | `docs/test-results/MVP.md` |
| T-43 | No content reads outside the DC-2 allowlist; every server action is a 6.6 function. | Phase 17 (step 17.2) | Phase 18; every phase that adds an action | L; script | same |
| T-44 | Unlock gate, cross-origin and wrong-Host refusal, lockout after 5 wrong passcodes. | Phase 4 | Phases 17 and 18 | L; W; script | same |
| T-45 | A created account must change its password and reads nothing until then; the password is not in the audit log or BACKUP_DIR. | Phase 8 | Phase 18 | H; W; API | same |
| T-46 | CSV preview marks the invalid row; exactly three accounts with Saved Messages. | Phase 9 | Phase 18 | H; W | same |
| T-47 | Reset, ban (including the 15-minute channel window), unban, audit rows. | Phase 10 | Phase 18 | H; W; API | same |
| T-48 | Export, two media copies, purge preview and purge, Overview done, restore drill, amber bar at 80%. | Phase 15 (display half in Phase 3, bar in Phase 13) | Phase 18 | H; W | same |
| T-53 | Deletion on request erases and disables the account with no hard delete. | Phase 11 | Phase 18 | H; W; API; D | same |
| T-31 | Premium flags set by the owner behave as D-87 and D-119 require. | Phase 19 | V2 gate M5-11 | H; W; API | V2 test log |
| T-40 (shared-token part only) | The 12.2 pairs used by the admin reach 4.5:1 and 3:1. | Phase 1 | Phase 16 | L; script | `docs/test-results/MVP.md` |
| T-16 | Catalog check of RLS on every public table, reused as ADM-08 row 7. | Phase 12 (as a screen check) | Phase 18 | H | same |

### 6.2 New admin tests with plan-local AT identifiers

| Test | Scenario | Pass criteria | Phase | Command |
|---|---|---|---|---|
| AT-01 | Start the admin web and list the listening sockets on port 3100. | Only 127.0.0.1 listens (D-102). | 0 | `Get-NetTCPConnection -LocalPort 3100 -State Listen` |
| AT-02 | Search the admin source for public variables and browser Supabase clients. | No `NEXT_PUBLIC_` and no browser Supabase client in apps/admin (AC-6). | 17 | `node apps/admin/scripts/audit-server-actions.mjs` |
| AT-03 | Run the component suite. | Every CMP-01 to CMP-04, CMP-16 to CMP-20 and CMP-24 to CMP-31 test passes. | 1 to 3 | `npm run test --workspace apps/admin` |
| AT-04 | Sign in as an existing admin/ordinary user; attempt self-promotion; demote a live admin; age/revoke/sign out sessions; send forged direct action/API/RSC requests. | Only currently-authorized accounts enter; DB role writes are protected; demotion and Sign out revoke further access. | Revised 4 | Commands established by revised 4.9; old passcode fixtures are historical only. |
| AT-05 | Write an audit row whose detail holds a `password` key. | The write is refused and the action reports failure (D-106). | 6 | `npm run test --workspace packages/admin-core -- audit` |
| AT-06 | Search and filter ADM-03. | A partial, mixed-case search finds the account; each filter returns only its status. | 7 | `npx --workspace apps/admin playwright test tests/e2e/accounts.spec.ts` |
| AT-07 | Generate server drafts and test bounds, session binding, expiry and replay. | Length/alphabet match D-105, generation uses crypto.randomInt, and client-selected/expired/replayed drafts cannot create an account. | 8 | `npm run test --workspace packages/admin-core -- passwords` |
| AT-08 | Import CSVs of 101 rows and with a wrong header. | Create is disabled with the 12.9 message, or the header message shows (D-81). | 9 | `npx --workspace apps/admin playwright test tests/e2e/import-csv.spec.ts` |
| AT-09 | Run ADM-08 with a valid and an invalid access token. | Valid: no Fail on H. Invalid: API rows show "Check by hand"; SQL rows still Pass or Fail (D-107). | 12 | `npm run test --workspace packages/admin-core -- settings` |
| AT-10 | Feed usage of 79.9%, 80%, 99.9% and 100%. | Brand, amber, amber, red, each with text and icon (D-45, D-123). | 3, 13 | `npx --workspace apps/admin playwright test tests/e2e/overview.spec.ts` |
| AT-11 | Start a second job while one runs. | Refused with "Another job is running" (ADM-06). | 14 | `npm run test --workspace apps/admin -- jobs` |
| AT-12 | Render every route in light and dark color schemes. | The body background equals color.bg.app for that scheme; no theme control exists (D-109). | 16 | `npx --workspace apps/admin playwright test tests/e2e/a11y.spec.ts` |
| AT-13 | Run axe on every route in both themes. | No serious or critical violation (D-95). | 16 | same |
| AT-14 | Measure every interactive element. | Each is at least 32 by 32 px (D-136). | 16 | same |
| AT-15 | Run with Supabase unreachable. | Data panels show CMP-30; the shell, Unlock and Lock now work (F12). | 16 | step 16.6 |
| AT-16 | Read the response headers of `/`. | `X-Frame-Options: DENY`, the CSP of step 17.5 and `Cache-Control: no-store`. | 17 | `(Invoke-WebRequest http://127.0.0.1:3100/unlock -UseBasicParsing).Headers` |
| AT-17 | Search the scripts for direct Admin API or Storage calls. | None; every script imports `@dologram/admin-core` (M4-08). | 18 | step 18.4 |
| AT-18 | Toggle each premium switch. | One flag changes per toggle, with one audit row (D-72, D-106). | 19 | `npx --workspace apps/admin playwright test tests/e2e/premium.spec.ts` |

### 6.3 Regression rule

Each phase runs affected lint/CSS lint/typecheck and meaningful unit/integration checks. Build/browser/security checks apply to routes/framework/config/dependencies and Phases 17–18. Broaden root/mobile checks for shared-contract/dependency impact. Preserve unrelated failures. Policy changes rerun permission/consumer tests. Phase 18 requires full release matrix. Record passed/failed/blocked/not run with evidence under Section 0 isolation/timeouts/cleanup. A new phase number alone does not require repeated full builds/E2E.

## Appendix A: Proposed decisions

Historical D-164–D-180 proposals remain plan-local references because later mobile decisions overlap these numbers. Allocate unique global IDs before merging. Section 0 records evidence/proposals/unresolved policy.

| Proposed ID | Decision | Reason | Phase |
|---|---|---|---|
| D-164 | Passcode/helper requirement cancelled by the 2026-11-15 user revision. Retain the unrelated D-105 generated-account-password alphabet and crypto.randomInt contract for Phase 8. | Existing account credentials and a protected database role replace admin passcode setup. | 4 (superseded), 8 (password generation retained) |
| D-165 | Superseded session contract: opaque local cookie sessions bind verified Auth UUID/server-only Auth state; every privileged request verifies identity/current DB admin role. Preserve HttpOnly/Strict, 8h idle, passive polling and restart expiry; local Sign out remains available during outages. | Account-role authorization replaces anonymous passcode sessions. | 4 |
| D-166 | `npm run admin` builds and then runs `next start -H 127.0.0.1 -p 3100`; `npm run admin:dev` runs `next dev` on the same address for development only. | 6.6 names `npm run admin`; a production build is what T-42 scans. Binding to 127.0.0.1 keeps the app off the network (D-102). | 0 |
| D-167 | Superseded on 2026-11-15: remove ADMIN_OWNER_USER_ID. Actor identity comes from verified Auth and authorization from the current protected database application role; protect currently-admin targets from Ban/Delete. | User-requested account-role model. | 4, 7, 10, 11 |
| D-168 | `packages/admin-core` reads `SUPABASE_URL`, which 10.2 already defines for scripts and tests, for the Auth Admin and Storage APIs. | AG-2: the scripts call admin-core, so the same variable serves both. | 0 |
| D-169 | Only `packages/admin-core/src` and `apps/admin/src/server` read `process.env`. `apps/admin` has no `NEXT_PUBLIC_` variable and no browser Supabase client. `packages/admin-core` starts with `import "server-only"`. | Makes D-102 checkable at build time and by AT-02. | 0, 17 |
| D-170 | admin-core reaches Supabase in three ways: the Auth Admin API and the Storage API through supabase-js with the secret key; SQL through the `postgres` driver over `SUPABASE_DB_URL` (audit, account list from `auth.users`, ban fallback, settings checks, deletion, purge preview, usage fallback); the Management API through `fetch` with `SUPABASE_ACCESS_TOKEN`. | 10.5 says the admin web writes the private schema over `SUPABASE_DB_URL`; D-107 assigns status, usage and settings to the Management API. | 0, 6, 7 |
| D-171 | Every privileged mutation requires registered policy, Host/Origin, verified account identity and current database admin role. Only account sign-in is public; local Sign out may revoke its own local state during an outage without granting business privileges. Unknown names fail closed. | Replaces public-passcode registry policy under the user revision; verify exact export names during implementation. | 4, 17 |
| D-172 | The audit action names are the 17 names of step 6.5, each with a typed detail; action-specific detail schemas allow required safe counts and reject credentials/content. | AG-5: Action-specific schemas enforce safe allowed fields and values. | 6 |
| D-173 | Admin tests use Vitest with Testing Library and jsdom for units and components, and Playwright with @axe-core/playwright for end-to-end, accessibility and security checks against 127.0.0.1:3100. | D-100 fixes Vitest for unit and API tests; T-44 and the D-95 checks need a real browser. Both tools are free. | 1, 4, 16 |
| D-174 | ADM-04 parses CSV files in the browser with papaparse; the result CSV is built in the browser as a Blob. | D-105 requires the download to be built in the browser; parsing there keeps the file off the server. | 9 |
| D-175 | When the Management API returns no database or storage usage, the Overview uses `pg_database_size(current_database())` and the sum of `storage.objects` sizes, before falling back to hand entry. | Labelled SQL estimates with source/time that reveal no content. Physical database/Storage metadata totals can differ from billing usage. Amends nothing; extends the D-107 fallback. | 13 |
| D-176 | A maintenance job is Overdue at twice its due interval: the export after 14 days, the media copy and the purge after 62 days; a job that never ran is Overdue. | ADM-02 names Due and Overdue but gives only the due intervals. | 13 |
| D-177 | A purge preview is valid for 15 minutes; Purge revalidates versions/eligibility, deleting unchanged eligible identities and reporting differences. | Makes T-48's "preview counts match what the purge deletes" exact. | 15 |
| D-178 | The admin web sends `X-Frame-Options: DENY`, a CSP with `frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store` on HTML and RSC responses. | Another local page must not frame the admin web, and pages showing one-time passwords must not be cached (D-104, D-105). | 17 |
| D-179 | Maintenance jobs run in memory, one at a time; the browser polls `GET /api/jobs/current` every 1000 ms while a job runs; the log keeps the last 200 lines and the panel shows 8. | ADM-06 requires one job at a time with progress; CMP-29 shows 8 log lines. | 14 |
| D-180 | The T-43 content-read search allowlists exactly `maintenance/mediaCopy.ts`, `maintenance/purge.ts` and `accounts/deleteAccount.ts` in `packages/admin-core/src`, none of which returns message text or file bytes to the UI. | DC-2: v14's own jobs (D-74, D-75, D-110) touch those tables. | 11, 14, 15, 17 |

## Appendix B: New flags and gaps

Proposed flag numbers for the admin plan start at PF-38, to avoid collision with the Android plan's PF-25 to PF-31.

| ID | Proposed flag | Where | Gap or conflict and effect | Handling in this plan |
|---|---|---|---|---|
| AF-1 | PF-38 | AC-7 | `DoloGram_Android_Implementation_Plan.md` exists at `G:\codebase\DoloGram\Plans\` (verified). The package name is verified as @dologram/shared. | Verified package is @dologram/shared. Recheck if package identity/exports change. |
| AF-2 | PF-39 | DC-4, 12.10 | tokens.css and generator are absent in the inspected working copy. | Phase 1 adds the deterministic shared system CSS projection and tests under AB-04. |
| AF-3 | PF-40 | DC-1, D-103, ADM-03 | "Last sign-in" may count as per-user activity. | Shown, because 11.4 and 12.9 list it; the owner confirms at merge. |
| AF-4 | PF-41 | DC-2, T-43 | T-43's wording conflicts with D-74, D-75 and D-110. | D-180 allowlist; T-43's text should name the three jobs. |
| AF-5 | PF-42 | DC-3, ADM-06, M4-05 | One export file named in ADM-06, three dumps in M4-05. | Three files; ADM-06 should name all three. |
| AF-6 | PF-43 | DC-5, 12.10 | CMP-23 Menu is marked for admin use but no admin screen uses it. | Not built for the admin web. |
| AF-7 | PF-44 | Phase 14, D-102 | Installed connection method/version requires discovery, with possible argument exposure. | Verify protected invocation/redaction and record residual exposure before export acceptance. |
| AG-1 | PF-45 | 11.4, D-108 | No contract element identifies the owner's account. | D-167 `ADMIN_OWNER_USER_ID`. |
| AG-2 | PF-46 | 10.2 | `SUPABASE_URL` is not listed for the admin web. | D-168. |
| AG-3 | none (D-107 already covers it) | D-107, PR-19 | Management API coverage for a Free project is unverified. | CMP-30 and hand entry; checked in Phases 12 and 13. |
| AG-4 | PF-47 | D-104 | No minimum passcode length. | D-164: at least 12 characters. |
| AG-5 | PF-48 | D-106 | No audit action names. | D-172. |
| AG-6 | PF-49 | 6.2 | No column types for `private.admin_audit`. | Types of Phase 6 step 6.2 (AS-9). |
| AG-7 | PF-50 | D-123, ADM-02 | D-123 gives no action for the monthly-active-users bar. | The bar shows "The Pro plan is the only option beyond the Free plan." (from D-41). |

## Appendix C: Assumptions and unverified claims

Each assumption names where it is checked and the fallback that applies if it is wrong.

| ID | Assumption | Checked in | Fallback |
|---|---|---|---|
| AS-1 | Module state on `globalThis` is shared by the server components, route handlers and server actions of one `next start` process. | Phase 4 (AT-04) | Session and lockout state in a dedicated owner-only runtime state file outside backup exports. |
| AS-2 | The loopback HTTP cookie behavior must be checked in the designated desktop browsers. | Phase 4 | None needed; D-104 requires only HttpOnly and SameSite=Strict. |
| AS-3 | Corrected by official docs. Next.js 16 renamed middleware to proxy. | Phase 0 pin/Phase 4 | Use supported convention and verify discovery. |
| AS-4 | Browsers treat `http://127.0.0.1` as a secure context, so `navigator.clipboard` works. | Phase 3 | Select the text and show "Press Ctrl+C to copy". |
| AS-5 | `SUPABASE_DB_URL` may point at the Supavisor pooler, which needs `prepare: false`. | Phase 6 | Use the session-pooler connection string. |
| AS-6 | Running the scripts with `--conditions=react-server` makes `server-only` resolve to its empty module. | Phase 8 step 8.6 | `node --conditions=react-server --import tsx`. |
| AS-7 | `auth.admin.updateUserById` merges `app_metadata` keys. | Phase 10 step 10.1 | Read with `getUserById`, merge, then update. |
| AS-8 | Auth durations need version/target verification. | Phase 10 | Only an effective verified AB-02 fallback is permitted, with no absent-table query or automatic success. |
| AS-9 | The `private.admin_audit` column types of step 6.2 suit D-106. | Phase 6 | Change in a new migration before Phase 18. |
| AS-10 | ADM-03 is ordered by created, newest first; 12.9 fixes an order without naming it. | Phase 7 | Change the ORDER BY. |
| AS-11 | The Management API paths and field names of steps 12.2 and 13.2. | Phases 12 and 13 (D-85 item 13) | CMP-30 with the Dashboard link (D-107). |
| AS-12 | The Supabase Dashboard URL paths of step 12.3. | Phase 12 | The project home `https://supabase.com/dashboard/project/<ref>`. |
| AS-13 | The single egress bar of ADM-02 means uncached egress (5 GB); cached egress (5 GB) is not shown. | Phase 13 | Add a seventh bar if the owner wants it (a change to 11.4). |
| AS-14 | The plan is readable from the organization endpoint, and `POST /v1/projects/{ref}/restore` restores a paused Free project. | Phase 13 (D-107) | "unavailable" with a Dashboard link. |
| AS-15 | The Management API returns at least database size and egress for a Free project. | Phase 13 step 13.5 | D-175 SQL estimates, then hand entry. |
| AS-16 | `supabase` and `docker` are executables on PATH. | Phase 14 step 14.3 | Call the `.cmd` shim through `cmd.exe /d /s /c`. |
| AS-17 | Runbook/checklist is absent and requires the AB-05 handoff. | Phase 14 prerequisite/Phase 15 | Missing checklist blocks the restore-drill gate, with a named next action. |
| AS-18 | `tokens.css` exposes motion.delay.loading as `--dg-motion-delay-loading`, per the 12.10 naming rule. | Phase 16 | Read the delay from `tokens.ts` at build time. |
| AS-19 | Test process must prove which isolated configuration it loaded, including overrides. | Phase 16 step 16.6 | Use a separate isolated process/configuration, preserving the active env file. |
| AS-20 | The repository root is `G:\codebase\DoloGram` with the 10.2 layout. | Phase 0 | Run the commands from the actual root. |
| AS-21 | The create-next-app flags of step 0.2 exist in the current release. | Phase 0 | Map the same choices with `--help`. |
| AS-22 | Verified package name is @dologram/shared. | Recheck if source changes. | Preserve exports/callers. |
| AS-23 | Actual callers are create-accounts.ts/.ps1. Fixture identities remain unverified. | Phases 7–10 | Integrate callers and discover disposable fixtures, excluding embedded credentials. |
| AS-24 | Dump scope has version-specific managed-schema exclusions. | Phase 14 | Prove public/private/Auth/Storage coverage by isolated restore. |
| AS-25 | Direct SQL privileges/trigger behavior require verification on the intended target. | Phase 11 | Resolve the contract under AB-02/03 while preserving atomic SQL erasure. No unverified multi-request REST substitution. |

| AS-26 | Official docs list --use-copy. Installed CLI/connection flags remain unverified. | Phase 14 | Pin supported commands and verify restore. |

Unverified claims that come from v14 itself and stay unverified until their check point: the Management API coverage of D-107 (checked in Phases 12 and 13); the BEFORE UPDATE trigger on auth.users of D-78 (checked at M1-03, read in Phase 7); the Admin API ban of D-85 item 8 (checked at M1-08, re-checked in Phase 10).

## Appendix D: Traceability

| Document ID | Phase |
|---|---|
| 6.6 Admin Web | 0 to 18 |
| 10.2 environment and layout | 0, 12 |
| 10.8 R-1 | 6, 18 |
| 10.8 R-2, R-3 | 6, 18 |
| 10.8 R-7, R-8 | 18 |
| 11.4 Navigation | 5 |
| 11.6 Shared Rules (admin strings, states, offline) | 1, 16 |
| 12.2 Design Tokens | 1, 16 |
| 12.3 Iconography | 1 |
| 12.6 admin routes and shell | 5 |
| 12.7 admin row | 2, 5, 16 |
| 12.8 Accessibility Defaults | 3, 5, 16 |
| 12.9 Admin Web Components | 2, 3, and the screens of 4 to 15 |
| 12.10 Implementation Mapping | 1, 2 |
| F12 | 4 to 18 |
| ADM-01 | 4 |
| ADM-02 | 13 |
| ADM-03 | 7, 19 |
| ADM-04 | 8, 9 |
| ADM-05 | 10, 11, 19 |
| ADM-06 | 14, 15 |
| ADM-07 | 6 |
| ADM-08 | 12, 19 |
| CMP-01, CMP-02, CMP-03, CMP-04 | 1 |
| CMP-16, CMP-17 | 3 |
| CMP-18, CMP-19, CMP-20 | 1 |
| CMP-21 (admin header) | 5 |
| CMP-24, CMP-25, CMP-30, CMP-31 | 2 |
| CMP-26, CMP-27, CMP-28, CMP-29 | 3 |
| D-41, D-45 | 13 |
| D-47 | 8, 18 |
| D-61 | 10, 11 |
| D-72, D-87, D-119 | 19 |
| D-74 | 14 |
| D-75 | 15 |
| D-78, D-86 | 7, 8, 10 |
| D-81 | 9 |
| D-89, D-116 | 8, 9 |
| D-95 | 1, 16 |
| D-102 | 0, 8, 10, 14, 17, 18 |
| D-103 | 7, 17 |
| D-104 | 4, 17 |
| D-105 | 3, 8, 9, 10 |
| D-106 | 6 and every later phase |
| D-107 | 12, 13 |
| D-108 | 3, 7, 10, 11 |
| D-109 item 13 | 1, 16 |
| D-110 | 11 |
| D-114 | 10, 12 |
| D-123 | 13, 15 |
| D-125 | 13 |
| D-129, D-130, D-131 | 1 |
| D-134 | 1, 3, 16 |
| D-135 | 5, 16 |
| D-136 | 1, 5, 16 |
| D-137 | 2, 3 |
| D-138 | 1, 16 |
| M1-08 | 8, 10 |
| M4-02 | 1 |
| M4-05 | 14, 15, 18 |
| M4-07 | 18 |
| M4-08 | 0 to 18 |
| M5-03, M5-08 | 19 |
| PF-18 | 15 |
| PR-19 | 12, 13, 18 |
| PR-20 | 11 |
| T-31 | 19 |
| T-40 (shared tokens) | 1, 16 |
| T-42, T-43 | 17, 18 |
| T-44 | 4, 17, 18 |
| T-45 | 8, 18 |
| T-46 | 9, 18 |
| T-47 | 10, 18 |
| T-48 | 3, 13, 14, 15, 18 |
| T-53 | 11, 18 |

