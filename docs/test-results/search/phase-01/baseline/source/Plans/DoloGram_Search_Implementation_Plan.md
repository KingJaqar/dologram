# DoloGram Messenger-style mobile search implementation plan

Prepared and polished on 2026-11-11, Asia/Manila.

**Status — second-pass audit complete. Ready for execution when implementation is requested. Implementation and operational verification have not started.** This audit edits only this document and its [context index](context/DoloGram_Search_Context_Index.md). The user's standing emulator/testing authorization applies throughout later execution. This planning-only request does not start execution.

## 1. Goal, scope, and evidence labels

Reproduce the Messenger search experience through recent searches, grouped conversation results, scoped message snippets, and navigation to the original message. Global and scoped search share matching and presentation rules. Preserve DoloGram's existing account isolation, offline cache, chat organization, Markdown, and navigation behavior.

**Verified** identifies current source inspection. **Reported** identifies historical evidence that needs revalidation. **Proposed** identifies the executable behavior selected by this plan. **Unresolved** identifies a prerequisite with a consequence and next action in Section 9. All implementation requirements and acceptance criteria below are proposed work.

The visual adaptation carries forward the earlier plan's DoloGram charcoal/ivory palette, Inter typography, and existing icons. Messenger supplies the screen hierarchy, rounded field, avatar-led rows, recent-history management, and conversation-first message retrieval. All/People/Groups/Messages filters and the ranking rules are DoloGram design choices. The research does not verify those exact controls on every current Messenger build.

Supported execution target is the existing Android Expo app on the assigned MuMu Player instance named `dologram`, package `com.dologram.app`, using ADB only. Shared React Native code must retain its existing iOS branches and type compatibility. Physical-device and iOS-device testing are not prerequisites under the recorded emulator-only restriction.

Feature scope covers local synced messages, currently eligible contacts/groups, recent history, the existing exact-username lookup, snippets, highlighting, and historical navigation. Shared media browsing remains the existing chat-info destination. Full-name remote directory discovery, assistant answers, OCR, audio transcription, original-filename search, new date/sender filters, new backend APIs, schema migrations, unrelated navigation redesign, and calling work require separate scope. The existing media model supplies attachment-type labels and has no original-filename column.

## 2. Working-copy baseline and verified findings

The working copy is the baseline. `git status --short` shows most application, shared, schema, and plan directories as untracked. Tracked and staged diff statistics are empty. `git ls-files` lists README and older documentation files, so committed history cannot restore the current application. Preserve relevant untracked inputs before execution. This request modified no application files. Concurrent calling work changed manifests, app configuration, shared strings, and root route integration during inspection. Their search-relevant contracts were rechecked and their latest identities are recorded in the context index. Revalidate those identities again at execution start.

| Finding | Current source and implication |
|---|---|
| Global search already searches beyond 200 rows | `apps/mobile/app/search.tsx` and `src/search/query.ts` use 150 ms message-search debounce, 200-row scan batches, 30-match pages, `(createdAt, messageId)` cursors, Unicode NFKC normalization, nickname/type matching, and AbortController checks. Extend these paths. |
| Scoped search has a different data window and error behavior | `apps/mobile/app/chat/[chatId]/search.tsx` reads `loadChatSnapshot(..., { limit: 200 })`, includes pending queue items from the snapshot, swallows read errors, and replaces itself when opening a result. Remove the history limit and silent failure while retaining supported pending-message behavior. |
| Membership and organization already affect search | `useChatList` returns active, archived, and ignored items, excludes blocked chats, and uses local deleted preferences. Global search currently includes all three returned lists. Preserve these inclusion rules. |
| Existing contact reads are broader than the new search needs | `src/chats/infoQuery.ts::loadCachedContacts` selects every cached member other than the caller, without joining the caller's membership or the search allowlist. Search requires a scoped adapter. Preserve the existing group-picker callers. |
| Direct-chat creation already has error and conflict handling | `src/chats/directChat.ts::openDirectChat` looks up cached direct chats, then creates rows and resyncs after second-member conflicts. Reuse it, guard repeated taps, and surface its failed outcome. Its multi-row operation is not an atomic backend transaction. |
| Historical navigation already exists | `src/chat/query.ts::loadChatSnapshotForMessage` loads bounded surrounding history. Missing targets fall back to the latest snapshot. The chat screen highlights a row background but currently receives no query for text highlights. Preserve helper compatibility and add explicit search-target availability feedback. |
| SearchField has multiple callers | Global search, scoped search, and `app/forward.tsx` consume it. It owns internal text and passes remaining TextInput props afterward. Controlled/prefilled support must synchronize rendered text, clear-button visibility, callback timing, and internal state. |
| Markdown is a supported message contract | `MessageBubble` renders `MessageText`, which provides formatting, image suppression, code styles, and URL-scheme restrictions. Add highlighting within this renderer. |
| Runtime and commands are established | Current manifests specify Expo 57, Router 57, React Native 0.86.3, React 19.2.3, npm workspaces, Jest mobile tests, and Vitest shared tests. Actual routes live in `apps/mobile/app`. The `src/app` wording in mobile AGENTS is stale. |
| Concurrent native work affects artifact assumptions | Mobile manifest/config now also contain LiveKit/WebRTC packages and Expo plugins, and root layout integrates CallProvider. Search needs no new native dependency, but compatibility of the whole current app with an older client must be established independently. Preserve the concurrent work. |
| Sign-out is an existing local-data cleanup consumer | `app/(main)/(tabs)/settings.tsx::handleSignOut` calls `src/storage/localData.ts::clearLocalData`, which currently clears queue/cache rows. Integrate new search-history cleanup into that established operation and invalidate stale history writes. |
| Historical check results are not current passes | Android Phase 17 reported passing typecheck/shared tests, existing sign-up lint findings, and a hanging full mobile Jest run. The current source includes later work. Re-establish all relevant baselines before implementation. |

Source paths, inspected locations, SHA-256 identities, freshness limits, and inspection outcomes are centralized in the context index. Historical Repomix packets omit the current global/scoped search paths searched during this review. They are supplementary references rather than a current feature packet.

## 3. Requirements and acceptance matrix

Every requirement maps to execution work in Section 6 and verification in Section 7. No criterion is recorded as passed by this plan.

