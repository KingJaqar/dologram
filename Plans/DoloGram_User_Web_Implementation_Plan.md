# DoloGram User Web Implementation Plan

Refined 2026-11-14; verification policy revised by owner instruction 2026-11-15, Asia/Manila. Current implementation status: Phases 0–10 complete under the required local/automated verification policy below, with overall required progress **57% (94/166)** per the Phase 10 report. Phase 11 and later phases have not been started. Follow-up changes in this chat cover public configuration, email-or-username sign-in and saved-session error recovery; they add no phase credit. The accepted outcome remains the MVP user web client, WEB-01 through WEB-14, including self-service sign-up and email recovery. Unrun optional isolated/manual checks remain explicitly unverified.

Product reference is `Documentation/DoloGram_Documentation_v14.docx`. Current source establishes available interfaces and the mobile contracts the web must support. Later owner decisions already recorded in this plan retain precedence over v14. D-163 and D-181 are later plan references absent from the original v14 document. Backend changes remain outside this plan's implementation scope. Evidence and source identities are centralized in `Plans/context/DoloGram_User_Web_Context_Index.md`.

## 1. Purpose and how to use this plan

**Purpose.** Build the MVP user web app (screens WEB-01 to WEB-14 of Section 11.3) against the required backend capabilities of Sections 5, 6 and 10.5, using current mobile-compatible contracts. Each executable phase leaves the app runnable with the proposed web dev script and testable in a browser. Missing backend capabilities have explicit owners and release consequences.

**How to use it.**

- Execute only after a separate implementation instruction. This polishing pass authorizes the plan and supporting context artifacts.
- Phases run in dependency order from Phase 0. Each step and acceptance check has a stable identifier. Mark completion only with its required implementation and local/automated verification evidence; optional evidence is recorded separately under D-W26.
- Commands use PowerShell from `G:\codebase\DoloGram` unless stated. Current root/shared commands are confirmed in package manifests. Every web command is proposed until Phase 0 creates and verifies its script. Stop a command chain after a failed prerequisite.
- Use the current working copy, including relevant untracked files. Read applicable AGENTS instructions, compare relevant diffs, and preserve recoverable patches plus copies of relevant untracked inputs before implementation. Avoid overwriting concurrent work.
- Follow the context index workflow before each phase. Run scoped Repomix from the root with the repository config. Packs and generation logs belong under `supabase/repomix/`. Exclude credentials, `.env*` values, user content, signing material, backups, node_modules and application bundles. Check intended/actual entries and source SHA-256 identities, then verify relationships against originals. Refresh changed dependencies and reuse unchanged evidence only when its environment still applies.
- Pin necessary dependencies after checking peer/runtime compatibility with root React overrides, installed shared tools and the selected Next.js release. Record exact versions in `docs/versions.md`. Avoid broad upgrades and extra abstractions.
- Record phase evidence in proposed `docs/test-results/web/phase-NN.md`. Include source identities, environment/target, command, exit code, redacted diagnostics, requirement/check IDs, and passed, failed, blocked or not-run status. A historical pass is evidence only for its recorded source and environment. An unverified required criterion stays incomplete. An unrun optional check is labeled optional/not run and does not block completion.
- Deliver production-ready required paths with no stubs or placeholders at the full-plan gate. After two operational failures for the same reason, diagnose and change approach or report the blocker. This process rule does not change the accepted eight-attempt message-delivery policy. Set explicit command timeouts and request deadlines before each operation. Use 10 seconds for auth/read/join requests unless an existing contract specifies otherwise, allow bounded upload duration proportional to size/test throttle, and record any longer check deadline. Bound retries, coalesce triggers, and stop task-created processes after use.
- Acceptance gates include lint, typecheck, affected automated tests and observable browser behavior. Capture a relevant baseline before edits. Compare pre-existing failures separately and do not weaken assertions or repair unrelated failures to obtain a pass. Rerun affected checks after relevant changes.
- The phase denominator contains every required active W-P work item plus one separately weighted required gate item G-Wnn. All required items have equal weight unless justified weights are recorded before execution. Optional-only work items/checks have zero weight and are excluded from required completion/progress totals. Mixed items retain their implementation/local-automated weight; their isolated/manual subchecks are optional and have zero additional weight. Before execution, map required work to required AC portions and concrete evidence. The gate requires required AC portions, baseline/regression disposition, cleanup and owned-diff review. A failing/unrun required check leaves its item/gate incomplete; an unrun optional check does not. Report 100% only when every required item/gate is complete. Report current-phase and overall required progress separately, rounded to a whole percentage, and retain optional outcomes in a separate evidence register without counting them as passes. Current totals: 146 required work items + 20 phase gates = **166 required items**; W-P09-S05, W-P19-S04 and W-P19-S05 are optional-only/zero weight. Historical percentages using 169 items describe the earlier policy and are superseded for current progress. During authorized execution use the following format.

`Current execution phase: [name] — [X]% complete. Completed: [verified work]. Remaining: [required work]. Blockers: [none or specific blocker].`

**Shared phase contract.** Proposed relative paths resolve beneath `apps/web` unless prefixed explicitly; the original absent-workspace baseline is historical, and current source/phase reports establish actual prerequisites. Phase 0 starts from the working copy; later phases require their preceding required local gate, applicable context/source identities and actual consumed interfaces. Minimal shared/mobile compatibility edits remain scoped to the phases that assign them and require affected regression checks. Every required exit gate includes local automated acceptance, relevant lint/typecheck/tests/build, cleanup/recovery checks and owned-diff review. Use source-matched local/injected transports or fixtures for client behavior; they do not prove hosted backend enforcement or real email delivery. Missing isolated targets, mail fixtures, manual attendance or optional platform observations do not block phase completion, progress, transition or plan release gates. Verified source/interface defects and failing required checks still block the affected work. Do not start phases beyond the user's execution authorization. External actions retain their separate authorization requirements.

**Verification policy — D-W26 (owner revision, 2026-11-15).** Applies to every phase, work item, acceptance criterion, cross-phase test, appendix, progress calculation and release gate in this plan, including earlier wording/history. **Isolated testing and manual verification are optional.** This includes real-tenant disposable-account/API/RLS/Storage/Realtime tests, mail-link consumption/expiry/reuse, backend atomicity/forced/ban observations, isolated latency/load runs, human visual/accessibility/device checks and manual smoke. They may be elected and recorded as passed/failed/optional-not-run, but their absence, missing credentials/fixtures or unavailable owner/device never creates a required blocker or prevents 100% required completion. Required local/automated typecheck, lint, tests, builds, secret scans, source/API-contract validation and feasible automated browser assertions remain required. Functional/security requirements, auth/RLS guards, error handling and thresholds are unchanged; never label an unperformed optional observation verified or treat a known implementation/security defect as fixed. If optional testing is elected, authorization, isolation, scoped disposable fixtures, secret handling, timeouts and cleanup remain mandatory conditions of running it. Optional means the test may be omitted, not that it may run against an unsafe/unapproved target. Deployment/commit/push/external-service authorization is unchanged.

**Scope.**

- In scope: MVP flows F1 to F9 as they apply to the web client (Section 3.5, 11.3), LS-1 to LS-4 and LS-7 to LS-10 (the web subset of Section 3.4), and the web parts of M2-01 to M2-13, M3-01 to M3-04, M4-01 to M4-04, the web part of M4-07, and R-5 of 10.8.
- Out of scope: the Android app, the admin web, and every backend task. V2 and V3 web screens (WEB-15 to WEB-20) are out of scope too (D-W13). On web there is no Low Signal compression, no Wi-Fi deferral and no Force switch (D-19): LS-5 applies only through its "No connection" row, and LS-6 does not apply.

## 2. Conflicts and gaps found

The following corrections are based on the 2026-11-14 working copy. Current backend deployment/service behavior is not inferred from local tests. Target-specific isolated/manual evidence is optional under D-W26.

| ID | Finding and evidence | Required handling |
|---|---|---|
| C-1 | Both companion plans exist in `Plans/`. `apps/web` is absent. Shared implementation is present. | Phase 0 creates the web workspace as authorized web work. Reuse current shared exports in Phase 1. Retire the old missing-plan/shared-module flags. |
| C-2 | v14 D-115 specifies Vercel production. No existing web Vercel configuration was confirmed. | Prepare and verify locally, then preview and production in Phase 19 after deployment authorization. |
| C-3 | `docs/test-results/M1.md`, `scripts/create-user` and `scripts/disable-user` are absent. `scripts/create-accounts.ts` and `.ps1` exist. | Validate capabilities and actual command interfaces. Missing historical filenames do not block independent frontend work. |
| C-4 | Message/chat/find-user DG429 enforcement and the full v14 forced-password/ban backend gates are unconfirmed. Calling rate limits are separate. | Preserve client behavior and test faults. Track PF-W5/PF-W16 as optional target-evidence follow-ups. Missing live evidence alone does not block required client acceptance; a confirmed implementation/security defect remains an actual issue. |
| C-5 | Service workers remain excluded by D-109. | Offline history and queue work in a loaded tab. A cold offline load requires the browser to supply the app assets. |
| C-6 | Foreground-only delivery and one browser worker need visible leadership transfer. | Phase 5 releases hidden leadership and fences stale work. Phase 6 attempts only from the current visible leader. |
| C-7 | Existing `LocalQueueStore`, `SyncCacheStore`, `createQueueCore` and `createSyncEngine` differ from the old plan interfaces. | Use their actual contracts. Plan only minimal compatibility corrections necessary for queue/sync integrity, with mobile regression coverage. |
| C-8 | Mobile `createSupabaseDelivery` listens to `chat_members` as well as message/media/reaction rows. Migration 026 publishes members. | Phase 7 validates member events and reconciles complete snapshots. Actual private/public Realtime authorization remains PF-W2. |
| C-9 | Windows WebKit cannot establish Safari verification. Historical mobile plans now designate the MuMu `dologram` instance and optional device checks. | Required desktop browser checks use Windows. Android web/mobile observations use only the rediscovered assigned emulator and approved connection method. Keep Safari and unavailable emulator observations unverified. |
| C-10 | Migration 034 and mobile `openDirectChat` use atomic `open_direct_chat`. | Phase 11 uses that RPC. Retire the three-insert direct-chat path and orphan workaround. |
| C-11 | Search, calling, memos, read details and local APK updates have separate mobile work/evidence. | Reuse compatible core contracts, without adding those feature screens to this web MVP. Aggregate Seen compatibility is required. |
| C-12 | Current shared theme uses warm ivory/deep charcoal. `config.message.counterFromChars` is 3500, while v14 says 3900. | Generate CSS from current shared theme and use the shared counter threshold. Record these as working-copy conventions. Keep the 4096 limit. Do not overwrite mobile tokens to restore old literals. |
| C-13 | The old auth plan exchanges a full URL and assumes URL session detection, but `createDgClient` disables it. | Phase 4 explicitly processes the installed SDK's recovery tokens and recovery state. Invalid/expired links fail safely. |
| C-15 | Current media rows omit filename/MIME/size and support individual deleted_at tombstones. | Phase 17 follows mobile metadata/fallback behavior and excludes tombstones without inventing columns. |
| C-14 | Current sync pagination advances a common cursor to the maximum of three independently limited pages. Current queue discard removes local work for server errors. | Phase 6/7 regression gates must establish safe retention and gap-free paging. These directly affect required delivery/cache behavior. |

## 3. Prerequisites and environment checklist

### 3.1 Source prerequisites and optional backend capability checks

Verified locally, the repository has npm workspace patterns `apps/*` and `packages/*`, `@dologram/shared`, `@dologram/mobile`, migrations 001–040, and no `apps/web` or `apps/admin` directory. Node is 24.13.1, npm 11.8.0 and Repomix 1.18.1. The root override pins React and React DOM to 19.2.3. The shared package pins supabase-js 2.119.0, TypeScript 6.0.3 and Vitest 5.1.0. These observations do not establish compatibility with an unselected Next.js version.

Phase 0 records known source/local capabilities and the optional target-evidence inventory below. An unavailable or unverified target is optional/not run, not a required prerequisite; actual source/interface defects remain actionable.

| Capability | Local source reference | Source/local contract and optional target evidence |
|---|---|---|
| Schema, grants and member-scoped reads | Migrations 016–018, 021, 024, 026, 033, 034, 037–039 | Target migration identities plus authenticated member/non-member API assertions. Needed before live chat/media tests. |
| Sign-up and Saved Messages | `private.handle_new_user_profile` in 018 and username uniqueness in 012 | Disposable valid registration creates one profile/self-chat. Username collision rolls back account creation. Confirm actual email-confirmation setting. |
| Recovery and forced password change | `db/client.ts`, mobile AuthProvider and sign-up/reset routes | Confirm Auth settings, email delivery/redirect allow-list, trusted forced flag source, server clearing mechanism and denied data access while flagged. PF-W16 covers missing backend enforcement. |
| Atomic direct chat | Migration 034, `supabase/tests/open_direct_chat.sql` | RPC present, own-session permission, duplicate/concurrent retry produces one pair with no shell. |
| Aggregate reads | Migrations 037/038 and shared member repository | `mark_chat_read` and complete snapshot RPCs present, membership generation errors handled, current mobile interoperability. Read-detail UI remains separate scope. |
| Realtime | Migration 026, mobile `src/sync/source.ts` and `src/chat/realtime.ts` | Publication for four tables, Postgres Changes subscribe and private chat member/non-member checks on actual target. |
| Contract limits and security | v14 T-05/T-10/T-15/T-16/T-21/T-22/T-36/T-39/T-47 | Confirm backend message/chat/find-user limits, active/forced-user checks, group/folder limits, tombstones, grants and ownership transfer. Client validation alone cannot establish these. |
| Media and deployment | Shared media repository, migrations 021/024/033, current Vercel project inventory | Actual bucket policies/limits/TUS route, readable existing avatar paths, authorized deployment project and credentials. |

The memo sync report dated 2026-11-14 records remote migration history 001–040 for the linked project. Treat that as a dated report, not a fresh capability test or authority to mutate the target. The web client must not require unrelated memo/calling functions merely because their migrations exist.

### 3.2 Testing platforms and resource boundaries

Desktop verification uses installed Chrome, Edge and Firefox plus Playwright Chromium/WebKit where compatible. Record exact browser versions at execution. WebKit results remain identified as WebKit. Real Safari/manual platform observations are optional and stay unverified when not run. Automated supported-desktop browser checks remain required; manual observation is never silently substituted for them.

Android observations are optional supplemental checks, consistent with current mobile progress. If later authorized interoperability work genuinely needs multiple release/dev-client APKs, use the existing local Gradle build route rather than EAS. From the repository root the confirmed script accepts `./scripts/build-android-local.ps1 -Variant Debug` or `-Variant Release`, with optional `-Architectures` and `-Offline`. Release requires the existing local signing credentials. The script refreshes native configuration before Gradle. Verify compatible Java/Android SDK, signing identity, versionCode/data compatibility, disk space and the assigned emulator ABI before building. Reuse matching artifacts and request missing credentials/artifacts only for dependent work. This instruction does not add mobile builds to the web MVP or authorize a build during this audit. Rediscover only the assigned MuMu instance named `dologram` before any device action. Historical serials are inconsistent and must not be reused blindly. Use its approved ADB/dev-client connection method. Physical-device testing, unrelated emulator/app access and speculative native rebuilds are excluded. Reuse a source-compatible approved mobile artifact. Missing artifacts affect only dependent observations.

If optional isolated integration testing is elected, before any mutating test identify actual endpoint/project, Auth tenant, Storage and test-account ownership. Use isolated configuration, disposable accounts/data and an approved mail sink. Every spec owns its fixtures or requests them from an idempotent run-scoped helper, creates all required message/media/group prerequisites in that run, and performs permitted cleanup in finally/teardown. Reuse local fixture assets and helper logic across phases, never rely on remote resources left behind by a previous phase. Preserve failed-cleanup IDs for recovery. A local container, browser context or Preview deployment alone does not prove backend isolation. Restrict production verification to authorized non-destructive smoke with designated accounts. Rate bursts, account bans/deletion, failure injection and destructive tests stay on an explicitly isolated target. Record missing target/access as optional-not-run PF-W17 and continue required local/automated checks without a completion blocker.

### 3.3 Environment variables for the web app

Names follow 10.2 (D-100). `NEXT_PUBLIC_` marks intentionally browser-exposed build-time values. Next config `env`, bundler defines, source imports and serialized props can also expose values, so none may contain secrets/test credentials. Browser-public values are fixed in a built artifact. Rebuild only when its source or required public configuration changes, and verify the actual embedded target before any test writes. Values are never written into this plan, the repository or a commit.

| Name | File or place | Secret | Use |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | `apps/web/.env.local`; Vercel Production and Preview | No | Actual approved target URL, embedded at build time and checked before each test/deployment. The linked hosted project remains a reference, not the default isolated test target. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | `apps/web/.env.local`; Vercel Production and Preview | No | Public publishable key or legacy anon JWT; browser validation rejects privileged keys. Replaces the former NEXT_PUBLIC_SUPABASE_KEY name in runtime, example configuration and affected test helpers (D-56). |
| NEXT_PUBLIC_ADMIN_WEB_URL | `apps/web/.env.local` | No | Owner-requested public admin web URL setting. Included in the local configuration/example; this chat did not wire navigation or make this value a Supabase connection prerequisite. |
| NEXT_PUBLIC_DG_LATENCY | `apps/web/.env.test.local` only | No | `1` turns on latency capture in test builds (D-W09). Never set on Vercel Production. |
| NEXT_PUBLIC_DG_BUILD | Set in `next.config.ts` from VERCEL_GIT_COMMIT_SHA (first 7 characters) or `local` | No | Build string in About (WEB-14). |
| TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD (and B, C, G) | `apps/web/.env.test.local` | Password: yes | Playwright sign-ins (10.2). |
| E2E_BASE_URL | Shell variable for one run | No | Target of a Playwright run. The default is `http://localhost:3000`; Phase 19 selects the isolated integration, Preview or safe production URL explicitly. E2E_BASE_URL changes the page origin only, not its embedded Supabase endpoint. |
| SUPABASE_SECRET_KEY, SUPABASE_DB_URL, SUPABASE_ACCESS_TOKEN | Never in `apps/web` | Yes | Optional scan inputs held by the scanner process only. Test credentials and known sensitive names/patterns are scanned too. No values are printed (T-42). |

`apps/web/.env.local` and `apps/web/.env.test.local` MUST be matched by `.gitignore` (M0-10).

