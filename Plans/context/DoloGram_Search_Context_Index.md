# DoloGram search planning context index

## Current verification policy and roadmap — 2026-11-13, Asia/Manila

The user made all device checks optional. The plan applies that policy to V11 and V16, the phase gates and the progress denominator. Required source and automated checks still apply. Recorded device passes, failures and gaps retain their original results.

Phases 0–12 are complete under the revised policy. Their required implementation, integrated verification, rollback, handoff and fixture/process cleanup are recorded. The original search implementation is 12/12 required items (100%), and the full plan has 13 of 13 phases complete. The previous counts included optional device follow-up; that work remains a separately recorded checklist and does not gate completion. Historical statuses below describe their dated checkpoints.

The plan's opening roadmap links to each phase's detailed work items and exit gate. Phases 5–12 are complete, and there is no later phase in this search plan. [Current plan and roadmap](../DoloGram_Search_Implementation_Plan.md)

## Phase 12 execution record — 2026-11-13, Asia/Manila

Phase 12 — integrated verification, deterministic performance gate and handoff — is **Complete, 7/7 required items (100%)**. The current execution added only two focused regression assertions: a controlled 150 ms debounce/≤300 ms completion test and a typed-search-shell stability test during message counting. Existing source and tests already cover cancellation, late native settlement, serialized scans, pending/deleted filtering, account boundaries, history, username failures/retry, accessibility, Markdown/highlight behavior, navigation and the synthetic 10,000-message fixture. The caller audit found no current non-search `/new-chat` caller; `NewConversationMenu` enters the global Username filter, and the deleted `apps/mobile/app/new-chat.tsx` remains pre-existing user work and was not restored.

The focused Repomix packet is [`focused-context.xml`](../../supabase/repomix/phase-12-20261113/focused-context.xml), 72 entries, security-clean, SHA-256 `79B1A21C0F6FD4EA1A9D314297CCCFB072DEF46D8B546258CF01E4C0C6ED8B83`; the broad packet is retained as [`context.xml`](../../supabase/repomix/phase-12-20261113/context.xml), SHA-256 `8CB03CC2A14C9436FA25B4395E66469E27EA448C23FB8D7CDE79DAEB33F9BEE0`. Workspace/mobile and shared typechecks passed, owned ESLint passed, focused search/accessibility verification passed 15 suites/123 of 124 tests with one pre-existing `VoiceNotePlayer.tsx:69` failure, and full mobile regression passed 467 of 471 tests with four unchanged unrelated baseline failure categories. Full mobile lint retains 20 unrelated baseline problems (16 errors/4 warnings); default Jest cache remains sandbox-blocked by transform-cache `EPERM`, so repository-local caches were used. Optional MuMu/ADB device timing and visual checks were not run. Exact diagnostics, acceptance mapping, rollback scope and readiness are in the [Phase 12 report](../../docs/test-results/search/phase-12/report.md). No dependency, migration, backend, route-removal, build, deployment, commit, push or later-phase work was performed. The historical planning records below retain their original dated status and are superseded by this current execution record.

## Phase 7 execution record — 2026-11-13, Asia/Manila

Phase 7 — Progressive loading and query lifecycle — is **Complete, 7/7 required items (100%)**. The global and scoped search routes now use compact inline progress/skeleton states, preserve People/Groups and the result structure while message scans run, and keep the toolbar/filter shell stable during the initial chat-list read. `useMessageSearch` keeps immediate query state separate from its 150 ms expensive-work debounce, coalesces synchronous invalidations, and serializes underlying per-scope loader promises so a late native/database settlement cannot overlap the next scan. Generation, account, focus, cache, queue, preference, timeout, retry and late-result guards remain intact.

The Phase 7 scoped Repomix 1.18.1 packet is [`context.xml`](../../supabase/repomix/phase-07-20261113/context.xml), with 25 current entries and no security findings; its generation log is beside it. Workspace/mobile typecheck passed after the edit; owned ESLint passed; the initial focused run exposed two diagnosed test-fixture assertions, then the final split reruns passed 21 global-screen tests and 9 lifecycle/scoped tests. Shared Vitest passed 21 files/154 tests after the shared wording addition; no shared implementation behavior changed. Full mobile lint remains a pre-existing baseline failure of 21 problems/17 errors/4 warnings in unrelated files. The first focused Jest attempt hit the known sandbox transform-cache EPERM; repository-local cache reruns passed. Optional device evidence was not run. No later phase was started.

## Phase 8 execution record — 2026-11-13, Asia/Manila

Phase 8 — Inline username search integration — is **Complete, 6/6 required items (100%)**. The global route now exposes `Username` as a normal filter beside All, People, Groups and Messages. Selecting it automatically looks up the normalized current field value without a separate full-width `Search username` action or separate find-by-username screen. The lookup trims whitespace, removes one leading `@`, rejects empty candidates locally, and uses the existing authenticated exact-username RPC with the existing bounded search-read contract. Query/account/focus/clear changes invalidate publication of late results. Loading, no-match, offline, rate-limit, generic failure and retry are rendered in place, and message scanning is disabled while Username is selected. Successful remote users use the existing guarded `openDirectChat` and search-history path; cached People rows retain their eligibility preflight. Search never routes to `/new-chat`.

The scoped Phase 8 Repomix 1.18.1 packet is [`context.xml`](../../supabase/repomix/phase-08-20261113/context.xml), with 17 actual entries and no security findings; its generation log is beside it. The packet included current source, tests, contracts, migrations and plan/context inputs, and the required implementation entries were read in bounded chunks before original-source verification. The post-edit freshness packet is [`final-context.xml`](../../supabase/repomix/phase-08-20261113/final-context.xml), also with 17 entries and no security findings. Version-matched Expo SDK 57/Router 57 and React Native 0.86 references were checked before editing. Workspace typecheck, owned ESLint, and `git diff --check` passed. The focused search/People Jest run passed 2 suites/27 tests after the known sandbox transform-cache EPERM was bypassed with the approved escalated execution. Full mobile lint remains the same 21-problem/17-error/4-warning unrelated baseline. Optional device evidence was not run. The current caller inventory found no non-search `/new-chat` references; `apps/mobile/app/new-chat.tsx` was already deleted by pre-existing user work and was not restored. No dependency, migration, backend, build, deployment, commit, push or Phase 9+ work was started. Phase 9 is ready.

### Phase 8 username-filter revision — 2026-11-13, Asia/Manila

The requested UI revision supersedes the earlier explicit-CTA wording above: the full-width `Search username` button was removed, the old standalone find-by-username entry point is not used by global search, and the search field now supports username lookup through the normal `Username` filter. The exact lookup remains normalized, bounded, cancellable and guarded against stale results; successful results retain the existing direct-chat/history behavior. The revised `SearchScreen` coverage verifies automatic lookup, no-match, offline, rate-limit, retry, stale-result invalidation and absence of the old button. No Phase 9+ work was started.

The final revision packet is [`final-context.xml`](../../supabase/repomix/phase-08-username-filter-20261113/final-context.xml), with 17 entries and no security findings; its SHA-256 is recorded in the accompanying generation log. Current revised source identities are `app/search.tsx` `3A9AA81FDBD4CF59929C48370804BDC86D87E06E5E7DD94D53DC775D3F78DA2E`, `UsernameResults.tsx` `DB73F2A3370C9B94A3D11954E2DE171346B163B0B142BC8AB0105FED5CEBB26E`, `SearchScreen.test.tsx` `B675A4C4772E6B461034CF360350DC494E2C97F2418D5E01285364838F486DB8`, and shared strings `4CCD022F1CE2C9B5588983A67D7BEF07F3EDE902956D448A17D247B0415E8D7B`.

## Phase 6 execution record — 2026-11-13, Asia/Manila

Phase 6 — Stable search geometry and state shell — is **Complete, 6/6 required items (100%)**. The implementation is limited to the existing global search route, search suggestions, shared search wording, and focused screen coverage. The route keeps a fixed toolbar/filter/results stack, accounts for horizontal and bottom safe-area insets, caps filter text enlargement consistently with existing button behavior, and uses a compact token-based no-results state below the filters. `SearchSuggestions` now renders an accessible skeleton rail while history is loading, so the empty-history copy is shown only after a settled zero-entry result. No new dependency, schema, native, backend, navigation, emulator, build, commit, push, or Phase 7+ work was performed.

The Phase 6 scoped Repomix 1.18.1 packet is [`context.xml`](../../supabase/repomix/phase-06-20261113/context.xml), with 16 current entries and no security findings; its generation log records the sandbox-only token-cache `EPERM` after successful output creation. A focused post-edit packet is retained beside it after the plan/report update. Version-matched Expo SDK 57 and Expo Router references were checked before editing; no version-sensitive navigation API was changed. Source-level verification and exact check results are in the [Phase 6 report](../../docs/test-results/search/phase-06/report.md). The focused screen suite passed 19/20 tests, including the new loading-placeholder test; its one 5-second first-test timeout matches the Phase 5 baseline limitation. Optional device evidence was not run.

## Phase 5 execution record — 2026-11-13, Asia/Manila

Phase 5 — Hardening baseline, ownership, and measurement preparation — is **Complete, 6/6 required items (100%)**. No application or native code was edited. The current working copy remains the baseline: HEAD `d906bff38ea932c1cab6410b13c6d102e9069067`, with 194 status lines at capture (121 tracked modified/deleted and 73 untracked). A search-only tracked recovery patch, 34 secret-free source snapshots, and SHA-256 identities are recorded under [`docs/test-results/search/phase-05/`](../../docs/test-results/search/phase-05/). The deleted `apps/mobile/app/new-chat.tsx` was preserved as-is and not restored.

The required source/context workflow was completed: Git baseline → scoped ripgrep → instruction and source validation → Repomix 1.18.1 from the repository root → XML entry inventory/analysis → original-source verification. The pre-edit packet is [`context.xml`](../../supabase/repomix/phase-05-20261113/context.xml), with 37 actual entries and no security findings. The stable current source handoff is [`final-source-context.xml`](../../supabase/repomix/phase-05-20261113/final-source-context.xml), with 35 actual source, test, instruction, manifest and fixture entries, no security findings, and manifest/log/hash companions in the same directory. The 39-entry `final-context.xml` is retained as a documentation-inclusive supplemental packet. These packets include the current untracked `UsernameResults.tsx` seam and exclude the absent deleted `/new-chat.tsx` body.

H5.1–H5.6 are satisfied in the [Phase 5 report](../../docs/test-results/search/phase-05/report.md). Workspace typecheck passed; corrected shared tests passed 21 files/154 tests; mobile lint failed with 21 unrelated baseline problems; focused mobile Jest was blocked by sandbox transform-cache EPERM and the explicit-cache diagnostic reached a pre-existing screen-test timeout. The [fixture matrix](../../docs/test-results/search/phase-05/fixtures.md) defines the repeatable history-loading, People/Groups-first, username, no-result, slow-scan, rapid-query and 10,000-message/scroll fixtures plus timing, overlap and cleanup rules. Optional device/runtime observations were not run. No later phase was started; Phase 6 is ready.