| ID | Required behavior and observable acceptance | Work | Verification |
|---|---|---|---|
| SR-01 | Open search from the existing header, focus its rounded field, type, submit, clear, and go back. Clearing immediately cancels the active query and restores suggestions/history. Direct entry without `originX` renders correctly. | P1.2, P2.2 | V02, V09, V11 |
| SR-02 | With an account that belongs to chats A and B, results include permitted active, archived, ignored, and Saved Messages content. Another account's chat C, blocked chats, locally deleted chats, deleted messages, and deleted attachments do not supply searchable content. Known people are derived from allowed chats with a caller-membership join. | P1.1, P1.3, P2.2, P3.1 | V01, V03, V07 |
| SR-03 | People and Groups show relevant names once per entity. Exact matches precede prefixes, then other substrings, with deterministic tie ordering. A known group member without a direct chat can open/create one. Existing direct chats open offline. New-chat creation and remote username lookup give explicit offline/failure feedback. Repeated taps launch one operation. | P1.3, P2.2 | V03, V09, V11 |
| SR-04 | A keyword in 35 delivered messages older than the latest 200 produces the same 35 delivered matches in global/scoped matching. A Messages conversation row reports the completed total. Counts remain marked as counting until complete. Pages have no duplicate or missing messages at tied timestamps. Scoped pending items remain searchable, status-labeled, account-scoped, and deduplicated against delivered echoes. | P1.1, P3.1 | V01, V04, V07 |
| SR-05 | All shows up to three rows per nonempty section and See all where more exist. People, Groups, and Messages show the full relevant category through virtualized lists. Selecting a Messages conversation opens scoped snippets with the query prefilled. | P2.2, P3.1 | V02, V05, V11 |
| SR-06 | Opening a result records its person/conversation in account-local device history. History is unique, newest first, capped at 20, survives ordinary reopening, and supports removal and confirmed clear-all. Failed writes preserve the last durable list and offer retry. Unavailable entries are omitted from display. Existing sign-out/local-data clearing removes the new history keys and prevents stale writes from restoring them. | P2.1, P2.2 | V06, V07, V11 |
| SR-07 | Both scoped entry paths show sender, date, and contextual snippets. Query occurrences in snippets and the selected message are highlighted legibly. Unicode normalization and case expansion do not highlight unrelated characters. Markdown, links, code, and message actions continue to work. Sender-only/type-only matches explain their source. | P1.1, P1.2, P3.1, P3.2 | V04, V08, V11 |
| SR-08 | Global results → scoped results → message context → Back restores scoped query, pages, and scroll, then global query/filter/pages/scroll. Chat-info entry returns through its own stack. Missing/deleted targets show an unavailable message with a return action. Existing pinned-message navigation and Jump to latest retain their behavior. | P2.2, P3.1, P3.2 | V05, V09, V11 |
| SR-09 | Local results remain usable offline. An empty query, completed zero-match query, unfinished scan, unavailable scope, read error, timeout, and history-write error each have truthful feedback. Failures expose a bounded explicit retry. They never appear as successful zero results. | P1.1, P2.1, P2.2, P3.1 | V02, V04, V06, V09 |
| SR-10 | Rapid query changes, chat changes, sign-out/account switch, late reads, and cache changes cannot display or navigate using stale account/query/scope data. Edits/deletions refresh counts and snippets. Scoped queue transitions refresh pending matches. Unmount/blur removes active listeners and timers as appropriate. | P1.1, P2.1, P2.2, P3.1, P3.2 | V07, V09 |
| SR-11 | Screens follow Section 4 in both themes, at compact width and enlarged text, with safe areas, keyboard visibility, reduced motion, labeled controls, selected filter states, and legible highlights. Every icon action has a non-overlapping touch target of at least 44 logical pixels. | P1.2, P2.2, P3.1, P3.2 | V08, V10, V11 |
| SR-12 | Text updates immediately while message work is debounced by 150 ms. Scans read at most 200 source rows per batch, delivered pages contain at most 30 matches, and aggregation retains one summary per conversation. Retained result memory grows with explicitly loaded pages and eligible conversation summaries, without eagerly loading the full message history. A 10,000-message fixture remains scrollable and cancellable. Deadline/retry behavior releases or invalidates requests without spawning overlapping retry loops. | P1.1, P4.2 | V01, V07, V11 |
| SR-13 | Existing forward-search, chat-info, pinned-message, direct-chat, local-data cleanup, and Markdown callers pass relevant regression checks. New strings follow shared-string conventions. Only feature-obsolete code is removed after caller checks. | P1.2, P2.1, P2.2, P3.2, P4.1 | V06, V08, V09, V10 |
| SR-14 | Execution preserves recoverable tracked/untracked user inputs, uses permitted targets/artifacts, excludes secrets from evidence, records all gate outcomes honestly, and stops task-created processes. | P0.1, P0.2, P0.3, P4.1, P4.2 | V00, V10, V11 |

## 4. Screen and interaction specification

All values here are proposed DoloGram implementation targets. Verify against public Messenger references and record adaptations in Phase 0. Existing tokens govern colors and fonts.

| State | Structure and action |
|---|---|
| Entry | Retain the existing header search icon and expand-to-field transition. Toolbar is 56 logical pixels plus top inset. Field is 40 pixels high with full radius and a 44-pixel clear-action target. Placeholder is Search. Back is always available. |
| Blank query | Show Recent searches as horizontally scrolling 64-pixel avatars and up to two name lines, with Edit beside the heading. Suggested shows up to ten eligible conversations, newest activity first, using 48-pixel avatars and simple two-line rows. With no history or conversations, show the existing search empty state and an actionable username-lookup entry. |
| Entered query | Show All/People/Groups/Messages pills in a horizontal strip. Preserve the selected category while typing. Clear resets to All. Rows use 16-pixel outer padding, a 12-pixel avatar/text gap, titleSm/bodyMd text, and minimum height 72 pixels that grows for accessibility. |
| All/category results | People rows open a person, Groups open a group, and Messages rows show conversation title plus N matched messages. All limits each section to three rows. See all selects that category and starts it at the top. Empty categories have query-specific feedback. |
| Scoped results | One toolbar field with Back and a visible conversation scope label. Use a virtualized list showing sender, date including year, and up to two snippet lines around the matching text. Continue loading with cursor pagination and retain an accessible Show more action. |
| Message context | Show the original message with surrounding history, readable term highlighting, and the existing focused-row treatment. Restrict search highlighting to the selected message. Jump to latest ends the search highlight treatment. |
| Edit history | Replace the recent-avatar rail with removable rows and Done. Clear all opens the existing confirmation dialog. Cancel preserves history. Storage errors retain existing entries with Retry. Android Back dismisses the dialog, then editing, then the search route according to native keyboard handling. |
| Loading/error | Names can render while messages are counting. Display Counting messages or Searching messages while incomplete. Show exact counts only after completion. A timeout/read error keeps eligible name results usable and supplies Retry for the failed portion. |

Use native keyboard and accessibility behavior through existing components. Avoid focus on every rerender or every return from a message. Restore focus only when opening a fresh search or when the user selects the field. Active motion uses `theme.duration` and `theme.reduceMotion`. Secondary text/highlight combinations must maintain 4.5:1 text contrast against their actual backgrounds, including outgoing custom chat colors.

## 5. Data, state, navigation, and compatibility contracts