**Local configuration follow-up — 2026-11-15.** Keep the ordinary local file limited to these three settings, preserving actual values only in the ignored file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_WEB_URL=
```

The URL and public key must be populated for Supabase access. Restart the development server after environment changes; rebuild production artifacts when embedded public settings change. Runner credentials/latency controls belong in the test configuration, not this minimal local file. `apps/web/.env.example` retains separate test-only/runner names. Admin uses its own server-only configuration in `apps/admin/.env.local`; BACKUP_DIR and admin secrets do not belong in the user web file.

### 3.4 Free-plan ceiling

The app is designed for 2 to 10 daily users, with the Supabase Free plan limits of 7.1 as the ceiling (D-41). The browser leader owns the single active Realtime connection and the foreground chat topic. Other tabs exchange validated commands/events locally. A hidden leader relinquishes work. Capture request/subscription counts and first-sync size against the accepted 2–10-user workload. Quota exhaustion never authorizes another build or service tier.

## 4. Phase overview

| Phase | Name | Goal | Depends on | Document IDs covered |
|---|---|---|---|---|
| 0 | Prerequisites, workspace and tooling | Confirm the contract and give `apps/web` its test, lint and scan tooling. | Working-copy/context baseline | 10.2, M0-09, M0-10, D-62, D-100, D-115, T-42 (script) |
| 1 | Shared package integration | Adapt current shared exports, browser storage and contracts. | 0 | M2-01, D-27 to D-30, D-90, D-100, D-113, D-116, D-122 |
| 2 | Design tokens, fonts, icons and theme bootstrap | Generate CSS from current mobile/shared tokens and verify first-paint theme. | 1 | 12.2, 12.3, 12.10, D-83, D-95, D-129 to D-131, D-134, D-138, D-144, M4-02 |
| 3 | Base and state components | Build the shared web components and the loading, empty and error patterns. | 2 | 12.4 (CMP-01 to CMP-03, CMP-05, CMP-06, CMP-15 to CMP-21, CMP-23), 3.5 Loading and Error, D-95, D-134, D-136 |
| 4 | Sign-in, sign-up, forgot password, forced password change and session | Email or username and password sign-in, self-service sign-up (username + display name) and email password reset, with the forced change for admin-created accounts and a persistent session. | 3 | F1, WEB-01, WEB-01b, WEB-02, 5.1, D-47, D-51, D-78, D-86, M2-04, D-163, D-181, T-10 |
| 5 | IndexedDB local store | Persist account-owned state and atomic queue writes, with visible fenced ownership. | 4 | M2-02, 6.1, 6.2 local records, D-06, LS-9, LS-10 |
| 6 | Queue core and delivery worker | Deliver text through the local queue with LS statuses, retries and idempotency. | 5 | M2-03, LS-1 to LS-4, LS-7 to LS-10, D-10, D-12, D-27, D-77, D-93, D-109, T-09, T-18, T-19 |
| 7 | Sync module | Integrate current sync with gap-free paging and member snapshots. | 6 | M2-05, 6.4, D-40, D-43, D-91, T-13 |
| 8 | Responsive shell and navigation | Rail, tab bar, panes and dialog history at the 768 and 1280 px breakpoints. | 7 | WEB-03, 12.6, 12.7, CMP-32, CMP-33, D-35, D-142, D-145 |
| 9 | Settings dialog, theme setting and sign-out | Settings with theme choice, change password, About and sign-out that wipes local data. | 8 | WEB-14, F1, D-51, D-83, D-109 (5) |
| 10 | Chat list and archive view | List chats from the cache in D-94 order, with unread counts and the offline banner. | 9 | F2, WEB-04, WEB-05, CMP-09, CMP-13, CMP-14, D-12, D-19, D-92, D-94, M2-08 |
| 11 | New chat, New group and chat info | Find users, create chats and groups, manage members, leave groups. | 10 | WEB-11, WEB-12, 3.2 Chat, D-42, D-46, D-58, D-70, D-88, D-91, D-124, M2-07 |
| 12 | Chat thread and Markdown | Render the message list, bubbles, separators and Markdown safely. | 11 | WEB-06 (read), CMP-07, CMP-22, D-05, D-30, D-99, D-143, M2-06, T-12 |
| 13 | Composer, sending and delivery status | Send text through the queue, with the status captions, Retry and Discard. | 12 | F3, F7, CMP-08, CMP-10, LS-2, D-93, D-132, D-143, M2-09, M2-12, M4-04, T-01, T-02, T-19 |
| 14 | Message actions | Reply, forward, copy, react, edit and delete. | 13 | F3, F4, WEB-07, WEB-08, CMP-12, CMP-34, D-22, D-31, D-50, D-76, D-109 (4), D-133, M2-09, M2-10, M3-04, T-06, T-17 |
| 15 | Typing indicators and read receipts | Show typing and seen state over Broadcast, and keep last_read_seq current. | 14 | F6, D-23, D-57, D-92, D-118, M2-11, T-37, T-51 |
| 16 | Attachments: pipeline and attach UI | Queue and upload photos, videos, voice notes and files. | 15 | F5, WEB-09, LS-4, D-29, D-39, D-75, D-90, D-109 (7), D-113, D-116, M3-01 to M3-03, T-20, T-52 |
| 17 | Media display and viewer | Show tiles and rows, placeholders and the media viewer with signed-URL refresh. | 16 | WEB-10, CMP-11, D-113, 12.3 Attachment tiles, T-11 (client re-run) |
| 18 | Folders, archive and mute controls | Archive, mute and folder management, synced across devices. | 17 | F9, WEB-13, D-24, D-94, D-109 (1), M4-01, T-36, T-49 |
| 19 | Hardening and release gate | Run the cross-cutting, browser, latency and security checks, then deploy production. | 18 | 3.5 cross-cutting, 12.8, M4-03, M4-04, M4-07 (web part), R-5, D-82, D-115, T-01, T-40, T-42, T-49, T-50 |

## 4.1 Stable requirements and acceptance coverage

Every requirement maps to numbered work W-Pnn-Snn and acceptance AC-Wnn-nn in its phase. Phase execution records below identify completed required checks; unstarted phases remain incomplete and optional observations are tracked separately. The following table summarizes observable outcomes. Detailed phase acceptance criteria supply boundary/failure cases and verification methods. W-20 applies to every phase and Phase 19's final release record.

| Requirement | Accepted behavior and observable outcome | Implementation work | Verification |
|---|---|---|---|
| W-00 | Missing web workspace gains compatible, real check entry points and isolated-target guard. | Phase 0 steps 1–7 | AC-W00 and tooling/smoke/scanner fixtures. |
| W-01 | Browser consumes actual shared APIs without native startup or session leakage. | Phase 1 steps 1–5 | AC-W01, consumer typecheck, production-boundary and shared/mobile regressions. |
| W-02 | Current shared theme appears before first paint and CSS matches tokens. | Phase 2 | AC-W02, token sync/nonzero contrast pairs and first-paint/font requests. |
| W-03 | Accessible loading/error/overlay controls honor 300 ms, focus and history. | Phase 3 | AC-W03, component tests, keyboard/back and 44 px browser assertions. |
| W-04 | Sign-in/sign-up/recovery/forced-change follow validated session and backend gates. | Phase 4 | AC-W04, required unit/transport/automated-browser cases; isolated auth/mail/security observations optional. |
| W-05 | Durable account-owned state survives restart with atomic limits/order and one visible owner. | Phase 5 | AC-W05, real IndexedDB/multi-tab/quota/upgrade/account tests. |
| W-06 | Offline text delivers once, bounded retry retains recoverable failures and safe discard. | Phase 6 | AC-W06, required queue fault/state/concurrency tests; isolated row assertions optional. |
| W-07 | Catch-up restores every row/member without unsafe pruning or cursor gaps. | Phase 7 | AC-W07, required >500-row imbalanced paging/snapshot/transport cases; isolated Realtime cases optional. |
| W-08 | 767/768/1280 layouts, route guards/panes/dialog history and unread title work. | Phase 8 | AC-W08, breakpoint/title/history/keyboard browser tests. |
| W-09 | Theme/settings/password/sign-out behave safely in concurrent/offline tabs. | Phase 9 | AC-W09, logical wipe/blocked deletion/stale callback/theme/password cases. |
| W-10 | Cached list/archive previews/order/unread updates match shared conventions. | Phase 10 | AC-W10, own/deleted/muted/archive/pending-read and two-client tests. |
| W-11 | Exact lookup/atomic direct chats/recoverable groups enforce member permissions. | Phase 11 | AC-W11, concurrent RPC, partial creation/additions, removal/rejoin/leave cases. |
| W-12 | Ordered paged history safely renders Markdown, replies and accessible states. | Phase 12 | AC-W12, T-12 payloads, scroll/keyboard and missing/denied chat tests. |
| W-13 | Composer validates Unicode/IME/queue limits and preserves drafts on failure. | Phase 13 | AC-W13, offline/send/retry/dedup/status/keyboard tests. |
| W-14 | Reply/forward/copy/reaction/edit/delete obey ownership/offline rules. | Phase 14 | AC-W14, two-user mutations, rollback, raw-HTML/link and attachment-forward assertions. |
| W-15 | Typed hints and membership-bound read intents converge without forged confirmation. | Phase 15 | AC-W15, required state races, pending/confirmed cursors and injected two-client timing; isolated timing optional. |
| W-16 | Files/voice persist before send and text-first uploads recover idempotently. | Phase 16 | AC-W16, MIME/size/count/denial/TUS/interrupt/atomic-enqueue cases. |
| W-17 | Authorized media opens with bounded URL refresh and teardown. | Phase 17 | AC-W17, expiry/deletion/nonmember/playback/download/history tests. |
| W-18 | Archive/mute/folders persist, reconcile cross-client and preserve chats on deletion. | Phase 18 | AC-W18, limits/permissions/infinity/concurrent partial-mutation cases. |
| W-19 | Complete MVP passes required browser/security/accessibility/performance and authorized release gates. | Phase 19 steps 1–9 | AC-W19, required local automation/bundle scan/authorized automated production smoke and rollback; isolated integration/100-sample live p95/manual smoke optional. |
| W-20 | Changes remain recoverable, verified, scoped and accurately reported with cleanup. | Shared phase contract, Phase 0 step 1 and Phase 19 steps 6–9 | Snapshot/diff/source identities, baseline/regression comparison, cleanup and evidence/status audit. |

## 5. Phases

---

### Phase 0 Prerequisites workspace and tooling

**Goal.** Establish a recoverable baseline, create the missing web workspace and prove local check entry points. Implements W-00/W-20, M0-09/M0-10 and T-42 tooling. Missing target evidence is an optional follow-up; genuine consumed-interface defects still block affected implementation.

- [x] 1. **W-P00-S01** Preserve relevant tracked diffs/untracked inputs and validate context identities. Inventory approved test targets, existing services/artifacts, browsers and Vercel configuration. Record every §3.1 capability as source-verified, optional/not run, or an actual source/interface defect; distinguish missing evidence from a confirmed defect. Historical filenames are references, not prerequisites when equivalent capability evidence exists.
- [x] 2. **W-P00-S02** Create proposed `apps/web/package.json` and TypeScript App Router layout under `src/app`, `components`, `features`, `lib`, `theme` and `e2e`. Select a maintained Next.js release with peer ranges compatible with root React 19.2.3, Node and TypeScript. Check its official requirements before installing exact versions. Reuse root overrides/shared workspace linkage and avoid broad upgrades. Record compatibility blockers rather than forcing peer conflicts.
- [x] 3. **W-P00-S03** Define proposed web scripts `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `lint` (ESLint CLI plus Stylelint), `test` (Vitest run) and `e2e` (Playwright). Add only necessary compatible web tools including jsdom, Testing Library and fake-indexeddb. Use Next's selected-version ESLint flat config and `eslint .`. Next.js 16 removed `next lint`. Required suites must discover actual assertions and fail on zero tests.
- [x] 4. **W-P00-S04** Create proposed `vitest.config.ts`, `src/test/setup.ts`, `playwright.config.ts`, `eslint.config.mjs` and Stylelint configuration. Exclude E2E from unit discovery. Add accessibility/token-literal rules with generated-theme exclusions. Load `.env.test.local` only in the runner using confirmed Node env-file support. Playwright starts one task-owned local server only for a local target, with bounded startup/test timeouts. E2E_BASE_URL disables that server. Verify an existing server's identity before reuse and stop task-created processes afterward.
- [x] 5. **W-P00-S05** Create `.env.example` with names/placeholders only and ignored local config. Verify `git check-ignore apps/web/.env.local apps/web/.env.test.local`. Keep TEST_USER values out of application configuration, public prefixes and diagnostics. Proposed `e2e/helpers/api.ts` checks actual target identity before mutation, uses each disposable user's session/publishable key, scopes resources to a run ID and tracks cleanup. Administrative fixtures require an approved isolated harness. Discover real `scripts/create-accounts.*` arguments before use.
- [x] 6. **W-P00-S06** Create proposed `scripts/scan-web-bundle.ps1` using the existing mobile scanner's redaction conventions. Scan client/server output for forbidden names/patterns, test credentials and securely supplied known secret values. Print filenames/categories only. Refuse missing/empty input and prove positive/negative fixtures. The scanner builds nothing and never imports secrets into application code.
- [x] 7. **W-P00-S07** Add the root DoloGram smoke page and proposed `e2e/phase-00-smoke.spec.ts`. Run local lint/typecheck/unit tests and Chromium smoke. Build once for production-boundary checks, scan it and reuse the artifact while source/config is unchanged. Record versions, commands, source identities, results and outstanding capabilities in proposed `docs/test-results/web/phase-00.md`.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W00-01** Workspace resolution/scripts and selected dependencies work without mobile graph regressions.
- [x] **AC-W00-02** Env exclusion, target guard, real test discovery and scanner fixtures pass.
- [x] **AC-W00-03** Local root/title, lint/typecheck/unit/Chromium smoke and source-matched bundle scan pass.
- [x] **AC-W00-04** Every §3.1 capability has source evidence, an optional-not-run target observation, or an actual scoped source/interface defect.

**Execution status — 2026-11-14 (Asia/Manila).** Complete. Current phase: **100% (8/8 items including G-W00)**. Overall user-web implementation: **5% (8/169, rounded)**. All four AC-W00 checks are met. **G-W00: passed** — baseline/regression disposition, cleanup and owned-diff review completed. Phase 1 is ready for independent local execution with injected transports; it has not been started.

**Dated progress note.** Implemented apps/web with Next 16.4.6, exact compatible tooling, runner-only env handling, isolated-target/own-session/resource-scoped fixture guards, strict lint rules, a redacting bundle scanner and the DoloGram smoke page. Web typecheck/lint, 11 unit assertions (plus 4 affected guard assertions after schema-key review), development and production Chromium smoke, production build and the 119-file client/server scan pass. Shared typecheck/215 tests and mobile typecheck pass. Mobile lint is byte-for-byte unchanged at 14 errors/4 warnings; mobile tests retain the same four failing suites with 15 failing cases versus 16 at baseline. No new failing case. Task-owned ports 3000/3100 are closed. Details, commands, exact versions, source identities and acceptance mapping: `docs/test-results/web/phase-00.md`.

**Discrepancies and remaining capabilities.** Planning-only statements elsewhere are historical; this request authorized Phase 0 execution only. Concurrent Admin work created apps/admin/packages/admin-core and root scripts during execution; those changes were preserved. The interrupted concurrent install was repaired with a scoped offline web install. Development uses documented Webpack mode after unrelated repository writes stalled Turbopack; production uses the single verified Turbopack artifact. Confirmed fixture primary keys are chat_id/message_id. Every §3.1 capability has an explicit scoped blocker or not-run record (PF-W2/W5/W7/W13/W15/W16/W17/W18); these target/mail/settings observations are optional follow-ups under D-W26, while deployment authorization remains separate; no remote mutations occurred. No instruction conflict or Phase 0 manual-verification item remains.

**Deliverables.** Proposed workspace/tooling/helper/scanner and Phase 0 report.

**Exit gate.** After scripts exist, root commands `npm run typecheck --workspace apps/web`, `npm run lint --workspace apps/web`, `npm run test --workspace apps/web` and `npm run e2e --workspace apps/web -- phase-00 --project=chromium` pass. Capture shared/mobile baselines before dependency edits. Independent Phase 1 work may proceed with injected transports while the integration target is blocked.

Framework reference is [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint).

---

### Phase 1 Shared package integration

**Goal.** Integrate current shared interfaces into the browser. Depends on Phase 0. Implements W-01 and M2-01.

| Existing source | Current symbols and adaptation |
|---|---|
| `src/config/index.ts` in `packages/shared` | `config.queue`, `media`, `message`, `list`, `sync`, `reactions`. Counter threshold currently 3500. |
| `src/validation/{account,message,attachment,chat,text}.ts` | Existing validators plus `codePointLength`, `dgTrim`, `isBlank`. Read actual argument/result types. |
| `src/ids.ts`, `src/db/client.ts`, `src/db/database.types.ts`, `src/errors.ts` | `createIdGenerator`, `createDgClient`, `Database`, `classifyError`, `DgResult`. Factory requires async storage/HTTPS and disables URL detection. Error kinds currently include `server { code, status }` and `rateLimited { retryAfterSec }`. |
| `src/queue/{types,core,runner}.ts`, `src/sync/{types,engine}.ts` | `LocalQueueStore`, `SyncCacheStore`, `SyncSource`, `SyncDelivery`, `createQueueCore`, `createQueueRunner`, `createSyncEngine`. |
| `src/db/repositories/*.ts`, `src/chatList/*.ts`, `src/chats/*.ts`, `src/chat/readStatus.ts` | Repositories, `buildChatList`, `formatChatListTime`, `messagePreview`, `findDirectChatId`, `buildContactList`, `buildChatInfo`, `selectReadStatus`. |
| `src/theme/*.ts`, `src/strings/index.ts`, `src/realtime/topics.ts` | Current theme/strings and typed Broadcast contracts. |

- [x] 1. **W-P01-S01** Verify current originals/tests/callers and compile a web consumer of `packages/shared/src/index.ts`. Audit transitive exports for native/Node APIs and accidental memo/calling initialization. Add a browser-safe export only for a demonstrated compilation/runtime need, with mobile consumer checks. Do not fork modules under historical filenames.
- [x] 2. **W-P01-S02** Create proposed `src/lib/supabase.ts`, a lazy browser singleton supplying `createDgClient` an async localStorage wrapper, validated NEXT_PUBLIC config and injectable fetch. Storage access failures show recoverable UI. Browser APIs must not execute during Next prerender. Use Client Components, `transpilePackages: ['@dologram/shared']` and dependency `*`. All data access remains session/RLS-bound.
- [x] 3. **W-P01-S03** Proposed `src/lib/ids.ts` uses `createIdGenerator(() => crypto.randomUUID())`. Keep `database.types.ts` and document its contract-derived provenance. Compare required rows/RPCs with migrations. Root `gen:types` has unresolved project/ref arguments and must not overwrite these types. Fresh generation requires a confirmed target and reviewed diff.
- [x] 4. **W-P01-S04** Reuse existing validation tests and fill concrete web gaps for blank/attachment-only text, Unicode 4096/4097, photo/file byte limits, MIME rejection and 10/11 attachments. Preserve current error result contracts or make only W-06's necessary compatible extension.
- [x] 5. **W-P01-S05** Proposed `/dev` diagnostics use a server production-404 boundary covering all children. Compile out test fault globals in production. Diagnostics expose synthetic IDs/counts and redact sessions, emails, message content and token URLs. Production verification uses public UI.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W01-01** Actual shared exports compile/run in the browser without native initialization.
- [x] **AC-W01-02** Configuration/storage failures recover safely and validation tests/typechecks pass.
- [x] **AC-W01-03** Every `/dev` child and fault control is inaccessible in production.
- [x] **AC-W01-04** Existing shared/mobile consumer contracts remain compatible.

**Execution status — 2026-11-15 (Asia/Manila).** Complete. Current phase: **100% (6/6 including G-W01)**. Overall user-web implementation credited by this execution: **8% (14/169, rounded)**, carrying forward Phase 0's verified eight items. All four AC-W01 checks are met; G-W01 passed. Phase 2 is ready for independent local execution; this execution did not start it or credit concurrent work to it.

**Dated progress note.** Completed the Git → ripgrep → Reader validation → scoped Repomix → XML analysis → original-source workflow. Added lazy browser client/storage and UUID adapters, public recovery UI, shared-consumer/validation tests and production-denied synthetic diagnostics. Next transpiles the existing shared workspace. Production aliases development code to a server denial module; diagnostics markers/fault globals are absent from emitted JavaScript. Disabled production/prerender source maps after the unchanged secret scanner identified a vendor source comment naming a privileged configuration variable. Final web typecheck/lint, 33 unit tests, configured development Chromium checks (3), production Chromium checks (2), production build and 110-file secret scan pass. Shared typecheck/262 tests and mobile typecheck pass. Shared Vite-config/experimental SQLite warnings predate this work. Full evidence, baseline failures and owned-change review: `docs/test-results/web/phase-01.md`; context identities/reads: `Plans/context/DoloGram_User_Web_Phase_01_Context_Index.md`.

**Discrepancies and boundaries.** Phase 0 has already created apps/web, its dependency and scripts; older planning-only claims elsewhere remain historical. The shared entry requires no new browser export or shared/mobile contract changes. Database types remain the existing contract-derived client projection, compared with local migrations 016/024/025/026/034/037/038; no type generation or remote schema verification occurred. Concurrent theme/shared-config/Admin/dependency/root-script changes were preserved and are separately owned; the higher final shared-test count includes that work. No dependencies were added by this execution. No repository-instruction conflict, outstanding Phase 1 manual gate or live-backend prerequisite remains. Historical external target/mail/security evidence gaps are optional under D-W26; external deployment authorization remains unchanged.

**Deliverables.** Browser singleton/storage/ID adapters, integration tests and Phase 1 report.

**Exit gate.** Web lint/typecheck/tests, shared `npm run test --workspace @dologram/shared`, affected mobile checks and source-matched production-boundary assertions pass relative to recorded baselines.

---

### Phase 2 Design tokens, fonts, icons and theme bootstrap

**Goal:** Generate `apps/web/src/theme/tokens.css` from the shared token set, bundle Inter, JetBrains Mono and Lucide, and apply the theme before first paint.

**Depends on:** Phase 1.

**Implements:** 12.2, 12.3, 12.10, M4-02 (web part), D-83, D-95, D-129, D-130, D-131, D-134, D-138, D-144, TW-03, TW-04.

**Steps**

- [x] 1. **W-P02-S01** **Token source.** Reuse current `packages/shared/src/theme/tokens.ts`, including warm-ivory/deep-charcoal theme, spacing/type/radius/motion/elevation exports. Map existing source property names to web CSS variables explicitly. Historical prose names such as `bubble.out.bg` require an alias to current `bubble.outgoing`, with the mapping tested. A missing token is a type/test failure. No web phase overwrites shared theme values from v14's older palette.
- [x] 2. **W-P02-S02** **Icon map.** Reuse current `theme/icons.ts` exports `iconMap`, `iconNames` and `iconSizes`. Resolve each semantic name used by this plan against current source and the pinned web icon package. Keep native icon imports out of browser code. Existing custom assets may need a web rendering adapter. Missing names require a tested browser mapping with no mobile map overwrite.
- [x] 3. **W-P02-S03** **CSS generator.** Install `tsx` (it runs the TypeScript generator under Node) at the root, pinned and recorded. Create `packages/shared/scripts/generate-tokens-css.ts`. It writes `apps/web/src/theme/tokens.css` with:
  - `:root { ... }` holding every light color and every non-color token as `--dg-<dot name with hyphens>` (for example `--dg-color-bg-app`, `--dg-space-5: 16px`, `--dg-radius-bubble: 22px`, `--dg-z-toast: 600`, `--dg-motion-duration-base: 200ms`)
  - `[data-theme="dark"] { ... }` holding the dark colors and dark elevations
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` with the same dark values, so System follows the media query (12.10)
  - `@media (prefers-reduced-motion: reduce) { :root { ... } }`, which sets every duration except `--dg-motion-duration-fast` to `0ms` (D-134)

  Add `"tokens": "tsx packages/shared/scripts/generate-tokens-css.ts"` to the root `package.json`.

  ```powershell
  npm install --save-dev --save-exact tsx; if ($?) { npm run tokens }
  ```

- [x] 4. **W-P02-S04** **Token sync test (12.10, TW-04).** Create `packages/shared/src/theme/tokens-css.test.ts`. It regenerates the CSS in memory and fails if it differs from the committed `apps/web/src/theme/tokens.css`.
- [x] 5. **W-P02-S05** **Contrast test (12.10, D-95, TW-04).** Extend the existing contrast test only for actual web foreground/background pairs from current nested tokens. Its current pair builder indexes nested colors with flat keys and can produce no text pairs. Assert a nonzero expected pair set and every required rendered pair. Compute WCAG relative luminance and fail below 4.5:1 text or 3:1 non-text. Preserve required thresholds and record existing theme failures separately.
- [x] 6. **W-P02-S06** **Fonts (D-130).** In `apps/web/src/app/layout.tsx`, load `Inter` (weights 400, 500, 600, 700, normal and italic) and `JetBrains_Mono` (400) from `next/font/google` with `display: 'swap'` and `subsets: ['latin']`. Expose them as `--dg-font-sans` and `--dg-font-mono` through each font's `variable` option, on `<html>`. next/font self-hosts the files at build time, so no font is fetched from Google at runtime (12.10). Assumption: next/font downloads the font files during `next build` on Vercel and locally; checked in this phase's acceptance criteria.
- [x] 7. **W-P02-S07** **Global CSS.** Create `apps/web/src/app/globals.css`:
  - import `../theme/tokens.css`
  - `html { font-size: 100%; }`
  - type tokens in rem (16 px = 1 rem: `body.lg` 1rem/1.375rem)
  - `body { background: var(--dg-color-bg-app); color: var(--dg-color-text-primary); font-family: var(--dg-font-sans); }`
  - a `.dg-visually-hidden` utility
  - `:focus-visible { outline: 2px solid var(--dg-color-focus-ring); outline-offset: 2px; }` (D-136)
- [x] 8. **W-P02-S08** **Theme bootstrap (D-83, TW-03).** Create `apps/web/src/theme/ThemeScript.tsx`. It renders an inline `<script>` in `<head>` that reads `localStorage.getItem('dg.theme')` inside `try`/`catch`: `light` or `dark` sets `document.documentElement.dataset.theme`, and `system`, a missing value or an error leaves the attribute unset. Create `apps/web/src/theme/useTheme.ts`, which exports `getThemeSetting()`, `setThemeSetting('system'|'light'|'dark')` (writes `dg.theme` and updates `data-theme` at once) and `useResolvedTheme()` (reads `matchMedia('(prefers-color-scheme: dark)')` while the setting is System). Add `suppressHydrationWarning` on `<html>`, because the attribute is set before hydration.
- [x] 9. **W-P02-S09** **Icon component (D-131).** Install `lucide-react`, pinned and recorded. Create `apps/web/src/components/Icon/Icon.tsx` with props `name` (a key of `icons.ts`), `size` (`'xs'|'sm'|'md'|'lg'|'xl'`), optional `label` and optional `spin`. It renders the mapped Lucide component with the size and stroke of 12.3 and `currentColor`. With `label` it sets `role="img"` and `aria-label`; otherwise `aria-hidden="true"`. Screens never import `lucide-react` directly (12.10). Enforce this with `no-restricted-imports` for `lucide-react` outside `src/components/Icon`.

  ```powershell
  npm install --workspace apps/web --save-exact lucide-react
  ```

- [x] 10. **W-P02-S10** **Token page.** Create `apps/web/src/app/dev/tokens/page.tsx`. It renders one swatch per color token with its name, every type token as a sample line, and one `Icon` per semantic name, plus three buttons that call `setThemeSetting` with System, Light and Dark.
- [x] 11. **W-P02-S11** **Spec.** Create `apps/web/e2e/phase-02-theme.spec.ts`:
  - with `localStorage dg.theme = 'dark'` set through `page.addInitScript`, the computed `background-color` of `body` on first load is the current shared dark `color.bg.app` value and `<html>` has `data-theme="dark"`
  - with `colorScheme: 'dark'` emulated and no stored value, the color is also the current shared dark `color.bg.app` value
  - with `light`, it is the current shared light `color.bg.app` value
  - the page requests no URL on `fonts.googleapis.com` or `fonts.gstatic.com`

**Deliverables:** reused current `tokens.ts`/`icons.ts`, the proposed generator, the `tokens` script, the generated `apps/web/src/theme/tokens.css`, the sync and contrast tests, `ThemeScript.tsx`, `useTheme.ts`, `Icon`, `globals.css`, `/dev/tokens`.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W02-01** The contrast test asserts a nonzero complete set of actual rendered foreground/background pairs in both current shared themes, with required thresholds. (TW-04; part of T-40)
- [x] **AC-W02-02** The token sync test passes, and editing one value in `tokens.ts` without running `npm run tokens` makes it fail.
- [x] **AC-W02-03** A hex literal added to any `apps/web/src/components/**/*.module.css` fails `npm run lint --workspace apps/web` (12.10).
- [x] **AC-W02-04** The theme spec passes: no flash of the wrong theme on first paint. (TW-03)
- [x] **AC-W02-05** No request to a Google Fonts host is made. (12.10)

**Execution status — 2026-11-15 (Asia/Manila).** Complete. Current phase: **100% (12/12 including G-W02)**. Overall user-web progress: **15% (26/169, rounded)**, carrying forward Phase 0/1's verified 14 items. All five AC-W02 criteria are met. Phase 3 is ready to start and has not been started.

**Dated progress note.** Completed Git baseline → ripgrep discovery → Reader validation → scoped Repomix → bounded XML analysis → original-source/version-doc verification. Reused the existing shared/admin CSS generator and current tokens; added typed web aliases, reduced motion, generated web CSS, nonzero rendered-pair contrast coverage, parser-time theme bootstrap, reactive theme/storage handling, typed Lucide adapter and development token gallery. Added tsx 4.23.15 for the required TypeScript generator and lucide-react 1.73.0 for browser icons. Final web lint/typecheck/build, 38 web tests, shared typecheck/289 tests, 12 Chromium/Chrome theme checks, six production smoke/font/diagnostics checks and 152-file secret scan pass. Actual token-mutation and component-hex-literal negative controls reject stale/invalid output; originals/fixtures restored. Console checks are clean; local servers stopped. Evidence and complete AC mapping: `docs/test-results/web/phase-02.md`; identities/read boundaries: `Plans/context/DoloGram_User_Web_Phase_02_Context_Index.md`.

**Discrepancies and boundaries.** Admin work had already supplied shared CSS generation and repaired the stale contrast-test issue. Preserved that work and all shared token/icon values; actual space.5=20px, z.toast=1000, bodyLg lineHeight=24px and duration.normal=200ms override stale examples above. Google font downloads failed, so the phase's authorized next/font/local fallback bundles existing licensed Inter/JetBrains Mono assets with the same CSS variables. Reused the current logo as a Next app icon to resolve Chrome's favicon 404 during console verification. No repository-instruction conflict. Edge, Firefox and WebKit executables are absent; their recorded launch failures remain unverified later release coverage, not claimed passes. Phase 2's explicit Chromium gate and all five AC checks pass. No mobile/backend implementation, remote data/configuration change, commit, push, migration or deployment.

**Exit gate:** `npm run test --workspace packages/shared; if ($?) { npm run e2e --workspace apps/web -- phase-02 --project=chromium }` passes.

**Risks and fallbacks**

- A Lucide icon of 12.3 is renamed in the pinned release: correct only the web mapping after verifying the installed web icon export, preserving mobile aliases.
- next/font cannot reach Google Fonts during the build: place the Inter and JetBrains Mono release files (SIL Open Font License 1.1) in `apps/web/src/theme/fonts` and use `next/font/local` with the same variable names (D-130 fallback, adapted to web).

---

### Phase 3 Base and state components

**Goal:** Build the reusable web components and the 300 ms loading, empty and error patterns that every later screen uses.

**Depends on:** Phase 2.

**Implements:** 12.4 CMP-01 (Button, IconButton), CMP-02 (TextField), CMP-03 (SearchField), CMP-05 (Avatar), CMP-06 (Badge), CMP-15 (BottomSheet), CMP-16 (Dialog), CMP-17 (Toast, ToastProvider), CMP-18 (Skeleton), CMP-19 (EmptyState), CMP-20 (ErrorState), CMP-21 (TopBar), CMP-23 (Menu); 3.5 Loading and Error; D-95, D-134, D-136; 12.8 Roles and states, Focus order, Touch targets; TW-06.

**Steps**

- [x] 1. **W-P03-S01** **One folder per component.** Each component lives at `apps/web/src/components/<Name>/<Name>.tsx` with `<Name>.module.css`, camelCase class names, and every color, space, radius, motion and z value taken from `var(--dg-…)` (12.10). Use the 12.10 primitive for each:
  - `Button`, `IconButton`: `<button type="button">`
  - `TextField`: `<input>` or `<textarea>` with `<label>`
  - `SearchField`: `<input type="search">`
  - `Avatar`, `Badge`: `<span>`
  - `Dialog`: `<dialog>` opened with `showModal()`
  - `BottomSheet`: `<div role="dialog">` fixed to the bottom
  - `Toast`: a root-level `<div role="status">`
  - `Skeleton`: `<div aria-busy="true">` with a CSS gradient animation
  - `EmptyState`: `<section>`
  - `ErrorState`: `<section role="alert">`
  - `TopBar`: `<header>`
  - `Menu`: a `<div role="menu">` popover in a portal
- [x] 2. **W-P03-S02** **Button (CMP-01).**
  - Variants: Primary, Secondary, Text, Danger, Icon.
  - Height 44 on the user web, minimum width 88, `radius.md`, label `label.lg`.
  - States: pressed, disabled (`color.bg.disabled` and `color.text.disabled`), loading (the spinner replaces the label after `motion.delay.loading`, with `aria-busy="true"`).
  - IconButton: a 40 visual circle in a 44 target, with a required `label` prop that becomes `aria-label` (12.8).
- [x] 3. **W-P03-S03** **TextField and SearchField (CMP-02, CMP-03).** Props: `label`, `helper`, `error`, `counter`, `type`, `autoComplete`, `disabled`. The error text shows `status.failed` at `icon.xs` and `color.danger` and is linked with `aria-describedby`. The password type has the show and hide IconButton (`action.showPassword`, `action.hidePassword`). SearchField uses `radius.full` and `action.search`.
- [x] 4. **W-P03-S04** **Avatar and Badge (CMP-05, CMP-06).**
  - Avatar: sizes 24, 28, 40, 48, 56, 64 and 96. Initials are the first code point of the first two words, uppercased, counted with Array.from. The fill index is the sum of the UTF-16 code units of the id, modulo 7, from `avatarFills` (12.3), with initials always `#FFFFFF` read from the token.
  - Avatar variants: `saved` (`chat.saved` on `color.brand.primary`), `deleted` (`person.deleted`) and `former` (`person.former`), both on `color.badge.muted.bg`.
  - Inspect the existing mobile `Avatar.tsx` initials/fill mapping first. Reuse a browser-safe helper where available. If extraction is necessary, preserve both callers and test their current behavior before adding a shared helper.
  - Badge: `radius.full`, `label.sm`, brand and muted variants.