Build-policy update — 2026-11-13, Asia/Manila: authorized testing may use the existing local Gradle workflow when an APK is required: `scripts/build-android-local.ps1 -Variant Debug` for the development-client APK or `-Variant Release` for the signed release APK, with credentials and keystores excluded from evidence. Local Gradle is the quota-free default; EAS cloud build is a separately authorized fallback only after a documented local-build limitation. This changes planning authorization only; no build was run in this update.

Revision workflow: inspected Git status and preserved the extensive pre-existing working-copy changes; used scoped ripgrep discovery and original-source review; checked the current policy, Phase 4 evidence/status, future phase requirements and local link targets. The final scoped Repomix review uses version 1.18.1, root configuration and the two planning documents plus root `AGENTS.md`/`repomix.config.json`. Packet, generation log, source identities, read scope and document snapshots are recorded under `supabase/repomix/search-plan-policy-20261113/`. Older analysis below remains historical; changed policy and status findings above supersede it. Phase 5's current evidence is recorded in the execution section above; seven later phases contain 43 required work items. Local link/anchor/count checks and diff whitespace passed; Phase 5's affected application checks are recorded in its report.

## Planning-refinement audit — 2026-11-12, Asia/Manila

### Boundary and working-copy classification

- This audit refined the search plan and context index only. No application code, data, migration, build, service, emulator state, or remote configuration was changed or operated.
- The working copy already contains the earlier search implementation and extensive concurrent changes. Those changes are user-owned inputs and were not reset, staged, or overwritten.
- The historical Phase 0–4 reports remain evidence with their original dates, environments, and failures. They are not fresh acceptance for the new UI-hardening requirements. Phase 4's native V11 gate is still incomplete in its report.
- The new hardening requirements are planned as Phases 5–12. They are not started, and no UI-hardening requirement is marked passed by this audit.

### Current verified implementation surface

| Area | Current source finding | Planning consequence |
|---|---|---|
| Global search | `apps/mobile/app/search.tsx` currently renders SearchToolbar, blank suggestions, category filters, grouped results, full-screen chat-list loading, and a username action that pushes `/new-chat`. | Phase 6/7 stabilizes layout/loading; Phase 8 moves username lookup in place. Existing global-search tests asserting `/new-chat` must be replaced with inline-flow assertions. |
| Blank/history state | `src/search/SearchSuggestions.tsx` renders `No history` for an empty history array without a dedicated loading placeholder and places capped suggestions in `ListEmptyComponent`. | Add a stable history-loading state and keep the capped suggestion behavior unless measurements show a need for a list-structure change. |
| Transition/focus | `src/search/SearchToolbar.tsx` provides a custom animated field morph; `src/search/transition.ts` and root `app/_layout.tsx` provide a search crossfade; `app/search.tsx` focuses on `transitionEnd`. | Phase 9 must choose one transition source and one focus point, preserving reduced motion and keyboard behavior. |
| Rows/lists | `src/search/SearchResultRow.tsx` is not memoized and uses 72 px minimum rows; global lists use inline render callbacks and have no hardening-specific virtualization tuning. | Phase 10 applies compact rows and measured rendering optimization without changing result semantics. |
| Query lifecycle | `src/search/useMessageSearch.ts` already debounces scans, aborts publication, applies generation/lifetime guards, and invalidates on cache/queue/preference changes. A late SQLite/native loader promise may still settle after logical abort. | Phase 7 preserves these protections, serializes underlying loader promises when physical cancellation is unavailable, and verifies no stale/overlapping UI updates while changing the loading presentation. |
| Username contract | `packages/shared/src/db/repositories/profiles.ts::findUser` calls the authenticated exact case-insensitive `find_user` RPC. `supabase/migrations/016_align_messenger_schema.sql` grants that function only to `authenticated`. The RPC returns only `{ user_id, display_name }`. | Inline username search triggers only on explicit action/submit, trims/removes at most one leading `@`, rejects an empty candidate locally, wraps the existing call in a bounded lifecycle, and adapts only the one returned row. Cached People results keep local allowlist preflight; uncached exact-username results use the existing New Chat `openDirectChat` path, not `loadSearchPeople`. No migration or new API is planned. Test rate-limit/network behavior through existing error classification and the authorized runtime fixture. |
| Existing New Chat route | `apps/mobile/app/new-chat.tsx` remains a complete non-search exact-username screen with username prefill and search-origin Back behavior. | Preserve it for non-search callers. Search must stop depending on it; removal is out of scope until a caller audit proves it is unused. |
| Runtime/dependencies | `apps/mobile/package.json` specifies Expo `~57.0.32`, Router `~57.0.30`, React Native `0.86.3`, Reanimated `4.5.1`, and no new dependency is required by the hardening plan. The repository also contains `scripts/build-android-local.ps1`, `apps/mobile/android`, `expo-dev-client`, and a release signing init script. | If an APK is needed for authorized testing, prefer the quota-free local Gradle `Debug` development-client or signed `Release` build, recording variant, architectures, fingerprint, path and SHA-256 while excluding credentials/keystores. EAS is only a separately authorized fallback after a confirmed local-build limitation; no speculative rebuild is implied. |

### Current hardening-scope source identities

SHA-256 identities below were captured from the working copy during this audit. They supersede older manifest entries for execution-start freshness checks. They identify complete files; they do not claim every byte was read in the same pass.

| Path | SHA-256 |
|---|---|
| `apps/mobile/app/search.tsx` | `EE2513358A96D3692D9552BB13A48E931C5FA4C2CC1A70A32C8B136F7B57994C` |
| `apps/mobile/app/chat/[chatId]/search.tsx` | `73B9DDE676ED796379C758B1016D8DD0B99CB08E1D0854C8E399F378F8537566` |
| `apps/mobile/app/new-chat.tsx` | `6970AC3D908F0216FAB2D2C44052FFCFB930C8808768482A3022FD5C7AB6459B` |
| `apps/mobile/app/_layout.tsx` | `562B15DD0D7F905067D5E1B4D2085524A5E064A396E687D1DF5E77325B8643F9` |
| `apps/mobile/src/components/SearchField.tsx` | `11C8A8014D6ADBCED9A71E8DFDB84ED19D550E3E7C97D8267311CF9B056B9EC0` |
| `apps/mobile/src/search/SearchSuggestions.tsx` | `F7006D39B70F36F415531D78722275CEE63AFD2801E0A8263D17DC50B282B4FB` |
| `apps/mobile/src/search/SearchToolbar.tsx` | `009C7230C55D1488999BB1569B5FB1774120FF96FA4009DC2906E5356C0B156F` |
| `apps/mobile/src/search/SearchResultRow.tsx` | `6B2A6457F4252D648F7FEAC23FD6C387ED8A5730923581CE3493FDEFF27474F8` |
| `apps/mobile/src/search/transition.ts` | `C2941CDCC499350410C8B6E3BFDFAA6ADE97321EF3F3D44F72DDD2B4522F77CF` |
| `apps/mobile/src/search/useMessageSearch.ts` | `A26C104AD7DEE6E913A0594B0EF98D90B4AE463278C346C014F8A3C6AFEA1EFA` |
| `apps/mobile/src/search/HighlightedText.tsx` | `186C8DCC5F887B934862D66C14A2A90B5812AF34902DDEEFEBFA1593EC962C0F` |
| `apps/mobile/src/search/history.ts` | `49CF392EEF6646560E6433AE8342429ACD40F8500C53BFFEADC9B1DF0CAC803B` |
| `apps/mobile/src/search/people.ts` | `E880FE0B2DD761745A8D0ED870006706BFF3FF1CA53D55D1CFC1B3BB50189781` |
| `apps/mobile/src/search/__tests__/SearchScreen.test.tsx` | `BF10D97734FE34FF8934082C000F5431E91FAEC366AC4B275C490FF22CDFD39D` |
| `apps/mobile/src/search/__tests__/ChatSearchScreen.test.tsx` | `0B772E22F6342304CF7966D03EDDB8DB669FA19F66A0E28D3C73E9F09EEB661E` |
| `apps/mobile/src/search/__tests__/history.test.ts` | `09C4A1BFADAB8A9B257EF4CD6FF523C90023F99184D6F25E2C4EC108E5C70A6E` |
| `apps/mobile/src/search/__tests__/people.test.ts` | `467B5D5CA7154C51A62FE64696293293A4E0D8C6A37F894BA5C75709B5B77F50` |
| `packages/shared/src/strings/index.ts` | `3F586DEABAA79BCFCCC21CC0B19223AABE3363D9AF07D71F6C39DF26791FE7C7` |
| `packages/shared/src/db/repositories/profiles.ts` | `2430FE537AB37DF8E6940BBB3653172E36CEA2DAAD05215B9E76182540FBC95A` |
| `supabase/migrations/016_align_messenger_schema.sql` | `16B4819DA0E85E1C456BC5E2595C5ECDBA079259AB8E55B4A7DAB3B0C969B9F6` |
| `apps/mobile/package.json` | `C2C8911C8AC01FE2D5685077ADBA4264A9583C66E8F88053335B5D2F9311A3B9` |
| `package-lock.json` | `C70C289EFEC5C05FDABEB99157FAD9EAF23BFD7B0428D17934B5B8725FC00703` |
| `Plans/DoloGram_Search_Implementation_Plan.md` | `C2F1A6D22140C92FD3BD0EC9A3E63AF9F9509F215FF421EF808937C2A637C23F` |

### Context packet and verification freshness

- `docs/test-results/search/phase-04/context.xml` is a historical Repomix packet with a recorded 55-file scope and SHA-256 in the Phase 4 report. It includes the earlier search files, but its source bodies and hashes predate the current working-copy identities above; it is supplemental historical context, not the current execution baseline.
- No new packet was generated during this planning audit because no application source was changed. Phase 5 must either refresh a narrowly scoped packet or record a complete targeted-read manifest using the current identities before implementation.
- No tests, lint, typecheck, build, migration, service, ADB, or runtime command was run during this audit. Existing reports are referenced with their original pass/fail/blocked classifications only.

### Planning audit open questions

| ID | Question/evidence | Consequence and resolution |
|---|---|---|
| PA-01 | The screenshots show a large gap above filters, while the current `GlobalResults` style source uses only small filter padding. The cause must be confirmed on the assigned runtime rather than inferred from screenshots. | Phase 5 records the current coordinates; Phase 6 fixes only the measured layout cause. UI-01 remains unverified until runtime evidence exists. |
| PA-02 | Current global search username tests assert a push to `/new-chat`; the new agreed behavior requires in-place lookup. | Phase 8 updates those tests and adds mocked `findUser`/direct-chat seam coverage without changing the RPC or non-search route. |
| PA-03 | The assigned MuMu runtime previously exposed incomplete keyboard/theme/Back/scroll/stress observations and a later non-fatal ReactHost soft exception. | Phase 5 revalidates target/artifact stability; Phase 12 classifies unavailable observations as blocked and does not claim hardening acceptance. |
| PA-04 | Logical AbortController cancellation does not prove an underlying SQLite/native read has stopped. The hardening target requires zero overlapping underlying scans. | Phase 7 must serialize/coalesce loader promises and instrument overlap; if the runtime/library cannot provide the target without violating correctness, record the exact limitation and keep UI-03/UI-11 incomplete rather than weakening the assertion. |