### 5.1 Matching and scope

Reuse `normalizeSearch` as the canonical delivered-message predicate foundation. Literal case-insensitive NFKC substring matching applies independently to content, resolved sender name, and live attachment-type labels. Use the same predicate for snippets, delivered counts, and scoped messages. Keep raw input for the field and username handoff. The backend's exact-username rules continue through `findUser`.

Derive eligible conversation IDs from the existing account-specific chat-list output, including ignored/archived chats. Confirm caller membership again in SQL and when opening a result. A direct scoped route must satisfy the same authorization checks. A blocked direct target must not be reopened through a People candidate supplied by a different group. Locally deleted chat messages remain excluded. An explicit person selection may reuse the established direct-chat reopening behavior after eligibility checks.

**Proposed search-local contracts**, placed in `src/search` rather than route files, include a conversation summary `{ chatId, deliveredMatchCount, latestMatch }`, a scoped page `{ matches, next }`, and request identity `{ userId, allowedChatIds, chatId?, normalizedQuery, generation }`. Preserve the existing `searchCachedMessages` callable contract unless all known callers/tests are updated together. Add optional match-source metadata for content/sender/attachment explanations. Stored names/previews are derived values rather than history identifiers.

A completed conversation summary represents one stable search generation. Aggregate all matches while retaining one summary per conversation. The existing timestamp/message-ID ordering remains the delivered cursor order. Group ordering follows latest matching timestamp, then message ID, then chat ID. Name ordering uses exact/prefix/substring class, newest existing conversation activity, normalized name, and entity ID.

Scoped search also merges relevant unsent items from `getUnsentItems`, filtered by selected chat and the authenticated sender. Use `temp_id = message_id` to deduplicate delivered echoes, preserve existing queue statuses, and subscribe to `subscribeQueueChange`. Global conversation totals remain delivered-message totals, matching existing global behavior. Scoped summaries identify queued matches separately so they do not silently inflate a delivered total. Pending target navigation must still resolve to the existing queued bubble.

Cache/queue events invalidate the affected generation, refresh counts/pages, and coalesce bursts. The current `subscribeChatPreferenceChanges` API also supplies relevant chat block/preference changes. Observe those changes for candidate scopes without altering unrelated consumers. Revalidate on focus because the screen may have been frozen or unsubscribed. Preserve scroll by entity/message key where possible. Remove stale content promptly when permission or deletion changes. Keep only one active scan and one coalesced rerun per scope. Check cancellation between batches and discard late native results. Proposed local-search deadline is 15 seconds with visible timeout and user-triggered retry. A native read already in flight may finish after cancellation, but its result cannot update UI or release another request's guard.

No migration or new runtime dependency is planned. Existing cache v7 columns/indexes and AsyncStorage cover the feature. If measured performance cannot meet SR-12 with bounded batching, document the query bottleneck and propose the smallest change before adding a schema or indexing dependency.

### 5.2 People and creation

Add a search-local contact query anchored to allowed chat IDs and the caller's membership. Deduplicate by user ID and reuse the shared contact representation where compatible. Include contacts known only through groups. Match the canonical display name and permitted cached direct-chat nickname, while using the existing direct-chat title in its result. Keep Saved Messages discoverable as a conversation shortcut in People without creating a second self-chat.

Resolve an existing eligible direct chat before using `openDirectChat`. A failed or timed-out cache/eligibility preflight produces an explicit read failure and performs no create mutation. Creation requires a successful eligible lookup that finds no existing direct chat. This caller-side guard is necessary because `openDirectChat` itself catches a cache-read failure and can proceed to creation. Preserve that helper's ordinary callers. Offline, open existing cached chats and disable creation for a person with no existing chat with explicit connection feedback. Online, use the existing creation outcome and resync handling. Hold an operation lock until resolution and ignore navigation from a previous account. Typing does not create chats or issue remote lookups.

Find someone by username pushes `/new-chat` with an optional raw username prefill. Add safe scalar/array parameter handling there. The existing Find action triggers the lookup and retains existing not-found, rate-limit, and network errors. Record search history after an existing conversation opens or creation successfully resolves. Support a search-origin marker in this handoff so its Back behavior returns to the originating search and returned targets receive the same blocked-target checks before opening. Preserve ordinary New Chat callers. Avoid automatic mutation retries after an ambiguous network failure. Reconcile using existing direct-chat lookup/resync before another explicit attempt.

### 5.3 History

Proposed storage key is `dg.searchHistory:<userId>` with payload `{ version: 1, entries }`. Each entry is `{ kind: 'person' | 'chat', id: string, selectedAt: number }`, where time is epoch milliseconds. Cap entries at 20 after canonical deduplication. Selecting a known regular direct conversation, including a message result from it, records its person identity. Groups and Saved Messages record their chat identity. This collapses a direct conversation and its person into one recent item. Resolve entries against current eligibility each time they render. New accounts/absent storage begin empty. Validate malformed entries without crashing or reading another account's key. An unsupported future version is reported as unavailable history and is preserved until an explicit clear action.

Serialize read/modify/write mutations per account, continue the chain after failure, and use a generation guard so an earlier load cannot restore removed entries. Keep the last durable state until a write succeeds and offer explicit retry after failure. Selecting a result must still open it when recording history fails. Search-screen Clear all affects only this account's history key. Integrate a device-history cleanup helper with the existing `clearLocalData` path, which is called by sign-out. That operation removes only the feature's history-key prefix across this device, fences in-flight history mutations, and invalidates stale writers before reporting success. Its failure remains recoverable through the established sign-out error/retry path. Preserve other device preferences and saved-account behavior.

History reads/writes/cleanup use a 15-second logical UI deadline. A timeout is reported as an unknown durable outcome until the native promise settles. Generation guards suppress stale UI updates, but they do not cancel a physical storage write. Keep that write tracked in the serialization chain, reconcile by reading storage after it settles, and avoid overlapping mutation retries. A clear operation stays ordered after older writes and cannot report success before its own removal succeeds. Account exit invalidates older writers even when navigation has completed. If native storage never settles, show the timeout, preserve the pending operation fence, and continue independent app work. Record the blocked storage operation rather than retrying it indefinitely.

When history has an unsupported future version, ordinary result selections still open their destination but cannot overwrite that history payload. Show an explicit unavailable-history state with the existing clear confirmation reachable. A confirmed clear may replace it with an empty version-1 payload.

### 5.4 Routes and shared callers

Use existing routes `/search`, `/chat/[chatId]/search`, `/chat/[chatId]`, and `/new-chat`. Proposed optional parameters are scoped `query`, chat `searchQuery` alongside existing `focusMessageId`, and username `username` plus a search-origin marker. Validate missing/array parameters and account scope. Raw queries are navigation state, not analytics or diagnostic output.