- [x] 5. **W-P03-S05** **Overlays (CMP-15, CMP-16, CMP-23).**
  - Dialog: variants `form` (520 wide from 768 px, full screen below) and `confirm` (400 wide), `radius.xl`, `elevation.3`, scrim `color.scrim`, `z.dialog`.
  - Dialog behavior: focus trapped by the native modal dialog, focus returned to the opener on close, Escape closes (12.6), title in `title.md`.
  - BottomSheet: below 768 px only, top corners `radius.xl`, `z.sheet`, enter over `motion.duration.slow` with `motion.easing.enter`. As a modal it needs aria-modal, an accessible title, background inertness, focus containment/return, Escape dismissal and history integration. Menus portalled from a modal remain in its focus/interaction scope.
  - Menu: positioned in a portal at `z.menu`, `role="menu"` with `menuitem` children, arrow-key navigation, Escape closes. A disabled item shows its reason ("No connection") as a second line in `body.sm`.
- [x] 6. **W-P03-S06** **Overlay history hook (12.6).** Create `apps/web/src/lib/useOverlayHistory.ts`. Opening an overlay preserves Next's existing history.state keys and adds a namespaced dgOverlay entry via pushState at the same URL. Use one owner for stack/history mutation so OverlayProvider and Dialog/BottomSheet cannot both push. A popstate event reconciles the recorded stack without pushing a replacement entry. Closing it by a control calls `history.back()` when the top state is that overlay. This makes the browser back button close an open dialog or overlay first (TW-06). Dialog, BottomSheet and (in Phase 17) the media viewer use it.
- [x] 7. **W-P03-S07** **Toast (CMP-17, D-134).**
  - `ToastProvider` is mounted once in the root layout and exposes `useToast().show({ text, action? })`.
  - Toasts use `color.toast.*`, `elevation.2` and `z.toast`. They last 4000 ms, or 6000 ms with an action, and are one at a time with the newest replacing the current one.
  - The container is `role="status"`, so a toast is announced politely.
- [x] 8. **W-P03-S08** **Loading rule (D-95).** Create `apps/web/src/lib/useDelayedFlag.ts`: `useDelayedFlag(active, 300)` returns true only after `active` has been true for 300 ms (`motion.delay.loading`). Skeleton (CMP-18) and every spinner render only when this flag is true. The shimmer stops under reduced motion, and the spinner keeps turning next to a text label (D-134).
- [x] 9. **W-P03-S09** **Empty and error states (CMP-19, CMP-20).** EmptyState props: `icon`, `title`, `body`, optional `action`. ErrorState props: `title`, `body` (the error text from the strings module), optional `onRetry`. Retry shows only when the action can be repeated (3.5 Error, D-95). Error text always comes from `strings`, never from a raw server message (D-35).
- [x] 10. **W-P03-S10** **TopBar (CMP-21).** Height 56, fill `color.bg.app`, bottom border `color.border.subtle`, `z.sticky`. Variants: chat list (wordmark "DoloGram" in `title.lg`, no Low Signal chip on web, D-19), screen (back IconButton `nav.back` and title in `title.md`) and chat (filled in Phase 12).
- [x] 11. **W-P03-S11** **Gallery.** Create `apps/web/src/app/dev/components/page.tsx`, which renders every component in every state of its 12.4 table, in both themes, using the Phase 2 theme buttons.
- [x] 12. **W-P03-S12** **Tests.** Create `apps/web/src/components/<Name>/<Name>.test.tsx` for Button (loading after 300 ms only), Dialog (Escape closes, focus returns), Menu (arrow keys) and Avatar (the fill index, and initials "AM" for "Ana María Reyes"), and `apps/web/src/lib/useOverlayHistory.test.ts` (back closes). Create `apps/web/e2e/phase-03-components.spec.ts`: on `/dev/components`, Tab reaches every button in visual order, every interactive element has an accessible name (Playwright `getByRole` with a name for each), opening the Dialog and pressing the browser back button closes it while the URL stays the same (TW-06), and a Toast is announced through `role="status"`.

**Deliverables:** the components listed under Implements, `useOverlayHistory.ts`, `useDelayedFlag.ts`, a shared avatar helper only if the inspected callers require extraction, `/dev/components`, the unit tests and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W03-01** No spinner or skeleton appears for a wait under 300 ms, and one appears for a wait over 300 ms. (D-95; part of T-40)
- [x] **AC-W03-02** `npm run lint --workspace apps/web` reports no jsx-a11y error. (D-95; part of T-40)
- [x] **AC-W03-03** Back closes the top overlay exactly once with preserved router history. Nested overlays, Forward, Escape and route changes do not double-push/close or lose focus. BottomSheet traps/restores focus and its modal background is inert. (TW-06)
- [x] **AC-W03-04** Every component renders in Light and Dark with token colors only (the lint color check passes).
- [x] **AC-W03-05** Icon buttons are at least 44 by 44 px (Playwright `boundingBox()` check in the spec). (D-136)

**Execution status — 2026-11-15 (Asia/Manila).** Complete. Current phase: **100% (13/13 including G-W03)**. Overall user-web progress: **23% (39/169 rounded)**, carrying forward 26 verified Phase 0–2 items. All five AC-W03 criteria met. At this historical Phase 3 checkpoint Phase 4 had not started. The current Phase 4 record below supersedes this transition note; isolated/backend/mail observations are optional under D-W26.

**Dated progress note.** Completed Git baseline → ripgrep → Reader validation → scoped Repomix → complete bounded XML analysis → original-source/version-doc verification. Implemented token-based component folders, 300ms loading/cancellation, labeled spinners, native dialogs/manual sheets with nested focus/inert cleanup, one overlay-history writer with Next path/query reconciliation, modal-scoped menu portals, safe error/empty states, timed/pausable replaceable toasts and the development-only component gallery. No dependencies added. Final web typecheck/lint/49 tests/build, shared typecheck/289 tests, 16 final Chromium/Chrome component cases, 12 theme regression cases, six production cases and a 179-file bundle secret scan pass. Both theme screenshots inspected; runtime/console assertions clean. Owned diff/source hashes reviewed, user changes and existing dev servers preserved, temporary production server stopped. Full AC/work-item evidence: `docs/test-results/web/phase-03.md`; reusable context/identities: `Plans/context/DoloGram_User_Web_Phase_03_Context_Index.md`.

**Discrepancies and boundaries.** Existing mobile avatar helpers are private; browser-local pure mapping preserves the mobile caller and source fills. Web-only CSS generation adds avatar variables and the source spinner period without changing shared/admin output. Current `modal`, `easeOut` and `z.dialog` replace absent `slow`, `enter` and `z.menu`; search/menu targets use 44px for D-136. ErrorState accepts static shared wording. TopBar chat content remains Phase 12. No repository-instruction conflict, required manual gate, mobile/backend implementation, remote action, commit, push or deployment. Wider Edge/Firefox/WebKit/Safari coverage remains a later release task, not a claimed result.

**Exit gate:** `npm run test --workspace apps/web; if ($?) { npm run e2e --workspace apps/web -- phase-03 --project=chromium }` passes.

**Risks and fallbacks**

- `<dialog>` focus behavior differs in Safari: the Phase 19 T-50 run checks it. Fallback: a `div role="dialog" aria-modal="true"` with a manual focus trap in the same component.
- SwitchRow (CMP-04) is not built: the user web has no switch in the MVP (WEB-14 has no Force switch, D-19).

---

### Phase 4 Authentication and recovery

**Goal.** Deliver accepted email-or-username/password sign-in, self-service registration, recovery, forced password change and browser session guards. Depends on Phase 3. Implements W-04, WEB-01/WEB-01b/WEB-02, T-10/T-45, later accepted D-W21/D-W22.

- [x] 1. **W-P04-S01** Create proposed `src/lib/session/SessionProvider.tsx` and `RouteGuard.tsx`. Restore persisted session and subscribe once to SDK events. Distinguish loading, signedOut, signedIn, mustChangePassword, passwordRecovery and recoverable error. Keep recovery state until a valid update succeeds or the user cancels. Fence late profile/session reads with an account revision. Defer async SDK work out of auth callback locks. Update Realtime token once on refresh and tear down old account workers/channels before exposing another account's data.
- [x] 2. **W-P04-S02** Add proposed `(auth)/{sign-in,sign-up,forgot-password,reset-password,change-password}/page.tsx` and `(main)/layout.tsx`, with thin server pages rendering client forms. Main guard redirects signed-out sessions to sign-in and flagged accounts to change-password. Recovery routes remain reachable while recovery is pending. Use the trusted Auth app_metadata flag and retain the guard until refreshed trusted state clears it. Client guards do not establish server data permissions. PF-W16 tracks optional target-specific clearing/enforcement evidence; do not invent a backend clearing API.
- [x] 3. **W-P04-S03** `AuthForm` sign-in retains the centered max-400 column, wordmark/title, labeled Email or username/current-password fields, reveal button, Primary Sign in, Forgot your password? and Create account links. The identifier uses a text input with username autocomplete, no automatic capitalization and no spellcheck. Trim identifiers; validate email or normalize usernames to lowercase and apply the shared 5–32-character username rule before requesting. Email uses `auth.signInWithPassword`; username uses the existing `sign-in-username` Edge Function, validates the returned tokens/user email and installs the session through `auth.setSession`, then the existing owner/profile guards. Do not expose profile emails through a pre-authentication client lookup. Wrong credentials share “Email, username or password is incorrect.” Map username-function 401/429 safely, reject incomplete sessions, disable duplicate submits and offline requests with No connection. Registration and password recovery continue to require email.
- [x] 4. **W-P04-S04** `SignUpForm` retains Email, new Password/Confirm, Username and Display name, Create account and Sign in link. Apply shared email/password≥12/username/display-name validation. Pass username/display_name metadata to `auth.signUp`. With confirmed auto-confirm enabled, route the returned unflagged session to main. If actual server returns no session, display confirmation-required state and report the agreed-setting gap. Username/email collisions must not create a session or orphan profile/auth user. A generic HTTP 500 shows a generic retryable registration failure, never a false username-taken claim. Required local tests cover payloads, validation, safe collision/server-error handling and returned-session routing. Optional isolated evidence asserts actual backend atomicity through an approved fixture harness, never a client scan of auth.users.
- [x] 5. **W-P04-S05** `ForgotPasswordForm` validates email and calls `resetPasswordForEmail` with a validated same-origin `/reset-password` redirect. Show the accepted generic Check your email for a reset link response without account enumeration. Rate-limit and network failures remain actionable. Actual mail/redirect configuration and delivery checks are optional isolated/manual observations. Configuration changes belong to backend/deployment authorization.
- [x] 6. **W-P04-S06** Use an explicit browser recovery flow compatible with installed supabase-js 2.119.0. Current shared factory disables automatic URL detection and uses the SDK's default implicit flow. Before installing tokens, enter recovery-pending state so the SDK SIGNED_IN event cannot start main data/queue work. Parse a recovery hash, validate type and both tokens, and hold tokens only in memory while immediately removing them from history. Call `auth.setSession`, validate its result and persist only a non-secret session-scoped recovery marker for reload. Its SIGNED_IN event is not proof that recovery completed. Clear the marker on success/cancel/sign-out. Never log tokens. Invalid/missing callbacks cannot enable Save. Optionally verify expired/reused original email verification links through the Auth verification endpoint with an approved mail fixture; missing mail/tenant access does not block the required local recovery gate. Session-token acceptance/refresh follows the SDK contract and must not be represented as proof of one-time email-link consumption. If a confirmed target emits PKCE codes, use a deliberately configured compatible client flow and exchange only the extracted code, with verifier storage and missing-verifier recovery tested. Do not pass a full URL to `exchangeCodeForSession`. Do not silently change mobile factory defaults.
- [x] 7. **W-P04-S07** `ChangePasswordForm`/reset form validate matching passwords≥12 and update through `auth.updateUser`. Forced mode has no Back and loads no main data. Settings mode permits Back. After update refresh and re-read trusted flag/profile state. Do not navigate until refreshed trusted Auth state reports the forced flag cleared; identifying/exercising the actual backend clearing mechanism is optional target verification. On failure retain the form/recovery state with retry. Include disabled offline state. Optionally verify old password refused/new accepted on an approved disposable account.
- [x] 8. **W-P04-S08** Basic local sign-out removes the browser session using the installed SDK's actual behavior. Verify offline handling because revocation may use the network. Phase 9 adds coordinated wiping and the unsent warning. Preserve local access denial even when remote revocation fails, report pending revocation accurately and never reuse the old session. Do not clear unrelated browser storage.
- [x] 9. **W-P04-S09** Add proposed `phase-04-auth.spec.ts` and unit/transport cases for validation/no request, wrong credentials, reload/offline restore, token refresh, duplicate submit, atomic registration collision, generic server error, confirmation-required response, recovery success/expired/reused email link/wrong type, SIGNED_IN-during-install guard, URL clearing before requests, recovery reload/direct navigation, forced guard/data denial and password change failure/flag clearing. Required tests use local/injected Auth transports and automated browser fixtures. Real mail-link/registration-atomicity/old-new-password/server-denial cases are optional and require approved mail/disposable-account fixtures if elected. Reuse existing shared strings before adding only missing web wording.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W04-01** Email and normalized username sign-in restore the correct owner in required local/injected tests. Wrong credentials show the same message and create no session. Live account sign-in remains separately unverified. A failed saved-session restore offers Retry session and Sign out on this browser; explicit local sign-out clears the failed saved session and enables a fresh sign-in. Pending-revocation errors retain Retry local sign-out.
- [x] **AC-W04-02** Required client registration validation, username/display_name metadata, unflagged returned-session routing, confirmation-required state and safe/atomic-failure response handling pass local/automated tests. Optional isolated verification: actual one-profile/Saved-Messages creation, backend collision rollback and agreed tenant settings remain unverified until run.
- [x] **AC-W04-03** Required SDK/automated-browser recovery validates callbacks, clears URL credentials before requests, blocks SIGNED_IN bypass, resumes valid pending recovery and clears its marker only after a verified successful update or cancellation/sign-out. Optional isolated/manual verification: real mail delivery, Auth verification-endpoint expiry/reuse and old-password refusal/new-password acceptance remain unverified until run.
- [x] **AC-W04-04** Required client forced accounts remain guarded with no main data reads until refreshed trusted flag/profile state allows access. Failed update/refresh cannot bypass the gate. Optional isolated verification of actual server denial and backend flag clearing remains unverified; client checks are not proof of backend enforcement.
- [x] **AC-W04-05** Offline/refresh/sign-out/account transitions preserve isolation and show accurate recoverable state.

**Execution progress — 2026-11-15 (Asia/Manila), revised verification policy D-W26.** Complete: required local implementation/verification **100% (10/10: S01–S09 + G-W04)**. Overall required user-web progress **30% (49/166 rounded)**, carrying forward 39 completed Phase 0–3 items. All five AC-W04 required client/SDK/browser portions are met. No new runtime check is claimed by this documentation revision: it reuses the recorded 87 passing tests, 16 passing Chromium cases, lint/typecheck/build/secret scan, cleanup and owned-diff evidence for unchanged application source. Actual isolated registration/mail/old-new-password/server-denial observations remain **optional/not run and unverified** under PF-W15/PF-W16/PF-W17. Their absence no longer blocks completion or transition. Phase 5 is ready to start only when separately authorized; this revision starts no later phase.

**Dated verification note.** Workflow: Git working-copy snapshot → scoped ripgrep → Reader validation → Repomix 1.18.1 scoped XML → all 806 XML lines analyzed → original-source/installed-doc verification. Pre-edit web typecheck/lint/build and all 49 existing tests passed. Final web typecheck/lint/build/secret scan passed; all **87 unit/transport tests** and **16 Chromium production browser cases** passed. Light/dark responsive forms visually inspected; no unexpected application runtime/console warning/error observed. Existing root/web manifests, lock and shared/mobile source preserved; no new dependencies. Task-owned local server stopped; existing user dev server preserved. Evidence, owned diff/hashes, diagnostics, historical classifications, optional live follow-ups and external authorization limits: [Phase 4 report](../docs/test-results/web/phase-04.md) and [context index](context/DoloGram_User_Web_Phase_04_Context_Index.md).

**Discrepancies/decisions.** No repository-instruction conflict. The initial plan's absent-web-directory baseline is stale; actual Phase 0–3 source and current checks establish prerequisites. The current SDK removes a local session before network revocation and already updates Realtime on token refresh, so no duplicate setAuth is added. Existing root page moved under the guarded main layout; earlier smoke tests now assert the required sign-in redirect. The test artifact embeds only a synthetic intercepted Auth target; rebuild with approved public configuration before real use. No backend clearing RPC was invented, no backend/mobile/settings/store phase was implemented, and no external service configuration/data was changed. Phase 4's required transition gate is **cleared** under D-W26, and Phase 5 is ready for separately authorized execution using verified session interfaces and local/injected fixtures. **Phase 5 and later phases were not started.**

**Chat follow-up — 2026-11-15 (Asia/Manila).** Owner requested the three-setting local configuration, email-or-username user login and a fix for the saved-session error that disabled sign-in. Changes are in `apps/web/src/lib/supabase.ts`, `src/features/auth/AuthForm.tsx`, `src/lib/session/session.ts`, `src/lib/session/errors.ts`, the environment example, affected unit tests and E2E selectors. Existing phase reports above are historical evidence; their full build/browser results were not rerun for this follow-up.

| Follow-up | Observed evidence and limits |
|---|---|
| Public configuration | Runtime, unit fixtures and API target helper use NEXT_PUBLIC_SUPABASE_ANON_KEY. The environment change passed 21 affected tests and web typecheck. The ignored local file retains only the three requested settings. No credential values are recorded here. |
| Connection smoke | Read-only Supabase Auth settings request returned HTTP 200. Local user web returned HTTP 200 with the matching embedded Supabase URL. These checks establish endpoint reachability/configuration, not successful account login or database operations. Sandbox EACCES/ENOTFOUND diagnostics were resolved by the approved network check; they were not treated as backend failures. |
| Username sign-in | Initial AuthForm/session regression run: 47/47 passed; web typecheck and lint passed. Coverage includes normalized usernames, installed session ownership, credential/rate-limit/service failures and incomplete returned sessions. Existing backend function reused; no function deployment or backend edits occurred. An OPTIONS check of the configured username endpoint returned HTTP 200; it does not prove a successful credential exchange. |
| Saved-session recovery | A fresh browser opened an enabled sign-in form. Added explicit local sign-out alongside Retry session when restore fails. A simulated expired session with Supabase traffic intercepted reproduced the disabled form; clicking local sign-out removed its saved SDK session and enabled sign-in. The actual user's saved session was not inspected or cleared, so its underlying failure cause is not established. |
| Final affected checks | `npm run test --workspace apps/web -- src/features/auth/AuthForm.test.tsx src/lib/session/session.test.ts`: 49/49 passed. Final `npm run typecheck --workspace apps/web` and `npm run lint --workspace apps/web`: passed. Browser recovery was verified in a fresh automated Chromium context. No new full build, full suite, secret scan or full production E2E run is claimed. |
| Account diagnosis | Web/admin configured project URLs matched. An authorized read-only exact profile lookup for the screenshot identifier returned zero rows. This does not establish that the user's intended account is absent under another identifier. A profile row alone does not prove a valid Supabase Auth identity/password. The four-character screenshot identifier also fails the current shared 5–32-character username rule; this chat did not relax that rule. Successful live email/username account sign-in remains unverified; use the registered email when the username does not meet the current rule. |

No later phase, backend migration/deployment, account creation or credential reset was performed by this follow-up. These changes refine Phase 4 behavior without changing **63/166** completed required items.

**Deliverables.** Session/guard/forms/routes, safe error mapping and recovery tests.

**Exit gate.** Web lint/typecheck/unit/auth browser cases pass. G-W04 passes on the recorded required local/automated evidence. PF-W15/PF-W16/PF-W17 observations are optional/not run, not completion blockers; no hosted-security verification is claimed.

SDK exchange reference is [Supabase exchangeCodeForSession](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession).

---

### Phase 5 IndexedDB local store and browser ownership

**Goal.** Persist queue/cache/blobs with safe cross-tab/account coordination. Depends on Phase 4. Implements W-05, TW-01/TW-02/TW-08 and LS-9/LS-10.

