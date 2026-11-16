# DoloGram Admin Web Context Index

Inspected and refined on 2026-11-14, Asia/Manila. Scope is plan polishing and supporting inspection. Implementation/runtime acceptance remains pending. The consolidated plan is [DoloGram_Admin_Web_Implementation_Plan.md](../DoloGram_Admin_Web_Implementation_Plan.md).

## Source identity and working copy

Repository root is G:\codebase\DoloGram. Inspected HEAD was d906bff38ea932c1cab6410b13c6d102e9069067. Existing extensive tracked changes and untracked inputs are user-owned. The admin plan had no pre-existing diff. Baseline status is in supabase/repomix/admin-plan-polish-20261114/status-before.txt. Source hashes, sizes and inspection depth are in source-identities.json in that directory. Final hashes were rechecked. No commit identity substitutes for working-copy state.

During inspection, apps/mobile/package.json changed concurrently, removing react-native-view-shot. The initial packet entry is stale for that file. The one-file supplement was read completely and matched the current source. Expo/RN/React compatibility versions used in the plan were unchanged. No other source changed between the identity manifest and final recheck. Current values must be revalidated before implementation.

## Instructions and context workflow

- Root AGENTS.md requires Repomix at repository root and packs/logs under supabase/repomix. repomix.config.json points there and excludes generated packets.
- supabase/AGENTS.md requires next sequential zero-padded migration numbers and preserving applied versions. Proposed admin migration uses the next available number after actual ledger discovery, rather than timestamp naming.
- apps/mobile/AGENTS.md was read as mobile-consumer context. Its mobile-code checks apply when implementation affects those sources. No mobile APIs were implemented in this polishing pass.
- Discovery used bounded ripgrep searches, current source reads and relevant diffs. Initial broad output was truncated, so the entire admin plan was subsequently read across explicit bounded continuation ranges. Required packet entries were read completely. Larger source files were inspected by relevant symbols/ranges, as listed below.
- Existing Search/Memo/Local-update context indexes/reports were considered historical reference. Their runtime results were not promoted into current admin acceptance. No usage-savings estimate is claimed.

## Packet inventory and freshness

The focused uncompressed parsable XML packet context.xml contains the 15 exact paths in packet-scope.txt. Actual entries matched the intended set with no unexplained omission. Generation/security results are in repomix.log. The complete packet was read in two bounded chunks. The 14 unchanged entries matched current original text after newline normalization. mobile-package-supplement.xml replaces the stale apps/mobile/package.json entry, with its separate generation log and a complete read. The supplement contains exactly one entry and matches current original text. Hashes are recorded in source-identities.json.

Packet scope covers root/Supabase instructions, Repomix config, root/shared/mobile manifests, tsconfig.base.json, shared account validation/icon map, function config, migrations 018/024/026/039 and the Nov 14 memo-sync evidence. Supplemental original reads cover current theme/Auth/Storage/schema/publication and mobile progress relationships. This packet is deliberately narrower than the full repository.

Excluded from packets are .env files, credentials, legacy provisioning script bodies, account/user content, backups, generated native files, APKs, caches, node_modules and unrelated application sources. Legacy script identities are hashed without copying credential-bearing bodies. The source DOCX is identified by hash. v14-admin-excerpts.txt contains only inspected admin/decision sections extracted from OOXML. The full temporary extraction was removed. plan-before.md preserves the original plan for recoverability. All generated artifacts stay inside supabase/repomix/admin-plan-polish-20261114.

## Inspected source relationships

| Sources and inspected locations | Finding and plan use |
|---|---|
| Documentation/DoloGram_Documentation_v14.docx, extracted 6.6, D-108–111, 11.4, 12.9 and beginning of 12.10 | Verified local-only passcode/admin scope, account CRUD/erasure, audit, usage and maintenance requirements. Preserved existing component/phase detail. Explicit conflicts remain recorded in Section 0/2. |
| package.json, shared/mobile manifests, tsconfig.base.json, README | Workspace globs already discover admin/core. No admin/tokens scripts/workspaces. Current React overrides and TypeScript require compatible version selection. The second-pass user instruction resolves artifact preference in favor of existing local Gradle when release/dev-client APKs are needed. See plan Section 0.6. |
| shared validation/account.ts complete, index.ts export list, theme/icons.ts complete, tokens.ts colors/motion and token-name searches | Actual reusable validation exports exist. CSS/generator and admin semantic tokens/icons have gaps. Phase 1 owns required projection and mapping. Preserve current mobile palette. |
| migrations 012/018 complete, 016 schema/sequence/reaction/policy sections, migration-wide targeted D-78/disabled/premium/handoff searches | Profile/Saved Messages exist. Password clearing/deny fallback and admin audit are unverified or absent. Message deletion does not automatically clear content. Reaction UPDATE/handoff contracts need backend evidence. |
| mobile AuthProvider.tsx flag/profile/session code and diff, app/_layout.tsx guard references, change-password.tsx update/refresh path | Forced-change UI consumes app_metadata and expects backend clearing. Profile email/metadata trigger ordering matters during erasure. UI guard cannot establish backend authorization. |
| migrations 019/021 bucket policies, 024 complete, shared db/repositories/media.ts canonical path/bucket functions | avatars already exists. Chat media paths use chat/media identity with media_type bucket mapping. Individual attachment tombstones must participate in purge. |
| 026 complete, 029 publication/eligibility/table definitions, 035/036 memo tables/bucket/publication/grants, 038 receipt cleanup, 039 complete | Publication grew beyond v14 three-table set. Calling eligibility is specific to calls. Memo-assets privacy/retention and new call/memo account data require explicit lifecycle disposition. |
| supabase/config.toml complete/current diff, migrations/tests filename discovery | Config contains function settings without local stack/Auth setup. Latest local migration is 040. Proposed M1/MVP/runbook/API helper paths are missing. Isolated target setup must be discovered. |
| scripts/create-accounts.ts complete inspection and .ps1 invocation/filter inspection, filenames/caller discovery | Existing legacy provisioning has embedded account inputs and signup behavior. Integrate actual callers, remove obsolete scoped implementation and exclude credentials from context/diagnostics. |
| Android plan opening policy/prerequisites/progress and Phase 17 report | Self-service signup supersedes signup-off check. Historical physical-device/cloud restrictions conflict with later MuMu constraints. Android release evidence retains unmet runtime/artifact shares. |
| Calling Phase 7 report, Search Phase 12 report, Seen Phase 6 report, Memo Phase 6 and Nov 14 sync report, Local-update Phase 3 report/index | Distinguish coded/automated completion from optional live checks and required service/artifact gaps. Memo-sync deployment/anonymous rejection does not prove authenticated transfer. No admin check is passed by these reports. |