Use a push/return flow that retains the scoped screen. Verify actual Expo Router 57 stack behavior when the same chat is already underneath search. Existing chat and pinned routes also use `focusMessageId`; optional search metadata must preserve their established behavior. Missing or deleted search targets get explicit feedback without changing non-search helper callers' expectations.

Extend SearchField with a backward-compatible controlled/uncontrolled API. Render and clear from one current value. Preserve immediate clearing, 150 ms default callback debounce for forward-search callers, and timer cleanup. Global/scoped inputs update immediately while the query layer controls debounce. Ensure submission uses current text even with a pending timer.

Pass an optional highlight query through MessageBubble into MessageText. Preserve Markdown AST structure, code/font styles, URL handling, image suppression, and native text selection/actions. Unicode highlight ranges must map normalized matches to original display text without changing the saved or displayed message. A query spanning multiple rendered Markdown leaves requires contiguous rendered-text range handling. For matches found only in hidden Markdown syntax or a link destination, retain the focused-row highlight and explain the matched raw content in the search snippet rather than inventing a visible term highlight.

## 6. Execution phases and measurable work items

These phases are specific to search and do not inherit the numbering or incomplete release gates of the older Android plan. Items within each phase have equal weight. An item earns credit only after its stated work and applicable acceptance assertions pass. A recorded failed, blocked, or unrun required assertion does not earn completion credit. Shared execution rules in Section 8 apply throughout. Source baselines and recoverable snapshots gate code changes. Unavailable runtime prerequisites may leave their Phase 0 items incomplete while Phases 1–3 proceed on satisfied source/test dependencies. Report that distinction explicitly and retain the unfinished items in the denominator. For P0 baseline capture, completing the work means capturing and classifying the actual baseline result, including a pre-existing failure, rather than requiring the unchanged application to pass every repository check before coding can start.

Verification IDs group related assertions across phases. Their ownership below defines which assertions are due at each gate. Listing a group in a work item does not claim the whole group has passed before later integration exists.

| Phase | Assertions owned by its items and gate |
|---|---|
| Phase 0 | V00 source/snapshot preparation and V10 existing-test/toolchain baseline capture. Do not attempt newly proposed test paths as baseline files. P0.2/P0.3 runtime discovery or observations may remain pending without blocking independently satisfied code prerequisites. |
| Phase 1 | V01 query/count/cursor assertions, V02 field contract, V03 people adapter/ranking, V04 scoped-data/pending merge, V07 request lifecycle, and V08 pure highlight-range helpers. Screen creation/opening and Markdown-renderer integration are due later. |
| Phase 2 | V02 global screen, V03 person opening/username handoff, V06 history/cleanup, V07 global/history state, V05 global route-parameter handoff, and V09 affected field/New Chat/cleanup callers. |
| Phase 3 | V04 scoped UI/target selection, V05 full navigation/state retention, V07 scoped/context invalidation, V08 Markdown-renderer highlights, and V09 historical/pinned/account/calling-consumer preservation. |
| Phase 4 | Final affected V00–V10 checks, actual V11 platform/performance observation, cleanup, and consolidated SR acceptance. Earlier assertion evidence can be reused when its source/environment identities remain applicable. |

### Phase 0 — Establish safe execution inputs

**Scope and prerequisites.** Supporting preparation after implementation is authorized. Inputs are this plan, the context index, current instructions, manifests, and relevant working-copy files. Affected artifacts are local search evidence/snapshots under `docs/test-results/search/`, created during execution.

- **P0.1** Recheck status/diffs, refresh changed source identities, and create recoverable snapshots of relevant tracked and untracked sources. Include hashes and restore instructions, exclude credentials and unrelated files. Read the installed/versioned Expo SDK 57 and React Native 0.86 APIs needed by the implementation.
- **P0.2** Record V00/V10 baselines with exact command, exit/timeout, toolchain, and log path. Inventory compatible existing development artifacts and discover the named MuMu identity through ADB before operating it. Preserve existing services. If device discovery is blocked, continue independent code/test preparation and mark V11 pending.
- **P0.3** Finalize the Section 4 screen checklist from public references, record documented adaptations, and establish disposable fixture/target details. Confirm account/data isolation for connected tests and network isolation for offline local-fixture mode. Measure the existing search timing with safe data when the permitted environment is available.

**Baseline checks.** Hash/status review, confirmed package scripts, existing targeted tests, lint, and typecheck. No live credentials are needed for source/unit baselines.

**Acceptance gate.** Snapshots and baseline evidence are recoverable, scope/constraints are explicit, and required code contracts have no material ambiguity. Device/reference gaps are assigned to their affected verification items rather than silently treated as passes.

**Phase 0 progress/status — 2026-11-11, Asia/Manila: Complete, 3/3 items (100%).** This execution record supersedes the historical planning-only status above for Phase 0. Phases 1–4 have not started. Search-plan progress is 3/12 predefined items (25% by item count); broader DoloGram project progress is not defined.

| Item | Entry classification | Verified completion |
|---|---|---|
| P0.1 | Partially done — prior source/docs audit, no execution snapshots | Complete — instructions/current contracts checked; 72 recoverable source/config snapshots and restore rehearsal; fresh identities; Repomix 1.18.1 scoped XML generated, all 13 entries/980 lines read and original-source matched; relevant Expo 57/RN 0.86 docs read. |
| P0.2 | Not started — historical checks/device reports only | Complete — exact baseline logs/toolchain; named MuMu mapping and installed/local APK hashes verified; installed client exercised native RN/SQLite with the unchanged query; existing services preserved and task-owned processes/mapping stopped. Baseline capture includes failures, not a clean-check claim. |
| P0.3 | Partially done — proposed adaptation/public links, no safe runtime fixture | Complete — Section 4 checklist finalized with public-reference limits; wrong-product iPhoneLife link excluded; offline synthetic native SQLite fixture and network fence verified; existing query timing captured. Connected account/chat isolation and full product UI observations remain due with V11. |

**Dated verification note.** Workspace typecheck passed initially and finally. Initial mobile lint returned exit 0; final lint failed with 13 errors/3 warnings in seven application files untouched by this task, with both outputs retained and the differing outcome unexplained. Shared tests passed (20 files/149 tests). Initial targeted Jest failed on sandbox cache rename; the writable-cache combined run timed out at 120 seconds. After config/list discovery, split runs passed all six existing suites (29 tests total). Strict fixture typecheck and explicit fixture lint passed. Final native query sample on MuMu `dologram`/`127.0.0.1:16480` found all 35 old matches: 45.51 ms first page, 51.34 ms two-page total, zero reads for an already-cancelled request, zero final fixture console errors/warnings. These are query wall times, not end-to-end UI latency or the later 10,000-message gate.