- [x] 1. **W-P05-S01** Proposed `src/lib/store/IndexedDbStore.ts` implements current `LocalQueueStore` and `SyncCacheStore`. Add only consumed web query/blob/folder methods. Database `dologram` starts at version 1. Namespace all account-owned records by authenticated user ID and store owner identity before exposing cached data. Queue/messages/media/members/reactions/folders/cursors/pending reads/blobs must never cross accounts. Quarantine unknown-owner/newer-schema data without assigning it to the next account.
- [x] 2. **W-P05-S02** Define stores/indexes for queue status/chat/order, messages chat/seq/time, media/reactions by message, members, folders/folder_chats, sync state, pending reads, blobs and metadata. Queue payload follows current shared types. Persist web-only monotonic insertion order with each insert. Enforce 200 unsent atomically across tabs, adapting the core result contract minimally if needed. Preserve ordering on equal timestamps/restart. Upgrades are transactional and retain compatible data.
- [x] 3. **W-P05-S03** Persist blobs plus queue envelope atomically, or use a recoverable staging journal with startup orphan cleanup. Quota/write failures retain composer text/files and show actionable errors. Queue UI appears only after durable commit. Cache merges/complete `replaceMembers` are atomic where required. Notify observers after commit. Proposed `useStoreQuery` caches stable snapshots, rejects stale reads and avoids render loops. Add `idb` only when its promise wrapper is necessary.
- [x] 4. **W-P05-S04** Proposed `src/lib/worker/leader.ts` uses Web Locks plus account/session epochs and BroadcastChannel. Visible tabs compete for `dg-worker`. Hidden ownership stops new work, settles/aborts bounded requests, releases the lock and lets a visible tab lead. Use separate transactional admission/ordering for queue writes. Fence late callbacks after leadership/account/sign-out changes. Run startup resetSending only under exclusive ownership after old work settles. Local messages are validated and owner/epoch-scoped. Unsupported Web Locks needs a tested transactional IndexedDB lease with fencing or an explicit capability blocker. A lowest-random-ID heartbeat cannot establish safe ownership.
- [x] 5. **W-P05-S05** Proposed `StoreProvider` opens for the resolved owner, closes on versionchange/teardown and invalidates callbacks before switching account. Sign-out broadcasts quiescence before deletion. Handle crashed leader, blocked database open/delete and storage errors. A 5-second blocked deletion reports retained cleanup state, with verified logical clearing already complete.
- [x] 6. **W-P05-S06** Test real IndexedDB in Chromium/Firefox plus fake-indexeddb. Cover write/close/reopen, upgrade rollback, recovery, Blob/ArrayBuffer, complete member replacement, concurrent 199/200/201 capacity, equal timestamps, hidden-leader handoff, stale callback, A→sign-out→B, quota failure and interruption between blob/queue persistence.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W05-01** Queue/cache/blobs survive supported restart/upgrades without data loss or cross-account exposure.
- [x] **AC-W05-02** Two tabs preserve capacity/order, exactly one visible worker and handoff within 2 seconds after the prior bounded attempt settles/aborts. Committed changes refresh siblings within 1 second in the test workload.
- [x] **AC-W05-03** Stale/hidden/signed-out owners start no new side effects. Recovery cannot reset a live sending item.
- [x] **AC-W05-04** Failed persistence retains the draft and leaves recoverable consistent state.

**Deliverables.** Store/provider/query/leadership adapters and recovery tests. TW-01 uses existing queue/cache interfaces.

**Exit gate.** Web/shared checks and Chromium/Firefox real-store tests pass. Record unavailable capabilities explicitly.

**Execution progress — 2026-11-15 (Asia/Manila).** **Complete: 100% (7/7: W-P05-S01–S06 + G-W05)**. Overall required user-web progress **34% (56/166 rounded)**. All four AC-W05 criteria are met for required implementation/local automation. Evidence: `docs/test-results/web/phase-05.md`; source/read/packet identities: `Plans/context/DoloGram_User_Web_Phase_05_Context_Index.md` and `supabase/repomix/user-web-phase-05-20261115/`. This selected-phase record supersedes historical opening summaries that say Phase 5 is unstarted. **Phase 6 is ready for separate execution and was not started.**

**Verified implementation.** Account/epoch-checked IndexedDB v1, atomic 200-unsent admission/order/blob commits, complete member replacement, stable/stale-safe query snapshots, visible Web Locks ownership, lease-bound worker writes/recovery, validated sibling messages, provider teardown/versionchange and coordinated sign-out. Blocked opening/deletion report after 5 seconds; logical wipe precedes physical deletion. Failed cleanup is retained for retry. Unsupported Web Locks/BroadcastChannel has explicit capability errors. No new dependency, backend/mobile implementation, queue transport, sync integration, composer or later-phase UI.

**Verification.** Web lint/typecheck/build and secret scan pass; full web suite 97/97 plus final affected store suite 9/9 (one additional capability test); shared typecheck and 289/289 tests pass; mobile compatibility typecheck passes. Fourteen distinct real Chromium/Firefox storage/lock/channel cases pass across final full and supplemental runs; eleven production Chromium auth/provider/boundary cases pass with intercepted synthetic APIs. No unexpected browser/server warnings/errors. Baseline web 87/87 tests, lint/typecheck/build and shared checks passed. Intermediate type/lint/test-fixture issues were diagnosed and fixed; no required failing check remains. Final production bundle excludes harness/fixture markers. Task port 3105 is closed; existing user port 3000 remains running. Owned diff reviewed against captured working copy; manifests/config/lock preserved. Optional isolated/manual/Safari/device observations remain not run, non-blocking under D-W26.

**Discrepancies/decisions.** No repository-instruction conflict. The historical absent-web baseline is stale. A concurrent required `profiles.roles` schema field was preserved; session profile typing now matches its existing selected columns. Shared atomic admission is optional for existing adapters. v1 is the only supported schema: unknown-owner/newer data is quarantined without reassignment. Visibility automation uses injected lifecycle events with real browser locks/channels/storage and page-close crash recovery; no manual OS-backgrounding result is inferred. Existing shared discard/sync issues belong to Phases 6/7 and were not changed. No commits/pushes/deployments/remote mutations/service changes.

---

### Phase 6 Queue delivery integration and recovery

**Goal.** Deliver through the existing core/runner and browser store. Depends on Phase 5. Implements W-06, LS-1–LS-4/LS-7–LS-10, T-09/T-18/T-19/T-21/T-41/T-49.

- [x] 1. **W-P06-S01** Use `createQueueCore({ store, timing: config.queue, now, random })` and `createQueueRunner({ core, deliver, senderId, canAttempt })`. Enqueue uses `{ messageId, payload }` with `kind: 'text'`, chat/sender/content/reply/count/attachments and `force_low_signal: false`. Persist current row_may_exist/row_state/created_at/status/retry fields. Browser ordering stays adapter metadata. Do not create a parallel core or replace shared types with the old example.
- [x] 2. **W-P06-S02** Proposed `webConnectivity.ts`, `supabaseSender.ts` and `DeliveryWorker.tsx` use online/offline events and visible ownership at every attempt. Reuse shared message insert/soft-delete repositories and cache the delivered row. Validate duplicate-key success against the intended message ID/owner, and continue attachment work after a duplicate row. Coalesce 15-second timer, online, visibility and enqueue triggers through the non-overlapping runner. Sibling-tab commands wake the leader.
- [x] 3. **W-P06-S03** Preserve backoff/jitter, eight connected failures, DG429 wait without increment, retry reset and strict row order. Verify connectivity dropping during a request and minimally correct attempt accounting if disconnected failures consume attempts. Permanent authorization/validation rejection must retain failed work with safe text. Make any necessary shared terminal-error extension backward compatible. An invalid session suspends new work with bounded recovery.
- [x] 4. **W-P06-S04** Correct current `core.discard`, which removes local work after non-network server errors. Retain work until soft delete succeeds or an authorized read confirms absence. Forbidden/timeout/server rejection remains recoverable. A zero-row response alone does not prove absence under RLS. Clean blobs only after confirmed discard and preserve uncertain row state.
- [x] 5. **W-P06-S05** Add focused regressions for lost insert response, duplicate ID, offline mid-request, eight online failures, DG429, permanent error, account/leadership change, row ordering, stored-row attachment retries, failed discard and capacity races. Keep failure injection active for eight attempts. Use fake clocks and test-only transports, excluded from production.
- [x] 6. **W-P06-S06** Proposed `phase-06-queue.spec.ts` uses local/injected fixtures for required offline→online status, exactly-once delivery, leadership and retention assertions. Equivalent actual-row observations with isolated accounts are optional. Hide the leader, enqueue from a visible sibling and prove handoff/delivery. Assert hidden owners initiate no new requests. Add the previously planned proposed `src/app/dev/queue/page.tsx` behind the Phase 1 development boundary with synthetic status/queue controls and test-only fault injection. Phase 9 tests may enqueue fixture items through it. Production acceptance uses the ordinary composer when Phase 13 is available.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W06-01** Persistence precedes requests and uncertain retry produces exactly one row.
- [x] **AC-W06-02** Eight connected failures retain failed work, offline failures preserve count and DG429 waits without increment.
- [x] **AC-W06-03** Per-chat order, independent chats, capacity and safe Retry/Discard pass under multi-tab use.
- [x] **AC-W06-04** Hidden/stale owners and invalid sessions initiate no new work. Interrupted items remain recoverable for their owner.

**Deliverables.** Browser queue host/sender, minimal shared compatibility corrections and regression evidence.

**Exit gate.** Required web/shared checks, affected mobile queue tests and automated local/injected browser queue cases pass. Isolated browser/actual-rate-limit T-21 evidence is optional; PF-W5 missing evidence does not block this gate. Confirmed queue/rate-handling implementation failures still require correction.

**Execution progress — 2026-11-15 (Asia/Manila).** **Complete: 100% (7/7: W-P06-S01–S06 + G-W06)**. Overall required user-web progress **38% (63/166 rounded)**. All four AC-W06 criteria are met for required implementation/local automation. Evidence: `docs/test-results/web/phase-06.md`; verified context/source identities: `Plans/context/DoloGram_User_Web_Phase_06_Context_Index.md` and `supabase/repomix/user-web-phase-06-20261115/`. **Phase 7 is ready for separate execution and was not started.**

**Verified implementation.** Existing core/runner/store contracts, account-owned text enqueue, visible fenced worker hosted by StoreProvider, 15-second/online/sibling wake coalescing, bounded abortable sender, verified duplicate-row identity, durable cache before sent, offline attempt retention, eight connected failures, DG429 deferral, permanent-error retention and explicit invalid-session recovery. Retry/Discard serialize with drains across tabs; every deletion rejection/timeout/zero-row ambiguity retains local work and blobs. Only a matching confirmed soft-delete permits cleanup. Newer cached tombstones survive delayed delivery responses. No dependency, backend, native, composer or sync-engine implementation was added.

**Verification.** Final web lint/typecheck/build and secret/fixture scans pass. Full web 103/103 tests pass, followed by affected sender/store 14/14 and final store 10/10 (one added cache test); shared typecheck/297 tests and mobile typecheck/8 affected queue tests pass. Real Chromium 159.0.8154.6/Firefox 159.0: 14 queue cases and 14 storage regressions pass. Fifteen production Chromium auth/provider/HTML/RSC boundary checks pass; the development synthetic queue control flow passes with external requests blocked. No unexpected runtime/console warning/error remains. Shared Vite/SQLite warnings are pre-existing. Sandbox cache/filesystem/socket failures were diagnosed and required checks completed using workspace cache or host execution. Owned diff/source identities reviewed; manifests/lock/config/instructions preserved; task port 3106 stopped, existing user server 3000 preserved. Optional isolated/manual/device/Safari observations were not run and remain unverified under D-W26. No required blocker remains; no commit/push/deployment/remote mutation/service configuration change.

**Execution decisions and discrepancies.** The proposed DeliveryWorker is implemented in `src/lib/queue/worker.ts` and the existing StoreProvider, avoiding a second leadership host. SDK signal/retry options and shared offline/permanent-error extensions are optional and preserve existing mobile callers. RLS-filtered absence cannot be proven safely, so discard conservatively requires positive deletion confirmation. Attachment continuation is tested at an injected boundary; pending production attachment work is retained until Phase 16, and ordinary composer/cleanup remains Phase 13. The scoped development diagnostic uses a separate synthetic database and is excluded from production by the existing alias. Historical opening summaries saying Phase 5 is unstarted are stale; only this selected phase was updated. The pre-existing sync pagination finding remains for Phase 7.

---

### Phase 7 Sync integration and cache integrity

**Goal.** Integrate current sync with complete catch-up and member reconciliation. Depends on Phase 6. Implements W-07, T-04/T-13/T-38 and TW-09.

- [x] 1. **W-P07-S01** Reuse `createSyncEngine`, `SyncCacheStore`, `SyncSource`, `SyncDelivery` and repositories. Proposed browser adapters live under `src/lib/sync`. Mobile references are `createSupabaseSyncSource`/`createSupabaseDelivery` in `apps/mobile/src/sync/source.ts`. Share platform-neutral logic only when useful without importing mobile initialization. Validate untyped events before storage.
- [x] 2. **W-P07-S02** Subscribe to messages/media/reactions/chat_members under visible ownership. Map member DELETE/key-only/malformed events to bounded complete snapshot refresh through `listChatMembers(client, chatId, userId)`. Failed/incomplete snapshots never prune valid members. Prune only from complete authorized data or confirmed access loss. Proposed browser `refreshMetadata()` in `src/lib/sync/metadata.ts` refreshes complete chat/folder/archive snapshots at startup/foreground/reconnect. Folders are outside current SyncSource and require explicit browser orchestration.
- [x] 3. **W-P07-S03** Correct cursor safety before release. Current `resyncPages` advances to the maximum of three independently limited pages and can skip a fuller table's continuation. Add a fixture with >500 messages and a later media/reaction sequence. Retain the current source method signatures and choose a safe common page boundary. Fetch all three tables after the same confirmed cursor, persist their validated rows, and, when any table returns a full page, advance only to the minimum last sync_seq among those full pages. If every page is shorter than the limit, advance to the maximum persisted sync_seq and finish that catch-up pass. Empty tables never contribute a zero/minimum bound. Rows persisted above the safe boundary may replay and merge idempotently. Stop with an explicit incomplete/error result when no progress is possible or a cap is reached. Realtime events merge by key without advancing the catch-up cursor. Older responses cannot overwrite newer sync_seq/tombstones. For existing caches, a higher legacy cursor cannot establish completeness. Add a cache-local cursor-algorithm version marker and a reset operation to the existing SyncCacheStore contract and its browser/mobile/test adapters. Reset only sync checkpoints to 0 once per owning cache upgrade, atomically record the version under stopped/exclusive ownership, and preserve rows, queue, drafts and blobs. The resumed engine replays from 0 using sync_seq-guarded upserts. Assign mobile integration to `apps/mobile/src/sync/cacheStore.ts` and its existing local schema/migration owner found through `apps/mobile/src/queue/db.ts`; do not reset through the existing monotonic setCursor method. Old clients must be excluded from concurrently writing the same upgraded cache. Test a missing row below an inflated legacy cursor and interruption before/after the atomic reset. Reject unsupported newer local schemas in the new client. Preserve a recoverable pre-upgrade snapshot for rehearsal. Mobile rollback uses a forward-compatible repair artifact retaining the cursor fix, rather than reinstalling the legacy cursor writer over the upgraded cache; do not reset application data or queue to bypass recovery.
- [x] 4. **W-P07-S04** Preserve complete history, remote pages 500 and UI windows 50. Paginate metadata snapshots before pruning. Distinguish empty, partial, failed and denied reads. Bound catch-up per pass with safe continuations and explicit incomplete status at caps/timeouts. A loop cap alone cannot report success. Coalesce refreshes and back off repeated errors.
- [x] 5. **W-P07-S05** Proposed `SyncHost` follows account epoch/leadership, resubscribes before catch-up and propagates local invalidations. TW-09 records actual subscribe/timeout and member/non-member behavior. Refusal may enable visible-only bounded 15-second diagnostic catch-up while displaying degraded state. It cannot satisfy the 2-second release budget. Backend authorization stays outside scope.
- [x] 6. **W-P07-S06** Extend current sync tests and browser cases for imbalanced multi-table pages, empty tables, failed/partial roster, removal/rejoin, duplicate/out-of-order events, tombstones/edits, unknown chat, account change, interrupted checkpoint, >500-row metadata and cap continuation, plus the legacy-cursor reset/replay migration. Assert expected IDs/content/tombstones as well as counts. Cover current mobile read/member event compatibility.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W07-01** Every expected row appears after missed/concurrent changes, including beyond page 1 and below an inflated legacy cursor after upgrade, without gaps/stale overwrite. Checkpoint reset preserves owned cached rows, queue and blobs and is crash-safe.
- [x] **AC-W07-02** Failed/incomplete reads preserve data/safe cursors. Confirmed removal clears owned chat cache, pending reads and orphan blobs.
- [x] **AC-W07-03** Complete member replacement and folder/archive reconciliation follow current contracts.
- [x] **AC-W07-04** One visible owner subscribes/catches up. Refused joins are visible, bounded and unverified for latency.

**Deliverables.** Browser sync adapters, necessary cursor correction and mobile regression evidence.

**Exit gate.** Required web/shared checks, affected mobile tests and local/injected automated paging/snapshot/catch-up assertions pass. Isolated Realtime/catch-up/timing observations are optional and PF-W2 missing evidence does not block completion. Former D-W19 algorithm is replaced by this safe paging contract.

**Execution progress — 2026-11-16 (Asia/Manila).** **Complete: 100% (7/7: W-P07-S01–S06 + G-W07)**. Overall required progress **42% (70/166 rounded)**. AC-W07-01–04 are met for required source/local automation. Evidence: `docs/test-results/web/phase-07.md`; context and source identities: `Plans/context/DoloGram_User_Web_Phase_07_Context_Index.md` and `supabase/repomix/user-web-phase-07-20261115/`. Phase 8 is ready for separate authorization and has not been started.

**Verified implementation.** Browser sync shares the existing visible queue-worker lease, validates transport rows, fences writes and cancels on account/ownership/connectivity changes. Four-table delivery, bounded complete member refreshes, paginated chat/folder/archive reconciliation, conservative common-page checkpoints, event-only merges, sequence-guarded tombstones and explicit incomplete results are implemented. Browser schema v2 excludes v1 writers; its account-local checkpoint backup/reset/version commit is atomic. Mobile local schema v10 adds checkpoint backup/version ownership; SQLite reset and sequence guards retain cached rows, local queue and membership-bound reads. Normal startup resets legacy cursors only once before subscription. Remote schemas are unchanged.

**Verification — 2026-11-16.** Final web typecheck/lint/build, 118 tests (22 files), secret scan of 345 emitted files after browser verification and fixture exclusion pass. Shared tests: 303/303. Mobile typecheck and 11 affected sync/database/queue tests pass; owned mobile files lint clean. Chromium 159.0.8154.6 and Firefox 159.0 pass all 12 sync/upgrade cases; the existing storage/queue browser cases passed 28/28 across the recorded regression run. Sixteen production auth/provider/boundary assertions passed, followed by four source-matched final production assertions. No unexpected browser console/runtime errors or warnings. Shared typecheck retains its two baseline unresolved AbortSignal names in messages.ts; full mobile lint retains 14 errors/4 warnings on seven unchanged, unrelated source paths. These pre-existing checks are explicitly recorded, not claimed passed; no new diagnostic remains. Both task ports 3108/3109 are closed. No new dependencies, commit, push, deployment, remote migration, hosted mutation or service configuration change.

**Decisions, discrepancies and remaining optional work.** The proposed SyncHost is `src/lib/sync/host.ts`, attached to StoreProvider's existing worker instead of adding another leader. Platform-neutral Supabase transport moved from mobile to shared with a compatibility re-export. Safe continuation preserves complete cached history; shared list/sync limits remain 50/500, with no later-phase list/thread UI added. Diagnostic refusal recovery starts after 15 seconds, backs off and stops after four retries; it is visibly degraded and establishes no two-second live latency claim. Mobile upgrades require the old app process stopped/excluded and a source-compatible forward repair artifact for rollback; never reopen the upgraded cache with a legacy writer or reset app data. Package/device rollout was not performed. Optional isolated Realtime/member/nonmember authorization, live timing, native device and manual/Safari observations remain not run and unverified under D-W26. Historical opening/index progress is stale; this selected-phase record is authoritative. No instruction conflict or required implementation blocker remains.

---

### Phase 8 Responsive shell and navigation

**Goal:** Build the main layout with the navigation rail from 768 px, the bottom tab bar below 768 px, the list and chat panes, and dialogs as history state.

**Depends on:** Phase 7.

**Implements:** WEB-03, 11.3 Layout, 12.6 (user web routes, keyboard order), 12.7 (user web widths), CMP-15, CMP-23, CMP-32, CMP-33, D-35, D-128 (superseded), D-142, D-145, T-40 (breakpoint part).

**Steps**

- [x] 1. **W-P08-S01** **Layout module.** Create `apps/web/src/features/shell/MainLayout.tsx` and `MainLayout.module.css`, used by `apps/web/src/app/(main)/layout.tsx`. The breakpoints are only CSS media queries `(min-width: 768px)` and `(min-width: 1280px)`, so the first paint is correct with no JavaScript width check (12.7). Grid areas:
  - below 768 px: one column. The chat list route shows the list plus the TabBar at the bottom. The chat route shows the chat full screen with no TabBar and a back button to `/`.
  - 768 to 1279 px: `rail 72px | list 360px | chat 1fr`, with the list pane's right border 1 px `color.border.subtle`.
  - from 1280 px: `rail 72px | list 400px | chat 1fr`, plus an `info 360px` column when chat info is open (D-145).
- [x] 2. **W-P08-S02** **NavRail (CMP-33).** Create `apps/web/src/components/NavRail/NavRail.tsx` as `<nav aria-label="Main">`:
  - the "D" mark, the shared bold sans font at 24 in a 48 square, linking to `/` with the label "DoloGram, chats"
  - Chats (`nav.chats`), active on every chat-list, archive and chat route with `aria-current="page"`, fill `color.bg.surface` and stroke 2.5
  - New (`nav.new`), which opens a Menu (CMP-23) with "New chat" and "New group"
  - Profile, the user's 24 Avatar at the bottom, label "Profile and settings", which opens the Settings dialog

  Items show their names as tooltips on hover and focus.
- [x] 3. **W-P08-S03** **TabBar (CMP-32).** Create `apps/web/src/components/TabBar/TabBar.tsx` as a `<nav>` fixed to the bottom, height 56 plus `env(safe-area-inset-bottom)`, rendered only below 768 px on the chat list. It has three icon-only items with the labels "Chats", "New" and "Profile and settings". New is a button with `aria-haspopup="dialog"` that opens a BottomSheet (CMP-15) with "New chat" and "New group". A tap on Chats while active scrolls the list to the top.
- [x] 4. **W-P08-S04** **Panes.**
  - `apps/web/src/features/shell/ListPane.tsx` hosts the chat list, filled in Phase 10.
  - `apps/web/src/features/shell/ChatPane.tsx` hosts the open chat. On `/` from 768 px it shows the EmptyState with `action.newChat` and "Select a chat" (11.3).
  - Routes: `(main)/page.tsx` (list), `(main)/archive/page.tsx` (archive, Phase 10) and `(main)/chat/[chatId]/page.tsx` (chat, Phase 12; this phase shows the TopBar with the chat id and a back button).
- [x] 5. **W-P08-S05** **Overlay state.** Create `apps/web/src/features/shell/OverlayProvider.tsx` with the state `{ kind: 'none' | 'newChat' | 'newGroup' | 'forward' | 'folders' | 'settings' | 'media', props?: object }`. Dialogs are state, not routes (12.6, D-128), and each open pushes a history entry through `useOverlayHistory` (Phase 3). This phase opens empty Dialog shells titled "New chat", "New group" and "Settings"; their contents arrive in Phases 9 and 11.
- [x] 6. **W-P08-S06** **Tab order (12.6).** DOM order is rail, top bar, banners, folder tabs, list, then the chat (top bar, messages, composer). Below 768 px the TabBar comes last in the DOM. No positive `tabindex` is used anywhere (`jsx-a11y/no-noninteractive-tabindex` and `tabindex-no-positive` are in the strict set).
- [x] 7. **W-P08-S07** **Document title.** Create `apps/web/src/features/shell/useDocumentTitle.ts`, which sets `document.title` to `DoloGram`, or `(<n>) DoloGram` when the total unread count n is above 0 (WEB-03, D-W15). The count comes from Phase 10; until then n is 0.
W-P08-S08 is retired. Phase 4 no longer creates a temporary Sign out button. Its cleanup has zero execution weight, and Phase 8 has eight active work items plus G-W08. Retain this identifier for history and do not delete unrelated controls.
- [x] 9. **W-P08-S09** **Spec.** Create `apps/web/e2e/phase-08-shell.spec.ts`:
  - at viewport 767 by 900 the TabBar is visible and the NavRail is hidden; at 768 by 900 the NavRail is visible, the list pane is 360 px wide and "Select a chat" shows; at 1280 by 900 the list pane is 400 px wide (T-40 breakpoint part)
  - New opens a menu at 768 px and a bottom sheet at 767 px
  - the browser back button closes the Settings dialog without leaving `/`
  - Tab from the page start reaches the rail before the list

