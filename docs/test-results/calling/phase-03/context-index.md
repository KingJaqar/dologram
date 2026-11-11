# Phase 3 execution context index

Date: 2026-11-11 (Asia/Manila)

## Instructions and baseline

- Read completely: `apps/mobile/AGENTS.md`, `supabase/AGENTS.md`.
- No root `AGENTS.md` or `CLAUDE.md` was found in the bounded repository scan.
- Repository state was `main` with the application, packages, plans, docs and
  other project inputs untracked. Existing user work was preserved; no reset,
  commit, push, deployment, migration application, or external configuration
  change was performed.
- Baseline checks and outcomes are recorded in `../phase-03.md`.

## Scoped Repomix packet

- Packet: `repomix-phase3-execution.xml` at repository root.
- Generator: Repomix 1.18.1.
- Scope: 37 explicitly selected entries covering the plan, applicable
  instructions, mobile manifests/layout/auth/media/preferences, shared calls
  contracts/icons/strings/database types, and Phase 2 calling functions and
  migrations.
- Packet identity: 482,534 bytes; XML parsed successfully. Every selected
  entry was enumerated with path, character count, line count and SHA-256; the
  packet was read in bounded initial/final chunks and changed or compressed
  implementation details were verified against original source before edits.
- Omitted by design: `.env`, credentials, generated native directories,
  unrelated app screens, unrelated migrations and private diagnostic payloads.

## Version-matched documentation and dependency identities

- Expo SDK 57 overview, audio, notifications and router pages were read before
  the related Expo/RN edits; the app-config page was then read to validate the
  resulting config shape.
- LiveKit Expo/RN quickstart and Room connection docs were read before the
  guarded adapter was written.
- Installed versions are pinned and verified in `phase-03.md`; no dependency
  outside the Phase 0 candidate set was added.

## Verified source areas

- New: `apps/mobile/src/calls/{CallProvider.tsx,useCall.ts,api.ts,media.ts,realtime.ts,state.ts,lifecycle.ts,audioOwnership.ts}` and `apps/mobile/app/call/[callId].tsx`.
- Modified: root layout, direct chat route, auth/session transition callers,
  shared strings/icons, Expo config, chat preferences, and the three existing
  media components.
- Prerequisite code confirmed: Phase 2 `call-action`, `call-token`, shared call
  types, migrations 029/030 and LiveKit server helper.
- Unresolved manual evidence: source-matched native artifact, ADB serial
  identity/operation, isolated provider target, and real second media endpoint.