**Constraints, discrepancies and remaining gates.** The AGENTS route-location sentence differs from actual `apps/mobile/app` routes; Phase 0 changes no product routes. Concurrent user video-call actions/strings were preserved and refreshed separately. Original Metro 8082 failed to serve the project; the task used and stopped its own offline fixture server. Existing APK compatibility is verified for the exercised search foundation, not the entire product/calling stack. Exact current Messenger parity, connected disposable fixtures and integrated V11 screens/navigation/stress remain unverified later-phase gates. No dependency, application-source, migration, remote configuration, commit, push, build or deployment change was made by this task.

Evidence: [Phase 0 report](../docs/test-results/search/phase-00/report.md), [screen checklist](../docs/test-results/search/phase-00/screen-checklist.md), [recovery/fixture procedure](../docs/test-results/search/phase-00/recovery.md), and the [central context index](context/DoloGram_Search_Context_Index.md). **Next phase ready to start: yes on source/unit prerequisites; Phase 1 was not started.**

### Phase 1 — Shared query and input foundation

**Scope and prerequisites.** Depends on P0 source/baseline preparation. Context is Section 5, current query tests, SQLite schema, SearchField callers, organization logic, and queue contracts.

- **P1.1** Extend `apps/mobile/src/search/query.ts` with shared matching, source metadata, summary counting, scoped pagination, pending-item compatibility, cancellation/deadline/generation logic, and cache/queue invalidation. Add a small shared search hook only where both screens require it. Verify V01/V04/V07.
- **P1.2** Extend `src/components/SearchField.tsx`, add reusable search rows/highlight-range support under `src/search`, and add shared search strings in `packages/shared/src/strings/index.ts`. Verify controlled/uncontrolled/forward callers and V02/V08.
- **P1.3** Add the scoped people adapter and deterministic ranking in `src/search`. Reuse `findDirectChatId`, contact types, and existing direct-chat outcomes without changing the group-picker contract. Verify V03.

**Proposed new files.** `src/search/people.ts`, `src/search/useMessageSearch.ts`, `src/search/HighlightedText.tsx`, and `src/search/SearchResultRow.tsx`, only to house the corresponding required shared behavior. These files do not currently exist. New interfaces remain local unless an existing shared consumer requires them.

**Baseline checks.** Current query/ChatSearch behavior, forward field behavior, membership filtering, and queue-merging fixtures.

**Acceptance gate.** Query/count/cursor assertions from V01, SearchField assertions from V02, candidate/ranking assertions from V03, scoped-data/pending assertions from V04, and request-lifecycle assertions from V07 pass. Global-screen and navigation assertions from those verification groups are due in Phases 2–3. Relevant callers typecheck and data contracts are ready for both screens. Search introduces no migration or dependency installation.

### Phase 2 — Global search and recent history

**Scope and prerequisites.** Depends on Phase 1 contracts. Inputs are global search/header routes, Avatar/Button/Dialog/theme components, the history conventions, and direct-chat/New Chat flows.

- **P2.1** Implement `src/search/history.ts` and history management UI, including typed entries, serialized writes, durable-failure handling, removal, and clear confirmation. Integrate feature-key cleanup and stale-writer fencing with `src/storage/localData.ts`, checking its Settings sign-out caller. Verify V06/V07, including interrupted cleanup and retry.
- **P2.2** Rework `app/search.tsx` around blank-query suggestions, recents, categories, See all, grouped counts, independent name/message loading, error/retry handling, known-person opening, and username handoff in `app/new-chat.tsx`. Preserve the existing header entry and expansion origin. Verify V02/V03/V05/V06/V09 and affected caller checks.

**Proposed additional file.** `src/search/SearchSuggestions.tsx` for the blank-query/history UI. Reuse existing Dialog, Avatar, and Button. New code outside route files stays under `src`.

**Baseline checks.** Compare old global search tests and existing exact-username/direct-chat behavior. Confirm no opening guard remains stuck after a failed request.

**Acceptance gate.** Global screen states, history, person-opening behavior, and the scoped-route handoff contract pass automated component/navigation assertions. Account boundaries hold and every category/error state has a reachable path. Actual scoped-query consumption and original-message context integration are due in Phase 3. Retain pending V11 screenshot results truthfully if the assigned runtime remains unavailable.

### Phase 3 — Scoped results and original-message context

**Scope and prerequisites.** Depends on Phases 1 and 2 route/data contracts. Inputs include scoped search, chat-info search action, ChatScreen focus/load/scroll handling, pinned-message consumers, MessageBubble, MessageText, and historical query tests.

- **P3.1** Replace scoped snapshot filtering with shared full-history pagination plus supported pending matches. Prefill from global search, display scope/snippets/source explanations, and preserve pages/query/scroll through focus changes and Back. Verify V04/V05/V07/V09.
- **P3.2** Thread optional search query metadata through chat navigation and message rendering. Detect unavailable targets, handle bounded scroll-to-index recovery, and clear search treatment on Jump to latest. Preserve pinned-message and ordinary chat callers. Verify V05/V08/V09.

**Affected paths.** `app/chat/[chatId]/search.tsx`, `app/chat/[chatId]/index.tsx`, `src/chat/query.ts` only if additive availability metadata is necessary, `src/components/MessageBubble.tsx`, and `src/components/MessageText.tsx`. Inspect `app/chat/[chatId]/info.tsx` and `pinned.tsx` as integration consumers. Root `_layout.tsx` changes are needed only if actual stack tests demonstrate a route-discovery or transition defect caused by this feature.

**Baseline checks.** Historical-message helper test, current missing-target fallback, Markdown suite, and existing forward/pinned/ordinary chat navigation.

**Acceptance gate.** Automated global/scoped/context/Back flows pass. Historical, pending, deleted, and unavailable targets have correct outcomes. Markdown and non-search navigation regressions pass.

### Phase 4 — Integrated verification, cleanup, and handoff

**Scope and prerequisites.** Depends on completed implementation work from Phases 1–3. Uses Section 7's full acceptance matrix and the permitted runtime prerequisites from Section 8.

- **P4.1** Run affected and required checks, compare against Phase 0 baselines, remove only obsolete scoped filtering/rows and unused feature code after caller discovery, and rerun checks affected by cleanup. Record V00–V10 outcomes with evidence.
- **P4.2** Perform permitted ADB-only visual/interaction checks and performance measurement, finish V11, restore disposable fixtures/settings, stop task-created processes, and publish the requirement/gate results and rollback instructions in the search evidence directory.

**Acceptance gate.** Every SR requirement has a complete implementation and passing evidence for all its required acceptance assertions. Failed, blocked, and unrun required assertions keep their work item and feature acceptance incomplete. Preserve pending V11 observations while continuing independent implementation and automated checks. Historical passes, compilation, and mocked rendering cannot substitute for platform observation. Known unrelated baseline failures remain reported as failed and are handled by Section 8 rule 9 without claiming that the full command passed. Deferred iOS device observation stays outside this Android verification gate.