**Deliverables:** `MainLayout`, `NavRail`, `TabBar`, `ListPane`, `ChatPane`, `OverlayProvider`, `useDocumentTitle`, the `(main)` routes and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W08-01** At 767 px the layout is one column and at 768 px two columns plus the rail. (T-40, D-35)
- [x] **AC-W08-02** From 1280 px the list pane is 400 px. (D-145)
- [x] **AC-W08-03** The tab bar is not shown on the chat route below 768 px. (D-142, 12.7)
- [x] **AC-W08-04** Back closes exactly one dialog without losing Next router history or duplicating overlay entries, and restores focus. (12.6, TW-06)
- [x] **AC-W08-05** Tab order follows rail, list, chat. (D-95, 12.6)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-08 --project=chromium` passes.

**Execution progress — 2026-11-16 (Asia/Manila).** **Complete: 100% (9/9: W-P08-S01–S07/S09 + G-W08)**. Overall required progress **48% (79/166 rounded)**. AC-W08-01–05 met for required source/local automation. Evidence: `docs/test-results/web/phase-08.md`; compact context/source identities: `Plans/context/DoloGram_User_Web_Phase_08_Context_Index.md` and `supabase/repomix/user-web-phase-08-20261116/`. Phase 9 is ready for separate authorization and has not been started.

**Dated verification and decisions.** Baseline web typecheck/lint/build passed; 118/118 tests passed. Final web typecheck/lint/build passed; 119/119 tests passed. Phase 8 production-browser gate: 7/7 each on Chromium, Firefox and installed Chrome (21 passed); authentication/production-boundary regressions: 16/16 Chromium. Console/page warning/error assertions passed; secret scan passed over 361 build-only files and 405 files after browser requests; fixture-exclusion and owned-diff checks passed. Edge is unavailable (executable absent; launch failures retained, no application result); optional Safari/hosted/manual observations remain unverified. No dependencies added. Existing user changes and the user-owned port-3000 server preserved; task-owned port 3108 stopped after verification.

**Scoped implementation notes/discrepancies.** Reused existing overlay-history/modal controls; mobile New sheet stays below its selected dialog so each Back removes one overlay and restores its opener. Store feedback now occupies the list banner slot after its TopBar. Empty root/archive route bodies intentionally use the persistent shell's ListPane; chat route provides the ID TopBar. The 360 px information slot has CSS support from 1280 px; its later-phase contents/actions are not implemented. Unread input remains zero until Phase 10, with positive/invalid/reset hook tests. The plan opening/global summaries are stale and remain unchanged under the selected-phase-only update rule. No repository-instruction conflict, later-phase implementation, commit, push, deployment or remote mutation.

**Risks and fallbacks**

- A CSS grid of a later column does not collapse in one browser: checked in the T-50 run of Phase 19; fallback flexbox with the same widths in `MainLayout.module.css`.

---

### Phase 9 Settings dialog, theme setting and sign-out

**Goal:** Build the Settings dialog with the profile card, the theme choice, Change password, About and a sign-out that warns about unsent items and wipes this browser's data.

**Depends on:** Phase 8.

**Implements:** WEB-14, F1 (sign out, change password), 12.5 Settings template, D-51, D-83, D-109 (5), D-W17, T-10 (change password while signed in), T-40 (theme part), T-49 (sign-out part), TW-08.

**Steps**

- [x] 1. **W-P09-S01** **Dialog content.** Create `apps/web/src/features/settings/SettingsDialog.tsx`, opened by Profile (rail or tab bar) as a form Dialog (520 wide from 768 px, full screen below). Content, top to bottom:
  - Profile card, height 88: 64 Avatar, display name (`title.sm`) and `@username` (`body.sm` `color.text.secondary`), read from the cached `profiles` row of the session user
  - section "Appearance": a 3-option radio group, System, Light and Dark, with the icons `theme.system`, `theme.light` and `theme.dark`. A change calls `setThemeSetting` and applies at once (D-83)
  - section "Chats": Folders, which is hidden until Phase 18 adds WEB-13
  - section "Account": Change password, which navigates to `/change-password?from=settings` and is disabled offline with "No connection", and Sign out in `color.danger`
  - section "About": "DoloGram <version> (<build>)" in `body.sm`, with the version from `apps/web/package.json` (exposed through `next.config.ts` `env`) and the build from NEXT_PUBLIC_DG_BUILD

  No Force Low Signal Mode, app lock or notifications rows exist (D-19, F10, F11).
- [x] 2. **W-P09-S02** **Sign out (D-109 (5)).** Extend `apps/web/src/lib/session/signOut.ts` with `signOutAndWipe()`:
  1. Count current owner's unsent items and confirm the accepted loss warning. Cancel preserves everything.
  2. Mark the account epoch as signing out, block new mutations and broadcast quiescence before deleting anything. All tabs abort/settle bounded delivery/sync/media/read work, close DB handles and stop channels/timers. Late callbacks cannot repopulate the cache.
  3. Logically clear that owner's queue/cache/cursors/pending reads/blobs and revoke media object URLs. Close every tab's connection before `indexedDB.deleteDatabase('dologram')`, handling blocked/versionchange with a bounded 5-second wait. A physically blocked delete remains reported while verified logical wiping prevents access. Startup completes pending cleanup before showing another owner.
  4. Clear only this app's owner/session keys, retaining dg.theme. Use local-scope SDK sign-out and verify installed offline behavior. On network revocation failure remove local access/session state safely and report the outstanding revocation accurately. Do not assert remote success.
  5. Broadcast signedOut and route every tab to sign-in. Test simultaneous tabs, blocked delete, offline sign-out, cancellation and a delayed in-flight callback.

- [x] 3. **W-P09-S03** **Strings.** Add `strings.settings.*` with the section headers and labels of 12.5, `strings.settings.signOutWarning` = "{n} unsent messages will be lost", and `strings.settings.about` = "DoloGram {version} ({build})".
- [x] 4. **W-P09-S04** **Spec.** Create `apps/web/e2e/phase-09-settings.spec.ts`:
  - choosing Dark sets `data-theme="dark"` and survives a reload; choosing System with emulated `colorScheme: 'light'` matches the current shared light background (T-40 theme part)
  - with two items queued offline on `/dev/queue`, Sign out shows "2 unsent messages will be lost", and after confirming, the owner data is absent and physical deletion is verified or accurately reported blocked (actual reopen queries show no owned queue/cache/blob records, and physical deletion is checked where the browser exposes it), `/sign-in` is shown and `dg.theme` is kept (T-49 sign-out part, TW-08)
  - offline Sign out without unsent items reaches `/sign-in` (TW-08)
- [ ] 5. **W-P09-S05** **Optional manual check (T-10; zero-weight item).** If elected and separately authorized, signed in as a throwaway account, change the password from Settings, sign out, sign in with the old password (refused) and the new one (accepted). Log it in `docs/test-results/web/phase-09.md`.

**Deliverables:** `SettingsDialog.tsx`, `signOutAndWipe`, the strings, the phase spec and an optional manual log if the observation is elected.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W09-01** System, Light and Dark apply to every screen, and the choice survives a restart. (T-40, D-83)
- [x] **AC-W09-02** Sign out with unsent items warns, and then leaves the queue and cache empty. (T-49, D-109 (5))
- [x] **AC-W09-03** Sign out works offline. (TW-08)
- [x] **AC-W09-04** Required automated client/SDK tests cover Settings password validation/update/guard/error behavior. Actual old-password refusal/new-password acceptance is an optional isolated/manual observation. (T-10, D-51)
- [x] **AC-W09-05** The dialog has no Low Signal, app lock or notification control. (D-19)
- [ ] **AC-W09-06** **Optional / zero weight.** If manual T-10 step 5 is elected, log its actual result in `docs/test-results/web/phase-09.md`; otherwise record optional/not run. This check is not a required exit/progress gate. (T-10)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-09 --project=chromium` passes.

**Execution progress — 2026-11-16 (Asia/Manila).** **Complete: 100% (5/5 required items: W-P09-S01–S04 + G-W09)**. Overall required progress **51% (84/166 rounded)**, adding this phase's four items and G-W09 to Phase 8's verified 79. W-P09-S05 and AC-W09-06 are optional/zero weight and were not elected (D-W26). AC-W09-01–05 met for required source/local automation. Evidence: `docs/test-results/web/phase-09.md`; context/source identities: `Plans/context/DoloGram_User_Web_Phase_09_Context_Index.md` and `supabase/repomix/user-web-phase-09-20261116/`. Phase 10 is ready for separate authorization and has not been started.

**Dated verification and decisions.** Baseline web typecheck/lint passed with 119/119 unit tests. Final web typecheck/lint/build passed; 127/127 unit tests passed (5 Settings dialog, 2 pending-wipe and 1 browser-icon additions). Phase 9 production-browser gate: 3/3 Chromium. Regressions: 40/40 Phase 4–8 application tests (the development-only `/dev/queue` case is excluded from a production artifact and is skipped under `E2E_PRODUCTION=1`); production boundary 4 passed/1 skipped; shared 303/303; mobile typecheck passed; secret scan passed over 404 build-only files. No dependencies added. The user-owned port-3000 server was preserved; the task-owned port-3109 server was stopped.

**Scoped implementation notes/discrepancies.** `apps/web/src/lib/session/signOut.ts` did not exist after Phase 4; it now owns pending-wipe completion and the named `signOutAndWipe` entry point while the account store keeps the wipe. `strings.settings.about` already existed as a section header, so the version line is `settings.aboutLine`, and `signOutWarning` was added beside the mobile `signOutBody`. The "Chats"/Folders section stays hidden until Phase 18 as instructed, so it is not rendered yet. Required checks found and fixed two defects: the local quiesce handler ended the signing tab's session before SDK revocation (quiesce now notifies other tabs only) and clipped radio inputs were intercepted by their labels. Per C-5 an offline sign-out shows the signed-out screen and reaches `/sign-in` on reconnect instead of attempting an asset-less navigation. Media object-URL revocation is deferred to the phases that create them. Optional isolated/blocked-deletion/manual T-10 and non-Chromium observations were not run. No repository-instruction conflict, later-phase implementation, commit, push, deployment or remote mutation.

**Risks and fallbacks**

- `indexedDB.deleteDatabase` is blocked by another open tab: the `signedOut` broadcast makes the other tabs close their connection (`db.close()`) before reloading. If the delete stays blocked for 5 seconds, `clearAll()` has already emptied every store, which meets D-109 (5).

---

### Phase 10 Chat list and archive view

**Goal:** Show the cached chat list in D-94 order with previews, statuses, unread counts, the Archived row, folder tabs and the offline banner, plus the Archive view.

**Depends on:** Phase 9.

**Implements:** F2, F7 (listing), WEB-04, WEB-05, 12.5 Chat list and Archive templates, CMP-06, CMP-08 (row icons), CMP-09, CMP-13 (offline banner only), CMP-14, CMP-18, D-12, D-19, D-23, D-44, D-70, D-89, D-92, D-94, D-109 (12), D-110, D-W15, D-W16, M2-08, T-04, T-36 (list order part).

**Steps**

- [x] 1. **W-P10-S01** **List query.** Create `apps/web/src/features/chatList/useChatList.ts` (on `useStoreQuery`) and adapt current shared `buildChatList` input. Leave unrequested pin/ignore/block preferences at their default empty values. Preserve existing avatar paths and account-scoped local filters without adding their mobile controls. It returns, for the session user, every cached chat with:
  - `title`: the group title; for a direct chat the other member's display name (or "Deleted account" per D-110, or "Former member" when the profile is unreadable, D-89); "Saved Messages" when `direct_key` equals the user id (D-70)
  - `archived` and `muted_until` from the user's own `chat_members` row
  - `newest`: the cached message with the highest seq
  - `unread`: the count of cached messages from other senders with `seq > last_read_seq`, excluding deleted and expired ones (D-23, D-92), computed in one pass over the `messages` index (D-W16)
  - `ownLastStatus`: the LS-2 status of the user's newest queued item for the chat, otherwise `sent` or `seen` (Phase 15 fills seen)

  Order (D-94): non-archived chats only, by the `created_at` of the newest message, else `chats.created_at`, both descending, with ties by `chat_id`. Pending queue items count as the newest message by their enqueue time, so a chat moves up when the user sends.
- [x] 2. **W-P10-S02** **Preview text.** Reuse `packages/shared/src/chatList/preview.ts` exports `messagePreview`/`stripMarkdown` with a thin web adapter only where required. The accepted preview behavior returns the text with the Markdown markers `*`, `_`, backticks and `[text](url)` reduced to their text, or "Photo", "Video", "Voice note", "File" for an attachment-only message, or "Deleted message" (AND-03). In a group it prefixes the sender's display name and ": ", or "You: " (CMP-09).
- [x] 3. **W-P10-S03** **Time format (D-109 (12)).** Reuse `packages/shared/src/chatList/format.ts` export `formatChatListTime` with `Intl.DateTimeFormat` in the browser locale (D-W12): today shows the time, yesterday "Yesterday", within 7 days the weekday, older the date.
- [x] 4. **W-P10-S04** **ChatRow (CMP-09).** Create `apps/web/src/components/ChatRow/ChatRow.tsx` as a Next.js `<Link>` inside a `<ul>`:
  - height 72, 56 Avatar, name in `title.sm`
  - the `action.mute` icon when `muted_until` is in the future (D-94)
  - status icon (CMP-08, `icon.sm`) before the preview for the user's own last message, `color.danger` for failed; no Low Signal icons on web (D-132)
  - unread state in Inter Bold with a Badge (muted colors when muted)
  - the open chat with `color.bg.selected` and `aria-current="page"`
  - the accessibility label "<name>, <n> unread, muted, <preview>, <time>", leaving out parts that do not apply
  - a hover and focus `action.more` IconButton, right-click and Shift+F10, all opening the row Menu (CMP-23). In this phase its items are only "Leave group" (Phase 11), and Archive, Mute and Add to folder are added in Phase 18.
- [x] 5. **W-P10-S05** **ChatList screen (WEB-04).** Create `apps/web/src/features/chatList/ChatList.tsx`, rendered in ListPane:
  - TopBar (chat list variant)
  - the offline banner (CMP-13, step 6)
  - FolderTabs (CMP-14, `role="tablist"`): "All" plus the user's folders by name. A selected folder sets `?folder=<folder_id>` (12.6) and shows that folder's non-archived chats (D-94).
  - the "Archived (n)" row (`action.archive` in a 56 `color.bg.surface` circle) when archived chats exist, linking to `/archive`
  - the rows, rendered 50 at a time with more added on scroll (D-44)

  States: a loading Skeleton of 8 rows after 300 ms while the first sync runs with an empty cache; with a cache, the cached list plus a Toast with Retry on a sync error; with no cache and an error, ErrorState with Retry (12.5). There is no empty state, because Saved Messages is always listed (F2).
- [x] 6. **W-P10-S06** **Offline banner (CMP-13, D-12).** Create `apps/web/src/components/ConnectionBanner/ConnectionBanner.tsx`: height 40, `color.info.bg`, `status.offline` and "Offline: messages send when connected" in `body.sm` `color.info.text`, `role="status"`. It shows while `navigator.onLine` is false (`online` and `offline` events). There is no "waiting for Wi-Fi" banner and no Low Signal chip on web (D-19, WEB-04).
- [x] 7. **W-P10-S07** **Archive view (WEB-05).** Create `apps/web/src/app/(main)/archive/page.tsx` rendering `ArchiveList.tsx`: TopBar "Archived" with back, then archived chats in the same D-94 order. A new message does not move a chat out (D-94). Empty: EmptyState "No archived chats". Unarchive arrives in Phase 18.
- [x] 8. **W-P10-S08** **Document title.** Feed the total of `unread` over non-archived chats into `useDocumentTitle` (WEB-03, D-W15).
- [x] 9. **W-P10-S09** **Spec.** Create `apps/web/e2e/phase-10-chat-list.spec.ts`:
  - A sees Saved Messages, A-B, A+B and A+B+G
  - B sends to A-B through the API: A-B moves to the top within 2 seconds, its preview shows the text, the unread Badge shows 1 and the title starts with "(1)"
  - a second browser context signed in as A shows the same list order (T-04 list part)
  - `context.setOffline(true)` shows the offline banner, and the cached list stays visible after a client-side navigation
  - at 767 px a row opens the chat route full screen

**Deliverables:** `useChatList.ts`, existing shared preview/time adapters, `ChatRow`, `ChatList`, `ConnectionBanner`, `FolderTabs`, `ArchiveList`, the archive route and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [x] **AC-W10-01** The list shows non-archived chats in D-94 order, with Saved Messages always present. (F2, D-94, T-36 order part)
- [x] **AC-W10-02** A new message reorders the list without a reload. (F2)
- [x] **AC-W10-03** Unread counts exclude own and deleted messages. (D-92)
- [x] **AC-W10-04** The offline banner follows the browser's online state, and the cached list stays visible offline. (F2 Offline, D-12)
- [x] **AC-W10-05** Two browsers signed in as A show the same list. (T-04 part)

**Execution progress — 2026-11-16 (Asia/Manila).** **Complete: 100% (10/10 required items: W-P10-S01–S09 + G-W10)**. Overall required progress **57% (94/166 rounded)**, adding this phase's nine items and G-W10 to Phase 9's verified 84. Phase 10 has no optional-only work item, and no isolated or manual observation was elected (D-W26). AC-W10-01–05 are met for required source/local automation. Evidence: `docs/test-results/web/phase-10.md`; context/source identities: `Plans/context/DoloGram_User_Web_Phase_10_Context_Index.md` and `supabase/repomix/user-web-phase-10-20261116/`. Phase 11 is ready for separate authorization and has not been started.

**Dated verification and decisions.** Baseline web typecheck/lint passed with 127/127 unit tests. Final web typecheck/lint/build passed; 132/132 unit tests (5 chat-list additions). Phase 10 production-browser gate: 2/2 Chromium; Phase 8 shell 7/7 (both specs re-run together 9/9 on the artifact rebuilt after the final edit); Phase 4–9 application regression 37 passed/1 skipped (development-only `/dev/queue`)/0 failed; secret scan passed over 380 build-only files; shared 303/303; mobile typecheck passed; shared typecheck retains its pre-existing `AbortSignal` error in the user-modified `src/db/repositories/messages.ts`. No dependencies added. The user-owned port-3000 dev server holds this project's Next dev lock and embeds the linked public target, so the gate ran on a task-owned production artifact built with the isolated public target on port 3110 (stopped afterwards); both affected specs derive their fixture target from the app's embedded `dg-supabase-url` meta.

**Scoped implementation notes/discrepancies.** The list query is `features/chatList/query.ts` plus `ChatListProvider.tsx` (one shared read for both panes and the title) rather than a bare `useChatList.ts`; the LS-2 queue status is a web-only `ownLastStatus` field because the shared item type exposes only sent/seen, so the shared/mobile contract is unchanged; D-94 ordering with pending sends is applied by `orderWithPending` after the shared build; `ListPane` renders `ArchiveList` for the archive route (whose page stays a null marker) with the "Archived" title; the row menu carries the staged, disabled "Leave group" item until W-P11-S05, so direct chats render no empty menu; and the sync-error-with-cache state reuses the Phase 7 `StoreFeedback` banner instead of adding a second Retry toast. Required checks found and fixed two defects: the row link's padding pushed the row to 88 px (now `box-sizing: border-box`), and the fixture's new message needed a timestamp after the newest cached message to take the top of the D-94 order. The Phase 8 shell spec and the shell composition unit test were updated for the real list (the placeholder "Archive" link no longer exists; the list query is mocked in the unit test). No repository-instruction conflict, later-phase implementation, commit, push, deployment or remote mutation.

**Exit gate:** `npm run e2e --workspace apps/web -- phase-10 --project=chromium` passes.

**Risks and fallbacks**

- Recomputing unread counts on every store change is slow with long histories: memoize per chat on `(last_read_seq, message/reaction deletion and update revisions, pending-read revision)`, and recompute only the changed chat.

---

### Phase 11 New chats groups and chat information

**Goal.** Exact username lookup, atomic direct chats, recoverable groups and member management. Depends on Phase 10. Implements W-11, WEB-11/WEB-12 and T-22/T-38.

- [ ] 1. **W-P11-S01** Proposed `features/newChat/NewChatDialog.tsx` keeps exact-username field/Find, result Avatar/name/Message, no-match/loading/rate-limit/offline/retry states. Use shared `findUser` and its actual return type. Trim whitespace/one leading @ consistently with mobile. Reject invalid empty input, invalidate late results on query/account/dialog changes and preserve exact matching.
- [ ] 2. **W-P11-S02** Proposed `openDirectChat.ts` uses `findDirectChatId` for a validated complete cache then `rpc('open_direct_chat', { p_other_user_id, p_chat_id })` for a missing pair. Keep the generated ID across uncertain retry, recheck membership/resync returned chat and handle self/Saved Messages, archived pairs, duplicate taps and concurrency. Missing RPC is PF-W7 with no three-insert fallback.
- [ ] 3. **W-P11-S03** Proposed `features/newGroup/NewGroupDialog.tsx` retains 64-character title, shared-contact checklist, creator plus at most 99 selected members, count and offline-disabled Create. Reuse `buildContactList`, validators, `createChat`, `insertMember`. Group creation remains multi-request. Journal stable chat ID/intended members until reconciled. After uncertain insert, read known state before retry. Retry only missing authorized rows, keep successful additions and report failures. Never create a second group on Retry or report all members added when some failed. Where permitted cleanup is unavailable, retain a recoverable group and record its ID.
- [ ] 4. **W-P11-S04** Proposed `features/chatInfo/ChatInfo.tsx` uses `buildChatInfo`/complete snapshots and ?info=1. Keep 96 Avatar/title/username/count, owner labels/Add/Remove and group-only Leave. Layout remains full screen <768, replaces right pane 768–1279, 360 px info column ≥1280. Mute/Archive wire in Phase 18. Recheck permissions on mutation and handle access loss safely.
- [ ] 5. **W-P11-S05** Add/remove through existing repositories and detect zero-row rejection. Partial multi-add reports successes/failures and retries missing entries. Leave confirms ownership consequences, verifies authorized removal and clears owned cache/pending reads/queue/blob references. PF-W16 blocks owner-leave acceptance if server ownership transfer is absent. List Leave uses the same action.
- [ ] 6. **W-P11-S06** Proposed `phase-11-new-chat.spec.ts` covers exact/partial/self/unknown lookup, existing/archived pair, duplicate clicks/concurrent RPC/lost response, interruption after every group request, partial additions, member limit/non-owner denial, removal/rejoin/leave and stale responses. Use disposable resources with a cleanup journal.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W11-01** Exact lookup yields the expected user, partial input yields none and errors are recoverable.
- [ ] **AC-W11-02** Concurrent/repeated direct open yields one authorized pair without a shell.
- [ ] **AC-W11-03** Interrupted group/member operations resume without duplicates and expose reconciled results.
- [ ] **AC-W11-04** Authorized member actions update both clients. Removal/leave clears local access and ownership follows verified server behavior.

**Deliverables.** Chat/group/info UI, operation journal, bounded reconciliation tests and Phase 11 report.

**Exit gate.** Required web checks and local/injected automated UI/API contract cases pass. Isolated target UI/API observations are optional. Missing target evidence alone does not block acceptance; confirmed incompatible consumed APIs or implementation defects remain blockers.

---

### Phase 12 Chat thread and Markdown

**Goal:** Render the chat screen's message list from the cache with bubbles, grouping, time rows, date separators, the unread divider and safe Markdown.

**Depends on:** Phase 11.

**Implements:** WEB-06 (read path), 12.5 Chat screen template, CMP-07, CMP-21 (chat variant), CMP-22, 3.2 Text formatting, 5.5 (Markdown safety), M2-06 (web), D-05, D-22, D-30, D-44, D-85 item 2, D-89, D-99, D-109 (12), D-110, D-143, T-12, 12.8 Announcements and the "Skip to messages" link.

**Steps**

- [ ] 1. **W-P12-S01** **Markdown renderer (M2-06, D-99).** Install `react-markdown`, pinned and recorded. Create `apps/web/src/components/MessageText/MessageText.tsx`:
  - `<ReactMarkdown skipHtml={false} components={…} urlTransform={safeUrl}>` with no rehype-raw, so raw HTML is never parsed as HTML (D-05)
  - `components` keeps `p`, `strong`, `em`, `code`, `pre`, `a` and `br`
  - headings `h1` to `h6`, `ul`, `ol`, `li`, `blockquote`, `table` and its parts, and `hr` render the plain text of their children inside a `<span>` (D-99)
  - `img` renders its `alt` text and is never fetched (D-99)
  - `safeUrl` allows `http:`, `https:`, `mailto:` and `tel:`; any other URL renders the link text without a link (M2-06)
  - links open with `target="_blank"` and `rel="noopener noreferrer nofollow"`
  - inline code and code blocks use `mono` on the bubble's quote fill (CMP-07)

  ```powershell
  npm install --workspace apps/web --save-exact react-markdown
  ```

- [ ] 2. **W-P12-S02** **T-12 check first.** Create `apps/web/src/components/MessageText/MessageText.test.tsx`. The input `<script>alert(1)</script> <b>x</b> **unclosed [a](b` renders `<script>` and `<b>` as visible text, throws no error and creates no `<script>` or `<b>` element. `# Heading` renders as plain text, and `![alt](https://example.com/x.png)` renders "alt" with no `<img>`. If the tags are dropped instead of shown, create `apps/web/src/components/MessageText/remarkHtmlAsText.ts`, a remark plugin that turns every `html` node into a `text` node with the same `value`, and add it to `remarkPlugins` (D-85 item 2). Record which path applied in `docs/test-results/web/phase-12.md`.
- [ ] 3. **W-P12-S03** **Thread query.** Create `apps/web/src/features/chat/useThread.ts`. It returns, from the cache, the chat's messages by seq ascending (delivered), using message_id deduplication, followed by the chat's unsent queue items in `enqueue_order`, each with its LS-2 status (6.4). The window starts at the newest 50 and grows by 50 when the list is scrolled to the top (D-44). Each message joins its non-deleted `message_media` rows while counting tombstoned media as known slots rather than missing uploads, its non-removed reactions, its sender profile, and its `reply_to` parent.
- [ ] 4. **W-P12-S04** **Grouping and rows (D-143).** Create `apps/web/src/features/chat/buildRows.ts`, a pure function with unit tests that turns the thread into:
  - date separators "Today", "Yesterday", then the date (D-109 (12))
  - time rows at the start of each day and above the first message after a gap of 60 minutes or more
  - bubble groups: consecutive messages of one sender less than 5 minutes apart (CMP-07)
  - the unread divider above the first message from others with `seq > last_read_seq`