## Second-pass quality audit — 2026-11-12, Asia/Manila

- Reused the current identities and historical Phase 0–4 evidence; no packet was regenerated and no operational command was run.
- Re-read only material uncertainty sources: the current scoped search route, request/deadline lifecycle, direct-chat opening, global username handoff, exact-username repository/RPC grant, and focused search tests.
- Confirmed and repaired stale scoped-route findings, the remote-username/local-allowlist integration conflict, missing username lifecycle/normalization/deadline rules, logical-vs-underlying scan overlap ambiguity, and latency/render-count acceptance ambiguity.
- Phase 5–11 source/unit work can start without the incomplete native V11 observations; Phase 12 remains the runtime/performance closure gate.
- The exact-username path intentionally exposes only one authenticated RPC result and uses the existing New Chat `openDirectChat` contract for uncached users. No new RPC, migration, schema, dependency, or broader directory capability is planned.
- Audit status: **Ready for execution**, with B02/B03/B04/B05 as execution/verification prerequisites and B06 as an in-phase implementation seam. UI-01–UI-12 remain unimplemented and unverified.

## Phase 4 completion-audit context — 2026-11-12, Asia/Manila

This entry supersedes stale Phase 4 identities/status claims below; earlier records remain historical. Phase 4 is **partially complete, 50% (P4.1 complete; P4.2 incomplete)**. Original Phase 0–4 search-feature progress is 11/12 (92%); broader-project and expanded-hardening aggregate progress are not defined. Phase 5 is independently ready at its source/unit prerequisite gate but was not started.

Evidence root: `docs/test-results/search/phase-04/revalidation-20261112/`.

### Current scope/checklist

- [x] Read plan context, complete Phase 4/acceptance/dependency/safeguard sections and applicable mobile/Supabase instructions; confirmed Phases 1–3 in code/tests. No new phase entered.
- [x] Git status/diffs/HEAD and ignored-input inventory captured before edits; 72 exact working-copy snapshots hashed and verified, 59 unchanged from the Phase 0 refresh. Secrets/env/APKs/runtime private payloads excluded. Restore-to-scratch rehearsal passed.
- [x] Narrow `rg` → prior identity validation → scoped Repomix 1.18.1 → all XML continuations → original-source/diff verification. Repowise not needed. No compression or security disablement.
- [x] Baseline existing checks recorded before product edits. Implemented only existing SR-02/03/07 acceptance corrections; no later loading/layout/inline-username/animation work. Current `owned.diff` isolates these changes from pre-existing user work.
- [x] Final typecheck and owned ESLint passed. Affected Jest: 15 suites/140 tests passed. Full mobile: baseline 409/413, final 415/419 tests passed; same four failing suites, no new failures. Full lint: unchanged 17 errors/4 warnings outside owned paths. Shared baseline: 21 files/154 tests passed; unchanged shared sources justify reuse. Diff whitespace clean.
- [ ] P4.2 native gate/old fixture cleanup: authoritatively identified MuMu instance 3 `dologram`, `127.0.0.1:16480`, remains offline in ADB. Device operations attempted via ADB only; no new emulator data/settings changes. Task-owned hung alternate-port clients/shell stopped; existing services preserved.

### Packet/source/read index

| Identity | Verified finding and boundary |
| --- | --- |
| `sources.json`, `baseline/source/`, `baseline/{status,head,tracked.diff,staged.diff,ignored}.txt` | 72 pre-edit file identities, ownership/recovery baseline. Ignored env/artifact paths only, no secret contents. |
| `context.xml`, `context-manifest.json`, `repomix.log` | 11 actual files; SHA-256 `aedac8458f6e1ea5c62e76f56edf876b70eb3ab5a6ef31b75f6972450d87359f`. Complete reads `context-read-1..12.txt`; max 11,499 chars/155 lines. Source equality checked at extraction. |
| `supplement.xml`, `supplement-manifest.json` | 5 files; SHA-256 `87c0360297482e489882ef42f50ff172ef6b457bf5d2877c8c9d8de85e7baca6`. Complete reads `supplement-read-1..6.txt`. Resolves the initial literal-bracket scoped-route selector omission using `app/chat/*/search.tsx`; includes retained-page, lifecycle, Markdown and local-data tests. |
| `acceptance-fixes.xml`, `acceptance-fixes-manifest.json` | 4 preference/test entries; SHA-256 `383f044f9d4ee0e8d53e0f2186fc6dcbd1d628fbd672a9ef009f88db77af702e`. Complete reads `acceptance-fixes-read-1..7.txt`. No compression gaps. Truncated tool presentation around MessageText test lines 97–100 was explicitly resolved from original source. |
| `validation.json`, `owned.diff` | Final hashes/current owned source deltas supersede changed baseline packet entries. Only five application/test files changed: global search, ChatScreen's highlight prop, search query and two search tests. Other snapshotted live application inputs remained unchanged. Snapshot/recovery validation reused without overwriting baseline captures. |
| Original-source verification | Search query/ranking/preflight/history; full scoped route; preference serialization/listeners; useChatList membership/organization; MessageText rendered-leaf behavior; ChatScreen focus/load/jump/render/Back/scroll contracts; forward/pinned/info/New Chat callers; sign-out history cleanup. Inspected ranges appear in packet manifests or the owned diff, with remaining native uncertainties in the report. |
| Version anchors | Installed Expo 57.0.32, Router 57.0.30, SQLite 57.0.4, RN 0.86.3, React 19.2.3, Jest 29.7 and AsyncStorage 2.2.0 confirmed. Matching Expo 57/RN 0.86/Jest 29.7 docs read; exact installed storage JSDoc/types verified after public/tag URLs returned 404. Existing helpers reused; no new library API invented. |

### Requirement findings and unresolved gates

Earlier completion labels missed Groups' activity-only ranking, cached-person preflight bypass, scoped blocked/deleted read eligibility and all-bubble highlighting. These are fixed using existing contracts, with six new passing test cases for ranking/opening/read denial. Selected-only ChatScreen wiring is source-reviewed/typechecked/linted; native observation remains pending. No obsolete feature code was safe to remove; snapshot/row/compatibility APIs still have callers/contracts.

Full check failures remain explicit: unlabeled VoiceNotePlayer Pressable; actionScreens missing CallProvider; ChatRow/PeopleRows setup requiring Supabase URL through existing Avatar. Full lint diagnostics match the current baseline. Node SQLite/punycode toolchain warnings already existed. None was suppressed or repaired outside scope.

The mobile instruction's `src/app` statement conflicts with existing `apps/mobile/app` discovery; no route moved. Current explicit execution supersedes historical planning-only prohibitions. The old Phase 4 statement that no next phase exists is stale; Section 12/AQ-06 supplies Phase 5–12 and independent source/unit readiness. Exact Messenger parity is still unverified and no new fidelity claim is made.

Every complete SR-01–12 and SR-14 criterion remains pending required native evidence; SR-13's affected automated gate is met, with unrelated full-command failures separately retained. Required native steps and safe historical fixture/settings restoration are in the [audit report](../../docs/test-results/search/phase-04/revalidation-20261112/report.md) and existing runtime observations. No physical-device/iOS gate is added. Do not claim the historical hierarchy-capture latency measures <=100ms JS batches. No commit/push/build/deployment/migration/service configuration change occurred.

### Authorized Phase 4 native recovery follow-up

After explicit user approval for one lifecycle CLI restart, MuMu instance 3 restarted and ADB transiently recovered. `runtime-resume/inventory.json` records the recovered baseline. Historical cache/queue fixture cleanup now passes a separate direct-ADB SQL read: stress 0, pending 0, integrity ok (`runtime-resume/cleanup-verification.txt` and `verify-cleanup.sql`). Display/font restoration was independently read as physical 1080x1920 with no override and font 1.0. These supersede earlier pending fixture/display/font statements.

No fresh search hierarchy/Back/scroll/offline/theme/performance pass was captured. Current source bundled (21,433ms/4,673 modules; bundle time is not search latency). Subsequent native shells stalled again. An unrelated Kamelyon installation on the same serial remained active after one bounded 45-second wait; its separate app ID and process were preserved. Shared ADB daemon creation predates this task, so it was preserved too. Task-owned Metro and stalled/alternate ADB processes were stopped. Network/dark-theme restoration, task reverse mapping and device-side benign SQL/hierarchy-file cleanup still need responsive ADB. The only private hierarchy was the launcher and was excluded from evidence packets.

The unused Node ADB launcher was removed after direct ADB replaced it; no product/test code, dependency, migration, build or later-phase work changed. Existing automated results were reused without redundant test reruns; 72 snapshot/recovery entries verified again with zero changed unowned inputs. [Recovery report and remaining steps](../../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/resume-report.md). Current Phase 4 remains partially complete/blocked at P4.2, 50%; original search feature 92%; Phase 5 independently source-ready and untouched.

### Shared ADB recovery — 2026-11-13, Asia/Manila

The user authorized stopping the conflicting Kamelyon install and restarting shared ADB. The install had ended before current inspection. Shared ADB restarted; the task-owned isolated server responded over explicit IPv4. MuMu shell access recovered transiently after assigned-instance recovery, then closed during network restoration. No fresh V11 pass or network-fenced fixture run was credited. SDK ADB 37.0.0 and LDPlayer ADB 34.0.4 both report protocol 1.0.41; causation/incompatibility remains unproven. Task-owned isolated ADB/Metro processes were stopped; the restarted shared daemon was retained. See [dated results](../../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/shared-adb-recovery-20261113.md).

No application/test source changed, no later phase began, and 72 snapshot/recovery entries reverified with zero changed unowned inputs. Existing automated results remain valid without redundant reruns. Current Phase 4 remains partially complete/blocked at P4.2, 50%; original search feature 92%; broader project denominator undefined. Final network/theme/reverse/device-file cleanup and all outstanding native observations remain pending stable assigned-emulator control.

### Native verification continuation — 2026-11-13, Asia/Manila

Current DoloGram SDK 57 loaded through its dedicated Metro endpoint on MuMu instance 3. Native fixture evidence now covers 35 old matches, 30+5 pagination, blocked/deleted/foreign exclusions, archived/ignored inclusion, failed pending opening, scoped Back and scroll restoration, and a visible 10,000-result count with scoped scrolling. The 51-read scan measured 2,445.46 ms, 69.07 ms for a 30-result first page and a maximum 21.96 ms JS interval. Cancellation issued no second read. Temporary fixtures, storage keys, device settings, firewall/reverse rules and processes were cleaned up. Read [the criterion matrix](../../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/native-verification-20261113.md) before reusing these findings. Full V11 remains incomplete. Product source and test identities did not change in this continuation.