## 7. Verification plan and confirmed commands

The following verification is planned for authorized execution. None of these runtime/test commands was run during polishing. Test additions are justified by the changed behavior and use existing Jest/Vitest tooling.

| ID | Method and required evidence |
|---|---|
| V00 | Working-copy status/diffs, snapshots/hashes, confirmed versions and permitted target identity. Verify rollback can restore touched source files without resetting unrelated untracked work. |
| V01 | Extend `src/search/__tests__/query.test.ts` using its in-memory `node:sqlite` adapter. Cover 260 rows/35 old matches, multiple chats, tied timestamps, complete counts, literal SQL metacharacters, Unicode, zero results, source scope, cancellation and deadline. Use a separate 10,000-message/100-chat stress fixture for batch/count/memory observations. |
| V02 | Extend `SearchScreen.test.tsx` and add a focused SearchField test. Cover blank state, immediate clear, submission with pending debounce, controlled/uncontrolled/prefilled text, filter preservation, three-row truncation, See all, result semantics, and independent name/message failures. |
| V03 | Add scoped people/ranking tests with two accounts whose memberships coexist in cache, group-only contacts, blocked direct targets, archived/ignored/deleted chats, self shortcut, repeated taps, offline existing chat, disabled creation, creation failure/conflict, and explicit username handoff. A rejected/timed-out cache preflight must produce zero create calls. Inject direct-chat/network dependencies. |
| V04 | Add scoped-search tests for full-history parity, pagination, match-source explanations, failed reads/retry, timeout, pending statuses and delivered-echo deduplication. Confirm a queued message opens its queued bubble. |
| V05 | Add navigation/render tests asserting actual route parameters and retained query/filter/scroll/page state. Include already-open chat underneath search, direct links, chat-info entry, search-origin username flow, missing/deleted target, and pinned regression. Mock-only router assertions need the V11 real Back-stack observation. |
| V06 | Add history tests using the existing AsyncStorage Jest mock. Cover absent/corrupt/versioned payloads, capacity, person/direct-chat canonical identity, account isolation, concurrent record/remove/clear, late loads, failed writes/retry, cancellation, and durable state after reopening. Deferred native promises and fake timers must demonstrate timeout followed by late success/failure, reconciliation before retry, clear ordered after an old writer, and preservation of an unsupported-version payload until confirmed clear. Add a focused local-data cleanup test proving that sign-out clears feature history keys, preserves other preferences, cannot be undone by an in-flight writer, and can safely retry a cleanup failure. |
| V07 | Use deferred reads and cache/queue events to exercise rapid queries, account/chat switches, unmount, permission loss, deletion, pending delivery, invalidation bursts, deadline expiry, and listener/timer cleanup. Verify stale responses cannot navigate or repopulate history/results. |
| V08 | Extend `components/__tests__/MessageText.test.tsx` and add highlight-range tests. Cover repeated matches, NFKC expansions, combining characters, Turkish dotted I, Greek case behavior, emoji, formatting boundaries, code, links, hidden raw syntax, theme contrast, and incoming/outgoing/custom bubble backgrounds. Preserve existing image/URL safety assertions. |
| V09 | Relevant regression tests for forwarding, direct-chat lookup, historical context, account switch, chat organization and pinned behavior. Preserve concurrent ChatScreen call actions/CallProvider wiring and account-session call teardown when editing shared consumers. Configure test wrappers for current providers without starting calls. Add focused assertions only where existing tests miss a changed path. |
| V10 | Run required mobile lint, workspace typecheck, relevant Jest suites, affected shared tests, `a11yPressableSource.test.ts`, and accessibility render tests. Affected feature assertions must pass. Full-command failures remain failed in the report and can be classified as unrelated baseline findings only under Section 8 rule 9. The source Pressable test scans app/components, so new `src/search` controls also require explicit render-label assertions. |
| V11 | Assigned-MuMu ADB-only observations for all Section 4 states in both themes, compact width, enlarged text, keyboard, native Back, reduced motion, 44-pixel targets, offline cached results, old/pending targets, and real retained scroll. Use screenshots/UI hierarchy plus sanitized timestamps. Measure batch duration, first visible results, complete counts, cancellation, and scrolling with the stress fixture. Proposed per-batch JS-work ceiling is 100 ms. Reduce batch work or yield if exceeded, while retaining full-history correctness. Record actual measurements rather than estimated speedups. |

**Confirmed npm commands**, from `G:\codebase\DoloGram` in PowerShell, after execution is authorized. Save sanitized output and exit codes under `docs/test-results/search/phase-00/` for baselines and the applicable phase directory for later runs.

```powershell
npm run typecheck
npm --workspace @dologram/mobile run lint
npm --workspace @dologram/mobile run test -- --runInBand --watch=false --runTestsByPath src/search/__tests__/query.test.ts src/search/__tests__/SearchScreen.test.tsx src/chat/__tests__/query.test.ts src/components/__tests__/MessageText.test.tsx src/__tests__/a11yPressableSource.test.ts src/components/__tests__/a11yLabels.test.tsx
npm --workspace @dologram/shared run test
```

Add newly created test paths to the targeted command after confirming they exist. Broaden to affected consumers based on the actual change set. A final full mobile run uses `npm --workspace @dologram/mobile run test -- --runInBand --watch=false` with the timeout policy below. Shared tests remain relevant if shared strings/types/logic change.

Use a process supervisor with an initial 120-second bound for targeted runs and 300 seconds for full suites/typecheck/lint. Poll output in intervals of at most 60 seconds. Preserve logs and terminate only the task's process tree on timeout. These are proposed execution limits, adjustable with recorded evidence of legitimate progress. After two failures for the same reason, diagnose/change approach or report the blocker. Investigate hung startup with the installed Jest CLI's `--listTests`/`--showConfig` before another equivalent run. Do not use `--forceExit` to disguise a hang or weaken assertions.

Direct runtime commands require the confirmed assigned serial. Discovery begins with `adb devices -l`, then `adb -s <confirmed-serial> shell pm path com.dologram.app`. The placeholder represents an execution prerequisite, not a serial to run literally. Confirm the serial belongs to MuMu `dologram` against the existing instance inventory before connecting, launching, reversing ports, resetting, or installing. Command syntax for capturing screenshots/hierarchy and launching the existing development-client deep link must be confirmed against the permitted instance and current Metro port before use.

A native build is not part of the expected JavaScript-only implementation. If a compatible artifact proves unavailable, record the module/config mismatch and follow Section 8 before requesting a replacement. Build verification is conditional on that evidence, not an automatic rebuild gate.

## 8. Shared execution, recovery, and environment rules

