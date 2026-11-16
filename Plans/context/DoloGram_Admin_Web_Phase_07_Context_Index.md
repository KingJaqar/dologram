# Phase 7 execution context — 2026-11-15 (Asia/Manila)

**Status: Phase 7 complete, 4/4 steps (100%), five acceptance criteria met against the disposable environment and the production build. Overall admin plan 61/137 (45%). Phase 8 is ready to start and has not been started.** Evidence root: `supabase/repomix/admin-phase-07-20261115/`.

## Checklist and scope

- [x] Plan sections 0–4 and the full Phase 7 read; Phase 6's audit writer/reader, page pattern and harness confirmed in code (not only in its status block).
- [x] Repository instructions read: root `AGENTS.md` (Repomix under `supabase/repomix/`), `apps/admin/AGENTS.md` (installed Next 16.4.6 docs before writing Next code), `supabase/AGENTS.md` (sequential naming; no migration in this phase). No conflict with the phase.
- [x] No Expo/React Native code touched, so no Expo v57 documentation was required.
- [x] Version-matched sources checked: installed Next 16.4.6 (`connection()`, `searchParams` promise, `router.replace`), postgres 4.1.1 template-tag/types, Zod 4 (`z.coerce`, `z.uuid`, `z.enum` on one value), Vitest 5.1.0 aliasing, repository GoTrue 2.197.0 `auth.users` columns.
- [x] Scope kept to Phase 7: no create/CSV/detail, settings, maintenance, premium or theme-phase work.

## Baseline and recoverability

- HEAD `d906bff38ea932c1cab6410b13c6d102e9069067`; `baseline/status-before.txt`, `baseline/head-before.txt`, `baseline/plan-before.md` and the six baseline logs preserve the starting state. `apps/admin` and `packages/admin-core` are untracked work from Phases 0–6 and were preserved.
- Baseline before edits: admin ESLint 0, Stylelint 0, admin and admin-core typechecks 0, admin-core 53/53 tests, admin 117/117 tests.
- No `.env` file was read, copied or logged. No hosted database, Auth project, Storage bucket or deployment was contacted.

## Context inputs and reuse

- ripgrep discovery over `supabase/migrations`, `packages/admin-core` and `apps/admin` established the schema facts the capability contract depends on (see 7.1) and the existing component contracts (`DataTable`, `FilterBar`, `StatusPill`, `SearchField`, `EmptyState`, `ErrorState`, `UnavailablePanel`, `PageTitle`, `Button` classes).
- Phase 4–6 context was reused for guards, session semantics, the audit client pattern, harness topology (3114/3115/3120–3123) and the owner-port preservation rule.
- Scoped cached Repomix 1.18.1 packet `phase-07.xml` (11 entries, 9,017 tokens). The security scanner withheld `packages/admin-core/src/audit/list.test.ts` (synthetic connection-string sentinel); it was reviewed directly in source. No other omission.

## Requirement classification before editing

| Step | Before | Action |
|---|---|---|
| 7.1 | not started | Added `accounts/modes.ts` with a verified `unsupported` contract and the AB-02 prerequisite |
| 7.2 | not started | Added `accounts/list.ts` (`listAccounts`, `getAccount`) plus the shared `like.ts` escaping helper |
| 7.3 | placeholder ("Built in Phase 7") | Replaced with the server page, `AccountsClient`, `accounts.module.css` and a shared `LocalTime` |
| 7.4 | not started | Added `tests/e2e/accounts.spec.ts` with disposable fixtures |

## Decisions and discrepancies

- The M1-03 record (`docs/test-results/M1.md`) is absent, so criterion 5 was verified against the migrations: no trigger clears `raw_app_meta_data.must_change_password`, and no `private.initial_passwords`/`private.disabled_users` exists. `getPasswordFlagMode()` returns `unsupported`; create/reset/ban stay disabled.
- The 2026-11-15 revision replaces the Owner pill with the database-derived Admin pill, so `strings.status.owner` became `strings.status.admin` and the StatusPill value plus its component assertion were updated rather than kept alongside.
- Status precedence (Banned → Must change password → Active) is applied identically to the row projection and to the chip predicates, so a both-flags account appears only under Banned.
- `getAccount` validates the UUID before constructing a database client, so a malformed route parameter cannot trigger configuration reads.
- ADM-07's local-time renderer moved into `components/LocalTime` and is reused by ADM-03; rendered output is unchanged.
- M1-08 fixture names A/B/C/G are absent; the spec uses disposable `user_a`/`user_b`/`user_c`/`user_g` accounts, created idempotently so a Playwright worker restart cannot fail on duplicate emails.
- Not done and not claimed: hosted listing, a real-account read/promotion, hosted `042_admin.sql` apply, Phase 8 creation.

## Verification

| Check | Result |
|---|---|
| `npm run lint --workspace apps/admin` / `lint:css` | PASS, exit 0 |
| `npm run typecheck` (admin, admin-core) | PASS, exit 0 |
| `npm run test --workspace packages/admin-core` | PASS 62/62 (9 new) |
| `npm run test --workspace apps/admin` | PASS 117/117 |
| `npm run build --workspace apps/admin` | PASS; `/accounts` dynamic; eight admin routes preserved |
| Browser (`run.ps1` → Playwright) | PASS 16/16 in 37.9 s: seven columns, Never state, mixed-case username/email search, Admin pill, exclusive status buckets with precedence, row navigation, plus Phase 4/5/6 regressions |
| Cleanup | Owned containers/ports released; owner's 127.0.0.1:3100 service untouched |

Observed flake: `access.spec.ts:167` (offline sign-in message) failed twice with the same output, then passed three consecutive times with no source change; its 8 s assertion races the 10 s offline fetch abort. Recorded as a pre-existing environment-timing flake, not a Phase 7 regression.

## Handoff

- Phase 8 may start: `listAccounts`/`getAccount`/`getAccountCapability` are exported from `@dologram/admin-core`, and the create form's server action should refuse to run while `getAccountCapability().mutations === 'disabled'` and show its `prerequisite` text.
- Owner-attended before hosted use: authorize and apply `042_admin.sql`; promote the intended account; confirm the hosted pooler can read `auth.users` for ADM-03 (the fallback in the phase risks section covers a refusal).