- [ ] 5. **W-P12-S05** **MessageBubble (CMP-07).** Create `apps/web/src/components/MessageBubble/MessageBubble.tsx` as an `<article>` inside a `role="log"` scroll container (12.10):
  - own bubbles right in `color.bubble.out.bg`, received left in `color.bubble.in.bg`
  - `radius.bubble` 22, with join corners `radius.bubbleJoin` 4 inside a group
  - maximum width 78% of the list and 560 px; message column at most 840 px from 1280 px (12.7)
  - received: a 28 Avatar beside the last bubble of a group, and in groups the sender name above the first bubble (`label.sm`)
  - the sender shown as "Deleted account" (D-110) or "Former member" (D-89) where they apply
  - no time inside the bubble: the time shows in a tooltip after 500 ms of hover from 768 px, and for 3000 ms after a tap below 768 px (D-143)
  - "edited" under the bubble when `edited_at` is set
  - the deleted placeholder: `chat.deleted` and "Deleted message" in italics, with no reactions, no quote and no menu (D-22)
  - a reply quote at the top, whose tap scrolls to the parent and highlights it for `motion.duration.highlight`
  - the accessibility label "<sender or You>, <text or attachment summary>, <time>, <status>"
- [ ] 6. **W-P12-S06** **Chat screen.** Create `apps/web/src/features/chat/ChatScreen.tsx`, rendered by `(main)/chat/[chatId]/page.tsx`:
  - TopBar chat variant: back below 768 px, 40 Avatar, title, the member count for groups (the typing text arrives in Phase 15); a click opens `?info=1`
  - the offline banner
  - the message list with DateSeparator, UnreadDivider and JumpToBottom (CMP-22, with the unread count and the label "Jump to newest message")
  - the composer slot (Phase 13)

  The list keeps its scroll position when older rows load, and scrolls to the newest message on open. Roving tabindex: arrow keys move focus between bubbles (CMP-07 Focused).
- [ ] 7. **W-P12-S07** **States (12.5).** First open with no cache and syncing: the chat Skeleton after 300 ms. No messages after a successful complete read: EmptyState "No messages yet". An error with nothing cached: ErrorState with Retry. A chat id not in the cache after sync: ErrorState "This chat isn't available." with a link to the chat list.
- [ ] 8. **W-P12-S08** **Accessibility (12.8).** The first focusable element of the chat route is a "Skip to messages" link, visible on focus, that moves focus to the newest bubble. A `role="log"` `aria-live="polite"` region announces each new incoming message in the open chat as "<sender>: <text>".
- [ ] 9. **W-P12-S09** **Spec (T-12).** Create `apps/web/e2e/phase-12-thread.spec.ts`:
  - B sends the T-12 input of step 2 to A-B through the API: A's chat shows the tags as text, no dialog opens and no image request is made (`page.on('request')` sees no `example.com`) (T-12)
  - the date separator reads "Today"
  - scrolling to the top of a chat with more than 50 cached messages loads more (the spec seeds 60 messages through the API first)
  - a deleted message shows "Deleted message"

**Deliverables:** `MessageText` (and `remarkHtmlAsText.ts` if needed), `useThread.ts`, `buildRows.ts`, `MessageBubble`, `DateSeparator`, `UnreadDivider`, `JumpToBottom`, `ChatScreen`, the tests and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W12-01** HTML and malformed Markdown display literally, nothing executes, a heading is plain text, and an image link loads nothing. (T-12, D-05, D-99)
- [ ] **AC-W12-02** Messages are ordered by seq, with unsent items after the last delivered message. (6.4)
- [ ] **AC-W12-03** Date separators read Today, Yesterday, then the date. (D-109 (12), T-49 part)
- [ ] **AC-W12-04** Older messages load 50 at a time without the view jumping. (D-44)
- [ ] **AC-W12-05** The "Skip to messages" link is the first focusable element. (12.8)

**Exit gate:** `npm run test --workspace apps/web; if ($?) { npm run e2e --workspace apps/web -- phase-12 --project=chromium }` passes.

**Risks and fallbacks**

- react-markdown drops HTML instead of showing it (PR-11): apply `remarkHtmlAsText` (D-85 item 2) and re-run T-12.
- Long threads render slowly: at 50 rows per window this is not expected at 2 to 10 users (D-W12). If a window renders in over 100 ms (Chrome Performance panel), record it and add `content-visibility: auto` on bubbles.

---

### Phase 13 Composer, sending and delivery status

**Goal:** Send text from the composer through the queue, show the CMP-08 status captions, Retry and Discard on failed items, and capture latency in test builds.

**Depends on:** Phase 12.

**Implements:** F3 (send text), F7, WEB-06 (composer), CMP-08, CMP-10, LS-1, LS-2, LS-7, LS-8, D-30, D-90, D-93, D-109 (7), D-116, D-132, D-143, M2-09 (send), M2-12, M4-04 (web capture), D-82, D-W09, T-01, T-02 (web form via T-19), T-18, T-19, T-41 (web part), T-49 (keyboard part).

**Steps**

- [ ] 1. **W-P13-S01** **Composer (CMP-10).** Create `apps/web/src/components/Composer/Composer.tsx` as a `<form>` with a `<textarea>`, fixed to the bottom of the chat pane with `env(safe-area-inset-bottom)` padding on phones (12.7). Layout:
  - one pill with fill `color.bg.surface`, `radius.full` while one line and 22 when it grows, minimum height 44
  - Attach (`action.attach`, label "Attach"; wired in Phase 16) and Record (`action.record`, label "Record voice note"; Phase 16)
  - the Text button "Send" (label "Send"), shown only when the trimmed text is not blank or an attachment is present (D-30)

  The counter "3,912 / 4,096" appears from `config.message.counterFromChars` code points (currently 3500) (`codePointLength`) and turns `color.danger` above 4,096, with Send disabled (D-30, D-116). Keyboard: Enter sends and Shift+Enter adds a line (D-109 (7)), and Enter during IME composition (`event.nativeEvent.isComposing`) does nothing. The composer stays enabled offline (LS-1). Drafts are not persisted (D-02).
- [ ] 2. **W-P13-S02** **Send flow (LS-1).** `sendText(chatId, text, replyTo)` in `apps/web/src/features/chat/send.ts`:
  1. `validateMessageText(text, 0)`.
  2. `queue.enqueue({ messageId: ids.messageId(), payload: { kind: 'text', chat_id: chatId, sender_id: uid, content: text, reply_to: replyTo, attachment_count: 0, attachments: [], force_low_signal: false } })`. Use Phase 5's atomic admission/order path.
  3. Only after an ok enqueue result and durable commit, clear the accepted draft snapshot and scroll to the newest message. Validation failure, queueFull, rejected transaction or quota failure retains text/files. A late enqueue acknowledgment cannot clear a newer edited draft or another account/chat draft. Disable duplicate submission for the same draft snapshot and handle the returned result explicitly.

  A full queue keeps the text in the input and shows the D-27 toast (CMP-10 Error). The bubble appears at once from the queue as queued (LS-1). In Saved Messages the same flow applies, because it is a direct chat with one member (M2-12, F7).
- [ ] 3. **W-P13-S03** **MessageStatus (CMP-08, D-132, D-143).** Create `apps/web/src/components/MessageStatus/MessageStatus.tsx`. Under each bubble on the right:
  - queued: `status.queued` and "Queued"
  - sending: `status.sending` rotating and "Sending"
  - failed: `status.failed` at `icon.lg` beside the bubble, and under it "Failed" with the Text buttons Retry and Discard (D-93)
  - "Sent" or "Seen" only under the user's last own delivered message in a chat with another member, using `selectReadStatus`; Saved Messages omits them. Seen arrives in Phase 15

  Web never shows "waiting for Wi-Fi" or "sending (low signal)" (D-19, D-132). The status is part of every own bubble's accessibility label, also when no caption is drawn. A status change cross-fades over `motion.duration.fast`. A change to failed is announced "Message failed" through the live region (12.8).
- [ ] 4. **W-P13-S04** **Retry and Discard (D-93).** Retry calls `queue.retry`. Discard calls `queue.discard`. While offline, Discard is disabled with "No connection" when `row_state` is `stored` or `unknown` (LS-7).
- [ ] 5. **W-P13-S05** **Merge on delivery.** When a queue item becomes `sent`, its message row is in the cache (Phase 6 sender, or the Realtime event). `useThread` shows the cached row and drops the queue item from the view, keyed by message_id. Sent items and their owned blobs are deleted only once the row and required media are durably cached. Realtime-before-response and duplicate-row races must not lose the only local copy or double-render a bubble.
- [ ] 6. **W-P13-S06** **Latency capture (M4-04, D-82, D-W09).** When `process.env.NEXT_PUBLIC_DG_LATENCY === '1'`:
  - the sender records `{ message_id, sendStart: Date.now() }` when Send is pressed
  - the receiver records `{ message_id, received: Date.now() }` when the message's Realtime event is merged

  Both push into `window.__dgLatency`. Production builds never set the variable. Create `apps/web/e2e/latency.spec.ts` with required local/injected instrumentation assertions and an optional isolated Phase 19 measurement: two browser contexts on one computer, A and B, so both read one clock (D-82). A sends 100 messages one at a time, each waiting for B's receipt. When the optional isolated run is elected, the spec computes the 95th percentile and writes its actual 100 values/result to `docs/test-results/web/latency.json`; otherwise record optional/not run and do not fabricate samples.
- [ ] 7. **W-P13-S07** **Spec.** Create `apps/web/e2e/phase-13-send.spec.ts`:
  - A sends "T-01 <uuid>" in A-B: the bubble shows "Queued" or "Sending" and then "Sent" under the last own message, and B's context shows it without a reload within 2 seconds (T-01 delivery part)
  - offline, A sends: the bubble shows "Queued"; online, it delivers and `countMessages` returns 1 (T-19, T-02 web form)
  - with failure injection (`/dev/queue` switch, read by the shared sender) the bubble reaches "Failed" with Retry and Discard, and Retry delivers it (T-18)
  - Shift+Enter adds a line and Enter sends (T-49 keyboard part)
  - a 4,097-code-point paste disables Send and turns the counter red
  - sending in Saved Messages works (F7)

**Deliverables:** `Composer`, `send.ts`, `MessageStatus`, the merge rule in `useThread`, the latency capture and `latency.spec.ts`, and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W13-01** A durably queued message appears with status and reaches the other member without refresh. Failed validation/admission/storage retains the draft, and a late acknowledgment cannot clear newer text or another account/chat draft. (F3, T-01 delivery)
- [ ] **AC-W13-02** Offline sends are queued and delivered exactly once after the browser goes online. (T-19, LS-8)
- [ ] **AC-W13-03** Failed items stay visible with Retry and Discard, and Discard is disabled offline when the row may exist. (T-18, T-41 web part, D-93)
- [ ] **AC-W13-04** Enter sends and Shift+Enter adds a line. (D-109 (7), T-49)
- [ ] **AC-W13-05** No Low Signal label appears on web. (D-19, D-132)
- [ ] **AC-W13-06** Saved Messages passes the same send checks. (F7, M2-12)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-13 --project=chromium` passes.

**Risks and fallbacks**

- The Realtime event and the insert response both write the row: the merge is by message_id, so the second write is a no-op (D-40).

---

### Phase 14 Message actions

**Goal:** Reply, forward, copy, react, edit and delete from the hover row, the menu and the message focus overlay, with the D-22 rules.

**Depends on:** Phase 13.

**Implements:** F3 (reply, forward, react), F4, F7 (forward into Saved Messages), WEB-07, WEB-08, 12.5 Message actions and Forward picker templates, CMP-03, CMP-12, CMP-23, CMP-34, 3.2 (Reply, Forward, Reactions, Message edit / delete), M2-09, M2-10, M3-04, D-22, D-31, D-50, D-76, D-109 (4), D-133, T-06, T-17.

**Steps**

- [ ] 1. **W-P14-S01** **Action entry points (12.5 Message actions).**
  - From 768 px, hovering or focusing a bubble shows the hover row: React (`action.react`, label "React"), Reply (`action.reply`) and More (`action.more`, label "More actions"). React opens the ReactionPalette popover (CMP-12 in a CMP-23 popover). More opens the Menu.
  - Right-click, Shift+F10 and Enter on a focused bubble also open the Menu (CMP-07 Focused).
  - Below 768 px, a long press of 400 ms opens MessageFocusOverlay (CMP-34: `role="dialog"`, `aria-modal="true"`, label "Message actions") with the reaction pill above the bubble and the menu below it. A double tap toggles the user's own heart (palette position 2) within the D-22 rules (D-143).

  Menu items, in order:
  - Reply
  - Forward (hidden when the message has no text, D-109 (4))
  - Copy text (`navigator.clipboard.writeText`, Toast "Copied")
  - Edit and Delete (own, non-deleted messages)
  - Retry and Discard (own failed items)

  Deleted messages open nothing (D-22). Edit, Delete and reactions are disabled offline with "No connection" (D-22).
- [ ] 2. **W-P14-S02** **Reply (3.2 Reply).** Reply sets the composer's reply bar: a 3-wide `color.brand.primary` bar, "Reply to <name>", one line of the parent, and Cancel (label "Cancel reply"); Escape cancels (WEB-06). The queued item carries `reply_to` = the parent's message_id. The parent is always in the same chat, so D-90 holds.
- [ ] 3. **W-P14-S03** **Forward (WEB-08, D-31, D-50, D-133).** Create `apps/web/src/features/forward/ForwardDialog.tsx`, a form Dialog:
  - the notice "Attachments are not forwarded yet" (48 high row, `color.info.bg`, `body.sm` `color.info.text`) when the message has attachments (D-50, M3-04)
  - SearchField (CMP-03) filtering by title
  - chat rows without previews (48 Avatar and name, height 64), with Saved Messages first
  - empty search: "No chats match"

  A click on a row enqueues a new message in that chat with the copied text only (no attachments, no attribution, D-31) and closes the dialog with the Toast "Forwarded" (D-133). Forwarding works offline and queues (LS-1).
- [ ] 4. **W-P14-S04** **Reactions (3.2 Reactions, D-22, D-76).** Create `apps/web/src/components/ReactionChips/ReactionChips.tsx` and `apps/web/src/components/ReactionPalette/ReactionPalette.tsx`:
  - the palette shows the 8 emoji of `config.reactions.palette` with the 12.3 labels, each in a 44 square
  - chips sit under the bubble with the count and the `color.bg.selected` style for the user's own reaction
  - a chip click or palette pick toggles the user's own reaction:
    - add: if a cached row `(message_id, user_id, emoji)` exists with `removed_at` set, update `removed_at: null`; otherwise insert `{ message_id, user_id, emoji }` (the trigger sets chat_id). A 23505 on insert falls back to the update.
    - remove: update `removed_at: new Date().toISOString()`, never DELETE (D-22)
  - with 3 active own reactions, the other emoji are disabled with "You can add up to 3 reactions"
  - offline, the palette is disabled with "No connection" (D-22)
  - a rejected write restores the chip and shows a Toast with Retry (CMP-12 Error)

  Reactions are written directly, not queued (D-22).
- [ ] 5. **W-P14-S05** **Edit (F4, D-76).** Edit puts the original text in the composer with the edit bar ("Edit message", Cancel; Escape cancels) and the button "Save" (label "Save edit"). Save calls `update({ content }).eq('message_id', id).select('message_id, content, edited_at, sync_seq')`. The server sets edited_at (D-76). The returned row is merged. Zero returned rows → Toast "This message can't be edited." Online only.
- [ ] 6. **W-P14-S06** **Delete (F4, D-22).** Delete opens a confirm Dialog "Delete for everyone?" with Cancel and the Danger button "Delete". It calls `update({ deleted_at: new Date().toISOString() })` with `.select(...)` and merges the row, so the placeholder shows at once and the server clears content (D-22). Reply quotes to a deleted parent show "Deleted message" (D-22). Online only.
- [ ] 7. **W-P14-S07** **Spec.** Create `apps/web/e2e/phase-14-actions.spec.ts`:
  - A replies to B's message: the stored row has `reply_to` = the parent (API read), and B sees the quote
  - A forwards a text message to the A+B group: the target chat holds a new row with the same content
  - A forwards a message that has an attachment row (use a local/injected seeded attachment fixture for the required UI/action case; an actual isolated attachment fixture is optional. Phase 16 adds real upload-path integration): the notice shows, only the text arrives, and no object is copied (T-17)
  - A adds a heart and B sees the chip without a reload; A removes it: B's chip disappears, the API shows `removed_at` set, and a direct DELETE of the reaction through the API as A removes no row (T-17)
  - A edits a message: B sees the new text and "edited"; A deletes it: B sees "Deleted message"; the same update by B through the API returns zero rows and leaves the message unchanged (T-06)
  - Forward is absent from the menu of an attachment-only message (D-109 (4), T-49 part)
  - offline, Edit, Delete and the palette are disabled

**Deliverables:** the hover row, `MessageFocusOverlay`, `Menu` items, `ForwardDialog`, `ReactionChips`, `ReactionPalette`, the edit and delete flows, the strings and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W14-01** A reply stores reply_to, and the quote shows the parent. (T-17, 3.2 Reply)
- [ ] **AC-W14-02** A forward copies only the text, with no attribution, and shows the attachment notice when it applies. (T-17, D-31, D-50, D-133)
- [ ] **AC-W14-03** A reaction and its removal show on every member's client without a refresh, and removal is an UPDATE of removed_at. (T-17, D-22)
- [ ] **AC-W14-04** The sender's edit and delete show in real time, and another member's update is rejected. (T-06, F4)
- [ ] **AC-W14-05** Edit, delete and react are disabled offline. (D-22)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-14 --project=chromium` passes.

**Risks and fallbacks**

- The clipboard API is refused on an insecure origin: localhost and the Vercel HTTPS address are both secure contexts, so it is not expected. If it is refused, Copy text shows the Toast "Couldn't copy".

---

### Phase 15 Typing and aggregate read receipts

**Goal.** Match current mobile typing/read payloads and membership-bound reads. Depends on Phase 14. Implements W-15, T-04/T-14/T-37/T-51.

- [ ] 1. **W-P15-S01** Proposed `features/chat/useChatChannel.ts` uses `chatTopic`/`realtimeEvents` through the leader's one SDK connection. Sibling tabs send validated account/epoch commands to its foreground chat. Await old-channel removal, bound join timeouts and clear timers/listeners on hide/chat/account/sign-out. Ignore stale callbacks and nonmember hints.
- [ ] 2. **W-P15-S02** Send `TypingBroadcast { user_id, active: true }` at most once/3000 ms for active nonblank input, and active false on stopping/clear where possible. Resolve names from authorized profiles. Hide after 5000 ms or the sender's message. Keep direct typing.../group name/count and row preview consistent. Send nothing offline.
- [ ] 3. **W-P15-S03** Proposed `useReadState.ts` selects highest delivered seq actually displayed while visible/active. Separate confirmed server cursor from optimistic unread suppression. Persist maximum pending intent with account/chat/current member joined_at. It survives offline/reload and cannot apply to a later membership generation. Pending outgoing/hidden content does not mark reads.
- [ ] 4. **W-P15-S04** Flush via shared `markChatRead(client, chatId, seq, membershipJoinedAt, signal)` and `mark_chat_read`. Validate acknowledgment owner/chat/generation. Clear covered intent only, preserving newer candidates. DG409 drops stale generation and refreshes snapshot. DG403 clears revoked access. Bound sends to 10 seconds/three automatic attempts with backoff and stop after two identical failures. Coalesce lifecycle triggers and retain uncertain intent.
- [ ] 5. **W-P15-S05** Send `ReadBroadcast { user_id, last_read_seq }` after acknowledgment. Incoming events trigger authorized `listChatMembers`, never assign another member's read cursor directly. Atomically replace complete rosters with generation-aware monotonic merging. Reuse `selectReadStatus` for direct/group Seen, omitting Sent/Seen on Saved Messages. Keep unread divider until close. Read-detail/timestamp/privacy UI stays outside this plan.
- [ ] 6. **W-P15-S06** Add proposed `phase-15-typing-read.spec.ts` and lifecycle tests for mobile↔web payloads, ≤4 typing events/10 seconds, expiry/inactive/group count, offline reload, late/lost acknowledgments, removal/rejoin, forged/nonmember hints and two-browser convergence. Assert confirmed cursor and pending-intent retention/cleanup. MuMu observations are separately optional.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W15-01** Typing meets throttle/expiry and 2-second live display with no offline send.
- [ ] **AC-W15-02** Read writes are bounded/monotonic/membership-bound and forged hints cannot falsely confirm Seen.
- [ ] **AC-W15-03** Seen converges within 2 seconds on the verified target. Offline intent flushes only for its original membership.
- [ ] **AC-W15-04** Saved Messages omits aggregate receipts and teardown clears stale work/channels/timers.

**Deliverables.** Channel/read coordinator, IndexedDB intent integration and compatibility evidence.

**Exit gate.** Required web/shared checks, state tests and local/injected automated Realtime/read assertions pass. Actual isolated Realtime/timing observations are optional; PF-W2/PF-W17 missing live evidence does not block the gate.

---

### Phase 16 Attachments: pipeline and attach UI

**Goal:** Pick, paste, drop or record attachments, validate them, queue them in IndexedDB, and deliver them text-first with idempotent uploads.

**Depends on:** Phase 15.

**Implements:** F5, WEB-06 (paste, drop, voice), WEB-09, 12.5 Attach menu template, CMP-10 (attachment strip, voice on web), CMP-11 (composer tile, refused toasts), LS-4, LS-9, M3-01, M3-02, M3-03 (web), D-19, D-29, D-39, D-75, D-90, D-93, D-109 (7), D-113, D-116, D-W06, D-W07, D-W20, T-11 (upload part), T-20, T-52 (web part), TW-10.

**Steps**

- [ ] 1. **W-P16-S01** **Media type mapping (D-W20).** In `apps/web/src/lib/media/classify.ts`:
  - a picked, pasted or dropped `image/jpeg`, `image/png` or `image/webp` → `photo` (bucket `chat-media-small`)
  - `video/mp4` or `video/webm` → `video` (`chat-media-large`)
  - a MediaRecorder recording → `voice` (`chat-media-small`)
  - every other allowed type of 5.5, including a picked audio file → `file` (`chat-media-large`)
  - any other type is refused (D-29, D-75, D-90)

  Size checks use `validateAttachment` in bytes: photo and voice 10,485,760, video and file 52,428,800 (D-116). There is no compression and no Wi-Fi wait on web (D-19).
- [ ] 2. **W-P16-S02** **Attach entry points (WEB-09, D-109 (7)).**
  - Attach opens a hidden `<input type="file" multiple accept="<allowed types>">`. On a phone browser the device may offer its camera through the same input.
  - Paste: an `onPaste` handler on the composer adds `clipboardData.files`.
  - Drop: the chat pane listens to `dragover` and `drop`. While a file is dragged over, it shows the 2 px dashed `color.brand.primary` outline and "Drop files to attach" (CMP-10).

  Accepted files appear in the attachment strip: 64 by 64 tiles with a Remove button (label "Remove <file name>") and "n / 10" (D-90). Refused files show the CMP-11 toasts: "<file name> is too large. Photos and voice notes up to 10 MB, videos and files up to 50 MB.", "<file name> can't be sent. This file type isn't allowed." and "You can attach up to 10 files."
- [ ] 3. **W-P16-S03** **Voice notes (D-109 (7), D-W07).** Create `apps/web/src/lib/media/recorder.ts`:
  - the MIME type is the first of `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4` for which `MediaRecorder.isTypeSupported` is true
  - the declared Content-Type drops the codecs parameter (`audio/webm` or `audio/mp4`), so it matches the D-29 list exactly
  - a click on Record starts it (`getUserMedia({ audio: true })`): the record button becomes "Stop and send", the pulsing `color.danger` dot (static under reduced motion) and the elapsed time "0:07" show, and Escape cancels (CMP-10)
  - recording stops at 15 minutes or before exceeding 10,485,760 accepted bytes. Use timeslices and validate the final blob. On cancel, denied permission, error, route/account change or unmount, stop every microphone track/timer and release object URLs. A too-large final chunk is refused with a retained recoverable draft
  - a denied microphone permission does not start the action, and a CMP-20 dialog shows "DoloGram needs microphone access to record voice notes. Allow it in your browser's site settings." (F5, D-35)