## Historical Phase 4 execution context — 2026-11-12

Phase 4 was executed without changing product source. P4.1 is complete and P4.2
is partial because the required native V11 matrix is not fully observed.

### Phase checklist

- [x] Rechecked Git ownership/status and preserved the recoverable pre-edit patch
  at `.tmp/phase4-preexisting.patch`; concurrent calling, header, info, local
  update, notification, and plan changes were preserved.
- [x] Read the complete applicable `AGENTS.md` files and the version-matched
  Expo SDK 57, Expo Router/SQLite SDK 57, and React Native 0.86 Pressable,
  TextInput, FlatList, and BackHandler references before runtime verification.
  The mobile instruction's `src/app` wording remains stale; actual routes are
  under `apps/mobile/app`.
- [x] Used Git baseline → ripgrep discovery → prior context-index validation →
  scoped Repomix → bounded XML packet analysis → original-source verification.
  The final packet was generated with Repomix 1.18.1, security checks enabled,
  no compression, and 55 files; relevant entries were read completely or
  reused only where their packet/source identities remained unchanged.
- [x] Ran baseline/finally applicable typecheck, full/owned lint, affected and
  full Jest, shared tests, diff check, ADB identity/package checks, app launch,
  sanitized UI hierarchy observations, and recent runtime-error scan.
- [ ] Complete all required V11 platform/performance observations. The assigned
  MuMu target is available, but stable non-private observations for all themes,
  accessibility settings, nested Back/scroll, offline/pending/deleted targets,
  and native 10,000-message stress were not established in this session.

### Phase 4 context identities and results

| Input | Verified identity/coverage and finding |
|---|---|
| Working-copy baseline | `.tmp/phase4-preexisting.patch`; existing user changes were not reverted. The final report and runtime notes are under `docs/test-results/search/phase-04/`. |
| Repomix packet | `docs/test-results/search/phase-04/context.xml`; Repomix 1.18.1; 55 files; final metrics, SHA-256, and security identity are recorded in the Phase 4 report; security scan passed; no compression. |
| Packet scope | Plan/context, mobile instructions/manifests, search routes/helpers/tests, shared query/navigation/cleanup contracts, MessageBubble/MessageText/SearchField, chat/queue/people callers, and relevant shared strings/theme types. `node_modules`, secrets, credentials, generated native output, unrelated calling implementation, and private runtime payloads were excluded. |
| Packet analysis | Header, directory structure, all 55 entry identities/line counts, and the complete core search query/lifecycle/matching/request entries were read from XML. Original sources were then checked for current route/caller bodies. Five document/concurrent entries were re-read directly before final packet regeneration; no unexplained source omission remained. |
| Baseline | Workspace typecheck passed; shared tests passed 20 files/149 tests; full mobile lint failed with the known 13 errors/3 warnings outside the search-owned scope; affected Jest had 12/13 suites and 65/66 tests pass with the default-timeout SearchScreen failure; full mobile Jest had 58/59 suites and 324/325 tests pass with the unrelated DoloGramHeader failure. |
| Final affected checks | Search-owned Expo lint passed; search regression Jest passed 5 suites/25 tests; full suite's SearchScreen passed; isolated SearchScreen with an extended timeout passed 3/3; `git diff --check` passed. No product source changed after baseline, so these results remain applicable. |
| Runtime | MuMu `dologram` confirmed as `127.0.0.1:16480`; package `com.dologram.app`, Android 12, version 1.0.0, target SDK 36. Dark-theme global search entry/blank/query/filter/count/highlight states and 44-pixel hierarchy bounds were observed. The original dark theme was confirmed after the reversible theme check. The first log scan had no fatal signature; a later bounded relaunch emitted a non-fatal ReactHost `ReactNoCrashSoftException` before the hierarchy stabilized. |
| Sensitive capture handling | Raw hierarchy/screenshots containing live profile/message content were moved recoverably to `.tmp/phase4-unsanitized-captures`; they are not part of the evidence packet. Sanitized observations are in `runtime-observations.md`. |
| Cleanup/scope | No obsolete search code was safe to remove; compatibility and active callers were preserved. No dependency, migration, backend/configuration, commit, push, deployment, or later phase was started. |

### Phase 4 open gate

The feature's source/unit acceptance is substantially verified, but the plan's
Phase 4 gate requires every required assertion to pass. V11 remains incomplete
for light theme, enlarged text, compact width, visible keyboard, reliable nested
Back/scroll restoration, offline/pending/deleted targets, and native stress/
performance measurement. Current Phase 4 progress is 1/2 work items (50%); the
search-plan total is 11/12 predefined items (92%). No broader project denominator
is defined and no next phase exists in this plan.

## Phase 3 execution context — 2026-11-12

This supplement records the Phase 3 implementation and supersedes planning-only
statements below where they concern scoped results and original-message context.
Phase 4 remains unstarted.

Phase checklist:

- [x] Revalidated Phase 1/2 query, route, pending, history, and navigation
  contracts in current source; preserved concurrent calling/info work.
- [x] Rechecked git ownership and created the recoverable pre-edit patch at
  `.tmp/phase-03-pre-edit-working-copy.patch` without overwriting user changes.
- [x] Read `apps/mobile/AGENTS.md`, confirmed Expo ~57.0.32 / Router ~57.0.30 /
  React Native 0.86.3, and read the matching Expo Router SDK 57 reference plus
  navigation/URL-parameter/FlatList behavior before editing.
- [x] Generated and analyzed the scoped Repomix 1.18.1 XML packet at
  `docs/test-results/search/phase-03/context.xml` with security checks enabled;
  intended and actual scope was 23 files. Relevant packet entries were read in
  bounded chunks and then matched against the original sources, including the
  scoped route, chat query, ChatScreen, MessageBubble, MessageText, search
  query/lifecycle helpers, tests, instructions, package manifest, strings, and
  plan.
- [x] Implemented P3.1/P3.2 only: shared scoped pagination consumption, pending
  result presentation, push/back query retention, target availability feedback,
  Jump-to-latest search reset, and Markdown-visible highlighting.
- [x] Final owned typecheck/lint/Jest/shared checks and diff review completed;
  full mobile lint's 13 errors/3 warnings remain pre-existing outside Phase 3.

Phase 3 context identities and limits:

| Input | Verified identity/coverage and finding |
|---|---|
| Source packet | `docs/test-results/search/phase-03/context.xml`; Repomix 1.18.1; 23 files; 71,871 tokens / 290,988 chars reported by Repomix; SHA-256 `60DDDBEDE1357D5620886F6B1935A7F96FABDBCECE24529C46170F2AFC9417FA`; security scan passed. |
| Owned implementation | `apps/mobile/app/chat/[chatId]/search.tsx`, `apps/mobile/app/chat/[chatId]/index.tsx`, `apps/mobile/src/chat/query.ts`, `apps/mobile/src/components/MessageBubble.tsx`, `apps/mobile/src/components/MessageText.tsx`, shared search strings, and focused tests. Current source was re-read after packet analysis; no new runtime dependency or migration. |
| Baseline | Root typecheck initially failed in pre-existing `src/notifications/pushNotifications.ts`; full mobile lint initially and finally reports the same 13 errors/3 warnings outside Phase 3; first Jest attempt hit sandbox-cache `EPERM`, then the workspace-local cache reproduced five passes plus the unchanged Phase 2 SearchScreen timeout. |
| Final verification | Mobile/root typecheck passed; owned ESLint passed; six Phase 3 suites passed with 43 tests; shared Vitest passed 20 files/149 tests; `git diff --check` passed. The extra V09 regression batch passed `actionScreens.test.tsx` and was stopped after three unchanged suites produced no output for over one minute. |
| Runtime | No Phase 3 native UI claim was made. MuMu/ADB visual, native Back, large-text/theme, retained-scroll and performance observations remain Phase 4/V11 work. |
| Scope boundary | Phase 4 integrated cleanup/runtime handoff was not started. Existing calling, local-update, folders, info, notification, and other user changes were preserved. |

## Phase 2 execution context — 2026-11-12

This supplement is current for Phase 2 and supersedes the Phase 1-only status
sentences below where they concern Phase 2. The [Phase 2 report](../../docs/test-results/search/phase-02/report.md)
records the complete execution evidence; Phase 3 was not started.

Phase checklist:

- [x] Scope P2.1–P2.2 only; confirm Phase 1 contracts in source before editing,
  preserve the existing scoped route, and keep concurrent calling work untouched.
- [x] Git status/working-copy ownership, applicable instructions, Expo/RN v57
  documentation, and direct-chat/sign-out callers revalidated before editing.
- [x] Scoped Repomix 1.18.1 XML packet generated at
  `docs/test-results/search/phase-02/context.xml` with security checks enabled;
  34 selected files were included and the packet was read/analyzed before
  original-source verification. SHA-256 is recorded in the Phase 2 report.
- [x] Baseline and final typecheck/lint/Jest/Vitest checks recorded; owned lint,
  typecheck, Phase 2 tests, regressions and shared tests pass. Full mobile lint
  retains only the pre-existing unrelated 13 errors/3 warnings.
- [x] History durability/account isolation, global screen states, person opening,
  username handoff, cleanup fencing and scoped-route parameter handoff verified.
- [x] Owned diff and `git diff --check` reviewed. No dependency, migration,
  backend/configuration change, commit, push or deployment performed.

Phase 2 context identities and open limits:

| Input | Verified identity/coverage and finding |
|---|---|
| Source packet | `docs/test-results/search/phase-02/context.xml`; 34 files, 4,622 lines, SHA-256 `A3753825D0848EB5F1C17E43E42149A92C08277A68D20A0969B80019F1507A9F`. Plan/instructions, Phase 1 contracts, routes, UI primitives, storage, direct-chat, chat-list, auth and tests were included and read. |
| Owned implementation | `apps/mobile/src/search/history.ts`, `SearchSuggestions.tsx`, `app/search.tsx`, `app/new-chat.tsx`, `src/storage/localData.ts`, shared search strings and two Phase 2 test files. Final hashes and check outputs are in the Phase 2 report. |
| Runtime | Current `adb devices -l` showed only `emulator-5556` and `emulator-5560`; the assigned MuMu `dologram` endpoint was not exposed. No UI screenshot/device-flow pass is claimed; V11 remains pending manual verification. |
| Scope boundary | Actual scoped-query rendering/original-message context remains Phase 3. Concurrent calling/info/notification work was not reverted, reformatted or overwritten. |

## Phase 1 execution context — 2026-11-11