1. Deliver complete production-ready required paths. Follow existing conventions, callers, exports, route discovery, strings, theme, and error handling. Avoid placeholders, empty handlers, unnecessary dependencies, broad refactors, and unrelated fixes. Read version-matched Expo/RN documentation before changing their APIs.
2. Preserve relevant tracked/untracked files with secret-free local snapshots/patches before editing. Put execution artifacts under `docs/test-results/search`, separate from application code. Exclude `.env*`, credentials, signing material, saved account/session data, and private message payloads. Fixtures use synthetic text. Store source path/hash metadata without copying secrets. Do not package the whole repository.
3. Revalidate only changed sources and dependencies against the single context index. Existing generated guidance is reference material. If a later phase uses Repomix, record intended/actual paths, source hashes, exclusions, omissions, and complete read boundaries there. Never import compressed omissions as verified facts.
4. The user's standing authorization permits necessary reset/install/reinstall/launch, app-data clearing, emulator-setting changes, and test-account/data creation, login, modification, and deletion within the assigned testing environment. Main target is MuMu Player `dologram`/`com.dologram.app`, controlled through ADB only. LDPlayer is usable only if it is actually assigned. Historical serials differ, so resolve the named instance before use. Do not request confirmation again for covered actions or ask the user to create/login to an account when usable supplied or publicly documented credentials are available. Consult authorized materials without printing passwords/PINs. Ask only for genuinely missing essential access information or an actual tool/access restriction and continue independent work. Do not open Messenger or unrelated installed apps to obtain references. Use public captures for reference research and preserve unrelated apps/accounts/services. These standing permissions do not authorize operational actions during this planning-only audit.
5. Prefer isolated in-memory database and mocked transport tests. Runtime fixtures require a verified configured backend target and designated test accounts/chats, or network-disabled local fixture mode with no outbound sync, queue dispatch, or notifications. Authorized disposable accounts/data on the verified app target are sufficient when they stay within the supplied testing authorization. A separate backend project is not an automatic prerequisite. Record backup/removal procedures and restore settings. A container, emulator, or existing hosted URL alone does not prove account/data isolation. Preserve unrelated shared data and avoid changing live Auth/RLS/configuration to obtain a test pass.
6. Reuse the compatible approved development client. Record package/native fingerprint and required modules first. `docs/builds.md` reports a 15-build monthly allowance but is a historical ledger. Current availability is unknown. If a native replacement becomes necessary, establish the mismatch, current allowance, profile, and upload authorization before cloud EAS work. Local native builds remain excluded. No speculative rebuild, store submission, deployment, migration, or dependency upgrade is included.
7. Failed local reads/history writes get explicit retry with preserved durable state. Serialize mutations and release operation guards in finally. A stale request cannot release a newer request's lock. Bound request lifetimes and prevent cache-event refresh loops, repeated side effects, and retry storms. Direct-chat partial failures use the existing lookup/resync recovery, never automatic repeated create calls. Keep its residual server race recorded separately.
8. Rollback restores only touched feature files from Phase 0 snapshots and removes only task-created unused feature files after verifying ownership. Preserve unrelated user edits. The new history key is additive and can remain inert after code rollback. Keep old callable contracts or provide compatible optional fields. App database/server schema rollback is unnecessary for the planned scope.
9. Record check status as passed, failed, blocked, or not run with evidence and environment identity. Reproduce historical failures before calling them current. Fix task regressions only. An unrelated baseline failure may remain outside feature repair only when its exact diagnostics/test identity were captured before changes, current evidence establishes that it is unrelated, and all affected feature assertions pass. The full command remains failed, with the classification and supporting evidence attached. Unknown-cause failures or an inability to run a required feature assertion keep the affected acceptance gate incomplete. Never skip/weaken an assertion, suppress a finding, or substitute a mock for required platform evidence to close a gate. Rerun affected checks after meaningful changes and cleanup. Stop task-created servers, supervisors, fixture processes, and timers when no longer needed, preserving pre-existing services.
10. During authorized execution, report current-phase completion after each session. Use equal weights for the predefined Pn.n items. Completion is verified finished item count divided by required item count, rounded to a whole percentage. Record any legitimate item/weight change and its effect. Required unmet gates prevent 100 percent. Report overall project progress separately only if its denominator has been defined. State whether the next phase is ready.

Required execution-report format follows the user's instruction. It is not used as a progress claim during plan polishing.

> Current execution phase: [name] — [X]% complete. Completed: [verified work]. Remaining: [required work]. Blockers: [none or specific blocker].
>
> Next phase ready to start: [yes/no, with unmet prerequisite if any].

## 9. Decisions, unresolved prerequisites, and out-of-scope findings

### Material refinements from the saved original plan

| ID | Decision or correction | Reason |
|---|---|---|
| D01 | Retain Messenger's documented search hierarchy with DoloGram tokens. Adopt the four filters as the proposed DoloGram variant. | Current Messenger build details are unverified. This preserves the earlier visual adaptation without claiming universal pixel parity. |
| D02 | Use existing `apps/mobile/app` routes and explicit optional parameters. Preserve scoped results through Back. | Original source confirms route discovery and current replace-based loss of scoped state. |
| D03 | Add a search-scoped people adapter with a membership/organization allowlist. | Existing contact reads alone do not prove account scope. Changing the separate group picker is unnecessary. |
| D04 | Preserve pending scoped-message search and distinguish it from delivered global counts. | `loadChatSnapshot` currently merges unsent items. Replacing it with delivered-only cache search would silently remove a supported input. |
| D05 | Make recent-history entries typed people/chats and serialize changes per account. | Group-only contacts have no chat ID until creation. Chat-ID-only history would lose them. |
| D06 | Replace iOS/physical-device verification requirements with permitted Android MuMu observation plus shared-code compatibility checks. | Recorded project constraints require emulator-only/ADB-only work. Later records map the named instance to a different serial. |
| D07 | Separate historical outcomes from new baselines and keep required unverified gates incomplete. | The current user explicitly requires verification integrity. Older plans' optional-manual phase-completion conventions cannot mark this feature's required platform criteria passed. |
| D08 | Keep builds conditional on a demonstrated artifact mismatch. | Existing modules support the proposed JavaScript/local-storage work. Quota availability and historical upload restrictions are not resolved by this plan. |
| D09 | Add history cleanup to the existing local-data/sign-out path and preserve concurrent native work. | Later original-source inspection confirms that sign-out invokes local-data cleanup and that manifests/root providers changed during polishing. New feature storage must honor the existing cleanup consumer. |

### Unresolved prerequisites and next actions