- [ ] 4. **W-P16-S04** **Queue payload (M3-02).** Use Phase 5's atomic staging/enqueue operation. Current `QueuedAttachment` fields are `media_id`, `media_type`, `mime`, `size_bytes`, `local_uri`, `compressed`. Use a durable web blob-reference string for local_uri, not a transient object URL, and keep name/progress metadata in an owned browser record. Preserve shared payload compatibility and attachment_count. A rejected enqueue cleans staged blobs while retaining the draft. Never depend on the picker after commit.
- [ ] 5. **W-P16-S05** **Delivery order (LS-4, D-93).** Use the existing shared core/runner with its browser sender so an item with attachments:
  1. inserts the message row with its `attachment_count`, the same strict per-chat row order as text
  2. then, without blocking later items of the chat, uploads each attachment and inserts its `message_media` row `{ media_id, message_id, media_type, compressed: false }` (the trigger sets chat_id and storage_path, D-90)
  3. becomes `sent` only when every attachment has a confirmed media row, recorded in browser-owned progress metadata

  Track upload/media-row completion durably and reconcile existing IDs after uncertain responses. Use the current runner delivery result to mark the row stored while attachments remain. Preserve the shared item-level retry model unless a regression proves a compatible extension necessary. Bound upload timeouts/retries and make the queue the single retry owner, disabling nested automatic TUS retry storms. An interrupted upload restarts from the beginning (D-93).
- [ ] 6. **W-P16-S06** **Upload (M3-01, D-39, D-113, D-W06).** Create `apps/web/src/lib/media/upload.ts`. The path is `<chat_id>/<media_id>` with no extension (D-39).
  - Size at most 6,291,456 bytes: `storage.from(bucket).upload(path, blob, { contentType, cacheControl: '600', upsert: false })`.
  - Larger: `tus-js-client` against `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable` with:
    - headers `authorization: Bearer <access token>` and `x-upsert: false`
    - metadata `bucketName`, `objectName`, `contentType`, `cacheControl: '600'`
    - `chunkSize: 6 * 1024 * 1024`
    - `storeFingerprintForResuming: false`, so a restart begins again (D-93)

    Assumption: Supabase's resumable endpoint accepts the publishable key and a user JWT with 6 MB chunks, per its TUS documentation; checked by T-52 here, a failed TUS capability blocks uploads above the threshold until resolved. The required >6 MB transport must not silently become a standard upload.
  - An "already exists" result (HTTP 409 or the message "The resource already exists") counts as success (D-39). A 23505 on the `message_media` insert counts as success (M3-01).

  ```powershell
  npm install --workspace apps/web --save-exact tus-js-client
  ```

- [ ] 7. **W-P16-S07** **Pending display.** Until Phase 17's tiles exist, an own pending attachment shows a placeholder tile with "Uploading", and each attachment without a media row shows "Waiting for upload" (CMP-07 Attachment placeholder).
- [ ] 8. **W-P16-S08** **Spec.** Rerun the attachment-forward case of `phase-14-actions.spec.ts` with real uploaded media (T-17). Create `apps/web/e2e/phase-16-attach.spec.ts` with fixtures in `apps/web/e2e/fixtures/` (`photo.jpg` under 1 MB, `clip.mp4` under 5 MB, a valid synthetic ZIP of 7,000,000 bytes declared as `application/zip`, `doc.pdf`):
  - A sends `photo.jpg` with the text "T-20" on a throttled Chromium connection (CDP `Network.emulateNetworkConditions`, 50 kB/s upload): B's context shows the text and a "Waiting for upload" placeholder before the upload completes, and A's item shows "Sent" only after the upload (T-20)
  - A sends a video, a file and a 3-second voice note (the Chromium project grants microphone permission explicitly and supplies a valid fake audio source; the fake-device launch flag alone does not grant permission): each has one object and one `message_media` row (API read) (T-52 web part)
  - the ZIP goes through TUS and arrives once (D-W06)
  - an 11th file shows "You can attach up to 10 files."
  - a 10,485,761-byte PNG is refused before queueing; disallowed MIME, unknown/empty MIME, 50 MB boundary, denied microphone and storage quota failures produce the expected safe error without leaked tracks/blobs
  - paste of an image adds it to the strip (T-49 paste part)
  - with A in mid-upload of `clip.mp4`, `page.reload()`: after the reload the item is retried and delivered once, with one `message_media` row (TW-10, the web form of LS-9 and T-07)

**Deliverables:** `classify.ts`, `recorder.ts`, `upload.ts`, the attachment strip, paste and drop handling, the queue payload extension, the fixtures and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W16-01** The text reaches other members before the upload completes, and the item shows sent only after every attachment is uploaded. (T-20, LS-4)
- [ ] **AC-W16-02** Photo, video, voice note and file each produce one object and one media row. (T-52 web part, F5)
- [ ] **AC-W16-03** Oversize, disallowed and eleventh files are refused before queueing with the CMP-11 text. (D-29, D-90)
- [ ] **AC-W16-04** A reload mid-upload delivers the item once. (TW-10, LS-9)
- [ ] **AC-W16-05** A denied microphone stops the action with the message. (F5)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-16 --project=chromium` passes.

**Risks and fallbacks**

- MediaRecorder cannot produce an allowed type in a required desktop browser: retain a clear unsupported-capability error and record failed voice acceptance. Resolve compatibility before claiming support. An optional platform observation stays unverified until its browser is available.
- TUS fails: diagnose authorization/endpoint/headers with bounded synthetic tests. Retain the item and block >6 MB acceptance until the required transport works.

---

### Phase 17 Media display and viewer

**Goal:** Show photo and video tiles, voice and file rows, placeholders and the media viewer, with signed URLs that refresh after 10 minutes.

**Depends on:** Phase 16.

**Implements:** F5 (members see it), WEB-10, 12.3 (Attachment tiles and imagery), 12.5 Media viewer template, CMP-11, D-29, D-75, D-113, T-11 (client re-run), T-52 (open part), TW-07.

**Steps**

- [ ] 1. **W-P17-S01** **Signed URL cache (D-113).** Create `apps/web/src/lib/media/signedUrls.ts`. `getSignedUrl(media)` returns a cached URL until its actual issued expiry minus a bounded safety margin. The margin must scale for injected lifetimes, so the 5-second test cannot reuse a URL for 540 seconds, or calls `storage.from(bucket).createSignedUrl(storage_path, config.media.signedUrlSeconds)` (600). An `<img>`, `<video>` or `<audio>` error event calls `refresh(media)` once per load generation and retries. A second failure shows explicit Retry with no automatic loop. Account/access loss clears URLs and stops playback. The cache lives in memory only and is never stored. For downloads, `createSignedUrl(path, 600, { download: name })`. Assumption: the pinned supabase-js supports the `download` option; fallback fetch the blob and save it through an object URL.
- [ ] 2. **W-P17-S02** **Tiles and rows (CMP-11, 12.3).** Create `apps/web/src/components/AttachmentTile/AttachmentTile.tsx`, `VoiceNoteRow.tsx` and `FileRow.tsx`:
  - photo: width 240, height from the loaded image's ratio clamped 120 to 320, 240 by 180 before load; several photos form a 2-column grid of 119-wide tiles with a 2 gap; `color.skeleton.base` until loaded; label "Photo, <n> of <m>"
  - video: `color.bg.surface` with `media.video` at `icon.xl` and "Video · <size>", with no thumbnail generated (12.3)
  - voice: the 240-wide row with play and pause, progress, "0:12 / 0:45" and a 1x or 2x speed chip, on an `<audio>` element
  - file: `action.file`, a known local filename or stable media_id fallback with middle ellipsis, and available "<size> · <TYPE>" metadata from authorized Storage info; a click downloads. Current message_media has no original filename/MIME/size columns. Follow mobile `src/media/model.ts`/`useMediaSource.ts` and never invent remote metadata. Use the stable fallback download name for a received file
  - own pending upload: the local preview from awaiting the owned blob read, checking account/load generation, then calling `URL.createObjectURL(blob)`, with a 32 spinner on `color.scrim` and "Uploading"; the object URL is revoked on replacement/unmount/sign-out. Stop active playback and all media tracks/timers on teardown
  - received but not uploaded yet: the CMP-07 placeholder, one per genuinely missing media slot up to `attachment_count`. Individual media tombstones count as known removed slots and never show an endless Waiting for upload placeholder
  - renewal failure: `status.failed` and "Couldn't load. Tap to retry."
- [ ] 3. **W-P17-S03** **Media viewer (WEB-10).** Create `apps/web/src/features/media/MediaViewer.tsx` as a full-screen overlay at `z.dialog` on `color.media.bg`, opened through OverlayProvider with history (12.6):
  - a 56 top bar with close (`nav.close`), the sender and time in `color.media.text`, and Download (`action.download`)
  - photo: centered, with scroll-wheel and double-click zoom
  - video and audio: the browser players
  - Left and Right arrow keys move between the attachments of the same message; Escape closes
  - the top bar hides after 3000 ms without input
  - loading: a 32 spinner; error: "Couldn't load. Tap to retry."
- [ ] 4. **W-P17-S04** **Deleted media.** A deleted message renders the placeholder and no tiles (D-22). New signed URLs for it fail on the server (D-75), and the client does not ask for them.
- [ ] 5. **W-P17-S05** **Spec.** Create `apps/web/e2e/phase-17-media.spec.ts`:
  - Within this test run, the fixture helper uses the completed Phase 16 upload path to create A's photo, video, voice note and file, then B opens them: the photo loads, the video and audio elements decode the valid fixture and show advancing currentTime after an explicit play action, with no media error, and the file download starts (T-52 open part)
  - with `config.media.signedUrlSeconds` injected as 5 through `window.__dgTestConfig`, a photo reloaded after 6 seconds gets a new URL and still displays (TW-07, D-113)
  - after A deletes the message, B's view shows "Deleted message" with no tile, and a `createSignedUrl` call by B through the API fails (T-11 client re-run, D-75)
  - C's API call for the object's signed URL fails (T-11)
  - the browser back button closes the viewer

**Deliverables:** `signedUrls.ts`, `AttachmentTile`, `VoiceNoteRow`, `FileRow`, `MediaViewer` and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W17-01** Members open every media type from fixtures created in this run. Images decode, video/audio playback time advances without media errors, and the download contains the expected fixture bytes. (F5, T-52)
- [ ] **AC-W17-02** An expired signed URL is renewed without a visible change. (D-113, TW-07)
- [ ] **AC-W17-03** A deleted message's media is not shown and cannot get a new URL. (D-75, T-11)
- [ ] **AC-W17-04** A non-member gets no signed URL. (T-11)
- [ ] **AC-W17-05** The viewer works with the keyboard and closes on back and Escape. (12.6, 12.8)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-17 --project=chromium` passes.

**Risks and fallbacks**

- A `video/webm` from Android does not play in Safari: the tile still offers Download; recorded under T-50.

---

### Phase 18 Folders, archive and mute controls

**Goal:** Archive, unarchive, mute and file chats in folders from the list and chat info, and manage folders in WEB-13, all synced across devices and disabled offline.

**Depends on:** Phase 17.

**Implements:** F9, WEB-04 (row actions), WEB-05 (Unarchive), WEB-12 (Mute, Archive), WEB-13, 12.5 Folders template, 3.2 (Folders, archive, mute), M4-01 (web), D-09, D-24, D-94, D-109 (1), T-36, T-49 (mute part).

**Steps**

- [ ] 1. **W-P18-S01** **Row menu items.** Add Archive or Unarchive, Mute or Unmute, and Add to folder to the ChatRow Menu, and Unarchive to the Archive view's rows. Every item is disabled offline with "No connection" (D-24).
- [ ] 2. **W-P18-S02** **Archive.** `update({ archived: true|false }).eq('chat_id', id).eq('user_id', uid).select(...)` on the user's own `chat_members` row (D-38). The returned row is merged, so the list moves the chat at once. A new message does not unarchive (D-94).
- [ ] 3. **W-P18-S03** **Mute (D-109 (1), D-09).** Mute opens a Menu from 768 px or a BottomSheet below it, with 1 hour, 8 hours, 1 week and Until I unmute. It sets `muted_until` to now plus 1 hour, plus 8 hours, plus 7 days, or the string `'infinity'`. Unmute sets `null`. The muted icon shows while `muted_until` is in the future. Mute is a notification setting only, so a muted chat keeps its place (D-94).
- [ ] 4. **W-P18-S04** **Folders dialog (WEB-13).** Create `apps/web/src/features/folders/FoldersDialog.tsx`, a form Dialog opened from Settings ("Chats: Folders", now shown) and from an `action.folder` IconButton at the end of the folder tabs. Content:
  - the folder list (row height 56: `action.folder`, the name in `body.lg`, "<n> chats" in `body.sm`) with a row Menu of Rename, Edit chats and Delete
  - "New folder"; New folder and Rename open a confirm Dialog with one TextField (1 to 32, counter, `validateFolderName`)
  - Edit chats: a checklist of the user's chats, which inserts and deletes `folder_chats` rows
  - Delete asks "Delete this folder? Its chats stay in your chat list." and deletes the `folders` row; folder_chats rows cascade and chats remain (D-94)
  - empty: EmptyState with `action.folder`, "No folders yet", "Group chats into folders that show as tabs on the chat list." and "New folder"
  - an eleventh folder is refused locally and must also be refused by the verified server contract, showing "You can have up to 10 folders." (D-24)
  - every control is disabled offline (D-24)
- [ ] 5. **W-P18-S05** **Add to folder.** From a row: a Menu listing the folders with checkmarks. A pick inserts or deletes the `folder_chats` row.
- [ ] 6. **W-P18-S06** **Chat info.** Wire Mute and Archive in WEB-12 to the same actions.
- [ ] 7. **W-P18-S07** **Cross-device refresh.** Folder tables remain outside the current sync publication adapter. Member archive/mute changes have chat_members publication support, while foreground refresh remains necessary. Therefore the proposed Phase 7 `refreshMetadata()` coordinator on foreground and online refreshes them (M2-05). After a change on this browser, its own cache is updated from returned rows. Multi-row Edit chats operations track individual successes/failures, retry only missing changes and refresh an authoritative complete folder snapshot. Failed mutation restores optimistic UI with safe error/Retry. Deleting a selected folder clears its URL selection. Permission/account changes invalidate in-flight callbacks.
- [ ] 8. **W-P18-S08** **Spec (T-36).** Create `apps/web/e2e/phase-18-organize.spec.ts` with two contexts of A (one account, two clients):
  - in context 1, archive A-B, mute A+B for 1 hour, create the folder "Work <uuid>" with A+B
  - context 2, made visible, shows A-B only under Archived, A+B with the mute icon in place, and the folder tab listing A+B
  - B sends to A-B: it stays archived (D-94)
  - deleting the folder keeps A+B in the list
  - offline, the controls are disabled
  - Until I unmute stores `infinity` (API read) (T-49 mute part), partial Edit chats failure reports unresolved selections and retries without duplicate membership, and deleting the selected folder clears ?folder
  - through the API, an eleventh folder and a 33-character name are rejected, and C reads zero rows of A's folders (T-36 API part)