This supplement records the Phase 1 closeout and supersedes planning-only
statements below where they concern the completed foundation. At that closeout,
Phase 2–4 work had not started; the Phase 2 supplement above is now authoritative
for Phase 2.
The [Phase 1 report](../../docs/test-results/search/phase-01/report.md) maps each
owned assertion to checks, actual limitations and recovery instructions.

Phase checklist:

- [x] Scope P1.1–P1.3 only; verify P0 source/snapshot/test prerequisites against
  actual artifacts and sources, not status labels. Global/scoped screens remain
  unchanged. No new dependency, schema, migration or external mutation.
- [x] Git status/tracked/staged baselines; identify untracked user-owned app and
  plan inputs; 28 recoverable pre-edit source/config snapshots and SHA-256.
- [x] Narrow ripgrep/instruction/caller/schema discovery and prior-context
  validation; no fresh Repowise index was needed or assumed.
- [x] Repomix 1.18.1 scoped XML, security on/no compression; all 15 selected entries
  included; all six bounded Reader extractions completely read and analyzed;
  original source resolves excluded dependency contracts.
- [x] Fresh baseline typecheck/lint/existing four mobile suites/shared tests;
  exact output/exit/time retained. Added feature suites only after implementation.
- [x] V01/V02-field/V03-candidates-ranking/V04-data/V07-lifecycle/V08-pure-ranges
  gates pass; caller/accessibility/shared/strict-fixture checks and native query
  observation complete. Lint remains failed at the captured unrelated baseline.
- [x] Owned diff reviewed, rollback rehearsal and unchanged-user-input audit;
  task fixture servers/activity stopped, only added port mapping removed.

Context identities and read coverage:

| Input | Verified identity/coverage and finding |
|---|---|
| Git/source baseline | `phase-01/baseline/status.txt`, tracked/staged patches and `sources.json`; most app sources remain untracked user work. All 28 saved hashes and restore-to-scratch verified. No blanket restore or staging performed. |
| Packet | `phase-01/context.xml`, SHA-256 `0881fcfc4b627994e297ad2838312945279d83247a49deb9d6776865dae88797`; selectors/actual paths/source hashes in packet.json + baseline/sources.json. Includes mobile instructions/manifests, query/tests/field, contact/direct/queue contracts, preferences and event modules. No missing selectors or compressed bodies. |
| Complete Reader boundaries | packet-read-1..6: 195/195/195/195/195/80 lines, respectively 6552/6387/9646/8781/6665/2951 characters. Each read fully, in order; continuation crosses entries without omitting text. Original query/field/test contracts match saved packet bytes; current source changes supersede their baseline packet entries. No generated guidance overrides instructions. |
| Original-source dependency verification | `queue/db.ts` cache columns/indexes; `chat/query.ts` pending conversion/merge and queued temp IDs; `queue/localQueue.ts::getUnsentItems`; complete `chatList/query.ts`, `useChatList.ts`, preferences; `chats/directChat.ts` outcomes/preflight failure behavior; shared contact/direct types; `Avatar`, theme color/type tokens, field callers in forward/global/scoped routes. Baseline source hashes identify complete source files; relevant ranges were read directly before editing. |
| Instructions/conflicts | Repository/ancestor/hidden discovery found mobile AGENTS and Supabase migration AGENTS; both read fully. No applicable CLAUDE.md found. Actual routes are app rather than AGENTS' src/app wording, but this phase changes no route. Existing native/calling/account/organization work is preserved. |
| Final source identity | `phase-01/final-identities.json` marks changed/unchanged/owned originals and hashes all new application/test files. `owned.diff` compares against working-copy snapshots rather than HEAD. New dependency/lockfile identities unchanged. |
| Check baseline and final | Baseline checks JSON/logs; final-after-field (foundation 36 tests and existing regressions 29 tests, overlapping query suite), field-correction typecheck, regression-checks (shared149/accessibility6), prerequisite-regressions (chat-list9). All required assertions pass; lint remains identical 13 errors/3 warnings in seven untouched sources. |
| Native environment | Fresh MuMu name/config port confirms dologram / 127.0.0.1:16480. `native.log` shows network-fence probe, in-memory SQLite, 35 delivered matches/count, scoped30+pending1 and no exercised-process JS warnings/errors. Native timing and the raw cancellation-metric bookkeeping limitation are detailed in report.md. No full product UI/native10k pass inferred. |

Material discovery: the shared chat-list SQL has six placeholders but previously
received seven positional bindings. This prevented the required people adapter's
reuse on real SQLite. The single extra bind was removed; real-SQL people and
existing chat-list/preferences regressions pass. No broader SQL/contact-picker
refactor was performed. Deleted direct-chat reuse is permitted only as the
explicit-person reopening shortcut; searchable sources still exclude deleted
chat content. Blocked targets never re-enter through group candidates.

New lifecycle consumer contract: pass a stable loader that revalidates current
scope before reading, account/query/scope snapshots, screen focus as `active`,
and candidate IDs (including currently excluded targets) as `observedChatIds`
when needed for preference invalidation. Pending results stay separate from
delivered pages/counts and preserve message IDs/status. The old global page API
and initial-cancel zero-read behavior remain compatible. UI integration, history,
creation/opening locks, Markdown leaf ranges and full Back behavior remain the
next phases' obligations.

Framework contracts read this session:

- [Expo 57 index](https://docs.expo.dev/versions/v57.0.0/),
  [SQLite 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) and
  [Router 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/): typed async bound
  reads and API compatibility; default app route root confirmed, no routing edit.
- [Expo documentation index](https://docs.expo.dev/llms.txt).
- React Native 0.86 [TextInput](https://reactnative.dev/docs/0.86/textinput),
  [Text](https://reactnative.dev/docs/0.86/text),
  [Pressable](https://reactnative.dev/docs/0.86/pressable),
  [StyleSheet](https://reactnative.dev/docs/0.86/stylesheet): value/defaultValue,
  change/submit, nested text and touch bounds. Installed declarations plus
  typecheck confirmed absoluteFill; the removed absoluteFillObject was corrected.
- React 19 [effects](https://react.dev/reference/react/useEffect) and
  [version policy](https://react.dev/versions): docs are maintained per major,
  not per 19.2 patch; effect subscription/cleanup and stale-response rules used.
- [Jest29.7 timers](https://jestjs.io/docs/29.7/timer-mocks),
  [RNTL13 renderHook](https://oss.callstack.com/react-native-testing-library/13.x/docs/api/misc/render-hook),
  [Node24.13.1 SQLite](https://nodejs.org/download/release/v24.13.1/docs/api/sqlite.html).
  Installed RNTL13.3.3 signatures/implementation were also read to resolve its
  NoInfer prop typing and test-root behavior. No test dependency was changed.

No unresolved Phase 1 requirement or blocker remains. At Phase 1 closeout,
search-plan progress was 6/12 items (50%) and Phase 1 was 3/3 (100%); the Phase 2
supplement above updates the current total to 8/12 (67%). Broader project
progress is undefined. Remaining integrated runtime/connected-data/Markdown/
navigation/performance gates stay assigned to Phases 3–4. Historical
packets remain baseline evidence; do not reuse their old query/field bodies as
current implementation without checking final-identities.json and fresh hashes.

Prepared 2026-11-11, Asia/Manila. Scope is the [search implementation plan](../DoloGram_Search_Implementation_Plan.md). This is the single context index for this feature. Verified denotes source inspection, reported denotes old evidence, and proposed work remains unimplemented.

## Working-copy baseline and permitted artifacts

- Root is `G:\codebase\DoloGram`, PowerShell. Node 24.13.1 and npm 11.8.0 were read from the installed executables. No app/test/build/service/device commands were run.
- Initial `git status --short` lists most application/shared/schema/plan directories as untracked. `git diff --stat` and `git diff --cached --stat` have no changed-file entries. `git ls-files` lists README plus documentation v3–v6. Current untracked sources are user inputs, not generated trash or safely restorable from HEAD.
- The task created only `Plans/DoloGram_Search_Implementation_Plan.md` and this index. The initial outline was refined at that same plan path. This request only read application/schema/configuration files. Hash comparison detected concurrent user/other-task changes listed below. Those files were revalidated for search-relevant contracts rather than restored.
- Mobile AGENTS was read completely. Its Expo-version/docs, npm/Bun, navigation, lint/typecheck, and generated-native-directory rules apply to later implementation. Actual routes are in `apps/mobile/app`, superseding its stale `src/app` description. Supabase AGENTS was read for schema inspection context. No migration is proposed.
- Targeted discovery found these applicable instruction files. Cached AGENTS under `.tmp`/third-party packages belong to separate directories. Older phase-specific Repomix checklists are scoped to those phases and are not a repository-wide mandate for this search document.

## Context preparation and reusable material

Sequence followed was working-copy baseline, `rg` discovery, review of older context/evidence, narrow source reads, contract analysis, then original-source verification and hashes. No new source packet was generated because targeted originals and this manifest cover the feature. No token/usage savings are claimed.

`repomix-phase17-final.xml` contains older SearchField references, but literal path searches found no current `app/search.tsx` or `src/search` entries. Android Phase 16/17 indexes also show that original packets excluded tests. Consequently neither those packets nor their passing-check claims establish the current search baseline. Their index/report contents were inspected only as historical environment and verification evidence. Source contracts were checked directly. Initial combined output truncation was followed by narrower source/range reads for the contracts used below. No compressed source body supplies a required implementation detail.

No repository-wide context copy, generated guidance, SDK dump, application export, database snapshot, or screenshot was created. Exclusions are `.env*`, credentials/signing/session/account stores, generated native sources, node_modules package bodies, dist outputs, `.expo`, unrelated calling implementations and test-result payloads, and actual private message data. `package-lock.json` is hashed as dependency identity with only its mobile-workspace dependency section inspected. It was not packaged.

## Inspected locations and findings

| Area | Locations inspected and finding |
|---|---|
| Global/scoped/query/input | `app/search.tsx`, `app/chat/[chatId]/search.tsx`, `src/search/query.ts`, `src/components/SearchField.tsx`, and both search tests were read in full in this session. Global scans are already paged beyond 200. Scoped search uses a 200-delivered-message snapshot plus pending items, suppresses errors, and replaces its route on selection. Field controlled props can override display independently of internal clear state. |
| Entry/routes/callers | `MainHeader`, `DoloGramHeader`, navigation helper, and New Chat read in full. Root `_layout.tsx` stack configuration, chat-info QuickAction search route, pinned focus-message route, and forward SearchField call inspected at their original locations. Existing global entry passes originX and route is transparent with animation disabled. Existing ChatScreen focus/render/scroll and Jump to latest branches inspected by range. |
| History/organization | `chatList/preferences.ts`, `chatList/useChatList.ts`, `chatList/query.ts`, `chats/preferences.ts`, shared chat-list builder/types inspected. Account-specific organization serializes updates, blocked chats are filtered, and global search includes ignored/archived outputs. History is proposed, not present. |
| People/direct/lookup | `chats/infoQuery.ts`, `chats/useContacts.ts`, `chats/directChat.ts`, shared contacts/direct/profile repository read in full. `loadCachedContacts` does not anchor its rows to the caller's membership. `openDirectChat` is a non-atomic multi-row creation with cached lookup and resync conflict recovery. Search needs a scoped adapter and operation guards. New Chat's existing Find action uses exact username lookup. |
| Historical/Markdown | `chat/query.ts::loadChatSnapshotForMessage`, membership checks, delivered paging and pending merging inspected directly. Its historical query test read in full. `MessageText.tsx` and its tests read in full. `MessageBubble` prop/render integration inspected. Missing focus target falls back to latest; explicit search feedback must be additive. Pending messages use temp_id = message_id and need preserved scoped behavior. |
| Cache/queue/schema | `queue/db.ts`, `sync/cacheEvents.ts`, `sync/localCache.ts`, media model read in full. Lifecycle status/start APIs, localQueue init/getUnsentItems, queue event APIs, shared QueueItem fields inspected at relevant ranges. Database schema v7 already has the necessary message/membership/profile/media columns. Shared generated media types and migrations 014, 016 find_user, 024 delete-attachment sections confirm narrow lookup and media tombstones. Deployed migration state was not queried. |
| Auth/lifecycle | `src/storage/localData.ts` was read in full and `settings.tsx::handleSignOut` inspected. Sign-out calls clearLocalData, which clears SQLite rows. New feature history cleanup belongs in that path. Account session/switch modules read. Relevant AuthProvider account-generation guards inspected. Account identity must be present in request/history guards independently of cache composition. No credentials or saved-account contents were read. |
| UI/accessibility | Avatar, ChatRow, Button, Dialog, theme provider and token portions were reused from full/targeted session reads. Tokens cover colors/typography/spacing/motion. Pressable source test read in full and only scans app/components. Additional src/search controls need render assertions. Existing MessageText tests preserve image suppression and formatting. |
| Configuration | Root/mobile/shared manifests, mobile Jest/ESLint/TypeScript config, app config and EAS config read. Expo 57, Router 57, RN 0.86.3, React 19.2.3, AsyncStorage and SQLite are installed manifest dependencies. The final manifests also contain LiveKit/WebRTC dependencies and plugins from concurrent calling work. Root layout now imports/wraps CallProvider and registers its call route. Existing search route/stack settings and SDK pins remain as inspected. Presence does not prove the installed emulator artifact is compatible. |
| Environment evidence | Android plan sections 1–3 and relevant phase/workflow notes inspected. Calling plan current execution-rule section was read as a record of emulator-only, ADB-only, named-MuMu, artifact-reuse constraints. Phase 16/17 context indexes and Phase 17 report/baselines inspected. docs/builds and relevant docs/versions tables inspected. Historical device aliases and build allowance differ from current unconfirmed state. |
| Public framework/product references | Earlier session research checked Expo SDK 57 index, SQLite and Router references, React Native 0.86 TextInput/BackHandler docs, and public Messenger walkthroughs. The plan specifies future version-matched API checks. Earlier product captures span versions. Exact current Messenger geometry remains unverified. |

### Public references retained for Phase 0

- Product retrieval walkthrough with iOS screenshots dated 2024-09-16 — https://www.iphonelife.com/blog/32671/tip-day-how-search-message-conversations
- In-chat search walkthrough — https://www.adweek.com/media/messenger-how-to-search-for-messages-in-chats-on-mobile/
- History management walkthrough — https://www.aranzulla.it/come-cancellare-cronologia-messenger-1146809.html
- Expo versioned index — https://docs.expo.dev/versions/v57.0.0/
- Expo Router — https://docs.expo.dev/versions/v57.0.0/sdk/router/
- Expo SQLite — https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- Expo document index required by AGENTS — https://docs.expo.dev/llms.txt
- React Native input API — https://reactnative.dev/docs/0.86/textinput

These links are supporting references, not proof of live Messenger build identity or implementation acceptance. Preserve their source/date limitations in the reference checklist.

## Unresolved prerequisites and unrelated findings

B01 is version-specific visual-reference availability. B02 is current named-MuMu identity/artifact/service discovery. B03 is a confirmed isolated runtime fixture/remote target. B04 is fresh test/lint baseline and runner behavior. The plan assigns consequences and independent work to each. No user decision is required to continue planning.

The broader contact-picker behavior, existing direct-chat transaction gap, unrelated sign-up lint, historical release upload issue, calling work, and original-filename/AI/directory extensions are outside this feature. They are not new acceptance tasks. None was fixed.

## Second-pass audit supplement — 2026-11-11

- Reviewed the complete current plan, its D01–D09 decision log, this index, and mobile AGENTS. Read-only status/diff inspection confirms the same untracked-working-copy ownership constraint.
- Validated all 75 indexed source identities. All matched the saved SHA-256 values at audit start. Reused unchanged findings and historical evidence. No context packets, source snapshots, application outputs, or new context artifacts were generated.
- Targeted source reads addressed concrete audit questions only. `src/chats/directChat.ts::openDirectChat` catches cached lookup errors before continuing to create, justifying the search-side preflight guard. `src/chat/query.ts::loadChatSnapshotForMessage` and `src/queue/localQueue.ts::getUnsentItems` confirm the historical/pending target contracts. `src/search/query.ts` confirms batching, independent matching fields, and cursor behavior. Other unchanged original files were not reread wholesale.
- Confirmed plan defects AU-01–AU-06 were repaired in place. These cover phase assertion ownership/gates, honest memory bounds, preflight failures before creation, history timeout/durable reconciliation, explicit-clear handling for unsupported versions, standing authorization/isolation wording, and missing acceptance-to-work mappings. They do not add a feature, dependency, schema change, or unrelated repair.
- The user's latest standing authorization is authoritative for later assigned-emulator/test-account/data actions. Main environment remains MuMu Player `dologram`, ADB only. No physical-device or desktop-automation requirement was added. Separate backend infrastructure and repeated covered-action approval are not automatic prerequisites. Runtime target/artifact/credential facts remain unverified during this planning audit.
- Readiness is **Ready for execution** against the accepted adapted specification. Phase 0 preparation can start when execution is requested. B01–B04 affect later fidelity/runtime/check observations as documented and cannot turn unperformed checks into passes. Pending manual verification does not block independent implementation. No operational verification was attempted.
- Only the existing plan and this existing index were edited during the second pass. Document-only validation passed with 14 unique requirements, 12 work items, 12 verification groups, Phases 0–4, complete acceptance mappings, valid local links, and no undefined references or unclosed fences. This verifies document consistency, not application behavior.
- Final freshness validation found concurrent changes after the initial matching snapshot in `app/chat/[chatId]/index.tsx` and the calling plan. Only the chat parameter/focus/load/render/call-action integration and the calling plan's shared execution-rule section were rechecked. Search-relevant contracts and assigned-emulator constraints remain applicable. The two fingerprints below were refreshed. Revalidate subsequent changes at Phase 0 rather than assuming the working copy is frozen.

## Verification performed in this polishing pass

| Check | Actual outcome |
|---|---|
| Git/status/diff/instructions/source discovery | Passed as read-only inspection. Working-copy ownership and stale route wording recorded. |
| Current source/schema/config/test-contract inspection | Passed for the locations identified above. Planned behavior is distinguished from existing code. |
| Historical-results reuse | Classified as reported. No old pass is claimed current. |
| Input freshness | 75 identities captured at the final source review. Concurrent changes occurred in `package-lock.json`, `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/chat/[chatId]/index.tsx`, `apps/mobile/src/chats/preferences.ts`, `apps/mobile/src/auth/accountSession.ts`, `packages/shared/src/strings/index.ts`. Current mobile dependency/configuration sections, shared search/New Chat/chat-info strings, and root search/call integration were re-read. Manifest below uses refreshed identities. Recheck these sources at execution start. |
| Runtime lint/typecheck/Jest/Vitest/export/build | Not run. Planned Phase 0 establishes fresh baselines. No migrations, dependency installation, services, device actions, or application writes occurred. |
| Document traceability/link check | Passed — read-only validator found 14 unique requirements, 12 defined work items, 12 verification groups, Phases 0–4, and no undefined work/verification references, missing requirement mappings, broken local Markdown links, or unclosed fences. Application tests were not run. |

## Source identity manifest

Paths below are repository-relative. Hashes identify complete files, including existing untracked inputs. The inspected-location table specifies which large-file portions were actually read. Hashing a file is not a claim that all its contents were inspected. Re-read changed relevant sections and their callers before execution, then update only affected findings and hashes.

| Source | SHA-256 |
|---|---|
| `apps/mobile/AGENTS.md` | `B7D381DD55800D242252E8BF89A40B026586D254E34908210931BC35582396A3` |
| `supabase/AGENTS.md` | `CE08BCBDF1499B4C6A6046DCC1BA9FF689ED2A40C8B2856DB285CA78E994B055` |
| `package.json` | `7036F31C6E8488F38F82055803551E45E3C886005BF921F78EB9A0CCD08A3E67` |
| `package-lock.json` | `460920176DDD2313D5B6AE4D0E6145AAB186A21408B3026C486E5A74D1C0622F` |
| `apps/mobile/package.json` | `5BBCB737D3EC3A0CF4CD53673FC1A7744F15832FA66984F91CE8051BC2917C52` |
| `apps/mobile/jest.config.js` | `E74EC653B4E00F652A6C5B85C68A22B042A3844A8F5A362E58031BDD045C2218` |
| `apps/mobile/eslint.config.js` | `F2099DA1B25AA9E62DEFB44FFBEB8A4290EF7F905748A6849928A970ADF5390D` |
| `apps/mobile/tsconfig.json` | `1E730311369DD5E6014BFD5F64F0DF0D1CD7C15719D4A015486E647D8D488C06` |
| `apps/mobile/app.json` | `56E6165BE3CDD14D0735742D811B95FE46CA03B774041A9A97292ECD56A55DF6` |
| `apps/mobile/eas.json` | `4F9DF1BDE8807FA717F505FEE973AA6C640387C3D09E26D95E8F9F49A17FE899` |
| `apps/mobile/app/_layout.tsx` | `83C0A6E9C0953EE856AEBBE1EA21C13CF58340BA24680171A3C690F6A23C376D` |
| `apps/mobile/app/search.tsx` | `F77D91E5F467B8D447957CE9D0E570903C86C156F73462FCB1DC4AD78F731699` |
| `apps/mobile/app/chat/[chatId]/search.tsx` | `19F189BD0A81A5EDE74F5AC7C7F657F8B9CB22635F5D819F862AA22642A459CA` |
| `apps/mobile/app/chat/[chatId]/index.tsx` | `1D35C5D776BD6491C59E4892FFB32C9B1FC944118B0584DDE777091DEEF19D0A` |
| `apps/mobile/app/chat/[chatId]/info.tsx` | `9A82A3672ED83CD6B9507D863DA9FE4C3750630DBF6613571DD98DB230D2BDB8` |
| `apps/mobile/app/chat/[chatId]/pinned.tsx` | `6BDACCE75F59A747445698FA7D7F91321E85B444C79AE04B6EC51CABA2FF92C4` |
| `apps/mobile/app/forward.tsx` | `45CEDB863860D8104884E16492204EB10CEAC60CFF014BB0C623BB3FB027D9DB` |
| `apps/mobile/app/new-chat.tsx` | `C7F4504E0C977257FB5FC06BCC2804F5A16A6A0FEE36088505265D28C68D7919` |
| `apps/mobile/src/search/query.ts` | `7B584556CBC2139516F75A50C928351B9B9F3374ECE2B2E88345A82D86A07D08` |
| `apps/mobile/src/search/__tests__/query.test.ts` | `24011DE9EB4771482271C75F76F581A7EFA4A31484928C650F2462E8F36F7935` |
| `apps/mobile/src/search/__tests__/SearchScreen.test.tsx` | `10417DE6DE16EC898BEEA3C49F5472DB77134C423FE96C8046367905262EF046` |
| `apps/mobile/src/components/SearchField.tsx` | `410C15B4412BEBC2157E83F5D086CE6CA7BAA8B5A6B58BB4AE634A319B7BEC0B` |
| `apps/mobile/src/components/MainHeader.tsx` | `B1C2B4E6678328F0B8D37182F750797C15C91069CAD2C45A8657301B6426754C` |
| `apps/mobile/src/components/DoloGramHeader.tsx` | `8524635D7E102A9A9674FBDE9BC39F9DC03B0D960F646C16521502CD640F6706` |
| `apps/mobile/src/components/Avatar.tsx` | `0A6C56666BB759E173918B8F7EDF65B6BA426614E48C1C026D1C9FDA1C6C024F` |
| `apps/mobile/src/components/ChatRow.tsx` | `9B75F93781AE8E7107173AF0084BCF0A31D14F84E5AD02355E3DF4BD17100CE9` |
| `apps/mobile/src/components/Button.tsx` | `3480EB99C3CB1D364BB0F121F84EEA6FA3608AB66ABD1CED048E34744DDAEFED` |
| `apps/mobile/src/components/Dialog.tsx` | `B40C16F1C820769A5D12CC22E92D6D57CFAD986FF8DEDE9E17B0B70CAEA728E3` |
| `apps/mobile/src/components/MessageBubble.tsx` | `880CE451C164F1C1F1B76F409BD37ACBBA6DA440276865EB005DA5BF588145C6` |
| `apps/mobile/src/components/MessageText.tsx` | `C20FAA21DD6FBA35C1B4ECFFA98ACD999FA1249AF15FB2F336597CD5214DC5A4` |
| `apps/mobile/src/components/__tests__/MessageText.test.tsx` | `934753C74E3D70BF49D31B067E514B44BFFB9FB68C8C1ABDB290D5D6AA7B0A07` |
| `apps/mobile/src/__tests__/a11yPressableSource.test.ts` | `E82AD39CAEC1EEC0FA501E8100706536A553E2DF58437469DAEC0F610CD4005B` |
| `apps/mobile/src/components/__tests__/a11yLabels.test.tsx` | `FAAF42E30D3B182ECE94B1B745A405A2C91A388834B96834BB5B27547F04ACFF` |
| `apps/mobile/src/chat/query.ts` | `63BAB823C9C23053F442DA2BFCCFECBA630E9D5F0845D5F8DB6C44F9070A77AA` |
| `apps/mobile/src/chat/__tests__/query.test.ts` | `B301E74F660C1C0AC4BE02F7E14D11946C513F518229356FEFC15688E4595D12` |
| `apps/mobile/src/chatList/useChatList.ts` | `AE45A78C34F3E201A3DD46F2B18710492B5AE22E091EB76B27576AC7F2E005BD` |
| `apps/mobile/src/chatList/query.ts` | `413CDC548248C2B1EE314E13DFA8080F7896F426F4B375533BA9E050DE177470` |
| `apps/mobile/src/chatList/preferences.ts` | `7FC643636936EF2CED3261137B592A6D6201C35764EB9B31B4B7416B1A5661DC` |
| `apps/mobile/src/chats/useContacts.ts` | `C313C7D6A9C03D9D7F7007990BE70D8DF863497F559D7E275190D5D6944AF926` |
| `apps/mobile/src/chats/infoQuery.ts` | `33F58E3E54710B0351E34609235FCE315C02841C1C2CCFD9E4B71275F7896691` |
| `apps/mobile/src/chats/directChat.ts` | `BECC55A84FADF155020CEF4C13E7A0E3C22BEA75FD478A7BE271F847B3654336` |
| `apps/mobile/src/chats/preferences.ts` | `680E5B8A271CE1B27D2E5FB1A8B530FB34608921897380D7ABAFFC7E6F505228` |
| `apps/mobile/src/queue/db.ts` | `CC054672695997F320A9DF5EC021E3CE9B28869211DA7B825E56A5C348585B22` |
| `apps/mobile/src/sync/cacheEvents.ts` | `ECA7C7A580E18AD0FD5B5F8B8F1C0B8B582A4A46740522D781F0B0CB63A9F942` |
| `apps/mobile/src/sync/localCache.ts` | `066D909C6F16222206FB31FEB05FF393CB264E68FE229E80D36319BB22FA1D93` |
| `apps/mobile/src/sync/lifecycle.ts` | `EE3AB3E84390B70637D5F7877943DCB132A75F26BE0F991250A833C2A8E70825` |
| `apps/mobile/src/media/model.ts` | `00FEC1BC8446FEB45A4B8A35E4B1A93A1C9A79BF6D6737F4D37A01EFA18BCBFE` |
| `apps/mobile/src/auth/accountSession.ts` | `994724D416E7FDAAEE3A1E98DA56F5617B1AA1F8FB826DD0CAA4B9B654855F79` |
| `apps/mobile/src/auth/useAccountSwitch.ts` | `463EA83A268B2260E110FFFD28F4E270C1A9D83434D81A81D7963A92D7D926D9` |
| `apps/mobile/src/navigation/goBackOrReplace.ts` | `3B6AEB4BC8E933E8E1BA41B0EF1340991E13AE9AD9E26B5070F1657E866FB29F` |
| `apps/mobile/src/theme/ThemeProvider.tsx` | `FEC9875CA4D1BDF7AAE179406715B13AB3711BE360AD3997F01C93CED003B5F1` |
| `packages/shared/package.json` | `3C8AF956C6B43D97A4826DFE89B7D8C0ED4D6167F7A8C72946648F8A4BB2F4CC` |
| `packages/shared/src/chats/contacts.ts` | `EBDB863568D63474037D9C5A85454322A314D5A83A8FE363826666E85047B518` |
| `packages/shared/src/chats/direct.ts` | `E8A11F938028E58AE02DC60310DE4AA3F8AE9D7A7C102F01AFE55DBEBB22344A` |
| `packages/shared/src/chatList/build.ts` | `E49CB5D3D33FA5EB576FFBBE0C6DD5ACBC65FDA677F9EEBB8C6875E70020BFF9` |
| `packages/shared/src/chatList/types.ts` | `E1321BAF4CCE91282AFE009A7E7FDF6D08890777B8E71668DDCC5779483248B6` |
| `packages/shared/src/db/repositories/profiles.ts` | `2430FE537AB37DF8E6940BBB3653172E36CEA2DAAD05215B9E76182540FBC95A` |
| `packages/shared/src/db/database.types.ts` | `7013AA617F4C770EB28EC44437A8F028D073F80B4AF718F562FB04328FDA9A06` |
| `packages/shared/src/strings/index.ts` | `7E88D08EE060A740E4D4983506243E295F5EBB7E29594E231EAE163CA6C0CB02` |
| `packages/shared/src/theme/tokens.ts` | `A7DE58A88449002918DA3FF38DF52636BC2442D662422705ABD869EA51887138` |
| `supabase/migrations/014_create_find_user_rpc.sql` | `E0A11A47AF21355F0425BCF3954AAD87659CD632524A97A7238CC06F2EC892FA` |
| `supabase/migrations/016_align_messenger_schema.sql` | `16B4819DA0E85E1C456BC5E2595C5ECDBA079259AB8E55B4A7DAB3B0C969B9F6` |
| `supabase/migrations/024_soft_delete_chat_attachments.sql` | `7CCBAB6B05B90A303A27312593479AD1619FC22DBEA77F22FDBA23CF976FC505` |
| `Plans/DoloGram_Android_Implementation_Plan.md` | `44026E9DAE90482327526E72C773A8AC42E7C19EFBF3F28F175278F1A933101F` |
| `Plans/DoloGram_Voice_Video_Calling_Implementation_Plan.md` | `7C008C3FDCCDEE2B3472A8AFF0A672F24BB7425F8C6F8150DB4A2CFA6F25CD2F` |
| `docs/test-results/android/phase-16/context-index.md` | `09AC22C54E30DF898676FA17E36480E9326065BAD8D60537434D4DA38BC1345D` |
| `docs/test-results/android/phase-17/context-index.md` | `F0B071D74A5393647F6A1FCCBBD3C74AFE61AB2DA92E58055AB5587E0368AF6A` |
| `docs/test-results/android/phase-17.md` | `6A255189BCC2B039CA77771D1DDE44B434DA496C51502937F2A8EBDF9CF6EC28` |
| `docs/builds.md` | `08C61B408C75DA000B6F538B21DA82D2445AA1773766A4E7DF5B1B7371F6661B` |
| `docs/versions.md` | `A5B9FB913EDBE12C817E521537C0364FA204983EEB2E8474A9AD765E20CA4985` |
| `apps/mobile/src/queue/localQueue.ts` | `1B5C2AD7DBE678C8C77CF4CC014BF2F3ADD55EEEB3FDADED1D7D363E70A8035E` |
| `apps/mobile/src/queue/events.ts` | `6ACF3D8A54C1FB07B3AF4F4790AA8A544623B1CA4ECD0D09656B788B0146A9D7` |
| `packages/shared/src/queue/types.ts` | `7A74C99B7EDF9BD78078738BC1DDB609FCFBD04E406C232E6C4583DD52922ECD` |
| `apps/mobile/src/storage/localData.ts` | `1EE6E0BA8C929A9D29CCA3551029DBAF7AC634AF8F7064ADCFA4D777EE866A44` |
| `apps/mobile/app/(main)/(tabs)/settings.tsx` | `1E284E3A30D300203BC185CC171333FF3BE04C61E5E3C1581A414C5BB2F409BF` |

Concurrent changes are existing user work, outside this request. The updated source fingerprints invalidate earlier artifact-compatibility assumptions. Search itself plans no new native dependency and does not repair calling integration. Follow-up reads confirmed that ChatScreen retains its historical-focus/query/render contract while adding voice-call actions, accountSession adds call teardown before a session switch, and chats/preferences adds `subscribeChatPreferenceChanges` with unsubscribe handling. The plan preserves those consumers and uses the new preference notification API for search invalidation. Shared New Chat/chat-info strings and SDK pins retain their inspected contracts. A final validator detected another ChatScreen fingerprint change during active concurrent editing. Its parameter, historical-load, focused-row, Back, and call-action branches were re-read, and the manifest entry was refreshed. This manifest identifies inspection snapshots rather than asserting an immutable working tree. Phase 0 must refresh any subsequently changed source or dependency before editing it.

## Phase 0 execution context — 2026-11-11

Current execution: **Complete, 3/3 items (100%)**. Search plan: **3/12 (25%)**
by predefined item count. No later phase started. Historical planning statements
and the preceding manifest remain their dated inspection snapshots; current
execution identities and evidence below supersede them where changed.

### Scope, prerequisites and workflow checklist

- [x] Phase 0 only: recoverable inputs, check/toolchain/device/artifact baselines,
  public-reference adaptation and safe timing fixture. No earlier phase exists.
- [x] Read complete current plan across bounded ranges and both applicable
  AGENTS. Ancestor/hidden discovery found no other applicable AGENTS/CLAUDE.
  Mobile AGENTS' src/app sentence is factually inconsistent with existing app
  routes; no product routing change was made in this phase.
- [x] Git baseline → narrow ripgrep discovery → prior Reader identity validation
  → scoped Repomix → complete bounded XML analysis → original-source verification.
  Repowise was unavailable and unnecessary; no graph freshness was assumed.
- [x] Existing confirmed scripts run before product changes; exact logs/exits
  captured, failures diagnosed without weakening assertions. Final source checks
  and evidence-fixture checks recorded separately.
- [x] Acceptance: all three preparation items verified; gaps assigned to V11;
  task-owned processes/ADB mapping cleaned; snapshots/restore integrity verified.

### Current context inputs and identity index

Evidence root: `docs/test-results/search/phase-00/`.

| Evidence | Identity/coverage and finding |
| --- | --- |
| `baseline/git-status.txt`, tracked/staged patches, tracked-files/head | Working-copy ownership recorded. Most app inputs are untracked and cannot be restored from HEAD. Patches are empty. |
| `baseline/sources.json` and `baseline/source/` | 72 relevant exact pre-edit copies, SHA-256/byte counts, 1,176,525 bytes. No credentials, APKs or unrelated directory copy. `recovery.md` defines per-file recovery; restore-to-scratch passed. |
| `source-refresh.json` | All 75 historical identities rechecked: 74 unchanged initially, separate calling plan changed. Prior findings reused only for unchanged, relevant contracts. |
| `packet-manifest.json`, `context.xml`, `repomix.log` | Cached global Repomix 1.18.1, no compression, parsable XML, default security/exclusions intact. Exactly 13 intended/actual entries, no unexplained omission; 14,049 estimated packet tokens (not measured model usage or savings). |
| XML complete read boundaries | `packet-read-1.txt` 1–170/10,951 chars; 2:171–350/8,977; 3:351–530/7,173; 4:531–710/10,586; 5:711–890/8,958; 6:891–980/4,262. Every chunk ≤180 lines/11,000 chars; all six fully read. All decoded entries equal their current originals. |
| Packet SHA-256 | `8992e012a17905811e84a24e77547f06cb5effc75376aca27117e0e12c033538`. Source entries/selector string/hashes are in packet-manifest. No compression gaps; no repeat packet was needed. |
| `original-source-identities.json` | Targeted original contracts read beyond packet: direct-chat cache-failure/create recovery; broad contact query; chat-list organization; historical/pending helper; field/forward/header/info/pinned callers; clearLocalData; call native fallback; root auth/sync start; pure shared client definitions; configured backend. |
| `concurrent-sources.json`, `concurrent-source/`, `concurrent-source-2/` | Later user changes read by diff and preserved: ChatScreen video-call action; shared calling strings, then missing-native call wording/carriage-return bytes. Current hashes are in this supplemental manifest; original copies remain in baseline. Normalized follow-up diff is in concurrent-refresh-analysis.json. Search focus/navigation/query and search strings unchanged, so packet entries/analysis remain valid. |
| `toolchain.json`, `framework-notes.md` | Installed Expo 57.0.32/Router 57.0.30/SQLite 57.0.4/RN 0.86.3/React 19.2.3/Jest 29.7.0; Node 24.13.1/npm 11.8.0. Relevant versioned SDK/SQLite/Router/TextInput/BackHandler/native-entry docs and installed signatures read. |
| `screen-checklist.md` | Every Section 4 state finalized as DoloGram adaptation; public date/build/asset limits recorded. iPhoneLife is Apple Messages and excluded. Current Messenger pixel parity unverified. |
| `runtime/assigned-runtime.json`, `local-apk.json` | MuMu name/config port mapping and explicit ADB package/OS/ABI/APK hashes verified. Installed/local APKs differ. Relevant native query loading exercised; no entire-product/calling compatibility claim. |
| `runtime/native-timing.json` | Final offline/non-development native fixture: in-memory path empty, network fence verified, all 35 synthetic old matches (30+5), first page 45.51 ms/total 51.34 ms; native reads 200/60/5 rows; already-cancelled query zero reads; final console clean. Not UI/stress/JS-CPU evidence. |
| `runtime-app/`, `recovery.md` | Evidence-only custom main outside product routes/workspaces; uses existing installed modules and actual query. No auth/queue/sync/notification imports or connected fixture mutations. Database closes in finally; stopped activity releases fixture-only global network guards. |
| `baseline/checks/`, `baseline/writable-cache/`, `baseline/jest-diagnostics/`, `baseline/feature-suites/`, `baseline/isolated-accessibility/` | Exact initial commands/results/logs. Typecheck passed; initial lint returned 0; shared 149 tests passed. First Jest failed EPERM before assertions; writable-cache combined command timed out. Diagnosed config/list discovery; split runs passed six suites/29 tests. No failing full command relabeled passed. |
| `final-checks/`, `lint-diagnostic-sources.json` | Final workspace typecheck and strict fixture typecheck passed. Explicit fixture ESLint passed. Final mobile lint failed: 13 errors/3 warnings in seven task-untouched files; snapshotted affected info/preferences/config bytes match baseline. Initial/final lint discrepancy unresolved; no clean overall lint claim. All diagnostics captured before any product implementation. |
| `runtime/stopped-server.json`, `runtime/cleanup.json`, `validation.json` | Task-owned offline server/activity stopped; added 8084 reverse removed, prior mappings preserved at cleanup. A later observation found emulator/mapping reuse under another ADB host but no task fixture server/listener; that later state was left untouched. Source/packet/snapshot/link/scope integrity validation and final owned diff recorded. |

Fully read packet entries: global search 226 lines; scoped search 83; SearchField
108; query 86; query tests 92; screen tests 83; both AGENTS; three manifests;
app.json; Jest config. Findings: global batching/cursors already exist; scoped
search has the 200-row limit/silent error/replace navigation; SearchField's
internal value can disagree with supplied controlled props. Those remain later
implementation tasks and were not changed in Phase 0.

### Verification limits and unresolved questions

P0.1 entered partially done, P0.2 not started, P0.3 partially done. Their detailed
requirement-by-requirement entry/final classification is in `report.md`. No phase
credit was inferred from prior status labels.

The original 8082 Metro endpoint stopped serving; an ADB client launch reported
unexpected end of stream, without a captured native-module error signature.
The task did not restart that service. Its separate offline fixture used 8084.
Initial development-mode fixture guards blocked HMR/SQLite DevTools, creating
fixture errors; a justified non-development rerun omitted those clients and was
clean. Both diagnostic and final results are retained, not conflated.

Broader V11 product screens, connected disposable account/chat isolation, current
whole-app native loading and 10,000-message stress observations remain pending
their later-phase execution. The configured backend matches the supplied test
script but does not itself prove connected data isolation. Offline fixtures
provided the permitted Phase 0 alternative. No new authorization or credentials
are needed for Phase 1 source/unit work. Exact current-Messenger build geometry
and the initial/final lint outcome difference remain unverified. No unrelated
calling/lint repair, commit, push, upload, migration or deployment was performed.


### Phase 0 refresh revalidation — 2026-11-12, Asia/Manila (append-only)

Phase 0 (P0.1–P0.3) was re-executed against the current post-Phase-4 working copy;
no later phase was begun or altered and no application source was edited.

| Evidence | Identity/coverage and finding |
| --- | --- |
| `refresh-20261112/sources.json`, `refresh-20261112/source/` | Current-working-copy generation: 69 search/shared/config/instruction/plan files, 1,335,842 bytes, per-file SHA-256 plus byte counts. All copies re-hashed with zero mismatches; restore-to-scratch rehearsal passed; zero live drift between capture and validation. |
| `refresh-20261112/git-status.txt`, `head.txt`, `diffstat.txt`, `tracked-search.diff` | HEAD `d906bff3`; working-copy status and a 200,901-byte diff for tracked search-relevant paths. No reset, clean, commit or push was performed. |
| `baseline/sources.json`, `baseline/source/` | Unchanged 2026-11-11 pre-implementation generation, all 72 copies still matching their recorded hashes. 32 live files still match; 40 changed through Phases 1–4. |
| `refresh-20261112/checks/` | Fresh V00/V10: typecheck passed (33 s); lint failed 21 problems/9 non-search files; shared passed 21 files/154 tests; targeted six-file mobile run failed 1/37 (`a11yPressableSource` → `VoiceNotePlayer.tsx:69`). Exact logs, per-check JSON and `diagnostics.json` retained. |
| `refresh-20261112/runtime/assigned-runtime.json` | Assigned target `127.0.0.1:16480` (SM-S908B, Android 12, x86_64), `com.dologram.app` 1.0.0, reinstalled APK SHA-256 `13d4ccee…7468` (was `fb5aef22…0331`). `emulator-5556` untouched. |
| `refresh-20261112/runtime/native-timing.json` | Unchanged offline fixture importing current `searchCachedMessages`: 35/35 old matches, 51.47 ms first page / 57.10 ms total, 200/60/5-row batches, 0 reads after abort, 0 console errors/warnings; in-memory DB and network fence verified; task process/activity/reverse removed. |
| `refresh-20261112/validation.json`, `report.md`, `scripts/` | Scope/validation facts, dated report, and the reproducible capture/verify/integrity scripts used for this generation. |

Baseline deltas vs 2026-11-11: lint 13/3 → 21 problems (concurrent `Avatar.tsx`, `FloatingActionButton.tsx`, `info.tsx`, `nicknames.tsx`), shared 149 → 154 tests, and a new failing `a11yPressableSource` assertion in concurrent voice-note work. No search-owned file has a lint or test failure. Connected fixtures, themes/large text/keyboard/native Back/retained scroll, 10,000-message stress and exact Messenger geometry remain later-phase (V11/V16, B01) work.