## Official documentation checks

Next.js documentation confirms middleware was renamed to proxy in version 16. The old plan's universal middleware assertion was corrected. Setup/exports/request APIs still require matching the execution-time pinned release. [Next.js Proxy reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

Supabase documents managed-schema exclusions and --use-copy. Installed connection flags/version and actual backup coverage remain execution discoveries. Nonempty output cannot prove a restorable export. [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction), [Backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Decisions and open work

The plan preserves Phases 0–19, accepted local-only/passcode/no-content scope and conditional premium work. Material corrections include source-derived prerequisites, self-service signup/current publication, sequential migration naming, actual provisioning callers, missing CSS projection, direct server guards, removal of proposed production test bypass endpoints, audit/external-effect consistency, deletion recovery and attachment-aware purge. Historical D/AT proposals are kept local to avoid global ID collisions.

AB-01–07 in the plan give evidence, affected requirements, resolution and independent work. Open execution gates include missing backend password/ban/deletion contracts, absent user-web release shares, CSS projection, runbook/isolated restore, owner/target/API discovery and memo/call erasure/backup disposition. No additional owner decision was invented to block independent scaffold/fixture work.

Out-of-scope findings include embedded legacy account credentials, pre-existing mobile lint/test failures, pending APK/native runtime checks and historical build-policy conflicts now resolved for this plan by the second-pass local Gradle instruction. Credential values are excluded here. Scoped provisioning cleanup is planned, with broader credential remediation left to its own authorization. No unrelated issue was fixed or made an admin acceptance requirement.

## Verification of this polishing pass

- Read-only working-copy discovery and source inspection completed. Context freshness/omission checks completed with the one recorded supplement.
- Requirement rows ADM-R01–13 map acceptance to work and verification. Phase bodies and shared execution rules define prerequisites, baselines, proposed components, acceptance gates, recovery/cleanup and progress reporting.
- Plan-only structural checks verify Phase 0 through Phase 19, unique numbered work items and balanced Markdown fences. git diff --check is recorded separately in polish-verification.json.
- Application lint/typecheck/tests/builds, services, migrations and hosted operations were not run during polishing. Historical results are cited with limits. Every implementation acceptance remains pending.

Invalidate relevant findings when an identified source, target schema/configuration, approved artifact or dependency changes. Refresh only affected context and repeat the original-source checks before using it for execution.

## Second-pass quality audit

The candidate plan and its decision/assumption tables were audited against reused source evidence. A read-only comparison of all 45 prior source identities found no drift. No packet was regenerated and no operational verification was run. The prior polish-verification.json describes the first pass only. second-pass-audit.json records this revision.

Confirmed defects repaired were inconsistent Phase 0 environment parsing/start order, a circular Phase 1 CSS prerequisite, session enforcement before Unlock policy lookup, API redirects returning HTML to JSON callers, audit tests scheduled before setup, unconditional absent-table ban fallback, acceptance of caller-selected initial passwords and incomplete runtime secret-scan evidence. The plan now has separate lazy configuration parsers, policy-first guards, capability-aware mutations, bound server password drafts, correct test setup order and meaningful negative/runtime leak tests. Settings reads/audited mutations and stale assumption fallbacks were aligned. Explicit completion reporting prevents 100% while required gates remain open.

The user selected local Gradle for multiple required release/dev-client artifacts. Original sources inspected solely for that decision were scripts/build-android-local.ps1 (parameters, prerequisites, prebuild/assemble workflow and output checks) and scripts/android-release.init.gradle (complete signing input/variant configuration). Their hashes are in second-pass-audit.json. No credential file contents were inspected. The wrapper is a candidate execution entry point, with runtime/SDK/signer compatibility still checked before an authorized build.

Readiness is Ready for execution at Phase 0, pending a separate instruction to implement. Tool/version discovery belongs to the first Phase 0 work item. Later AB-01–07 gates retain affected requirements and next actions in Section 0.4/0.6. They cannot be bypassed by fixture-only evidence. No admin implementation or project completion is claimed.

## Phase 0 execution — 2026-11-14

Phase 0 is implemented and verified: 9/9 steps (100%); overall admin-plan progress 9/137 steps (7%). All five Phase 0 acceptance criteria and the loopback HTTP exit gate pass. Phase 1 is ready but was not started. This supersedes historical absent-admin/core findings for Phase 0 only. Concurrent apps/web work is outside this task's ownership. Current source identities, baseline ownership, full packet analysis, exact verification results and later gates are in [the Phase 0 context index](DoloGram_Admin_Web_Phase_00_Context_Index.md). Artifacts are under supabase/repomix/admin-phase-00-20261114/.
