# Admin Phase 9 context — 2026-11-16

Scope: ADM-04 CSV only, steps 9.1–9.5; no Phase 10 work. Workflow: Git baseline → ripgrep discovery → Reader validation → scoped Repomix → complete bounded XML analysis → original-source verification.

## Checklist and baseline

- Root/admin AGENTS read; no applicable CLAUDE found. Supabase instructions read; no migration planned.
- Git status and tracked plan/package patches: `supabase/repomix/admin-phase-09-20261116/baseline/`. Relevant untracked admin/core source snapshots exclude .env.local, node_modules and .next. All pre-existing changes belong to the user.
- Plan context 0, phase overview/dependencies, full Phase 8/9 requirements/progress/acceptance read. Opening Phase 8 blocked status is historical and contradicted by its dated completion and 043 rollout notes. Phase 9 has no recorded DeepSeek contribution; actual import page is a placeholder, action policies exist, CLI has independent CSV parsing. Preserve all contributions; adapt to current code.
- Initial classification: 9.1 not started (parser absent); 9.2 not started; 9.3 partial (registry and reusable creation/recovery exist); 9.4 not started; 9.5 not started.
- Prerequisites verified in source: core live version-43 capability probe; creation validates normalized shared fields, server password draft, normal role, profile/Saved Messages initialization and idempotent audit; recovery matches operation/actor/session and never creates or rotates passwords. 043 is already applied; do not modify it. Remaining hosted SQL credentials 28P01 is a release limitation, not bypassed.
- Baseline admin/core types, ESLint, CSS lint, production build PASS. Core97/97 PASS. Admin137/138 PASS: pre-existing theme-guards ESLint-load timeout at10s (full diagnostics retained). No assertion/time-limit weakening.

## Context identity / completed reads

Packet: Repomix1.18.1 `context.xml`, 24 entries, 14,546 estimated tokens, 61,306 chars; clean security scan, no compression. Read complete raw XML in explicit character spans [0,12000), [12000,24000), [24000,36000), [36000,48000), [48000,60000), [60000,end). Includes root/admin instructions, single route/actions/types/styles, import placeholder, DataTable/ConfirmDialog/password panel, registry, core creation/capability/recovery/audit/passwords and shared validators. No required continuation remains. XML matches discovered intended scope; original handlers/components/types rechecked where implementation depends on them. Packet/token estimates do not measure model usage.

Original additional sources: audit detail schemas/index exports, guards/session authorization, SDK createUser/error types, postgres4.1.1 array types, harness run/fixture/Playwright/backend and single-creation tests. Version docs: bundled Next16.4.6 use-server/use-client and server-actions guide (complete); installed React19.2.3 effect/startTransition signatures; installed Supabase2.119.0 createUser/error implementation; PapaParse5 official docs plus installed pinned source/types after installation. No Expo/RN touched.

## Decisions and verification gates

CSV is parsed only in the browser with explicit comma delimiter, strict header/field/byte/row bounds; normalized structured rows are revalidated server-side. Import IDs bind immutable server-validated rows to actor/session, serialize effects and share Phase8 recovery. No plaintext passwords in server import state, audit, disk or traces. Replayed completed rows return password-lost guidance; no automatic password reset. Summary counts come only from server outcomes and use import ID as idempotent audit event ID. SDK exposes no Retry-After header; use the specified bounded2s fallback on one definitive429 retry.

Acceptance gates: invalid preview; three real Auth accounts/Saved Messages after password change;101 rows rejected; browser CSV email/password + navigation cleanup; one summary/three safe create audits. Final evidence and source identity ledger to be recorded after implementation.