| ID | Evidence and consequence | Affected work | Resolution and independent work |
|---|---|---|---|
| B01 | Earlier public references mix versions and platforms. Exact current-Messenger geometry is unverified. | SR-11 fidelity claim and P0.3 | Use the explicit Section 4 adaptation as the executable specification, record source date/build where public references provide it, and document differences. Query/history/navigation work can proceed. No claim of exact current-build parity can pass without a matching reference. |
| B02 | Historical device identities include `emulator-5554` and `127.0.0.1:16480`. Current instance/artifact/service state was not inspected because auditing excludes operational actions. Concurrent calling native packages/plugins mean an older client cannot be assumed compatible with the whole current app. | P0.2 and V11 | During execution, use standing ADB/emulator authorization to discover MuMu `dologram`, verify current module loading against the installed artifact, and reuse it when compatible. Look for supplied compatible artifacts before requesting one. If none is available, record the exact mismatch and resolve actual artifact/upload/quota constraints. Automated query/component/navigation work proceeds independently. |
| B03 | Verified runtime target and designated disposable test accounts/data, or a proven network-isolated fixture mode, are not established in this audit. | Live creation/lookup and V11 fixtures | During execution, inspect the actual configured target and available authorized credentials, then create/login to test accounts and prepare disposable items using standing authorization. No separate backend project or repeated emulator approval is required by this plan. Request only genuinely unavailable essential access information and continue mocked/in-memory checks. |
| B04 | Full Jest hangs and sign-up lint errors were reported in 2026-11-10 evidence. Their current reproduction status is unknown. | P0.2, V10 | Run bounded baselines, retain diagnostics, isolate relevant suites, and separate unrelated failures from new regressions. If required feature tests cannot run, their gate stays blocked while independent work proceeds. |

There is no unresolved material product decision preventing implementation against the proposed adapted specification. Runtime prerequisite discovery and verification remain future work.

### Out-of-scope findings

- The existing direct-chat multi-row creation has a residual partial-failure/server-race gap documented in the older Android plan. Search must reuse and test its error/reconciliation path. An atomic server redesign is outside this change.
- `loadCachedContacts` has other group-picker consumers. Broader correctness changes to those consumers are separate work. The new search adapter must enforce its own scope.
- Existing global release-gate/EAS issues, calling work, sign-up lint findings, and full-suite infrastructure issues are recorded rather than repaired by this search plan.
- Media original-filename search, remote full-name discovery, assistant integration, new advanced filters, and iOS-device verification remain separate capabilities or environments.

## 10. Polishing-pass verification record

| Check | Outcome |
|---|---|
| Plan saved and refined in place | Passed — this consolidated Markdown file supersedes its initial saved outline. |
| Working-copy/instruction/source inspection | Passed — source identities and targeted read locations are recorded in the companion index. |
| Requirements mapped to work and verification | Passed — document review and a read-only validator confirmed 14 unique requirements, 12 work items, 12 verification groups, Phases 0–4, valid local links, and no undefined mappings. This is plan consistency evidence. |
| Current application lint/typecheck/tests/build | Not run — this pass inspected sources/configuration and edited planning artifacts only. Phase 0 contains the required fresh baselines. |
| Emulator/platform/remote verification | Not run — device identity, isolated runtime target, and compatible artifact remain B02/B03 prerequisites. |
| Implementation acceptance | Not run — every implementation criterion remains future work. |

The final polishing check compared 75 inspected source/configuration/evidence identities with the captured baseline. Concurrent application changes were detected and revalidated at their search-relevant contracts, with refreshed source identities in the context index. This request created only the plan and its supporting context index. Phase 0 must refresh any source that changes after these inspection snapshots.

## 11. Second-pass audit and execution readiness

Audited on 2026-11-11 under the user's planning-only instruction and updated standing testing authorization. The candidate plan's own consistency checks were treated as prior evidence to examine. The context manifest's 75 source identities were unchanged at the start of this audit, allowing unchanged findings to be reused. Targeted original-source reads resolved the cache-preflight creation behavior, historical/pending target handling, and shared query contracts. A final freshness check detected concurrent changes in ChatScreen and the calling plan. Their search-relevant integration and shared environment rules were rechecked and their context fingerprints refreshed. No tests, builds, migrations, service launches, device actions, or remote checks were performed. Document-only validation confirmed 14 requirements, 12 work items, 12 verification groups, Phases 0–4, complete identifier mappings, valid local links, and closed Markdown fences.

| Audit ID | Confirmed defect and repair | Coverage |
|---|---|---|
| AU-01 | Verification groups span phases. Added explicit assertion ownership and clarified that a failed/blocked/unrun required assertion earns no item credit. Final feature acceptance now requires passing required assertions. Known unrelated baseline failures retain their failed status and need evidence for their classification. | Section 6 gates and ownership table, V10, Section 8 rules 9–10 |
| AU-02 | Constant-memory wording conflicted with preserving explicitly loaded result pages. Defined the 200-row scan limit, 30-match delivered-page limit, one-summary-per-conversation aggregation, and memory proportional to requested pages. | SR-12, P1.1, V01/V11 |
| AU-03 | Reusing openDirectChat alone could turn a failed cache lookup into a create mutation. Required a successful search-side eligibility/cache preflight before creation and a zero-create-call assertion on read failure/timeout. | Section 5.2, P1.3/P2.2, V03 |
| AU-04 | History promises could remain pending without a defined timeout/reconciliation path, and result selection could overwrite an unsupported payload version. Added logical deadlines, serialization through late native settlement, durable reconciliation, safe clear ordering, and explicit-clear-only replacement of unsupported versions. | Section 5.3, P2.1, V06/V07 |
| AU-05 | Standing test authorization and isolation wording could imply repeated approval or a mandatory separate backend project. Applied the user's explicit emulator/account/data authorization, retained ADB-only identity checks, and distinguished connected account/data isolation from offline network isolation. | P0.3, Section 8 rules 4–5, B02/B03 |
| AU-06 | Some acceptance rows omitted the phase item implementing their global state, history, scoped UI, or cleanup integration. Corrected those mappings without adding work items or features. | SR-08, SR-10, SR-11, SR-13 |

**Readiness classification — Ready for execution.** No unresolved product decision or technical prerequisite prevents Phase 0 source-baseline/snapshot preparation from starting when implementation is requested. This audit does not authorize or begin operational work. Standing test authorization applies once execution is requested, with no repeated approval for covered emulator/account/data actions.

The later prerequisites B01–B04 remain explicitly unverified. B01 affects claims about exact current Messenger fidelity, while Section 4 already defines the accepted adapted design. B02 gates actual MuMu/artifact observation, B03 gates connected/disposable runtime fixtures, and B04 requires fresh check baselines and diagnosis if a relevant test runner fails. Their exact next actions are in Section 9. Pending runtime observations cannot halt independent implementation or other satisfied phases and cannot be counted as passed or removed from the completion denominator. A real missing artifact, essential credential, or tool restriction blocks only the dependent action until resolved.

No optional improvement was promoted into additional feature scope. Calling work, broad contact-picker repair, atomic backend direct-chat creation, existing unrelated failures, and other listed exclusions remain outside this search change. The audit ends at this readiness assessment.