**Deliverables:** the row menu items, the mute options, `FoldersDialog`, Add to folder, the chat info wiring, the strings and the phase spec.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W18-01** Archive, mute and folder changes persist and show on A's other browser after foreground. (F9, T-36)
- [ ] **AC-W18-02** Archived chats appear only in Archive and stay there when a message arrives. (D-94, T-36)
- [ ] **AC-W18-03** Each mute option sets muted_until to the matching time, and Until I unmute sets infinity. (D-109 (1), T-49)
- [ ] **AC-W18-04** Deleting a folder leaves its chats. (D-94)
- [ ] **AC-W18-05** Every control is disabled offline. (D-24)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-18 --project=chromium` passes.

**Risks and fallbacks**

- `'infinity'` is not accepted as a timestamptz string through PostgREST: verify through the existing `mutedUntil` helper and API case. Failure blocks the accepted Until I unmute behavior until corrected, without silently changing the stored contract.

---

### Phase 19 Hardening integration and release

**Goal.** Verify complete MVP behavior and prepare a source-matched authorized release. Depends on Phase 18. Implements W-19/W-20 and Section 6 release cases.

- [ ] 1. **W-P19-S01** Proposed `next.config.ts` headers derive validated target HTTPS/WSS origins. CSP permits required self/Next/theme scripts/styles/fonts, authorized Supabase image/media/connect origins and blob media, while blocking objects/framing and restricting base/form origins. Permit unsafe-eval only in development. Add no-referrer, nosniff and camera/microphone self/geolocation disabled permissions. Record required inline-script tradeoff and independently test XSS. Expand directives only for an identified required request.
- [ ] 2. **W-P19-S02** Run web lint/typecheck/unit/E2E, shared regression and affected mobile tests. Record baseline failures separately. Verify all screens' 300 ms loading/error/retry, themes/token sync, actual rendered contrast pairs, 44 px targets, keyboard/history/Escape, menu semantics, 200% zoom, reduced motion and announcement semantics with automated assertions where feasible. Human visual/keyboard/screen-reader/NVDA observations are optional manual verification, recorded separately if elected. Reject vacuous contrast tests with zero pairs. Preserve thresholds.
- [ ] 3. **W-P19-S03** Proposed `smoke.spec.ts` runs in Chrome/Edge/Firefox/WebKit with versions recorded. Cover auth, text, each media class, voice recording/playback, offline queue, sign-out, navigation/theme and capability/permission failures. Safari and assigned-MuMu observations remain identified. Do not remove a supported browser to obtain a pass. Android recording requires HTTPS or approved secure localhost connectivity. LAN HTTP cannot verify microphone behavior.
- [ ] 4. **W-P19-S04** **Optional isolated testing / zero weight.** If elected and separately authorized, run Section 6 actual member/nonmember/forced/banned access, registration atomicity, expired/reused recovery, removal/deleted-user and actual T-21 rate-limit cases with approved isolated administrative fixtures. Record outcomes or optional/not run. Missing target/credentials/capability evidence does not block required completion. Required local/injected negative/permission/retention/201st-item assertions remain covered by their implementation phases. Bans/deletion/rate bursts/fault injection never run against production.
- [ ] 5. **W-P19-S05** **Optional isolated latency run / zero weight.** If elected and authorized, run 100 messages between two browser contexts on one host against the approved isolated target. Record individual Send-to-receive samples, nearest-rank p95, timeouts/losses and transport/UI observation times; retain p95 <2000 ms without loss as the observation threshold. Missing target or an omitted run does not block required completion, and no live latency result is inferred. Required local timing/instrumentation tests remain required. NEXT_PUBLIC_DG_LATENCY belongs only to the test artifact; production smoke uses public UI without /dev/injected globals.
- [ ] 6. **W-P19-S06** Build a source-matched production artifact, prove all /dev children 404, scan bundles/maps for secrets/test credentials and inspect network/CSP/headers/no service worker. Reuse unchanged artifacts. Remove required skipped/fixme tests, temporary controls and only confirmed obsolete task-owned code/assets after caller/import/route audit.
- [ ] 7. **W-P19-S07** Inspect actual Vercel project and confirm root `apps/web`, workspace inclusion, Node and root-lockfile install/build behavior in Preview. Check actual backend target before writes. Exclude test credentials/latency flags from deployment env. Record source/config/build fingerprint and rollback target before production. First-deployment recovery disables/reverts the introduced release when no prior deployment exists.
- [ ] 8. **W-P19-S08** Prepare reviewed release/preview. Obtain external source-upload/deployment/merge authorization when first needed unless already granted by execution instructions. Run required automated safe preview smoke, then authorized production deployment and automated non-destructive HTTPS/header/auth/text/media smoke with designated accounts. Additional human/manual smoke is optional. Revert/promote compatible prior deployment if required smoke fails. IndexedDB upgrades must preserve rollback compatibility or gate older clients recoverably. This plan adds no backend migrations.
- [ ] 9. **W-P19-S09** Record every requirement as passed/failed/blocked/not run with evidence. Require all mandatory gates before claiming release complete. Preserve cleanup results/process shutdown/deployment identity/recovery steps. Optional unavailable Safari/Android observations remain unverified. Required completion does not establish unrun live security or cross-client timing; optional isolated/manual gaps do not block it.

**Acceptance criteria**

**Verification scope:** Apply D-W26: implementation/local-automated checks required; isolated/manual observations optional, non-blocking and excluded from progress.

- [ ] **AC-W19-01** Every required W implementation/local-automated Section 6 case passes, with no unverified required portion counted complete. Optional isolated/manual portions are reported separately and excluded from this gate.
- [ ] **AC-W19-02** Required automated Windows-browser/accessibility/actual-contrast/XSS/production-boundary and credential-scan checks pass; human visual/accessibility/screen-reader observations are optional.
- [ ] **AC-W19-03** **Optional / zero weight.** If isolated live security/rate-limit/atomicity/media-recovery/p95 checks are elected, record actual results; otherwise optional/not run. This evidence is not required for G-W19 or plan completion and is never inferred from local tests.
- [ ] **AC-W19-04** Authorized production HTTPS/headers/automated safe smoke match the recorded source/config/artifact. Additional manual smoke is optional.
- [ ] **AC-W19-05** Rollback is recoverable, disposable fixtures/processes are cleaned and optional platform gaps remain labeled.

**Deliverables.** Headers, verification/latency/security report, rollback/release record and authorized deployment.

**Exit gate.** Required source-matched checks and production smoke pass. Failed/blocked/not-run required implementation or local/automated criteria prevent release completion. Optional isolated/manual checks are excluded; their missing fixtures or absence never blocks this gate. Deployment/external-action authorization remains required. No later phase exists in this MVP plan.

Secure-context reference is [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

---

## 6. Cross-phase test plan

Apply D-W26 to every T/TW row and phase reference: required portions cover local/source/transport/automated-browser behavior; isolated-backend and human/manual portions are optional even when a legacy row does not repeat the label. Record required and optional outcomes separately.

- RLS, Storage and Realtime checks run through the API with each test user's own session, never in the SQL Editor (D-16).
- Use N/A only for an explicitly authorized inapplicable scenario and record its reason. Never turn unavailable evidence or a failing required browser into a pass. Optional isolated/manual/platform observations remain optional/not run and unverified, outside required gate/progress accounting.
- Environments: H (hosted project), W (browser), D (Android device), API (direct calls with a user session).

The web plan re-runs the web-applicable tests after every phase that touches their area. Phase 19 runs required local/injected automated integration and automated safe production smoke after authorized deployment. Actual isolated-target integration and human/manual smoke are optional, subject to authorization and isolation if elected. Rerun only affected checks after intermediate changes, preserving diagnostics.

### 6.1 Core tests T-01 to T-22

| Test | Web applicability | First web phase | Re-run in | How it runs on web |
|---|---|---|---|---|
| T-01 | Web (local/injected automated W + W required; actual isolated latency and assigned-MuMu + W optional) | 13 (delivery), 19 (budget) | 14, 15, 16, 19 | `phase-13-send.spec.ts`; `latency.spec.ts` over 100 messages in two contexts on one clock (D-82). |
| T-02 | Device test; its web form is T-19 | 6 | 13 | Covered on web by T-19. The device run belongs to the Android plan. |
| T-03 | Not web (D-19) | None | None | Android plan. |
| T-04 | Web part (two browsers of one account) | 7 | 10, 15 | Two contexts of A compare list order, history and read status. |
| T-05 | Backend capability; no web UI; isolated target observation optional | 0 | 19 optional isolated | Capability matrix with authenticated member/non-member API assertions. |
| T-06 | Web | 14 | 19 | `phase-14-actions.spec.ts`: edit and delete visible to B; B's update returns zero rows. |
| T-07 | Not web (device force-stop); web form TW-10 | None | None | Android plan; TW-10 covers LS-9 on web. |
| T-08 | Not web (D-19) | None | None | Android plan. |
| T-09 | Web (automated) | 6 | 13 | Current queue core/runner regressions drop the response after commit. |
| T-10 | Web UI re-run | 4 | 9, 19 | Required Auth browser/transport tests; isolated/manual forced-change/password/recovery observations optional. |
| T-11 | Backend, with a client re-run | 17 | 19 | Non-member and deleted-message signed-URL refusals through the API; the lifetime check is TW-07. |
| T-12 | Web | 12 | 19 | `MessageText.test.tsx` and `phase-12-thread.spec.ts`. |
| T-13 | Web form (tab hidden instead of the app backgrounded) | 7 | 12, 19 | `phase-07-sync.spec.ts` with concurrent senders. |
| T-14 | Backend, with a client re-run | 15 | 19 | C's join of `chat:<id>` through the API helper. |
| T-15 | Backend capability; isolated target observation optional | 0 | 19 optional isolated | Authenticated negative/security cases or source-matched target evidence. |
| T-16 | Backend capability; isolated target observation optional | 0 | 19 optional isolated | Authenticated negative/security cases or source-matched target evidence. |
| T-17 | Web | 14 | 16 (attachment forward case), 19 | `phase-14-actions.spec.ts`. |
| T-18 | Web | 6 | 13 | Failure injection until 8 attempts. |
| T-19 | Web | 6 | 13, 19 (smoke) | Offline queue in IndexedDB, then online; `countMessages` = 1. |
| T-20 | Web | 16 | 19 | Throttled Chromium upload; text before media. |
| T-21 | Client part (drain a full queue) | 19 | None | Blocked until M3-08 (PF-W5). The API burst half is backend. |
| T-22 | Backend, with a UI part | 11 | 19 | Exact and partial username in New chat. |

### 6.2 Tests T-36 to T-53

| Test | Web applicability | First web phase | Re-run in | How it runs on web |
|---|---|---|---|---|
| T-36 | Web (two browsers of one account) plus API | 10 (order), 18 (full) | 19 | `phase-18-organize.spec.ts`. |
| T-37 | Web | 15 | 19 | Seen within 2 seconds; a non-member's and a forged hint change nothing. |
| T-38 | Client and UI parts | 7 | 11, 19 | Removal clears the cache on foreground; UI create, remove and leave. |
| T-39 | Backend (M3); client refuses the same inputs first | 1 (validation unit tests) | 16 | Validation unit tests mirror the T-39 cases. The API half is backend. |
| T-40 | Web | 2 (contrast), 3 (loading), 8 (breakpoint), 9 (theme) | 19 (full) | Phase 19 step 2. |
| T-41 | Web part (Retry, Discard, 201st item) | 6 | 13 | The Force-toggle and video-deferral half is Android. |
| T-42 | Web bundle part | 0 | 19 | `scripts/scan-web-bundle.ps1`. The three-bundle run is M4-07. |
| T-43 | Not web (admin) | None | None | Admin plan. |
| T-44 | Not web (admin) | None | None | Admin plan. |
| T-45 | Web part (sign-in leads to Change password) | 4 | 19 | Required Phase 4 local/injected trusted-flag/no-main-data checks; actual server-denied-data observations on isolated fixtures optional. |
| T-46 | Not web (admin) | None | None | Admin plan. |
| T-47 | Web part (the banned account's web session) | 19 | None | **Optional isolated observation:** on an approved administrative fixture, after banning disposable G: G's open web tab gets no new data, a reload shows a denied read as ErrorState, and a new `chat:` join is refused. Record actual target/results and fixture cleanup. |
| T-48 | Not web (admin) | None | None | Admin plan. |
| T-49 | Web part | 6 (background), 9 (sign-out), 12 (separators), 13 (keyboard), 14 (Forward hidden), 16 (paste), 18 (mute) | 19 | Each part runs in the listed phase's spec. The group-title API check is backend. |
| T-50 | Web | 19 | None | `smoke.spec.ts` in Chrome, Edge, Firefox and WebKit, plus optional assigned-MuMu Chrome and real Safari observations when available. |
| T-51 | Web | 15 | 19 | Typing display, throttle and group count. |
| T-52 | Web part (send and open each type) | 16 | 17, 19 | The bucket byte limits through the API are backend. |
| T-53 | Web part (the other member's view) | 19 | None | **Optional isolated observation:** on an approved administrative fixture, after deleting a throwaway account: A's web client, after foreground, shows "Deleted message" and "Deleted account". Record actual target/results and fixture cleanup. |

T-23 to T-35 (V2 and V3) are out of scope (D-W13).

### 6.3 New tests added by this plan

| ID | Scenario | Pass criteria | Phase | Verifies |
|---|---|---|---|---|
| TW-01 | Run current LocalQueueStore/SyncCacheStore contract checks against IndexedDB | Every contract test passes, including a Blob round-trip and `countUnsent`. | 5 | M2-02, LS-9, LS-10 |
| TW-02 | Open the app in two tabs of one browser | Exactly one visible tab leads; leadership moves within 2 seconds after the prior bounded attempt settles or aborts when it hides/closes; a write in one tab shows in the other within 1 second. | 5 | D-W04, D-93 |
| TW-03 | Load the app with Dark stored, and with System under a dark system theme | The first paint has the dark background; no light frame is visible. | 2 | D-83, 12.10 |
| TW-04 | Run the token sync and contrast tests | Both pass; an edited token without regeneration fails the sync test. | 2 | D-95, D-138 |
| TW-05 | Request the production page headers | The D-W10 headers are present, and the page works with them (smoke spec passes). | 19 | D-W10 |
| TW-06 | Open nested overlays and use Back, Forward, Escape and route navigation | One history entry per overlay, preserved Next state, reconciled stack and focus restoration without duplicate push/close; closing a last overlay preserves normal route navigation. | 3, 8, 17 | 12.6 |
| TW-07 | Inject a 5-second signed URL lifetime and reload a photo after 6 seconds | A new URL is fetched and the photo displays. | 17 | D-113 |
| TW-08 | Sign out offline, with and without unsent items | The warning shows when items exist; afterwards owned records are empty, physical deletion is verified or accurately reported blocked, `dg.theme` remains and `/sign-in` shows. Physical deletion blocked by another handle stays explicitly reported after logical wiping. | 9 | D-109 (5), D-W17 |
| TW-09 | Subscribe the Postgres Changes channel as A with public access disabled | The result (subscribed or refused) is recorded; on refusal the 15-second resync fallback runs. | 7 | 6.4, PF-W2 |
| TW-10 | Reload the tab in the middle of an upload | After the reload the item is retried and delivered once, with one object and one media row. | 16 | LS-9, D-93 |

## 7 Second-pass audit and execution readiness

**Current readiness — 2026-11-15.** Phases 0–6 required local gates are complete per their recorded reports: **38% (63/166)** overall. Phase 7 is ready for separate execution and has not started. The chat follow-up updates configuration/authentication/session recovery within existing scope and adds no phase credit. Historical Phase 4/5 transition notes describe their own checkpoints, not current readiness. Isolated testing/manual verification are optional throughout the plan. Their unavailability does not prevent completion/transition or require credentials/owner attendance. Genuine implementation/source-contract defects and required automated failures remain actionable; deployment and external mutations still require authorization.

| Capability / optional follow-up | Affected requirements and exact next action | Work available beforehand |
|---|---|---|
| PF-W17 optional isolated backend/mail/account target | W-04–W-19 supplemental live observations. Only if elected: identify endpoint/Auth/Storage ownership, verify embedded target and authorize scoped disposable mutations/mail. Missing target/access is optional/not run, not a required blocker. | All required client phases using verified source/local/injected fixtures. |
| PF-W5/PF-W16 backend enforcement and settings | W-04/W-06/W-11/W-18/W-19 source/API contracts remain required; target-specific isolated/manual enforcement/settings evidence is optional. Request target evidence or separately authorized backend work only for elected testing or a confirmed defect. | Forms, guards, validation, errors and local/injected compatibility tests; missing optional evidence does not block completion. |
| PF-W2/PF-W7/PF-W13 Realtime/direct-RPC/TUS | Required typed/local contract tests; optional isolated member/nonmember subscriptions, concurrent RPC and >6 MB upload observations. Missing target evidence does not block the required client gate; confirmed consumed-interface defects remain actual issues. | Typed adapters, paging/queue recovery and transport-fault tests. |
| PF-W18 deployment configuration/authorization | W-19. Inspect actual Vercel project, confirm compatible artifact/configuration, obtain outstanding upload/merge/deployment authorization and run safe smoke. | Local production-boundary checks and release preparation. |

This audit corrects progress denominator/gate accounting, stale cleanup, modal/router coordination, recovery-event ordering and email-link evidence, legacy cursor recovery, fixture independence, media playback/permission assertions and public-build target handling. Earlier agreed scope, theme/counter choices, required automated desktop checks remain intact; isolated/manual/platform observations are optional under D-W26. No runtime result is inferred from these repairs.

## Appendix A Decisions and material changes

Existing IDs remain stable. These are plan decisions for authorized execution. Current source observations are identified separately in Section 2 and the context index.

| ID | Retained or revised decision and reason |
|---|---|
| D-W01 | Browser-side Supabase through the existing factory, async localStorage adapter and client guards. Recovery URL handling is explicit because automatic URL detection is disabled. RLS remains authoritative. |
| D-W02 | IndexedDB is the durable browser UI source. Stable query snapshots and committed invalidations avoid parallel data models/render loops. |
| D-W03 | Database dologram, initial version 1, account-owned keys and transactional upgrades. A wrapper dependency is added only if required. |
| D-W04 | One visible worker/Realtime owner, with lock release, epochs/fencing and separate atomic enqueue ordering. Non-leaders use local commands/invalidation. Hidden ownership must not starve a visible tab. |
| D-W05 | No service worker. Open-tab offline queue/cache remain required. Cold offline navigation depends on browser-supplied assets. |
| D-W06 | >6,291,456-byte uploads use TUS with 6 MB chunks and no stored resume fingerprint. Queue owns bounded retry. A failed TUS path blocks that acceptance. |
| D-W07 | MediaRecorder capability-selects audio/webm or audio/mp4, removes codecs from the declared MIME and stops at 15 minutes/accepted size limit. Tracks/timers/URLs always clean up. |
| D-W08 | Compatible Vitest/jsdom/Testing Library/fake-indexeddb plus Playwright. Real browser storage tests supplement mocks. |
| D-W09 | Required local/injected latency instrumentation tests; optional isolated measurement uses two contexts on one host, 100 samples and nearest-rank p95 <2000 ms. Production has no test globals. Unrun live measurements remain optional/not run. |
| D-W10 | CSP and related headers restrict required origins. Record the Next/theme inline-script tradeoff and verify actual requests/XSS. |
| D-W11 | Proposed web src/app, components, features, lib and theme. Reuse shared strings and source conventions. |
| D-W12 | Intl dates and initial 50-row UI windows. Profile rendering under the accepted workload before adding virtualization. |
| D-W13 | MVP WEB-01–WEB-14 plus already accepted registration/recovery. Mobile search/calls/memos/read-details/APK-update UI remains separate. |
| D-W14 | Vercel preview then authorized production. Confirm actual workspace commands/configuration and rollback target, including first deployment. |
| D-W15 | Tab title counts unread non-archived chats including muted chats, consistent with the prior accepted plan. |
| D-W16 | Complete per-chat history cache with safe paginated catch-up, local unread computation and bounded UI windows. Quota failures remain recoverable. |
| D-W17 | Local browser sign-out, coordinated quiescence and logical wiping before physical DB deletion. Theme remains. Remote revocation failure is accurately reported. |
| D-W18 | Permanent rejection retains failed queue work with safe text. Shared classification changes preserve existing callers and get regressions. No unconfirmed discard drops local work. |
| D-W19 | Safe full-page common checkpoints and event-only merges, plus a one-time cache-local versioned checkpoint reset/replay for legacy gaps. Existing cached rows/queue/blobs are retained. |
| D-W20 | Picked/pasted/dropped supported images→photo, supported videos→video, recorded audio→voice, remaining allowed types→file. No web low-signal compression/Wi-Fi deferral. |
| D-W21 | Preserve the prior plan's accepted self-service sign-up, username/display name and confirmation-off intended behavior. D-163 is absent from original v14. Actual target Auth settings/atomicity are optional isolated observations, not prerequisites for required client acceptance. |
| D-W22 | Preserve accepted self-service email reset. D-181 is absent from original v14. Use explicit SDK-compatible token processing and protected recovery state, with optional isolated/manual target mail/redirect verification. |
| D-W23 | Reuse current shared warm-ivory/deep-charcoal tokens and shared 3500-character counter threshold. This adopts working-copy mobile conventions while preserving the accepted 4096 limit. |
| D-W25 | When authorized mobile interoperability needs new release/dev-client APKs, use the existing local Gradle build script and retained signing identity, with artifact reuse and assigned-emulator checks. Mobile build work remains conditional and outside web MVP deliverables. |
| D-W26 | Owner revision 2026-11-15: isolated testing and manual verification are optional in every phase/AC/test/release gate. Optional-only W-P09-S05/W-P19-S04/W-P19-S05 and optional checks have zero weight; required total is 166. Missing optional evidence never blocks completion or transition and is never marked passed. Required implementation/local automation/security controls and authorization/isolation conditions for elected tests remain unchanged. |
| D-W27 | Owner chat follow-up 2026-11-15: ordinary user-web local configuration contains NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_ADMIN_WEB_URL only. Public anon/publishable keys remain browser-safe; admin secrets stay in the separate admin app. Admin URL inclusion does not claim a navigation integration. |
| D-W28 | Owner chat follow-up 2026-11-15: user sign-in accepts email or a shared-rule-valid normalized username through the existing backend function. Saved-session failures must offer explicit local sign-out so users can attempt fresh authentication. Live account success and the actual saved-session failure cause remain unverified. |
| D-W24 | Required automated Windows desktop verification remains mandatory; manual desktop verification is optional. Unavailable real Safari/assigned emulator observations remain unverified supplemental evidence. Never substitute WebKit or mocks for those platform results. |

Material corrections are C-1 through C-15. Missing web scaffolding is web implementation work. Existing shared modules replace speculative APIs. Atomic direct-chat RPC, member publication and read RPC/payloads reflect mobile progress. Safe queue/sync fixes are scoped to necessary end-to-end behavior. Source completion is separated from deployment, isolated integration and optional device results.

## Appendix B Blockers capabilities and next actions

This register distinguishes actual implementation/interface issues from optional isolated/manual evidence. Missing test tenants, mail sinks, privileged fixtures, devices or manual attendance do not block required completion or trigger a request for those resources. Ask for them only if the owner elects that optional testing. Confirmed source/API/security defects remain actual issues; external deployment authorization is separate. Backend changes require their own authorized work and are excluded from this client plan.

| ID | Evidence/status and affected requirements | Recommended next action | Independent work |
|---|---|---|---|
| PF-W1 | Retired. Companion plans/shared modules exist. | Use Phase 1 current contract map. | All scoped frontend work. |
| PF-W2 | Optional/not run: target Realtime authorization/settings/timing unverified, W-07/W-15/W-19. No missing-evidence completion blocker. | If elected, record TW-09 member/nonmember join/four-table publication; backend owner handles confirmed refusals. | Required local adapters, state/transport tests and degraded catch-up. |
| PF-W3 | Accepted open-tab offline limit, W-04/W-05/W-06. | Test loaded-tab offline, identify cold-load limit. | Complete offline adapter/UI work. |
| PF-W4 | Local unread design retained, W-10. | Verify complete cache and single indexed pass. | List UI/tests. |
| PF-W5 | Optional/not run: actual message/chat/find-user DG429 enforcement unconfirmed, W-06/W-11/W-19; calling limits are separate. | If isolated testing is elected, obtain approved target fixtures for T-21/T-22. Track confirmed defects separately; never infer hosted enforcement from local tests. | Required injected error/queue/admission-limit tests. |
| PF-W6 | Resolved by visible ownership policy, W-05/W-06. | Verify hidden-leader handoff and no new hidden requests. | Host implementation. |
| PF-W7 | Local migration 034/mobile RPC verified; target capability is optional/unverified, W-11. | If elected, exercise open_direct_chat on the approved isolated target with concurrent retries. Missing target evidence does not block required client completion. | Required RPC adapter/UI/local contract tests. |
| PF-W8 | Old cursor assumption retired. Current max-of-limited-pages algorithm risks gaps, W-07. | Implement/test safe paging in Phase 7 with affected mobile regressions. | Cache/source adapters and deterministic fixture preparation. |
| PF-W9 | Real Safari unavailable on Windows, W-19 optional platform evidence. | Obtain Safari environment if available and record exact result. | Required Windows/WebKit checks. |
| PF-W10 | Lock API/capability untested in selected browsers, W-05/W-06. | Real browser capability/handoff tests or tested transactional fenced lease. | IndexedDB contract tests. |
| PF-W11 | Current helper supports Infinity; target round-trip is optional/unverified, W-18. | Require local serialization/muted-rendering tests; optionally observe actual approved-target RPC/PostgREST round-trip. | Organization UI/helper/local transport tests. |
| PF-W12 | Blob/quota behavior unverified per browser, W-05/W-16. | Real IndexedDB round-trip/quota tests with ArrayBuffer fallback. | Synthetic media/store tests. |
| PF-W13 | Optional/not run: target TUS authorization/endpoint unverified, W-16/W-19. No missing-evidence completion blocker. | If elected, run authorized bounded isolated >6 MB upload/restart/duplicate tests; confirmed TUS implementation defects remain actual issues. | Required adapter/transport upload/recovery tests. |
| PF-W14 | Resolved by retained D-W15 title policy. | Verify muted/non-archived count. | W-08/W-10 UI. |
| PF-W15 | Trigger source preserves username uniqueness failures; actual Auth atomicity/settings are optional/unverified, W-04. | If elected, perform disposable valid/collision sign-up using approved privileged fixture assertions. Generic 500 remains generic. | Required metadata/session-routing/validation/error/unit/browser tests; no completion blocker from omitted target evidence. |
| PF-W16 | Full hosted security/limits/ownership behavior is not established by current source/reports; target-specific observations are optional/unverified, W-04/W-11/W-18/W-19. | Do not invent APIs or weaken controls. Backend owner supplies clearing/enforcement/ban/limit/ownership evidence only for elected observations or confirmed defects; backend repair requires separate authorization and remains outside this plan. | Required trusted-flag guards, source/API validation and local/injected tests; missing hosted proof is not a completion blocker or a hosted-security pass. |
| PF-W17 | Optional/not run: isolated web target/mail sink/accounts unverified, W-04–W-19 target observations. Not a required completion blocker. | Only if optional testing is elected, obtain authorization and establish target identity/ownership/config/disposable fixtures before mutations. Otherwise retain optional/not run. | Complete required phases with source/local/injected tests. |
| PF-W18 | Web workspace/Next version are established by Phase 0; Vercel project/configuration/authorization remain unconfirmed for W-19 deployment. | Inspect actual Vercel project and obtain deployment/source-upload authorization before external release. Manual deployment verification is optional; required automated release/config checks remain. | All local implementation/production-boundary checks and release preparation. |

## Appendix C Assumptions and execution discovery

| ID | Unresolved item | How execution establishes it |
|---|---|---|
| A-1 | Next.js/test-tool compatibility with React 19.2.3 and TypeScript 6.0.3 | Phase 0 recorded Next 16.4.6/tooling compatibility through installed dependency graph, version docs and actual scripts; revalidate changed dependencies before use. |
| A-2 | Browser features and media MIME support | Phases 5/16/19 capability, persistent-store, microphone-denial and playback tests. |
| A-3 | Exact current token names/semantic icon mappings and contrast | Phase 2 generator/type tests, nonzero required contrast pairs and visual browser checks. Current originals take precedence over old prose token paths. |
| A-4 | Actual Auth recovery/forced flags and email configuration | Phase 4 required installed-SDK/local transport/browser cases; isolated/manual end-to-end email/session observations optional. |
| A-5 | Target Realtime/Storage/RPC/security behavior | Required source/API-contract checks and local/injected tests; optional target observations use each user's own authenticated API session. |
| A-6 | Actual Vercel workspace/build behavior, limits and rollback | Phase 19 current project settings/official guidance and source-matched preview. No quota or service availability is assumed. |

The original polishing pass ran no application checks. The earlier 2026-11-15 verification-policy revision was documentation-only; it reuses the recorded source-matched Phase 0–4 results and does not assert any new isolated/manual verification. Existing reports are dated evidence. Shared queue/sync/contrast findings above are source analysis pending implementation regression tests.

## Appendix D: Traceability

| Document ID | Phase |
|---|---|
| 3.2 1-on-1 & group chat | 7, 11, 13 |
| 3.2 Text formatting | 12 |
| 3.2 Message edit / delete | 14 |
| 3.2 Reply, Forward, Reactions | 14 |
| 3.2 Read receipts, Typing indicators | 15 |
| 3.2 Photos, videos, voice notes, files | 16, 17 |
| 3.2 Saved Messages | 6, 10, 13 |
| 3.2 Folders, archive, mute | 10, 18 |
| 3.2 Dark mode | 2, 9 |
| 3.2 Low Signal Mode (web subset) | 6, 16 |
| 3.4 LS-1, LS-2 | 6, 13 |
| 3.4 LS-3 | 6 |
| 3.4 LS-4 | 6, 16 |
| 3.4 LS-5 (No connection row only, D-19) | 6 |
| 3.4 LS-6 | Not web (D-19) |
| 3.4 LS-7, LS-8 | 6, 13 |
| 3.4 LS-9 | 5, 6, 16 |
| 3.4 LS-10 | 5, 6 |
| 3.5 F1 | 4, 9 |
| 3.5 F2 | 10 |
| 3.5 F3 | 13, 14 |
| 3.5 F4 | 14 |
| 3.5 F5 | 16, 17 |
| 3.5 F6 | 15 |
| 3.5 F7 | 6, 13, 14 |
| 3.5 F8 | 6 (web subset) |
| 3.5 F9 | 9, 18 |
| 3.5 Cross-cutting requirements | 3, 19 |
| 5.1, 5.2, 5.3, 5.4, 5.5 | 4, 6, 12, 16, 17, 19 |
| 6.1, 6.2 local records | 5 |
| 6.3 | 6 |
| 6.4 | 7, 15 |
| 6.5 Next.js | 0, 19 |
| 11.3 WEB-01, WEB-02 and accepted WEB-01b/recovery additions | 4 |
| 11.3 WEB-03 | 8 |
| 11.3 WEB-04, WEB-05 | 10, 18 |
| 11.3 WEB-06 | 12, 13, 16 |
| 11.3 WEB-07, WEB-08 | 14 |
| 11.3 WEB-09 | 16 |
| 11.3 WEB-10 | 17 |
| 11.3 WEB-11, WEB-12 | 11, 18 |
| 11.3 WEB-13 | 18 |
| 11.3 WEB-14 | 9 |
| 11.3 WEB-15 to WEB-20 | Out of scope (D-W13) |
| 12.2, 12.3, 12.10 | 2 |
| 12.4 CMP-01 to CMP-03, CMP-05, CMP-06, CMP-15 to CMP-21, CMP-23 | 3 |
| 12.4 CMP-04 | Not built on web (Phase 3 note) |
| 12.4 CMP-07, CMP-22 | 12 |
| 12.4 CMP-08, CMP-10 | 13 |
| 12.4 CMP-09, CMP-13, CMP-14 | 10 |
| 12.4 CMP-11 | 16, 17 |
| 12.4 CMP-12, CMP-34 | 14 |
| 12.4 CMP-32, CMP-33 | 8 |
| 12.4 CMP-24 to CMP-31 | Not web (admin) |
| 12.5 | 4, 8 to 18 |
| 12.6, 12.7 | 3, 8 |
| 12.8 | 3, 12, 13, 19 |
| M2-01 | 1 |
| M2-02 | 5 |
| M2-03 | 6 |
| M2-04 | 4 |
| M2-05 | 7 |
| M2-06 | 12 |
| M2-07 | 11 |
| M2-08 | 10 |
| M2-09 | 13, 14 |
| M2-10 | 14 |
| M2-11 | 15 |
| M2-12 | 13 |
| M2-13 (web part) | 6, 7, 12 to 15 |
| M3-01, M3-02, M3-03 | 16 |
| M3-04 | 14 |
| M3-05 to M3-07 | Not web (D-19) |
| M3-08 (client handling) | 6, 19 |
| M4-01 | 18 |
| M4-02 | 2, 9 |
| M4-03 | 3, 19 |
| M4-04 | 13, 19 |
| M4-07 (web part) | 19 |
| R-5 | 19 |
| D-05, D-30, D-99 | 12 |
| D-10, D-27, D-77, D-93 | 6, 13 |
| D-12, D-19 | 6, 10, 13, 16 |
| D-22, D-31, D-50, D-76, D-133 | 14 |
| D-23, D-57, D-92, D-118 | 15 |
| D-24, D-94 | 10, 18 |
| D-29, D-39, D-75, D-90, D-113, D-116 | 1, 16, 17 |
| D-35, D-95, D-136 | 3, 8, 19 |
| D-40, D-43, D-91 | 7 |
| D-42, D-46, D-58, D-70, D-88, D-124 | 11 |
| D-47, D-51, D-78, D-86 | 4, 9 |
| D-82 | 13, 19 |
| D-83 | 2, 9 |
| D-100 | 0, 1 |
| D-109 | 6, 9, 12, 13, 14, 16, 18, 19 |
| D-114 | 4, 15 |
| D-115 | 0, 19 |
| D-127 to D-131, D-134, D-138, D-144 | 2 |
| D-132, D-143 | 12, 13 |
| D-139 | 3 |
| D-141, D-142, D-145 | 8 |
| T-01 | 13, 19 |
| T-04 | 7, 10, 15 |
| T-06 | 14 |
| T-09, T-18, T-19 | 6, 13 |
| T-10 | 4, 9 |
| T-11 | 17 |
| T-12 | 12 |
| T-13 | 7 |
| T-14 | 15 |
| T-17 | 14 |
| T-20 | 16 |
| T-21 | 19 |
| T-22 | 11 |
| T-36 | 10, 18 |
| T-37, T-51 | 15 |
| T-38 | 7, 11 |
| T-40 | 2, 3, 8, 9, 19 |
| T-41 | 6, 13 |
| T-42 | 0, 19 |
| T-45, T-47, T-53 (web parts) | 4, 19 |
| T-49 | 6, 9, 12, 13, 14, 16, 18 |
| T-50 | 19 |
| T-52 | 16, 17 |
