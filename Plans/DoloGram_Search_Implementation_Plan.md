# DoloGram Messenger-style mobile search implementation plan

Prepared on 2026-11-11; planning-refinement audit updated on 2026-11-12, Asia/Manila.

**Current status (2026-11-13, Asia/Manila).** Phases 0–12 are complete under the revised verification policy. The original search implementation is **12/12 required work items (100%)**. The full plan has **13 of 13 phases complete**. Phase 12's integrated automated verification, deterministic performance gate, caller audit and handoff evidence are recorded below; optional device observations remain separately identified and do not gate completion. Broader DoloGram project progress has no defined denominator.

## Remaining phases at a glance

The previous count of nine included Phase 4's remaining device observations. Those observations are now an optional checklist outside the required phase count. Phase 4's handoff, automated verification and fixture cleanup are recorded below.

The required Phase 5–12 hardening sequence is complete. Each detailed phase below lists its purpose, prerequisites, context inputs, affected components, baseline checks, work items and exit gate. Optional device observations remain explicitly separated from required phase completion.

| Phase | Status and dependencies | Deliverable and completion evidence |
|---|---|---|
| [4 — Integrated verification and handoff](#phase-4) | Complete. Optional device checklist remains available. | Recorded regressions, source corrections, rollback and fixture cleanup. Retained existing native observations with their original results. |
| [5 — Baseline and ownership](#phase-5) | Complete. Uses completed Phases 0–4. | Captured Git status, scope, source hashes and recovery snapshots; ran the existing checks; and defined repeatable slow-query, history, username and 10,000-message fixtures. |
| [6 — Stable search layout](#phase-6) | Complete. After 5. | Kept the toolbar and filters fixed across loading, empty, error and result states; added a history-loading placeholder; and verified shared layout, spacing, accessibility labels and 44 dp targets in source/component checks. |
| [7 — Progressive loading and cancellation](#phase-7) | Complete. After 6. | People and Groups remain visible while messages count; progress is inline; selected filters and result structure are retained. Deterministic tests cover 150 ms debounce, immediate input, retries, stale responses and zero overlapping scans. |
| [8 — Inline username search](#phase-8) | Complete. After 7. | Make Username a normal search filter that automatically performs the exact lookup for the current query, accepts one leading `@`, and shows offline, error and retry states in search. Remove the separate Search username CTA while retaining safe chat opening, history recording, duplicate handling and compatibility for existing New Chat callers. |
| [9 — Transition and focus](#phase-9) | Complete. After 6–7. | Uses one 250 ms native-driven route crossfade, removes the competing toolbar morph, focuses global and scoped inputs once per route entry, and verifies reduced motion, interrupted navigation, keyboard layout and focus-loop guards. |
| [10 — Compact rows and rendering](#phase-10) | Complete. After 6–7. | Use 48 dp avatars, 12 dp gaps, 64–72 dp minimum rows and two-line snippets. Verify render counts, highlight reuse, contrast, text scaling, virtualization and bounded work with the synthetic stress fixture. |
| [11 — Recent searches and no-results polish](#phase-11) | Complete. After 6–8. | Finish the compact recent-search rail, Edit/Done, remove and clear confirmation. Show one username action and a compact empty state. Test history durability, theme, accessibility and Back handling. |
| [12 — Integrated verification and handoff](#phase-12) | Complete. After 5–11. | Focused and full automated checks, deterministic overlap/loading gates, caller audit, regression/rollback report and optional-device status are recorded. |

## Verification policy for every phase

**Required evidence:** Verify the implementation against source and applicable automated checks. Use the affected typecheck, lint, unit, component, integration, accessibility and synthetic performance checks listed in the phase. Review the diff, record known baseline failures and verify cleanup for any test operations actually performed. Fix reproducible in-scope defects and regressions found by either required checks or optional observations.

**Optional device evidence:** All emulator and physical-device checks are optional, including V11 and V16. This includes screenshots, visible IME behavior, real Back/scroll observation, live account and offline flows, frame pacing, and input-to-visible-result latency. If a device check is skipped or unavailable, record it as optional and not run or blocked. It does not affect completion, readiness, or the required-work denominator. Report only measurements and observations actually made. Use assigned MuMu `dologram` through ADB if optional device checks are performed, and restore any test changes.

Phase completion means the required implementation and verification are satisfied. The evidence records what was checked and any remaining platform uncertainty.

## 1. Goal, scope, and evidence labels

Reproduce the Messenger search experience through recent searches, grouped conversation results, scoped message snippets, and navigation to the original message. Global and scoped search share matching and presentation rules. Preserve DoloGram's existing account isolation, offline cache, chat organization, Markdown, and navigation behavior.

**Verified** identifies current source inspection. **Reported** identifies historical evidence that needs revalidation. **Proposed** identifies the executable behavior selected by this plan. **Unresolved** identifies a prerequisite with a consequence and next action in Section 9. All implementation requirements and acceptance criteria below are proposed work.

The visual adaptation carries forward the earlier plan's DoloGram charcoal/ivory palette, Inter typography, and existing icons. Messenger supplies the screen hierarchy, rounded field, avatar-led rows, recent-history management, and conversation-first message retrieval. All/People/Groups/Messages filters and the ranking rules are DoloGram design choices. The research does not verify those exact controls on every current Messenger build.

Supported execution target is the existing Android Expo app on the assigned MuMu Player instance named `dologram`, package `com.dologram.app`, using ADB only. Shared React Native code must retain its existing iOS branches and type compatibility. Physical-device and iOS-device testing are not prerequisites under the recorded emulator-only restriction.

Feature scope covers local synced messages, currently eligible contacts/groups, recent history, the existing exact-username lookup, snippets, highlighting, and historical navigation. Shared media browsing remains the existing chat-info destination. Full-name remote directory discovery, assistant answers, OCR, audio transcription, original-filename search, new date/sender filters, new backend APIs, schema migrations, unrelated navigation redesign, and calling work require separate scope. The existing media model supplies attachment-type labels and has no original-filename column.

## 2. Working-copy baseline and verified findings

The working copy is the baseline, not the committed revision. `git status --short` currently shows extensive existing tracked and untracked changes across application, shared, schema, calling, local-update, plan, evidence, and generated-artifact paths. The current search route and hardening-related components are also modified/untracked in the working copy. No application file was modified by this planning pass. Preserve relevant user-owned tracked and untracked inputs before execution; never use a destructive reset as rollback. Concurrent calling, local-update, account, notification, and shared-string work must remain outside this change and be revalidated only where search callers or contracts overlap. Current source identities for the hardening scope are recorded in the context index and must be refreshed at execution start.

| Finding | Current source and implication |
|---|---|
| Global search already searches beyond 200 rows | `apps/mobile/app/search.tsx` and `src/search/query.ts` use 150 ms message-search debounce, 200-row scan batches, 30-match pages, `(createdAt, messageId)` cursors, Unicode NFKC normalization, nickname/type matching, and AbortController checks. Extend these paths. |
| Scoped search already uses the shared full-history contract | `apps/mobile/app/chat/[chatId]/search.tsx` uses `useMessageSearch`/`searchScopedMessages`, cursor pagination, pending queue items, explicit error/retry states, and pushes message context with `searchQuery`; `loadChatSnapshot(..., { limit: 1 })` is used only for the scope title. Preserve these contracts while hardening shared loading/layout behavior. |
| Membership and organization already affect search | `useChatList` returns active, archived, and ignored items, excludes blocked chats, and uses local deleted preferences. Global search currently includes all three returned lists. Preserve these inclusion rules. |
| Existing contact reads are broader than the new search needs | `src/chats/infoQuery.ts::loadCachedContacts` selects every cached member other than the caller, without joining the caller's membership or the search allowlist. Search requires a scoped adapter. Preserve the existing group-picker callers. |
| Direct-chat creation already has error and conflict handling | `src/chats/directChat.ts::openDirectChat` looks up cached direct chats, then creates rows and resyncs after second-member conflicts. Reuse it, guard repeated taps, and surface its failed outcome. Its multi-row operation is not an atomic backend transaction. |
| Historical navigation/search highlighting are already integrated | `src/chat/query.ts::loadChatSnapshotForMessage`, `app/chat/[chatId]/index.tsx`, `MessageBubble`, and `MessageText` now carry optional search metadata, highlight visible text, and report missing/deleted targets additively. Preserve helper compatibility and verify the hardening pass does not regress this behavior. |
| SearchField has multiple callers | Global search, scoped search, and `app/forward.tsx` consume it. The current field supports controlled/uncontrolled/prefilled values, immediate clear/change callbacks, submit flush, and the default forward debounce. Preserve these contracts while changing only the global-search presentation/lifecycle. |
| Markdown is a supported message contract | `MessageBubble` renders `MessageText`, which provides formatting, image suppression, code styles, URL-scheme restrictions, and current optional search highlighting. Preserve this renderer and its callers during row/highlight optimization. |
| Runtime and commands are established | Current manifests specify Expo 57, Router 57, React Native 0.86.3, React 19.2.3, npm workspaces, Jest mobile tests, and Vitest shared tests. Actual routes live in `apps/mobile/app`. The `src/app` wording in mobile AGENTS is stale. |
| Concurrent native work affects artifact assumptions | Mobile manifest/config now also contain LiveKit/WebRTC packages and Expo plugins, and root layout integrates CallProvider. Search needs no new native dependency, but compatibility of the whole current app with an older client must be established independently. Preserve the concurrent work. |
| Sign-out already consumes search-history cleanup | `app/(main)/(tabs)/settings.tsx::handleSignOut` calls `src/storage/localData.ts::clearLocalData`, and current `src/storage/localData.ts` includes search-history cleanup/fencing. Preserve this integration and verify hardening changes do not weaken it. |
| Historical check results are not automatic current passes | Phase 0–4 reports contain dated source/unit/runtime evidence, including known failures and incomplete native gates. The current working copy has since changed in search, calling, shared strings, manifests, and other consumers. Re-establish affected baselines before hardening implementation and reuse historical results only when source, dependency, fixture, and runtime identities still match. |

Source paths, inspected locations, SHA-256 identities, freshness limits, and inspection outcomes are centralized in the context index. Historical Repomix packets omit the current global/scoped search paths searched during this review. They are supplementary references rather than a current feature packet.

## 3. Requirements and acceptance matrix

SR-01–SR-14 are the accepted end-to-end search requirements from the earlier feature scope. Their dated Phase 0–4 reports are retained as historical evidence, not as a fresh acceptance claim for this hardening pass. The additional hardening requirements UI-01–UI-12 below are the current refinement scope; none is implemented or verified by this planning pass. Every requirement maps to execution work and a verification method.

| ID | Required behavior and observable acceptance | Work | Verification |
|---|---|---|---|
| SR-01 | Open search from the existing header, focus its rounded field, type, submit, clear, and go back. Clearing immediately cancels the active query and restores suggestions/history. Direct entry without `originX` renders correctly. | P1.2, P2.2 | V02, V09, V11 (optional) |
| SR-02 | With an account that belongs to chats A and B, results include permitted active, archived, ignored, and Saved Messages content. Another account's chat C, blocked chats, locally deleted chats, deleted messages, and deleted attachments do not supply searchable content. Known people are derived from allowed chats with a caller-membership join. | P1.1, P1.3, P2.2, P3.1 | V01, V03, V07 |
| SR-03 | People and Groups show relevant names once per entity. Exact matches precede prefixes, then other substrings, with deterministic tie ordering. A known group member without a direct chat can open/create one. Existing direct chats open offline. New-chat creation and remote username lookup give explicit offline/failure feedback. Repeated taps launch one operation. | P1.3, P2.2 | V03, V09, V11 (optional) |
| SR-04 | A keyword in 35 delivered messages older than the latest 200 produces the same 35 delivered matches in global/scoped matching. A Messages conversation row reports the completed total. Counts remain marked as counting until complete. Pages have no duplicate or missing messages at tied timestamps. Scoped pending items remain searchable, status-labeled, account-scoped, and deduplicated against delivered echoes. | P1.1, P3.1 | V01, V04, V07 |
| SR-05 | All shows up to three rows per nonempty section and See all where more exist. People, Groups, and Messages show the full relevant category through virtualized lists. Selecting a Messages conversation opens scoped snippets with the query prefilled. | P2.2, P3.1 | V02, V05, V11 (optional) |
| SR-06 | Opening a result records its person/conversation in account-local device history. History is unique, newest first, capped at 20, survives ordinary reopening, and supports removal and confirmed clear-all. Failed writes preserve the last durable list and offer retry. Unavailable entries are omitted from display. Existing sign-out/local-data clearing removes the new history keys and prevents stale writes from restoring them. | P2.1, P2.2 | V06, V07, V11 (optional) |
| SR-07 | Both scoped entry paths show sender, date, and contextual snippets. Query occurrences in snippets and the selected message are highlighted legibly. Unicode normalization and case expansion do not highlight unrelated characters. Markdown, links, code, and message actions continue to work. Sender-only/type-only matches explain their source. | P1.1, P1.2, P3.1, P3.2 | V04, V08, V11 (optional) |
| SR-08 | Global results → scoped results → message context → Back restores scoped query, pages, and scroll, then global query/filter/pages/scroll. Chat-info entry returns through its own stack. Missing/deleted targets show an unavailable message with a return action. Existing pinned-message navigation and Jump to latest retain their behavior. | P2.2, P3.1, P3.2 | V05, V09, V11 (optional) |
| SR-09 | Local results remain usable offline. An empty query, completed zero-match query, unfinished scan, unavailable scope, read error, timeout, and history-write error each have truthful feedback. Failures expose a bounded explicit retry. They never appear as successful zero results. | P1.1, P2.1, P2.2, P3.1 | V02, V04, V06, V09 |
| SR-10 | Rapid query changes, chat changes, sign-out/account switch, late reads, and cache changes cannot display or navigate using stale account/query/scope data. Edits/deletions refresh counts and snippets. Scoped queue transitions refresh pending matches. Unmount/blur removes active listeners and timers as appropriate. | P1.1, P2.1, P2.2, P3.1, P3.2 | V07, V09 |
| SR-11 | Screens follow Section 4 in both themes, at compact width and enlarged text, with safe areas, keyboard visibility, reduced motion, labeled controls, selected filter states, and legible highlights. Every icon action has a non-overlapping touch target of at least 44 logical pixels. | P1.2, P2.2, P3.1, P3.2 | V08, V10, V11 (optional) |
| SR-12 | Text updates immediately while message work is debounced by 150 ms. Scans read at most 200 source rows per batch, delivered pages contain at most 30 matches, and aggregation retains one summary per conversation. Retained result memory grows with explicitly loaded pages and eligible conversation summaries, without eagerly loading the full message history. A 10,000-message fixture remains scrollable and cancellable. Deadline/retry behavior releases or invalidates requests without spawning overlapping retry loops. | P1.1, P4.2 | V01, V07, V11 (optional) |
| SR-13 | Existing forward-search, chat-info, pinned-message, direct-chat, local-data cleanup, and Markdown callers pass relevant regression checks. New strings follow shared-string conventions. Only feature-obsolete code is removed after caller checks. | P1.2, P2.1, P2.2, P3.2, P4.1 | V06, V08, V09, V10 |
| SR-14 | Execution preserves recoverable tracked/untracked user inputs, uses permitted targets/artifacts, excludes secrets from evidence, records all gate outcomes honestly, and stops task-created processes. | P0.1, P0.2, P0.3, P4.1, P4.2 | V00, V10, V11 (optional) |

### 3.1 UI-hardening requirements and acceptance matrix

| ID | Required behavior and observable acceptance | Planned work | Verification |
|---|---|---|---|
| UI-01 | Search toolbar, filter row, and result origin form one stable vertical stack. The filter row does not move between People, Groups, Messages, loading, error, empty, or no-result states; the excessive gap above filters is removed. | Phase 6 | V12, V16 (optional) |
| UI-02 | People and Groups render independently as local data becomes available. Message counting uses an inline progress label or two-to-three-row skeleton; history shows a loading placeholder and does not show `No history` until loading completes with zero entries. No full-screen spinner replaces typed results. | Phase 6, Phase 7, Phase 11 | V12, V13, V16 (optional) |
| UI-03 | Text input updates immediately; only expensive message work is debounced. The selected category is preserved while typing, clear cancels immediately, only the current request generation may update UI, and no overlapping scans or stale results are visible. | Phase 7 | V01, V07, V12, V16 (optional) |
| UI-04 | Search entry uses exactly one native-driven 200–250 ms transition strategy. Focus occurs once after the transition and does not loop on rerender or route cover/uncover; reduced motion and keyboard behavior remain correct. | Phase 9 | V12, V15, V16 (optional) |
| UI-05 | Search rows use a 48 px avatar, 12 px gap, 64–72 px minimum height, title-first hierarchy, compact metadata, two-line snippet cap, and only subtle separators where useful. All existing details remain accessible at enlarged text and compact width. | Phase 10 | V08, V12, V14, V16 (optional) |
| UI-06 | Filter pills preserve 44 px minimum touch targets, stable selected width, stronger unselected contrast, category retention, and optional counts only after counting completes. | Phase 6, Phase 10 | V10, V12, V16 (optional) |
| UI-07 | Changing a filter, progress state, or unrelated result section does not rerender unchanged rows unnecessarily in instrumented tests; highlight work is reused for unchanged text/query pairs; virtualization remains enabled; `removeClippedSubviews` is enabled only if runtime verification proves safe. | Phase 10 | V07, V08, V10, V16 (optional) |
| UI-08 | Blank search keeps a compact Recent searches rail, clear-all only when entries exist, explicit Edit/Done removal mode, 64–72 px Suggested rows, and no duplicate username action. | Phase 11 | V02, V06, V12, V16 (optional) |
| UI-09 | No-results content is compact and centered only below the filters, with a smaller icon, tighter spacing, concise copy, and a 44–48 px CTA. The toolbar and filters remain fixed. | Phase 6, Phase 11 | V02, V12, V16 (optional) |
| UI-10 | Username lookup is performed in the global search screen using the existing exact-username RPC. It supports optional leading `@`, loading, success, no-match, offline, rate-limit/error, retry, duplicate suppression, safe direct-chat opening, history recording, and repeated-tap protection without navigating to `/new-chat`. | Phase 8 | V02, V03, V05, V12, V15 |
| UI-11 | Required deterministic assertions cover immediate input state, the 150 ms debounce, progress within 50 ms after debounce and no later than 300 ms in the controlled fixture, zero full-screen loading replacements and zero overlapping scans. Optional device targets are: keystroke-to-visible feedback <50 ms, first cached People/Groups result <200–300 ms from the final keystroke, no sustained stress-fixture scroll stutter and preferred per-batch JS work ≤100 ms. | Phase 12 | V13, V16 (optional) |
| UI-12 | The hardening pass preserves account/permission boundaries, offline behavior, history durability, Markdown/highlight semantics, accessibility labels/44 px targets, existing `/new-chat` non-search callers, pinned/ordinary navigation, and recoverable user work. | Phases 6–12 | V06, V08, V09, V10, V14, V15, V16 (optional) |

## 4. Screen and interaction specification

All values here are proposed DoloGram implementation targets. Verify against public Messenger references and record adaptations during Phase 5. Existing tokens govern colors and fonts.

| State | Structure and action |
|---|---|
| Entry | Retain the existing header search icon and expand-to-field transition. Toolbar is 56 logical pixels plus top inset. Field is 40 pixels high with full radius and a 44-pixel clear-action target. Placeholder is Search. Back is always available. |
| Blank query | Show Recent searches as horizontally scrolling 64-pixel avatars and up to two name lines, with Edit beside the heading. Suggested shows up to ten eligible conversations, newest activity first, using 48-pixel avatars and simple two-line rows. With no history or conversations, show the existing search empty state and an actionable username-lookup entry. |
| Entered query | Show All/People/Groups/Messages pills in a fixed-height horizontal strip directly below the toolbar. Preserve the selected category while typing. Clear resets to All. Rows use 16-pixel outer padding, a 48-pixel avatar, a 12-pixel avatar/text gap, titleSm/bodyMd text, compact metadata, and a 64–72-pixel minimum height that grows for accessibility. |
| All/category results | People rows open a person, Groups open a group, and Messages rows show conversation title plus N matched messages. All limits each section to three rows. See all selects that category and starts it at the top. Empty categories have query-specific feedback. |
| Inline username search | For a non-empty query, People/All exposes one explicit inline exact-username lookup action/result. On tap or search submit, trim whitespace, remove at most one leading `@`, and do not call the RPC for an empty candidate. Show loading/success/no-match/offline/rate-limit/error/retry states in place, invalidate a result when the query/account/screen changes, and open a successful person through the existing safe direct-chat path. Search never routes to `/new-chat` for this action. |
| Scoped results | One toolbar field with Back and a visible conversation scope label. Use a virtualized list showing sender, date including year, and up to two snippet lines around the matching text. Continue loading with cursor pagination and retain an accessible Show more action. |
| Message context | Show the original message with surrounding history, readable term highlighting, and the existing focused-row treatment. Restrict search highlighting to the selected message. Jump to latest ends the search highlight treatment. |
| Edit history | Replace the recent-avatar rail with removable rows and Done. Clear all opens the existing confirmation dialog. Cancel preserves history. Storage errors retain existing entries with Retry. Android Back dismisses the dialog, then editing, then the search route according to native keyboard handling. |
| Loading/error | Names can render while messages are counting. Display an inline `Counting messages…`/`Searching messages…` state or compact message skeleton rows while incomplete. History uses a stable loading placeholder. Show exact counts only after completion. A timeout/read error keeps eligible name results usable and supplies Retry for the failed portion. |

Use native keyboard and accessibility behavior through existing components. Avoid focus on every rerender or every return from a message. Restore focus only when opening a fresh search or when the user selects the field. Active motion uses `theme.duration` and `theme.reduceMotion`. Secondary text/highlight combinations must maintain 4.5:1 text contrast against their actual backgrounds, including outgoing custom chat colors.

## 5. Data, state, navigation, and compatibility contracts

### 5.1 Matching and scope

Reuse `normalizeSearch` as the canonical delivered-message predicate foundation. Literal case-insensitive NFKC substring matching applies independently to content, resolved sender name, and live attachment-type labels. Use the same predicate for snippets, delivered counts, and scoped messages. Keep raw input for the field and the separately normalized username lookup candidate. The backend's exact-username rules continue through `findUser`.

Derive eligible conversation IDs from the existing account-specific chat-list output, including ignored/archived chats. Confirm caller membership again in SQL and when opening a result. A direct scoped route must satisfy the same authorization checks. A blocked direct target must not be reopened through a People candidate supplied by a different group. Locally deleted chat messages remain excluded. An explicit person selection may reuse the established direct-chat reopening behavior after eligibility checks.

**Proposed search-local contracts**, placed in `src/search` rather than route files, include a conversation summary `{ chatId, deliveredMatchCount, latestMatch }`, a scoped page `{ matches, next }`, and request identity `{ userId, allowedChatIds, chatId?, normalizedQuery, generation }`. Preserve the existing `searchCachedMessages` callable contract unless all known callers/tests are updated together. Add optional match-source metadata for content/sender/attachment explanations. Stored names/previews are derived values rather than history identifiers.

A completed conversation summary represents one stable search generation. Aggregate all matches while retaining one summary per conversation. The existing timestamp/message-ID ordering remains the delivered cursor order. Group ordering follows latest matching timestamp, then message ID, then chat ID. Name ordering uses exact/prefix/substring class, newest existing conversation activity, normalized name, and entity ID.

Scoped search also merges relevant unsent items from `getUnsentItems`, filtered by selected chat and the authenticated sender. Use `temp_id = message_id` to deduplicate delivered echoes, preserve existing queue statuses, and subscribe to `subscribeQueueChange`. Global conversation totals remain delivered-message totals, matching existing global behavior. Scoped summaries identify queued matches separately so they do not silently inflate a delivered total. Pending target navigation must still resolve to the existing queued bubble.

Cache/queue events invalidate the affected generation, refresh counts/pages, and coalesce bursts. The current `subscribeChatPreferenceChanges` API also supplies relevant chat block/preference changes. Observe those changes for candidate scopes without altering unrelated consumers. Revalidate on focus because the screen may have been frozen or unsubscribed. Preserve scroll by entity/message key where possible. Remove stale content promptly when permission or deletion changes. Keep only one underlying scan per scope at a time: if a native/database read cannot be physically cancelled, do not start the coalesced rerun until the prior loader promise settles; publish only the newest generation. Check cancellation between batches and discard late native results. Proposed local-search deadline is 15 seconds with visible timeout and user-triggered retry. A native read already in flight may finish after cancellation, but its result cannot update UI or release another request's guard.

No migration or new runtime dependency is planned. Existing cache v7 columns/indexes and AsyncStorage cover the feature. If measured performance cannot meet SR-12 with bounded batching, document the query bottleneck and propose the smallest change before adding a schema or indexing dependency.

### 5.2 People and creation

Add a search-local contact query anchored to allowed chat IDs and the caller's membership. Deduplicate by user ID and reuse the shared contact representation where compatible. Include contacts known only through groups. Match the canonical display name and permitted cached direct-chat nickname, while using the existing direct-chat title in its result. Keep Saved Messages discoverable as a conversation shortcut in People without creating a second self-chat.

Resolve an existing eligible direct chat before using `openDirectChat`. A failed or timed-out cache/eligibility preflight produces an explicit read failure and performs no create mutation. Creation requires a successful eligible lookup that finds no existing direct chat. This caller-side guard is necessary because `openDirectChat` itself catches a cache-read failure and can proceed to creation. Preserve that helper's ordinary callers. Offline, open existing cached chats and disable creation for a person with no existing chat with explicit connection feedback. Online, use the existing creation outcome and resync handling. Hold an operation lock until resolution and ignore navigation from a previous account. Typing does not create chats or issue remote lookups.

Global search performs the existing exact-username `findUser` lookup in place only after an explicit username-action tap or search submission; it must not issue a remote lookup on every keystroke. Trim whitespace, remove at most one leading `@`, reject an empty candidate locally, and use one in-flight lookup per account/query generation. Wrap the existing client call in the established bounded search-read/deadline pattern or an equivalent search-local deadline without changing the Supabase RPC contract. A timeout, query change, account change, blur/leave, or clear invalidates publication of the result; a late native/network settlement is consumed but cannot update UI or release a newer guard. Reuse the authenticated RPC contract, exact case-insensitive matching, not-found/rate-limit/network errors, and existing direct-chat/open-history path. The search screen must not navigate to `/new-chat` for username lookup. Preserve `/new-chat` and its existing behavior for non-search callers; do not remove or change its route until a separate caller audit confirms it is no longer needed. Avoid automatic mutation retries after an ambiguous network failure. Reconcile using existing direct-chat lookup/resync before another explicit attempt.

The remote exact-username result is intentionally distinct from a locally eligible People result: the authenticated `find_user` RPC may return one exact user who is not already cached in a shared chat. Do not expose broader directory data. Adapt the returned `{ user_id, display_name }` to the existing People-row presentation only for the active query. For a cached local People result, retain the search membership/allowlist preflight before navigation or creation. For a remote exact-username result, do not require `loadSearchPeople` membership because that would reject the intended new-contact flow; reuse the existing New Chat `openDirectChat` contract with its operation guard, server-side authenticated `open_direct_chat` call, mutation error mapping, resync, and recorded residual cache-read race. A username lookup failure must never call `openDirectChat`.

### 5.3 History

Proposed storage key is `dg.searchHistory:<userId>` with payload `{ version: 1, entries }`. Each entry is `{ kind: 'person' | 'chat', id: string, selectedAt: number }`, where time is epoch milliseconds. Cap entries at 20 after canonical deduplication. Selecting a known regular direct conversation, including a message result from it, records its person identity. Groups and Saved Messages record their chat identity. This collapses a direct conversation and its person into one recent item. Resolve entries against current eligibility each time they render. New accounts/absent storage begin empty. Validate malformed entries without crashing or reading another account's key. An unsupported future version is reported as unavailable history and is preserved until an explicit clear action.

Serialize read/modify/write mutations per account, continue the chain after failure, and use a generation guard so an earlier load cannot restore removed entries. Keep the last durable state until a write succeeds and offer explicit retry after failure. Selecting a result must still open it when recording history fails. Search-screen Clear all affects only this account's history key. Integrate a device-history cleanup helper with the existing `clearLocalData` path, which is called by sign-out. That operation removes only the feature's history-key prefix across this device, fences in-flight history mutations, and invalidates stale writers before reporting success. Its failure remains recoverable through the established sign-out error/retry path. Preserve other device preferences and saved-account behavior.

History reads/writes/cleanup use a 15-second logical UI deadline. A timeout is reported as an unknown durable outcome until the native promise settles. Generation guards suppress stale UI updates, but they do not cancel a physical storage write. Keep that write tracked in the serialization chain, reconcile by reading storage after it settles, and avoid overlapping mutation retries. A clear operation stays ordered after older writes and cannot report success before its own removal succeeds. Account exit invalidates older writers even when navigation has completed. If native storage never settles, show the timeout, preserve the pending operation fence, and continue independent app work. Record the blocked storage operation rather than retrying it indefinitely.

When history has an unsupported future version, ordinary result selections still open their destination but cannot overwrite that history payload. Show an explicit unavailable-history state with the existing clear confirmation reachable. A confirmed clear may replace it with an empty version-1 payload.

### 5.4 Routes and shared callers

Use existing routes `/search`, `/chat/[chatId]/search`, `/chat/[chatId]`, and `/new-chat`. Proposed optional parameters are scoped `query` and chat `searchQuery` alongside existing `focusMessageId`. Username lookup from global search is local screen state and does not add a route parameter or search-origin navigation. `/new-chat` retains its current `username`/`searchOrigin` compatibility parameters for non-search callers until a caller audit proves they can be retired. Validate missing/array parameters and account scope. Raw queries are navigation state, not analytics or diagnostic output.

Use a push/return flow that retains the scoped screen. Verify the Expo Router 57 stack contract in source and navigation tests when the same chat is already underneath search. Actual device Back-stack observation is optional. Existing chat and pinned routes also use `focusMessageId`; optional search metadata must preserve their established behavior. Missing or deleted search targets get explicit feedback without changing non-search helper callers' expectations.

Extend SearchField with a backward-compatible controlled/uncontrolled API. Render and clear from one current value. Preserve immediate clearing, 150 ms default callback debounce for forward-search callers, and timer cleanup. Global/scoped inputs update immediately while the query layer controls debounce. Ensure submission uses current text even with a pending timer.

Pass an optional highlight query through MessageBubble into MessageText. Preserve Markdown AST structure, code/font styles, URL handling, image suppression, and native text selection/actions. Unicode highlight ranges must map normalized matches to original display text without changing the saved or displayed message. A query spanning multiple rendered Markdown leaves requires contiguous rendered-text range handling. For matches found only in hidden Markdown syntax or a link destination, retain the focused-row highlight and explain the matched raw content in the search snippet rather than inventing a visible term highlight.

## 6. Execution phases and measurable work items

These phases are specific to search and do not inherit the numbering or incomplete release gates of the older Android plan. Items within each phase have equal weight. An item earns credit only after its stated work and applicable acceptance assertions pass. A recorded failed, blocked, or unrun required assertion does not earn completion credit. Shared execution rules in Section 8 apply throughout. Source baselines and recoverable snapshots gate code changes. Device observations are supplemental and carry no completion weight. Required source and automated verification remain in the denominator. For P0 baseline capture, completing the work means capturing and classifying the actual baseline result, including a pre-existing failure, rather than requiring the unchanged application to pass every repository check before coding can start.

Verification IDs group related assertions across phases. Their ownership below defines which assertions are due at each gate. Listing a group in a work item does not claim the whole group has passed before later integration exists.

| Phase | Assertions owned by its items and gate |
|---|---|
| Phase 0 | V00 snapshots and V10 existing-test/toolchain baseline. Optional device discovery and reference observations do not gate this phase. |
| Phase 1 | V01 query/count/cursor assertions, V02 field contract, V03 people adapter/ranking, V04 scoped-data/pending merge, V07 request lifecycle, and V08 pure highlight-range helpers. Screen creation/opening and Markdown-renderer integration are due later. |
| Phase 2 | V02 global screen, V03 person opening/username handoff, V06 history/cleanup, V07 global/history state, V05 global route-parameter handoff, and V09 affected field/New Chat/cleanup callers. |
| Phase 3 | V04 scoped UI/target selection, V05 full navigation/state retention, V07 scoped/context invalidation, V08 Markdown-renderer highlights, and V09 historical/pinned/account/calling-consumer preservation. |
| Phase 4 | V00–V10 applicable source and automated checks, cleanup for operations performed, rollback and handoff. V11 is optional. |

### Phase 0 — Establish safe execution inputs

**Scope and prerequisites.** Supporting preparation after implementation is authorized. Inputs are this plan, the context index, current instructions, manifests, and relevant working-copy files. Affected artifacts are local search evidence/snapshots under `docs/test-results/search/`, created during execution.

- **P0.1** Recheck status/diffs, refresh changed source identities, and create recoverable snapshots of relevant tracked and untracked sources. Include hashes and restore instructions, exclude credentials and unrelated files. Read the installed/versioned Expo SDK 57 and React Native 0.86 APIs needed by the implementation.
- **P0.2** Record V00/V10 baselines with exact command, exit/timeout, toolchain and log path. If running optional device checks, confirm the assigned MuMu identity and artifact before use. Preserve existing services.
- **P0.3** Finalize the Section 4 screen checklist and document the public-reference adaptations. Define isolated synthetic fixtures. If running optional device measurements, verify the target and fixture isolation first.

**Baseline checks.** Hash/status review, confirmed package scripts, existing targeted tests, lint, and typecheck. No live credentials are needed for source/unit baselines.

**Acceptance gate.** Snapshots and baseline evidence are recoverable, scope/constraints are explicit, and required code contracts have no material ambiguity. Device/reference gaps are assigned to their affected verification items rather than silently treated as passes.

**Phase 0 progress/status — 2026-11-11, Asia/Manila: Complete, 3/3 items (100%).** This execution record supersedes the historical planning-only status above for Phase 0. Phases 1–4 have not started. Search-plan progress is 3/12 predefined items (25% by item count); broader DoloGram project progress is not defined.

| Item | Entry classification | Verified completion |
|---|---|---|
| P0.1 | Partially done — prior source/docs audit, no execution snapshots | Complete — instructions/current contracts checked; 72 recoverable source/config snapshots and restore rehearsal; fresh identities; Repomix 1.18.1 scoped XML generated, all 13 entries/980 lines read and original-source matched; relevant Expo 57/RN 0.86 docs read. |
| P0.2 | Not started — historical checks/device reports only | Complete — exact baseline logs/toolchain; named MuMu mapping and installed/local APK hashes verified; installed client exercised native RN/SQLite with the unchanged query; existing services preserved and task-owned processes/mapping stopped. Baseline capture includes failures, not a clean-check claim. |
| P0.3 | Partially done — proposed adaptation/public links, no safe runtime fixture | Complete — Section 4 checklist finalized with public-reference limits; wrong-product iPhoneLife link excluded; offline synthetic native SQLite fixture and network fence verified; existing query timing captured. V11 retains optional connected and full-product UI observations. |

**Dated verification note.** Workspace typecheck passed initially and finally. Initial mobile lint returned exit 0; final lint failed with 13 errors/3 warnings in seven application files untouched by this task, with both outputs retained and the differing outcome unexplained. Shared tests passed (20 files/149 tests). Initial targeted Jest failed on sandbox cache rename; the writable-cache combined run timed out at 120 seconds. After config/list discovery, split runs passed all six existing suites (29 tests total). Strict fixture typecheck and explicit fixture lint passed. Final native query sample on MuMu `dologram`/`127.0.0.1:16480` found all 35 old matches: 45.51 ms first page, 51.34 ms two-page total, zero reads for an already-cancelled request, zero final fixture console errors/warnings. These are query wall times, not end-to-end UI latency or the later 10,000-message gate.

**Constraints, discrepancies and remaining gates.** The AGENTS route-location sentence differs from actual `apps/mobile/app` routes; Phase 0 changes no product routes. Concurrent user video-call actions/strings were preserved and refreshed separately. Original Metro 8082 failed to serve the project; the task used and stopped its own offline fixture server. Existing APK compatibility is verified for the exercised search foundation, not the entire product/calling stack. Exact current Messenger parity, connected disposable fixtures and integrated V11 screens/navigation/stress remain unverified later-phase gates. No dependency, application-source, migration, remote configuration, commit, push, build or deployment change was made by this task.

Evidence: [Phase 0 report](../docs/test-results/search/phase-00/report.md), [screen checklist](../docs/test-results/search/phase-00/screen-checklist.md), [recovery/fixture procedure](../docs/test-results/search/phase-00/recovery.md), and the [central context index](context/DoloGram_Search_Context_Index.md). **Next phase ready to start: yes on source/unit prerequisites; Phase 1 was not started.**

**Refresh revalidation — 2026-11-12, Asia/Manila: still Complete, 3/3 items (100%).** Phase 0 was re-executed against the current post-Phase-4 working copy instead of relying on the dated record, because 40 of the 72 recorded live files had changed and the baseline no longer described the copy a future phase would start from. A second dated generation, [`refresh-20261112`](../docs/test-results/search/phase-00/refresh-20261112/report.md), now holds 69 current search/shared/config/instruction/plan snapshots (1,335,842 bytes) with per-file SHA-256, byte counts, a 200,901-byte `tracked-search.diff` for search-relevant tracked paths, diffstat, status and HEAD; every snapshot re-hashed with zero mismatches, a restore-to-scratch rehearsal passed, and no live file drifted between capture and validation. The original 72-file 2026-11-11 baseline is preserved unchanged and still verifies, so recovery.md now distinguishes the pre-implementation generation from the current one. Fresh V00/V10 baseline: workspace typecheck passed (33 s); shared Vitest passed 21 files/154 tests (was 20/149); mobile lint failed with 21 problems (17 errors/4 warnings) in nine non-search files (was 13/3 as concurrent work changed `Avatar.tsx`, added `FloatingActionButton.tsx` and edited `info.tsx`/`nicknames.tsx`); and the plan's six-file targeted mobile command failed with 5/6 suites and 36/37 tests because `a11yPressableSource` reports an unlabeled `Pressable` at `apps/mobile/src/components/VoiceNotePlayer.tsx:69` (concurrent voice-note work; that test passed on 2026-11-11). No search-owned file carries a lint or test failure, and no source was edited by this pass. Runtime: the assigned target is still `127.0.0.1:16480` (SM-S908B, Android 12, x86_64, `com.dologram.app` 1.0.0) but it now serves a reinstalled APK, SHA-256 `13d4ccee…7468`, lastUpdateTime 2026-11-12 09:13:57, instead of the recorded `fb5aef22…0331`; `emulator-5556` was untouched. The unchanged offline fixture imported the current `searchCachedMessages` source and reproduced 35/35 old matches at 51.47 ms first page / 57.10 ms total with 200/60/5-row batches, zero reads after abort and zero console errors/warnings; the task's Metro process, fixture activity and added `tcp:8084` reverse were removed. Phase 0 still makes no application, dependency, migration, backend or configuration change, no later phase was begun or altered, and all earlier pending gates (connected fixtures, themes/large text/keyboard/native Back/retained scroll, 10,000-message stress, exact Messenger geometry) remain later-phase work.

Evidence for this refresh: [report](../docs/test-results/search/phase-00/refresh-20261112/report.md), [validation](../docs/test-results/search/phase-00/refresh-20261112/validation.json), [baseline checks](../docs/test-results/search/phase-00/refresh-20261112/checks/results.json), [runtime identity](../docs/test-results/search/phase-00/refresh-20261112/runtime/assigned-runtime.json), and [native timing](../docs/test-results/search/phase-00/refresh-20261112/runtime/native-timing.json).

### Phase 1 — Shared query and input foundation

**Scope and prerequisites.** Depends on P0 source/baseline preparation. Context is Section 5, current query tests, SQLite schema, SearchField callers, organization logic, and queue contracts.

- **P1.1** Extend `apps/mobile/src/search/query.ts` with shared matching, source metadata, summary counting, scoped pagination, pending-item compatibility, cancellation/deadline/generation logic, and cache/queue invalidation. Add a small shared search hook only where both screens require it. Verify V01/V04/V07.
- **P1.2** Extend `src/components/SearchField.tsx`, add reusable search rows/highlight-range support under `src/search`, and add shared search strings in `packages/shared/src/strings/index.ts`. Verify controlled/uncontrolled/forward callers and V02/V08.
- **P1.3** Add the scoped people adapter and deterministic ranking in `src/search`. Reuse `findDirectChatId`, contact types, and existing direct-chat outcomes without changing the group-picker contract. Verify V03.

**Proposed new files.** `src/search/people.ts`, `src/search/useMessageSearch.ts`, `src/search/HighlightedText.tsx`, and `src/search/SearchResultRow.tsx`, only to house the corresponding required shared behavior. These files do not currently exist. New interfaces remain local unless an existing shared consumer requires them.

**Baseline checks.** Current query/ChatSearch behavior, forward field behavior, membership filtering, and queue-merging fixtures.

**Acceptance gate.** Query/count/cursor assertions from V01, SearchField assertions from V02, candidate/ranking assertions from V03, scoped-data/pending assertions from V04, and request-lifecycle assertions from V07 pass. Global-screen and navigation assertions from those verification groups are due in Phases 2–3. Relevant callers typecheck and data contracts are ready for both screens. Search introduces no migration or dependency installation.

**Phase 1 progress/status — 2026-11-11, Asia/Manila: Complete, 3/3 items (100%).** Phase 0 source/unit prerequisites were confirmed against recoverable snapshots, actual code and check evidence. This execution record supersedes earlier planning-only/not-started statements for Phase 1. Search-plan progress is 6/12 predefined items (50% by item count); broader project progress has no defined denominator. Phases 2–4 were not started.

| Item | Entry classification | Verified completion |
|---|---|---|
| P1.1 | Partially done — existing delivered batch/page search only | Complete — shared matching/source metadata, completed conversation counts, scoped pagination and account-scoped pending compatibility, deadline/cancellation/generation/focus/event lifecycle. V01/V04/V07 foundation assertions pass, including 10,000 messages/100 chats with 200-row source batches and one retained summary per chat. |
| P1.2 | Partially done — uncontrolled field only | Complete — controlled/uncontrolled/prefilled field, immediate changes/clear, default forward debounce and submit flush, themed reusable rows/highlighted text, original-text Unicode ranges and shared strings. V02 field/V08 pure helper assertions and existing caller/accessibility regressions pass. |
| P1.3 | Not started — existing broad contact read unsuitable for search | Complete — separate membership/allowlist people adapter, cross-group blocked-person exclusion, deduplication, canonical/nickname matching, Saved Messages shortcut, existing direct lookup and deterministic name ranking. V03 candidate/ranking assertions pass. Opening/creation/username UI remains Phase 2. |

**Dated verification note.** Fresh pre-edit baseline: workspace typecheck passed; existing four targeted suites passed (23 tests); shared tests passed (20 files/149 tests); lint failed with 13 errors/3 warnings in existing unrelated files. Final workspace typecheck passed. Foundation suites passed (6 suites/36 tests); expanded existing search/chat/Markdown regression command passed (4 suites/29 tests, including query tests also in foundation); accessibility passed (2 suites/6 tests); chat-list/preferences passed (2 suites/9 tests); shared tests passed (20 files/149 tests). Final lint remains failed with the same 13 errors/3 warnings and zero new findings. Strict evidence-fixture typecheck, snapshot/restore/packet/hash audit passed. Initial implementation/test failures and their diagnosed corrections remain in the evidence; no assertion was skipped or suppressed.

**Native observation and limits.** Confirmed MuMu `dologram` / `127.0.0.1:16480` exercised the updated source in a network-fenced, in-memory fixture: 30+5 delivered matches, completed total 35, scoped page 30 plus one pending match retaining its queue ID/failed status, zero fixture-process JavaScript errors/warnings. First-page/two-page query wall time was 104.45/110.42 ms; separate count scan 31.29 ms. This is one query sample, not UI latency or a Phase 4 performance pass. The raw cancellation metric includes subsequent reads; its immediate zero-read assertion passed, and the evidence-source bookkeeping correction is explicitly not claimed rerun. Task servers/activity stopped, only added 8085 reverse removed, existing mappings/services preserved.

**Decisions/discrepancies.** A real in-memory SQL fixture exposed seven bound values for six placeholders in the existing chat-list loader. Removing the one extra binding was strictly necessary for the adapter's shared direct-chat lookup; the SQL and ordinary callers retain their contracts and relevant regressions pass. Mobile AGENTS' route-location wording remains stale, but Phase 1 creates/changes no routes. No dependency, migration, backend/configuration change, commit, push, build or deployment was performed. The reusable foundation exports await screen/Markdown integration in the authorized later phases; those integrations were not started.

Evidence: [Phase 1 report](../docs/test-results/search/phase-01/report.md), [check and recovery identities](../docs/test-results/search/phase-01/validation.json), and [central context index](context/DoloGram_Search_Context_Index.md). **Next phase ready to start: yes on source/unit prerequisites.** Connected fixtures, full product navigation/theme/large-font observation and native 10k stress remain later-phase gates, not pending Phase 1 criteria.

**Refresh revalidation — 2026-11-12, Asia/Manila: still Complete, 3/3 items (100%).** Phase 1 was re-audited against the current working copy instead of its 2026-11-11 record, because Phases 2–4 later edited the shared search modules and added their screen/Markdown consumers. P1.1–P1.3 were re-read and their acceptance assertions re-exercised; no requirement was missing, so no application source changed in this pass. Fresh results: workspace typecheck passed; the six Phase 1 foundation suites passed (37 tests); the affected consumer batch passed 5 of 6 suites (27 of 28 tests) with the only failure being the pre-existing unrelated unlabeled `Pressable` at `apps/mobile/src/components/VoiceNotePlayer.tsx:69` already recorded in the Phase 0 `refresh-20261112` baseline; shared Vitest passed (21 files/154 tests); mobile lint reported the same 21 problems (17 errors/4 warnings) as that baseline with no Phase 1 file named; `git diff --check` was clean. V01, V02, V03, V04, V07 and the pure-helper portion of V08 are met; Markdown leaf highlighting stays with Phase 3 and is covered by the passing `MessageText` suite. Current identities for the eight production modules and four focused tests are recorded in the evidence file.

**Refresh discrepancies.** The highlight-range helpers and the deadline/read wrapper now live in `src/search/matching.ts` and `src/search/request.ts` rather than inside `query.ts`/`HighlightedText.tsx`, and the focused field test is `apps/mobile/src/components/__tests__/SearchField.test.tsx`; the Phase 1 proposed-file list names neither extra module. Both are behaviour-neutral relative to the recorded contract. No native observation was performed, so Phase 4's V11 and Phase 12's V16 remain the optional owners of light/dark, compact, enlarged-text, keyboard, Back/scroll and 10,000-message observations. Hardening Phases 5–12 were not started, and no dependency, migration, backend, commit, push, build or deployment change was made.

Evidence for this revalidation: [revalidation report](../docs/test-results/search/phase-01/revalidation-20261112.md) and its retained [check logs](../docs/test-results/search/phase-01/revalidation-20261112/checks/).

### Phase 2 — Global search and recent history

**Scope and prerequisites.** Depends on Phase 1 contracts. Inputs are global search/header routes, Avatar/Button/Dialog/theme components, the history conventions, and direct-chat/New Chat flows.

- **P2.1** Implement `src/search/history.ts` and history management UI, including typed entries, serialized writes, durable-failure handling, removal, and clear confirmation. Integrate feature-key cleanup and stale-writer fencing with `src/storage/localData.ts`, checking its Settings sign-out caller. Verify V06/V07, including interrupted cleanup and retry.
- **P2.2** Rework `app/search.tsx` around blank-query suggestions, recents, categories, See all, grouped counts, independent name/message loading, error/retry handling, known-person opening, and username handoff in `app/new-chat.tsx`. Preserve the existing header entry and expansion origin. Verify V02/V03/V05/V06/V09 and affected caller checks.

**Proposed additional file.** `src/search/SearchSuggestions.tsx` for the blank-query/history UI. Reuse existing Dialog, Avatar, and Button. New code outside route files stays under `src`.

**Baseline checks.** Compare old global search tests and existing exact-username/direct-chat behavior. Confirm no opening guard remains stuck after a failed request.

**Acceptance gate.** Global screen states, history, person-opening behavior, and the scoped-route handoff contract pass automated component/navigation assertions. Account boundaries hold and every category/error state has a reachable path. Actual scoped-query consumption and original-message context integration are due in Phase 3. Retain pending V11 screenshot results truthfully if the assigned runtime remains unavailable.

**Phase 2 progress/status — 2026-11-12, Asia/Manila: Complete, 2/2 items (100%).** Phase 1 contracts and prerequisites were confirmed in source before implementation. Search-plan progress is 8/12 predefined items (67% by item count); broader project progress has no defined denominator. Phase 3 was not started. See the [Phase 2 execution report](../docs/test-results/search/phase-02/report.md) and scoped [Repomix context packet](../supabase/repomix/docs/test-results/search/phase-02/context.xml).

| Item | Entry classification | Verified completion |
|---|---|---|
| P2.1 | Not started — no history module or cleanup integration | Complete — account-local typed/versioned AsyncStorage history, validation, cap/deduplication, serialized writes, deadlines, stale-writer fencing, durable write failure with explicit retry, removal, confirmed clear, unsupported-version preservation, and sign-out cleanup through `clearLocalData`. History and cleanup-key isolation assertions pass. |
| P2.2 | Partially done — the route only had chat/message search | Complete — blank suggestions/recents, eligible people/groups/messages, category filters, grouped counts/See all, independent people/message loading and retries, known-person opening with preflight, guarded failures, history recording, username handoff with scalar prefill/origin return, and scoped-route query handoff. Global screen/history/navigation assertions pass. Scoped query consumption and original-message context remain Phase 3. |

**Dated verification note.** Fresh pre-edit baseline recorded workspace typecheck passed, shared tests passed (20 files/149 tests), mobile lint failed with the existing 13 errors/3 warnings in unrelated files, and the initial targeted Jest run was blocked by the known transform-cache EPERM. Final workspace typecheck passed; owned Phase 2 lint passed; the Phase 2/search/chat/accessibility regression command passed 12 suites/66 tests; the final focused Phase 2 rerun passed 2 suites/7 tests; and shared tests passed 20 files/149 tests. `git diff --check` passed. No new dependency, migration, schema, backend/configuration change, commit, push or deployment was made. V11 device/theme/large-text/keyboard/native-Back screenshots remain pending because the current ADB inventory did not expose the assigned MuMu `dologram` endpoint. Concurrent calling/info/notification edits were preserved. **Next phase ready to start: yes on source/unit prerequisites; Phase 3 scoped implementation remains deliberately untouched.**

**Revalidation — 2026-11-12 (Phase 2 audit pass), Asia/Manila: still Complete, 2/2 items (100%).** P2.1/P2.2 were re-classified against the current working copy instead of relying on the dated record, because later phases and concurrent work changed the search surface after it (`apps/mobile/src/search/people.ts`, `SearchSuggestions.tsx`, `app/search.tsx`, and the newer `SearchToolbar.tsx`/`transition.ts`/`useSearchContentActive.ts`). The account-local history module, its serialized/versioned persistence and deadlines, the stale-writer fencing, duplicate/confirmed-clear/removal UI, `clearLocalData` integration, blank suggestions/recents, categories, grouped counts with See all, independent people/message loading with retries, guarded known-person opening, and the `/new-chat` plus scoped-route handoffs are all present in source and were exercised. No production defect required a fix, so no application source changed in this pass. What was missing was required verification, not behaviour: the recorded V06 evidence lacked deferred-promise timeout/late-settlement, cleanup-ordering, cleanup-retry, in-flight-writer-fencing and the focused local-data cleanup test, and V02/V03 lacked global-screen assertions for immediate clear, category retention, three-row capping with See all, independent failures, offline no-create feedback, the repeated-tap guard, and the history rail/edit/clear/write-error paths. Those assertions were added in `src/search/__tests__/SearchScreen.test.tsx` (14 tests), `src/search/__tests__/history.test.ts` (8 tests) and the new `src/storage/__tests__/localData.test.ts` (3 tests). Checks: mobile and shared typecheck passed; ESLint over the three changed test files passed; the Phase 2 plus affected-caller Jest batch passed 14 suites/86 tests with the single pre-existing unrelated failure `src/__tests__/a11yPressableSource.test.ts` (unlabeled `Pressable` at `apps/mobile/src/components/VoiceNotePlayer.tsx:69`, unchanged by this pass and already in the `refresh-20261112` baseline); `git diff --check` was clean. Discrepancies recorded: the earlier report's wording that blank loading/ready/unavailable/error history states were all covered by component assertions overstated coverage — the blank-state history-loading placeholder is owned by Phase 6 (H6.4) and is still unimplemented, so `No history` can appear before history finishes loading; the report's file hashes are stale; and the three newer search modules postdate the Phase 2 record. Runtime: the assigned target `127.0.0.1:16480` (SM-S908B, `com.dologram.app`) is reachable by ADB again, but no UI/screenshot/device flow was performed in this pass, so V11 stays pending manual verification. No dependency, migration, backend/configuration, commit, push, build or deployment change was made, and Phase 3 onward was not touched. **Next phase ready to start: yes on source/unit prerequisites.**

### Phase 3 — Scoped results and original-message context

**Scope and prerequisites.** Depends on Phases 1 and 2 route/data contracts. Inputs include scoped search, chat-info search action, ChatScreen focus/load/scroll handling, pinned-message consumers, MessageBubble, MessageText, and historical query tests.

- **P3.1** Replace scoped snapshot filtering with shared full-history pagination plus supported pending matches. Prefill from global search, display scope/snippets/source explanations, and preserve pages/query/scroll through focus changes and Back. Verify V04/V05/V07/V09.
- **P3.2** Thread optional search query metadata through chat navigation and message rendering. Detect unavailable targets, handle bounded scroll-to-index recovery, and clear search treatment on Jump to latest. Preserve pinned-message and ordinary chat callers. Verify V05/V08/V09.

**Affected paths.** `app/chat/[chatId]/search.tsx`, `app/chat/[chatId]/index.tsx`, `src/chat/query.ts` only if additive availability metadata is necessary, `src/components/MessageBubble.tsx`, and `src/components/MessageText.tsx`. Inspect `app/chat/[chatId]/info.tsx` and `pinned.tsx` as integration consumers. Root `_layout.tsx` changes are needed only if actual stack tests demonstrate a route-discovery or transition defect caused by this feature.

**Baseline checks.** Historical-message helper test, current missing-target fallback, Markdown suite, and existing forward/pinned/ordinary chat navigation.

**Acceptance gate.** Automated global/scoped/context/Back flows pass. Historical, pending, deleted, and unavailable targets have correct outcomes. Markdown and non-search navigation regressions pass.

**Phase 3 progress/status — 2026-11-12, Asia/Manila: Complete, 2/2 items (100%).** Phases 1 and 2 contracts were confirmed in source before editing. The scoped route now consumes the shared full-history/pending search contract, preserves search state through push/back, and the chat renderer receives search metadata with additive target-availability reporting. Search-plan progress is 10/12 predefined items (83% by item count); broader project progress has no defined denominator. Phase 4 was not started.

| Item | Entry classification | Verified completion |
|---|---|---|
| P3.1 | Not started — the route filtered only a 200-message snapshot and used replace navigation | Complete — scoped search uses `useMessageSearch`/`searchScopedMessages`, full-history cursor pages, account/membership validation, queued-message status and deduplication, sender/date/snippet/source presentation, explicit loading/error/retry/empty states, scope label, controlled global-query prefill, virtualized results, and push/back retention. Focused route test and shared query tests pass; focus-return page/query retention was completed in the 2026-11-12 completion audit. |
| P3.2 | Not started — chat navigation carried only `focusMessageId`; MessageText had no search highlight input; missing targets fell back silently | Complete — `searchQuery` is threaded through result navigation and `MessageBubble`/`MessageText`; visible Markdown/code/alt/block text uses canonical Unicode ranges; deleted/missing targets report availability and offer a return action; Jump to latest clears search highlighting; existing pinned/ordinary callers retain optional-parameter behavior. Historical-query and MessageText tests pass; contiguous cross-leaf Markdown ranges were completed in the 2026-11-12 completion audit. |

**Dated verification note.** Fresh pre-edit baseline recorded root typecheck failure in pre-existing `src/notifications/pushNotifications.ts`, full mobile lint failure with the same 13 errors/3 warnings outside Phase 3, and the first targeted Jest run blocked by sandbox-cache `EPERM`; a workspace-local cache reproduced the baseline with five suites passing and the unchanged Phase 2 `SearchScreen.test.tsx` timing out. Final mobile typecheck passed, root workspace typecheck passed, owned Phase 3 ESLint passed, six Phase 3 suites passed (43 tests), shared tests passed (20 files/149 tests), and `git diff --check` passed. The V09 regression command passed `actionScreens.test.tsx` but was stopped after the remaining three unchanged suites produced no output for over one minute; no Phase 3 failure was observed. Full mobile lint remains failed with the same 13 errors/3 warnings. The scoped Repomix packet was generated and analyzed before edits at `docs/test-results/search/phase-03/context.xml` (Repomix 1.18.1, 23 files, SHA-256 `60DDDBEDE1357D5620886F6B1935A7F96FABDBCECE24529C46170F2AFC9417FA`). No dependency, migration, backend/configuration change, commit, push, deployment or Phase 4 work was made. Native MuMu visual/Back/large-text/performance verification remains a Phase 4/V11 gate.

**Phase 3 acceptance status.** Source/unit acceptance is met for scoped pagination, pending/deleted/missing targets, Markdown highlights, query/back handoff, and preserved optional navigation contracts. Real native Back-stack, theme/large-text/keyboard behavior, scroll restoration, and the incomplete V09 regression batch remain pending manual or Phase 4 verification. **Next phase ready to start: yes on the completed Phase 3 source/unit gate; Phase 4 owns integrated verification and records any optional device observations.**

**Completion audit — 2026-11-12, Asia/Manila: still Complete, 2/2 items (100%).** Phase 3 was re-classified against the current working copy rather than the dated record, because the evidence directory held only `context.xml` and no report, and later Phase 4/concurrent work touched the same files. P3.1 and P3.2 were re-read item by item. Most requirements were genuinely implemented: shared cursor pagination with pending merge and echo deduplication, global-query prefill, scope/sender/date/snippet presentation with sender/attachment explanations composed into the preview, `searchQuery` threading into `MessageBubble`/`MessageText`, additive target-availability reporting with a return action, bounded `onScrollToIndexFailed` recovery, Jump-to-latest cleanup, and unchanged pinned/ordinary callers. Two requirements were only partial and are now implemented: (1) P3.1 required pages and scroll to survive focus changes and Back, but `useMessageSearch` keyed its state on the active flag, so returning from a message context blanked the result, unmounted the list, refetched page one and discarded loaded cursor pages; the hook now retains the last completed result across coverage and exposes an `epoch`, and the scoped route retains cursor pages per `[userId, chatId, query, epoch]` so focus revalidation keeps them while a new query, scope or invalidation still drops them. (2) Section 5.4 required contiguous rendered-text ranges, but highlights were computed per Markdown leaf, so a term spanning inline leaves (`nee**dle**`) never matched and table text rendered unhighlighted; `MessageText` now computes ranges once over the rendered text built from the renderer's own `parser` pipeline (with block separators so matches cannot cross a paragraph) and clips them to each leaf, falls back to per-leaf ranges for unresolved leaves, and never highlights hidden syntax or link destinations. Focused assertions were added to `MessageText.test.tsx` (10), `ChatSearchScreen.test.tsx` (prefill and page retention) and `useMessageSearch.test.tsx` (retained result plus epoch advance). Checks: workspace typecheck passed; the six-file baseline was 6 suites/45 tests passing; focused suites passed 3 suites/30 tests; the affected regression batch passed 14/15 suites and 131/132 tests with the only failure being the pre-existing unrelated unlabeled `Pressable` at `apps/mobile/src/components/VoiceNotePlayer.tsx:69` already in the Phase 0 `refresh-20261112` baseline; ESLint over the six changed files reported no findings. No dependency, migration, schema, backend/configuration, string, route or build change was made, and Phase 4 onward was not touched. Native Back-stack, real scroll restoration, light/dark, enlarged-text, compact-width and keyboard observation remain pending manual verification under Phase 4/V11. Evidence: [report](../docs/test-results/search/phase-03/report.md), [regression log](../docs/test-results/search/phase-03/checks/regression.log), and [pre-edit snapshots](../docs/test-results/search/phase-03/snapshots/20261112/hashes.txt). Search-plan progress stays at 10/12 items (83%); broader project progress has no defined denominator. **Next phase ready to start: yes on the Phase 3 source/unit gate; Phase 4 owns the integrated and runtime verification.**

<a id="phase-4"></a>

### Phase 4 — Integrated verification, cleanup, and handoff

**Scope and prerequisites.** Depends on completed implementation work from Phases 1–3. Uses Section 7's full acceptance matrix and the permitted runtime prerequisites from Section 8.

- **P4.1** Run affected and required checks, compare against Phase 0 baselines, remove only obsolete scoped filtering/rows and unused feature code after caller discovery, and rerun checks affected by cleanup. Record V00–V10 outcomes with evidence.
- **P4.2** Publish the acceptance evidence and rollback instructions, restore fixtures/settings changed during testing, and stop task-created processes. Retain any V11 results and list unrun device observations as optional follow-up.

**Acceptance gate.** Complete the required source and automated verification, record unrelated baseline failures under Section 8 rule 9, and verify cleanup and handoff. V11 observations provide optional supplemental evidence.

**Phase 4 current status — 2026-11-13, Asia/Manila: Complete, 2/2 required items (100%).** P4.1 passed its affected verification. P4.2 has published evidence and rollback instructions, verified zero synthetic rows and SQLite integrity, and restored test settings and processes. The original Phase 0–4 search feature is 12/12 required items (100%). Phase 5 is next.

| Item | Entry classification | Verified completion | Remaining |
|---|---|---|---|
| P4.1 | Partially done at audit entry — historical checks stale; SR-02/03/07 implementation gaps found | Complete — fresh working-copy baseline and required checks recorded; stale allowlist blocked/deleted reads, cached-person eligibility, Groups ranking and selected-message-only highlighting corrected. Focused regression: 15 suites/140 tests pass; typecheck/owned lint pass. Full lint reproduces 17 errors/4 warnings outside owned files. Full-suite diagnostics and final totals are retained in the audit report. No obsolete feature code safe to remove. | None within P4.1; unrelated baseline failures remain failed under Section 8 rule 9. |
| P4.2 | Handoff and device follow-up were open under the former gate | Complete under the revised policy. Handoff, rollback and cleanup are recorded. | Optional V11 checklist below. |

**Historical execution notes.** The dated records below preserve the earlier device-gated statuses for traceability. The current Phase 4 status above supersedes them.

**Historical verification note (superseded by the completion audit).** The earlier Phase 4 report is [report.md](../docs/test-results/search/phase-04/report.md); sanitized runtime notes are [runtime-observations.md](../docs/test-results/search/phase-04/runtime-observations.md). Its packets and observations remain historical, not current passes. The old claim that no next phase exists is stale: Section 12 defines Phase 5–12, which can proceed independently on their source/unit prerequisites per AQ-06. They were not started by this Phase 4 request.

**Dated completion-audit note — 2026-11-12, Asia/Manila.** Source verification found three prerequisites only partially satisfied despite earlier completion labels: blocked/deleted preferences were not checked at scoped message-read boundaries, cached People results skipped opening preflight, and Groups lacked required exact/prefix/substring ranking. These now reuse existing preference/ranking/preflight contracts. A fourth SR-07 gap passed search highlights to every bubble; the query now reaches only the selected available message. Six new regression cases pass. Current checks: workspace typecheck passed before/after; owned ESLint passed; affected Jest passed 15 suites/140 tests; shared baseline passed 21 files/154 tests (unchanged shared code); full lint failed with the same baseline 17 errors/4 warnings; full-mobile baseline failed 4/67 suites (409/413 tests passed), with final totals/diagnostics in the [audit report](../docs/test-results/search/phase-04/revalidation-20261112/report.md); diff whitespace was clean. All 72 recovery snapshots and a scratch restore rehearsal verified. Repomix 1.18.1 packets/security/read boundaries and current source identities are indexed in the audit evidence. Mobile AGENTS' `src/app` sentence conflicts with actual `apps/mobile/app` route discovery; routes were preserved. No dependency, migration, build, backend/configuration change, commit, push, deployment or later-phase work occurred. **Next phase ready: yes for Phase 5's independent baseline/source work, not started; Phase 4 native acceptance remains blocked by offline ADB.**

**Authorized recovery follow-up — 2026-11-12, Asia/Manila.** The user approved one MuMu lifecycle CLI restart, which transiently restored instance 3/`dologram` ADB access. Historical synthetic cache/queue fixtures are now verified absent with SQLite integrity `ok`; physical 1080x1920/no display override and font 1.0 were also verified after restoration. Current source bundled through task-owned Metro, but no fresh search UI/Back/scroll/offline/performance acceptance was observed before ADB shells stalled again. An unrelated Kamelyon APK installation was discovered on the same emulator, remained active after one bounded wait, and was preserved along with the pre-existing shared ADB daemon. Task-owned Metro and stalled/alternate ADB processes were stopped. Final network/dark-theme/reverse/device-file restoration and V11 remain open; see [recovery results and exact remaining steps](../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/resume-report.md). No product/test source changed or redundant test rerun occurred; the 72-file recovery validator again passed with zero changed unowned inputs. **Status at that checkpoint was partially complete at P4.2: 50%; original search feature 11/12 (92%); Phase 5 independently source-ready but not started.** This note supersedes earlier pending fixture/display/font claims without converting unobserved runtime gates into passes.

**Shared ADB recovery — 2026-11-13, Asia/Manila.** The user authorized stopping the conflicting install and restarting shared ADB. The Kamelyon install had already ended at inspection. Shared ADB restarted successfully; isolated IPv4-server checks and assigned-instance recovery transiently restored shell access, but the transport closed again during network restoration. No further native gate passed; SDK/LDPlayer version incompatibility was not established. Task-owned isolated ADB/Metro processes were stopped and the shared daemon retained. No product/test source or later phase changed; snapshot validation again passed for 72 files with zero changed unowned inputs, so unchanged automated results were reused without test loops. [Dated evidence](../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/shared-adb-recovery-20261113.md). **Status at that checkpoint was partially complete at P4.2, 50%; original search feature 11/12 (92%); broader project denominator undefined.** Responsive assigned-emulator control, final settings/device-file cleanup and remaining native V11 observations were open at that checkpoint. Phase 5 remains independently source-ready and untouched.

**Native verification continuation — 2026-11-13, Asia/Manila.** The assigned MuMu client completed the 35-old-message pagination and failed pending flow. Native Back restored scoped scroll, and the app displayed and scrolled 10,000 stress matches. Measured on-device query results were 69.07 ms to the first 30-result page, 2,445.46 ms for the full count and 21.96 ms maximum JS interval between batches. Cancellation stopped after one read. Native light/dark, compact/enlarged text and reduced-motion states were exercised. Synthetic data cleanup, SQLite integrity, backed-up settings and task process cleanup were verified. The [native acceptance report](../docs/test-results/search/phase-04/revalidation-20261112/runtime-resume/native-verification-20261113.md) lists the remaining keyboard, nondefault global filter/scroll retention, visual contrast, history, navigation and error observations. **Under the policy in effect at that checkpoint, Phase 4 was 50% and the original search feature was 92%.** Phase 5 is independently source-ready and was not started.

**Optional Phase 4 device checklist.** Observe visible IME and submit, nondefault global filter and scroll restoration after Back, history removal/clear/reopen, Chat Info and pinned navigation, deleted-target return, selected-only highlighting and custom bubble contrast, cached-person opening and connected creation/conflict/username failure, input-to-first-visible-result latency, and the app console. The native report records the exact observations and limitations already captured.

## 7. Verification plan and confirmed commands

The following verification is planned for authorized execution. None of these runtime/test commands was run during polishing. Test additions are justified by the changed behavior and use existing Jest/Vitest tooling.

| ID | Method and required evidence |
|---|---|
| V00 | Working-copy status/diffs, snapshots/hashes, confirmed versions and permitted target identity. Verify rollback can restore touched source files without resetting unrelated untracked work. |
| V01 | Extend `src/search/__tests__/query.test.ts` using its in-memory `node:sqlite` adapter. Cover 260 rows/35 old matches, multiple chats, tied timestamps, complete counts, literal SQL metacharacters, Unicode, zero results, source scope, cancellation and deadline. Use a separate 10,000-message/100-chat stress fixture for batch/count/memory observations. |
| V02 | Extend `SearchScreen.test.tsx` and add a focused SearchField test. Cover blank state, immediate clear, submission with pending debounce, controlled/uncontrolled/prefilled text, filter preservation, three-row truncation, See all, result semantics, and independent name/message failures. |
| V03 | Add scoped people/ranking tests with two accounts whose memberships coexist in cache, group-only contacts, blocked direct targets, archived/ignored/deleted chats, self shortcut, repeated taps, offline existing chat, disabled creation, creation failure/conflict, and explicit username handoff. A rejected/timed-out cache preflight must produce zero create calls. Inject direct-chat/network dependencies. |
| V04 | Add scoped-search tests for full-history parity, pagination, match-source explanations, failed reads/retry, timeout, pending statuses and delivered-echo deduplication. Confirm a queued message opens its queued bubble. |
| V05 | Add navigation/render tests asserting actual route parameters and retained query/filter/scroll/page state. Include already-open chat underneath search, direct links, chat-info entry, search-origin username flow, missing/deleted target, and pinned regression. Use source review and route/render assertions for the required gate. V11 (optional) can supplement them with an actual device Back-stack observation. |
| V06 | Add history tests using the existing AsyncStorage Jest mock. Cover absent/corrupt/versioned payloads, capacity, person/direct-chat canonical identity, account isolation, concurrent record/remove/clear, late loads, failed writes/retry, cancellation, and durable state after reopening. Deferred native promises and fake timers must demonstrate timeout followed by late success/failure, reconciliation before retry, clear ordered after an old writer, and preservation of an unsupported-version payload until confirmed clear. Add a focused local-data cleanup test proving that sign-out clears feature history keys, preserves other preferences, cannot be undone by an in-flight writer, and can safely retry a cleanup failure. |
| V07 | Use deferred reads and cache/queue events to exercise rapid queries, account/chat switches, unmount, permission loss, deletion, pending delivery, invalidation bursts, deadline expiry, and listener/timer cleanup. Verify stale responses cannot navigate or repopulate history/results. |
| V08 | Extend `components/__tests__/MessageText.test.tsx` and add highlight-range tests. Cover repeated matches, NFKC expansions, combining characters, Turkish dotted I, Greek case behavior, emoji, formatting boundaries, code, links, hidden raw syntax, theme contrast, and incoming/outgoing/custom bubble backgrounds. Preserve existing image/URL safety assertions. |
| V09 | Relevant regression tests for forwarding, direct-chat lookup, historical context, account switch, chat organization and pinned behavior. Preserve concurrent ChatScreen call actions/CallProvider wiring and account-session call teardown when editing shared consumers. Configure test wrappers for current providers without starting calls. Add focused assertions only where existing tests miss a changed path. |
| V10 | Run required mobile lint, workspace typecheck, relevant Jest suites, affected shared tests, `a11yPressableSource.test.ts`, and accessibility render tests. Affected feature assertions must pass. Full-command failures remain failed in the report and can be classified as unrelated baseline findings only under Section 8 rule 9. The source Pressable test scans app/components, so new `src/search` controls also require explicit render-label assertions. |
| V11 | **Optional device evidence.** On assigned MuMu via ADB, observe Section 4 states, both themes, text scaling, compact width, keyboard, Back, retained scroll, reduced motion, accessibility targets and offline/old/pending flows. Optionally record stress timing, frame behavior and time to first visible result. |
| V12 | Add/extend component and screen tests for fixed geometry/state-shell behavior, history-loading placeholders, inline message skeleton/progress, filter retention, compact no-results layout, one username action, and zero `/new-chat` navigation from global search. Use explicit accessibility labels and rendered-state assertions rather than snapshots alone. |
| V13 | Use deferred/mock loaders and deterministic timers to verify immediate text updates, debounce timing, progress appearance, cancellation, generation guards, no overlapping scans, timeout/retry, and no stale-result restoration. Add measured local first-result/progress timing to the fixture report; do not treat unit-test wall time as native UI latency. |
| V14 | Extend row, highlight, accessibility, theme, and large-text tests for the finalized 48 px avatar/12 px gap/64–72 px row target, two-line snippets, metadata placement, contrast, 44 px controls, dynamic height, Markdown behavior, and compact-width rendering. Add a focused render-count/instrumentation assertion proving unchanged rows do not rerender for unrelated filter/progress updates; do not rely on source inspection alone for UI-07. |
| V15 | Add username integration tests around the authenticated `findUser` RPC contract: optional `@` normalization, exact case-insensitive lookup, found/not-found/rate-limit/network/offline/retry states, duplicate suppression, repeated-tap protection, no `openDirectChat` call after lookup failure, cached-People allowlist preflight, uncached exact-username opening through the existing New Chat `openDirectChat` contract, history recording, and preservation of non-search `/new-chat` callers. Confirm global search does not push `/new-chat`. |
| V16 | **Optional device evidence.** Run the post-hardening MuMu/ADB matrix for themes, layout, keyboard, reduced motion, Back and scroll, offline/old/pending/deleted targets, history and inline username states. If run, report actual input-to-visible feedback, result/progress timing, cancellation, per-batch work and frame behavior. |

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

A native build is not part of the expected JavaScript-only implementation. If an APK is required for authorized testing, first prefer the existing local Gradle path: from the repository root, use `scripts/build-android-local.ps1 -Variant Debug` for a development-client APK or `-Variant Release` for a signed release APK, after confirming the generated `apps/mobile/android` project, installed SDK/toolchain, package identity and required native modules. Use `-Offline` only when all required dependencies are already available locally. Record the exact command, variant, architectures, APK path, SHA-256, package/native fingerprint and test purpose. Never print or packetize `apps/mobile/credentials.json`, keystores, passwords or other signing material. If the local Gradle build fails because of a confirmed native/configuration/toolchain limitation, record the exact mismatch before considering an EAS cloud build; EAS is a fallback and requires separate user authorization because it is a remote/quota-consuming action. Build verification remains conditional on a demonstrated artifact need, not an automatic rebuild gate.

## 8. Shared execution, recovery, and environment rules

1. Deliver complete production-ready required paths. Follow existing conventions, callers, exports, route discovery, strings, theme, and error handling. Avoid placeholders, empty handlers, unnecessary dependencies, broad refactors, and unrelated fixes. Read version-matched Expo/RN documentation before changing their APIs.
2. Preserve relevant tracked/untracked files with secret-free local snapshots/patches before editing. Put execution reports under `docs/test-results/search`, separate from application code. Root `AGENTS.md` takes precedence over historical packet paths: run Repomix from the repository root with `repomix.config.json` and put new XML packets and generation logs under `supabase/repomix/`. Historical packets remain identifiable references. Exclude `.env*`, credentials, signing material, saved account/session data, and private message payloads. Fixtures use synthetic text. Store source path/hash metadata without copying secrets. Do not package the whole repository.
3. Revalidate only changed sources and dependencies against the single context index. Existing generated guidance is reference material. If a later phase uses Repomix, record intended/actual paths, source hashes, exclusions, omissions, and complete read boundaries there. Never import compressed omissions as verified facts.
4. The user's standing authorization permits necessary reset/install/reinstall/launch, app-data clearing, emulator-setting changes, and test-account/data creation, login, modification, and deletion within the assigned testing environment. Main target is MuMu Player `dologram`/`com.dologram.app`, controlled through ADB only. LDPlayer is usable only if it is actually assigned. Historical serials differ, so resolve the named instance before use. Do not request confirmation again for covered actions or ask the user to create/login to an account when usable supplied or publicly documented credentials are available. Consult authorized materials without printing passwords/PINs. Ask only for genuinely missing essential access information or an actual tool/access restriction and continue independent work. Do not open Messenger or unrelated installed apps to obtain references. Use public captures for reference research and preserve unrelated apps/accounts/services. These standing permissions do not authorize operational actions during this planning-only audit.
5. Prefer isolated in-memory database and mocked transport tests. Runtime fixtures require a verified configured backend target and designated test accounts/chats, or network-disabled local fixture mode with no outbound sync, queue dispatch, or notifications. Authorized disposable accounts/data on the verified app target are sufficient when they stay within the supplied testing authorization. A separate backend project is not an automatic prerequisite. Record backup/removal procedures and restore settings. A container, emulator, or existing hosted URL alone does not prove account/data isolation. Preserve unrelated shared data and avoid changing live Auth/RLS/configuration to obtain a test pass.
6. Reuse the compatible approved development client when one exists. Record package/native fingerprint and required modules first. If a fresh APK is needed for authorized MuMu testing, prefer the repository's local Gradle workflow: `scripts/build-android-local.ps1 -Variant Debug` for the development-client APK or `-Variant Release` for the signed release APK, with an explicit architecture selection when required. Confirm `apps/mobile/android` exists; if it does not, `expo prebuild --platform android --no-install` may generate the native project only as an implementation step, after checking the Expo/RN versions and preserving generated-native-directory rules. Keep credentials and keystores outside evidence packets. `docs/builds.md` reports a 15-build EAS allowance but is historical; local Gradle builds are quota-free and are the default for testing. If local Gradle is unavailable or a confirmed native/configuration mismatch requires a remote artifact, record the failure and request separate authorization before cloud EAS work. No speculative rebuild, store submission, deployment, migration, or dependency upgrade is included.
7. Failed local reads/history writes get explicit retry with preserved durable state. Serialize mutations and release operation guards in finally. A stale request cannot release a newer request's lock. Bound request lifetimes and prevent cache-event refresh loops, repeated side effects, and retry storms. Direct-chat partial failures use the existing lookup/resync recovery, never automatic repeated create calls. Keep its residual server race recorded separately.
8. Rollback restores only touched feature files from Phase 0 snapshots and removes only task-created unused feature files after verifying ownership. Preserve unrelated user edits. The new history key is additive and can remain inert after code rollback. Keep old callable contracts or provide compatible optional fields. App database/server schema rollback is unnecessary for the planned scope.
9. Record check status as passed, failed, blocked, or not run with evidence and environment identity. Reproduce historical failures before calling them current. Fix task regressions only. An unrelated baseline failure may remain outside feature repair only when its exact diagnostics/test identity were captured before changes, current evidence establishes that it is unrelated, and all affected feature assertions pass. The full command remains failed, with the classification and supporting evidence attached. Unknown-cause failures or an inability to run a required feature assertion keep the affected acceptance gate incomplete. Keep required assertions intact and report known defects. Label test-double evidence and device observations separately. Optional device checks can remain unrun without affecting phase completion. Rerun affected checks after meaningful changes and cleanup. Stop task-created servers, supervisors, fixture processes, and timers when no longer needed, preserving pre-existing services.
10. During authorized execution, report current-phase completion after each session. Use the predefined Pn.n items for the original feature phases and Hn.n items for the hardening phases in Section 12.10; use equal weights unless a justified execution-time change is recorded. Completion is verified finished-item weight divided by required-item weight, rounded to a whole percentage. Record any legitimate item/weight change and its effect. Required unmet gates prevent 100 percent. Optional device observations have zero weight. Report overall project progress separately only if its denominator has been defined. State whether the next phase is ready.

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
| D07 | Preserve dated results and distinguish required automated evidence from optional device evidence. | The user made device checks optional across all phases. Unrun or blocked observations retain their status. |
| D08 | Keep builds conditional on a demonstrated artifact need, and prefer the repository's local Gradle build for authorized testing. Local `Debug` builds may supply the development-client APK and local `Release` builds may supply a signed release APK; EAS cloud builds remain a fallback only after local Gradle is unavailable or incompatible and the user separately authorizes that remote action. | Local Gradle builds do not consume EAS quota and the repository already provides `scripts/build-android-local.ps1` plus the release signing init script. This plan still excludes deployment, submission, remote configuration and speculative rebuilds. |
| D09 | Add history cleanup to the existing local-data/sign-out path and preserve concurrent native work. | Later original-source inspection confirms that sign-out invokes local-data cleanup and that manifests/root providers changed during polishing. New feature storage must honor the existing cleanup consumer. |
| D10 | Move username lookup from global search into the search screen as an inline exact-username action/result. Preserve `/new-chat` for non-search callers until a caller audit proves it can be removed. | The user explicitly selected an integrated search experience. The existing authenticated `find_user` RPC and direct-chat/history contracts are reusable; a new backend API or migration is unnecessary. |
| D11 | Continue hardening phases as Phase 5 through Phase 12 after the earlier Phase 0–4 feature phases. | The repository already contains the earlier search implementation and historical Phase 0–4 evidence. New phases must not reuse temporary `U0` labels or imply that the hardening pass has begun. |
| D12 | Use the accepted adapted geometry and verify the layout through source and component assertions. | Device coordinates can supplement the layout checks. |

### Unresolved prerequisites and next actions

| ID | Evidence and consequence | Affected work | Resolution and independent work |
|---|---|---|---|
| B01 | Earlier public references mix versions and platforms. Exact current-Messenger geometry is unverified. | SR-11 fidelity claim and P0.3 | Use the explicit Section 4 adaptation as the executable specification, record source date/build where public references provide it, and document differences. Query/history/navigation work can proceed. No claim of exact current-build parity can pass without a matching reference. |
| B02 | Historical device identities include `emulator-5554` and `127.0.0.1:16480`. Current instance/artifact/service state was not inspected because auditing excludes operational actions. Concurrent calling native packages/plugins mean an older client cannot be assumed compatible with the whole current app. | Optional V11/V16 | If running device checks, use standing ADB/emulator authorization to discover MuMu `dologram`, verify current module loading against the installed artifact, and reuse it when compatible. Look for supplied compatible artifacts before requesting one. If none is available, record the exact mismatch and resolve actual artifact/upload/quota constraints. Automated query/component/navigation work proceeds independently. |
| B03 | Verified runtime target and designated disposable test accounts/data, or a proven network-isolated fixture mode, are not established in this audit. | Optional connected device flows and V11/V16 fixtures | If running connected device checks, inspect the actual configured target and available authorized credentials, then create/login to test accounts and prepare disposable items using standing authorization. No separate backend project or repeated emulator approval is required by this plan. Request only genuinely unavailable essential access information and continue mocked/in-memory checks. |
| B04 | Full Jest hangs and sign-up lint errors were reported in 2026-11-10 evidence. Their current reproduction status is unknown. | P0.2, V10 | Run bounded baselines, retain diagnostics, isolate relevant suites, and separate unrelated failures from new regressions. If required feature tests cannot run, their gate stays blocked while independent work proceeds. |
| B05 | The current working copy contains extensive concurrent changes and the Phase 4 packet is not current for the hashes recorded in the planning-refinement audit. | Phase 5, V00, V16 (optional) | Refresh only the affected identities/packet at execution start, preserve the user-owned changes, and re-read changed callers before editing. Independent plan/test design can continue. |
| B06 | Inline username lookup changes existing global-search tests and must introduce a testable seam for the authenticated `findUser`/direct-chat path without weakening the real RPC contract. | UI-10, Phase 8, V02/V03/V15 | During implementation, inject or mock the existing client/repository at the narrowest existing seam, cover success/failure/offline/rate-limit behavior, and verify the non-search `/new-chat` caller remains unchanged. |

There is no unresolved material product decision preventing implementation against the proposed adapted specification. Runtime prerequisite discovery and verification remain future work.

### Out-of-scope findings

- The existing direct-chat multi-row creation has a residual partial-failure/server-race gap documented in the older Android plan. Search must reuse and test its error/reconciliation path. An atomic server redesign is outside this change.
- `loadCachedContacts` has other group-picker consumers. Broader correctness changes to those consumers are separate work. The new search adapter must enforce its own scope.
- Existing global release-gate/EAS issues, calling work, sign-up lint findings, and full-suite infrastructure issues are recorded rather than repaired by this search plan. EAS is not the default build path for search testing; local Gradle is preferred when an APK is required.
- The `/new-chat` screen and route remain in scope for compatibility but are not redesigned or removed by this hardening pass. Search-only navigation to that route is removed after the non-search caller audit.
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
| AU-02 | Constant-memory wording conflicted with preserving explicitly loaded result pages. Defined the 200-row scan limit, 30-match delivered-page limit, one-summary-per-conversation aggregation, and memory proportional to requested pages. | SR-12, P1.1, V01/V11 (optional) |
| AU-03 | Reusing openDirectChat alone could turn a failed cache lookup into a create mutation. Required a successful search-side eligibility/cache preflight before creation and a zero-create-call assertion on read failure/timeout. | Section 5.2, P1.3/P2.2, V03 |
| AU-04 | History promises could remain pending without a defined timeout/reconciliation path, and result selection could overwrite an unsupported payload version. Added logical deadlines, serialization through late native settlement, durable reconciliation, safe clear ordering, and explicit-clear-only replacement of unsupported versions. | Section 5.3, P2.1, V06/V07 |
| AU-05 | Standing test authorization and isolation wording could imply repeated approval or a mandatory separate backend project. Applied the user's explicit emulator/account/data authorization, retained ADB-only identity checks, and distinguished connected account/data isolation from offline network isolation. | P0.3, Section 8 rules 4–5, B02/B03 |
| AU-06 | Some acceptance rows omitted the phase item implementing their global state, history, scoped UI, or cleanup integration. Corrected those mappings without adding work items or features. | SR-08, SR-10, SR-11, SR-13 |

**Readiness classification — Ready for execution.** No unresolved product decision or technical prerequisite prevents Phase 0 source-baseline/snapshot preparation from starting when implementation is requested. This audit does not authorize or begin operational work. Standing test authorization applies once execution is requested, with no repeated approval for covered emulator/account/data actions.

The later prerequisites B01–B04 remain explicitly unverified. B01 affects claims about exact current Messenger fidelity, while Section 4 already defines the accepted adapted design. B02 gates actual MuMu/artifact observation, B03 gates connected/disposable runtime fixtures, and B04 requires fresh check baselines and diagnosis if a relevant test runner fails. Their exact next actions are in Section 9. Optional device observations carry no completion weight and are recorded with their actual status. A real missing artifact, essential credential, or tool restriction blocks only the dependent action until resolved.

At the time of the second-pass audit, no optional improvement had been promoted into additional feature scope. The later user-approved hardening addendum in Section 12 now defines the bounded UI/performance work. Calling work, broad contact-picker repair, atomic backend direct-chat creation, existing unrelated failures, and other listed exclusions remain outside this search change. The historical audit ends at this readiness assessment; the current planning status is defined by the refinement record below.

## 12. Finalized UI, interaction, and performance hardening addendum

Added 2026-11-12, Asia/Manila, from the supplied search-screen visual review. **Planning only — no application code, dependency, route, schema, or configuration change is authorized by this addendum.** This section is the final product specification for the next implementation pass and takes precedence over earlier optional visual suggestions where they differ.

### 12.1 Product outcome

The search screen must feel compact, stable, and immediate while preserving all existing search details, account boundaries, result categories, history behavior, message counts, highlights, navigation, accessibility labels, and error/retry paths. The screen must not blank, jump, flash, or restart its layout during typing, category changes, loading, focus changes, navigation, or late result cancellation.

### 12.2 Finalized layout and density decisions

| Area | Final decision | Acceptance condition |
|---|---|---|
| Vertical structure | Use one stable stack: toolbar → 8–12 px gap → filter row → 12–16 px gap → result content. | Toolbar, filters, and result origin retain the same vertical coordinates across People, Groups, Messages, loading, error, empty, and no-result states. |
| Excess top space | Remove the excessive blank area above the filters visible in the supplied screenshots. Do not vertically center the filter row or result list as a state-dependent layout strategy. | Compact-width screenshots show no unexplained large gap between the search field and filters. |
| Filter row | Keep the filter row in a fixed-height horizontal container with 44 px minimum touch targets. | Changing category changes only selection and result content; the filter row does not move or resize. |
| Result rows | Use a 48 px avatar, 12 px avatar/text gap, 64–72 px minimum row height, title first, metadata second, and a maximum of two snippet lines. | Rows remain readable at enlarged text, grow naturally when required, and do not cause unrelated rows or filters to jump. |
| Dividers | Use subtle separators only between dense result rows where they improve scanning. Do not add heavy cards, shadows, or nested containers. | The screen remains lightweight in both themes and retains the existing charcoal/ivory visual language. |
| Message metadata | Keep matched-message counts and source information, but render them as compact secondary metadata or a trailing badge so the snippet has more horizontal space. | A message result still exposes its count/source while preserving two useful snippet lines at compact width. |
| No results | Reduce the empty-state icon, tighten icon/title/body spacing, retain a 44–48 px CTA, and center the state only within the space below the filters. | No-result content is visually balanced without consuming the full screen or moving the filters. |

### 12.3 Finalized loading and typing behavior

- People and Groups results render as soon as their local data is available; message counting does not block them.
- Replace the large/full-screen spinner with an inline `Searching messages…` status or two to three compact message skeleton rows.
- Keep the result structure mounted while message work is pending. Do not replace the whole result area with a spinner after every query.
- While history is loading, show a stable history skeleton/placeholder. Do not show `No history` until history loading has completed successfully with zero entries.
- Text input updates immediately. Only the expensive message scan is debounced.
- Preserve the selected category while typing. Clearing the query immediately cancels the scan and restores the blank-search state.
- Late responses must be ignored using the existing request identity/generation protections; overlapping scans must not update the screen.
- When a new scan starts, show a compact inline updating state rather than presenting stale results as if they belonged to the new query.

### 12.4 Finalized animation policy

Use one native-driven 200–250 ms search transition. The implementation must not run the native route fade, a separate toolbar morph, and an independent focus animation as competing transitions.

The next implementation pass must choose one of these behaviors and apply it consistently:

1. retain the native search-route fade and remove the custom toolbar morph; or
2. retain one native-driven toolbar expansion and use an otherwise static route transition.

Focus must occur once after the selected transition is ready, without repeatedly focusing on rerenders or route-cover/uncover events. Reduced-motion behavior must remain supported.

### 12.5 Finalized username search integration

Username search is part of the global search screen and must not navigate to a separate “Find by username” screen from search.

- Add `Username` as a normal filter beside All, People, Groups and Messages.
- While the Username filter is selected, the current non-empty query automatically performs the existing exact-username lookup in place, normalized for whitespace and an optional leading `@`.
- Display loading, success, no-match, offline, rate-limit/failure and retry states within the search screen; an empty candidate is handled locally.
- A successful username result uses the same People row, avatar, highlighting, accessibility, opening guard, history recording, and safe direct-chat/open-chat path as the existing search result flow.
- Do not show a separate full-width `Search username` button, bottom `Find by username` CTA, or duplicate username entry point.
- Disable message scanning while the Username filter is selected so the username query is not duplicated in Messages results.
- The existing `/new-chat` route may remain for non-search callers until a separate caller audit retires it. Search itself must not depend on that route.

### 12.6 Finalized blank-search behavior

- Keep Recent searches as a compact horizontal avatar rail.
- Show `Clear all` only when history contains entries.
- Use a clear edit mode with removable rows and a fixed `Done` action.
- Keep Suggested rows at approximately 64–72 px and preserve all current suggestion details.
- Keep the Username filter available with the other normal filters; do not add a separate username action to the blank/no-results layout.

### 12.7 Finalized rendering and list-performance decisions

The implementation must optimize without changing search semantics:

- wrap `SearchResultRow` in `React.memo` with an explicit comparison for title, subtitle, metadata, query, disabled state, and avatar identity;
- memoize `renderItem`, section headers, section footers, and empty/loading components;
- tune `initialNumToRender`, `windowSize`, and `maxToRenderPerBatch` when automated profiling or optional device measurements justify it;
- verify `removeClippedSubviews` on Android before enabling it, especially with dynamic text and focused-message navigation;
- cache or memoize highlighted-text ranges for unchanged text/query pairs;
- avoid allocating new sorted/filter arrays or maps inside row rendering;
- preserve virtualization for category result lists and keep message-summary aggregation bounded to explicitly loaded data.

### 12.8 Finalized performance targets

Use deterministic tests and the synthetic fixture for required state, overlap and batching assertions. Device latency and frame targets are optional measurement goals:

| Metric | Target | Evidence |
|---|---|---|
| Keystroke-to-visible UI feedback | < 50 ms | Optional device measurement |
| First local People/Groups results | < 200–300 ms where data is cached and available | Optional device measurement; independent section rendering remains a required component assertion |
| First message-search progress indicator | Within 50 ms after the 150 ms debounce fires and no later than 300 ms from the final keystroke in the controlled fixture | Required deterministic test; native visibility timing is optional |
| Full-screen loading replacement after typing | 0 occurrences | Required component test |
| Overlapping active scans for one screen/query lifecycle | 0 | Required deferred-loader test |
| Visible scrolling | No sustained dropped-frame/stutter pattern in the 10,000-message stress fixture | Optional device observation; bounded synthetic query work and virtualization tests remain required |
| Per-batch JS work | Prefer ≤ 100 ms, with measured evidence and corrective yielding/batching if exceeded | Optional device measurement; source batch limits remain required |

The 200–300 ms target applies to first useful local feedback, not necessarily completion of a full-history message count. Exact counts may continue progressively while People/Groups and stable message-search structure remain visible.

### 12.9 Implementation and verification mapping

| Finalized work | Planned implementation owner | Verification (required unless labeled optional) |
|---|---|---|
| Stable layout, compact rows, filters, blank/no-result states | Phase 6, Phase 10, Phase 11; existing P2.2 global search UI/components | V02, V08, V12, V14, V16 (optional) |
| Stable loading, typing, cancellation, and inline progress | Phase 7; existing P1.1/P2.2/P3.1 query and screen lifecycle | V01, V02, V07, V12, V13, V16 (optional) |
| Single transition and one-time focus | Phase 9; SearchToolbar/root search transition integration | V12, V15, V16 (optional) |
| Inline username search | Phase 8; existing exact-username/direct-chat contracts | V02, V03, V05, V15, V16 (optional) |
| Memoization, list tuning, highlight caching | Phase 10; shared search rows/highlighting and screen list configuration | V07, V08, V10, V14, V16 (optional) |
| Deterministic lifecycle and stress assertions, plus optional device timing and frame observations | Phase 12; Phase 4 handoff retains prior device evidence | V13 required, V16 optional |

Implementation items require applicable automated evidence. V11 and V16 are optional device evidence wherever cited in this plan. This addendum does not authorize coding, runtime actions, dependency changes, migrations, deployment, or removal of the existing separate route without a later implementation request and caller audit.

### 12.10 Finalized execution phases

These phases are the execution order for the hardening addendum after the recorded earlier search implementation phases. They are implementation-ready but not started by this planning update. A later execution request must begin with Phase 5 and must preserve the existing Phase 0–4 evidence, concurrent work, and recovery rules. Phase 4 is complete under the current policy. Phases 5–12 use the dependencies and required source/automated gates below.

Each hardening phase uses the numbered Hn.n work items below with equal weight unless execution records a justified change. An item is complete only after its planned change and required verification pass. A failed, blocked, or unrun required assertion does not earn credit. Execution reporting uses the centralized Phase 0–4/Section 8 rules and the required output format.

<a id="phase-5"></a>

#### Phase 5 — Hardening baseline, ownership, and measurement preparation

**Purpose:** Establish a fresh, recoverable baseline before changing the search UI.

**Prerequisites:** Planning scope accepted; current working-copy status and historical Phase 0–4 evidence available. No runtime action is required to begin source inspection.

**Context inputs:** Current plan/context index, `apps/mobile/AGENTS.md`, current search routes/components/tests, manifests, Phase 4 report/runtime notes, and the supplied screenshots as visual references only.

**Affected components:** No application components are edited in this phase. Evidence/snapshot files are limited to `docs/test-results/search/` and other explicitly authorized planning artifacts; generated Repomix packets/logs go under `supabase/repomix/` per root `AGENTS.md`.

**Baseline checks:** `git status --short`, relevant diffs and hashes, confirmed package scripts/versions, existing search test identities, current layout/timing observations where permitted, and runtime/artifact identity discovery without starting a service.

**Work:**

- **H5.1** Capture working-copy status, touched-file ownership, source identities, and a recoverable patch for only the search-related files.
- **H5.2** Re-read the current search routes, shared rows, SearchField, SearchToolbar, history/suggestion components, username lookup/direct-chat contracts, and relevant tests.
- **H5.3** Record toolbar, filter and content layout constraints from source and component tests. If device observations are available, attach coordinates and screenshots as supplemental evidence.
- **H5.4** Baseline debounce, progress and cancellation with a deterministic fixture. Device timing and scrolling observations are optional.
- **H5.5** Confirm the Expo and React Native versions before changing animation or list APIs. Resolve the assigned runtime target only for optional device work.
- **H5.6** Define synthetic fixtures for history-loading, people/groups-first rendering, username lookup, no-result, slow message scan, rapid query changes, and 10,000-message scrolling.

**Exit gate:** Baseline checks, source ownership, recovery and synthetic fixture definitions are documented.

**Phase 5 progress/status — 2026-11-13, Asia/Manila: Complete, 6/6 items (100%).** H5.1–H5.6 were completed against the current working copy. Git ownership, the search-only recovery patch, 34 secret-free source snapshots and SHA-256 identities are recorded in the [Phase 5 report](../docs/test-results/search/phase-05/report.md). The scoped Repomix 1.18.1 packet contains 37 current entries, no security findings and is recorded under [`supabase/repomix/phase-05-20261113/`](../supabase/repomix/phase-05-20261113/). Workspace typecheck passed; corrected shared tests passed 21 files/154 tests; mobile lint retained 21 unrelated baseline problems; focused mobile Jest remained blocked by sandbox transform-cache EPERM and then a bounded 5-second screen-test timeout under the explicit-cache diagnostic. Layout constraints and the deterministic synthetic fixture matrix are recorded in [fixtures.md](../docs/test-results/search/phase-05/fixtures.md). No application or native code, dependency, migration, runtime, emulator, backend, build, commit, push or later phase was changed. **Next phase ready to start: yes, Phase 6.**

<a id="phase-6"></a>

#### Phase 6 — Stable search geometry and state shell

**Purpose:** Remove layout jumps and create one stable visual skeleton for every search state.

**Prerequisites:** Phase 5 ownership, source identities, and baseline evidence recorded; affected current sources re-read after any concurrent change.

**Context inputs:** Section 4 geometry, UI-01/UI-02/UI-06/UI-09, `app/search.tsx`, `SearchSuggestions.tsx`, theme/safe-area/accessibility components, and current screen tests.

**Affected components:** Proposed changes are limited to the global search route, `SearchSuggestions`, shared search layout/state components, shared search strings if needed, and their focused tests. No schema or dependency change.

**Baseline checks:** Existing blank/query/filter/no-result assertions, current accessibility labels, both theme token definitions, and current compact/enlarged-text behavior where available.

**Work:**

- **H6.1** Refactor the global search layout into a stable toolbar/filter/results stack with the finalized 8–12 px and 12–16 px spacing rhythm.
- **H6.2** Remove state-dependent vertical centering or excess space above the filters.
- **H6.3** Keep the filter row fixed in height and position while category, loading, error, empty, and no-result content changes.
- **H6.4** Add stable history-loading placeholders so `No history` is rendered only after loading completes with zero entries.
- **H6.5** Add compact no-result geometry below the filters without moving the toolbar or filter row.
- **H6.6** Preserve safe-area handling, enlarged text behavior, reduced motion, accessibility labels, and 44 px touch targets.

**Exit gate:** Component and source checks confirm the common toolbar/filter/result layout and preserved search states. Device screenshots or hierarchy are optional.

**Phase 6 progress/status — 2026-11-13, Asia/Manila: Complete, 6/6 items (100%).** H6.1–H6.6 were implemented in the global search route, `SearchSuggestions`, shared search strings, and focused screen tests. The route now has an explicit 60 dp filter viewport with safe-area-aware horizontal padding and a `minHeight: 0` result viewport; filter labels retain enlarged-text support; no-result content uses a compact themed state below the filter row; and history loading occupies the recent-search rail with an accessible skeleton until the hook settles. No schema, dependency, native, navigation, backend, emulator, build, commit, push, or later-phase change was made. Verification and the pre-existing focused-screen timeout are recorded in the [Phase 6 report](../docs/test-results/search/phase-06/report.md). **Next phase ready to start: yes, Phase 7.**

<a id="phase-7"></a>

#### Phase 7 — Progressive loading and query lifecycle

**Purpose:** Make typing and searching feel immediate without showing stale or misleading content.

**Prerequisites:** Phase 6 stable state shell; existing `useMessageSearch` cancellation/generation behavior preserved as the baseline contract.

**Context inputs:** UI-02/UI-03, `SearchField`, `useMessageSearch`, `query.ts`, cache/queue event contracts, current scoped-search route, V01/V07 evidence, and the 150 ms debounce requirement.

**Affected components:** Search screen state composition, message-progress/skeleton presentation, query lifecycle tests, and only the shared hook/query code required to preserve the existing request contract.

**Baseline checks:** Existing rapid-query/account-switch/clear/cancellation/deadline/cache-event tests, plus a deferred-loader fixture that records active request count and late-result suppression.

**Work:**

- **H7.1** Keep People and Groups rendering independently of message counting.
- **H7.2** Replace the typed-query/full-screen search spinner with inline progress text or compact message skeleton rows; when the initial chat-list load has no data yet, keep the same toolbar/filter shell and show a stable skeleton rather than a state-dependent layout jump.
- **H7.3** Keep the result structure mounted during message scans and show progress without a full-screen replacement.
- **H7.4** Update the field immediately, debounce only the expensive message work, and flush the latest value on submit.
- **H7.5** Preserve selected category and clear behavior across rapid query changes.
- **H7.6** Verify cancellation, generation guards, account changes, focus changes, cache invalidation, queue changes, timeout, retry, and late-result suppression.
- **H7.7** Serialize underlying loader promises per scope when cancellation cannot physically stop a native/database read; coalesce invalidations and prove the overlap counter remains zero.

**Exit gate:** No overlapping underlying scans, no stale result restoration, no full-screen loading replacement after typing, and all query-lifecycle tests pass. If a native read cannot be cancelled, the next scan waits for its settlement rather than violating the overlap gate.

**Phase 7 progress/status — 2026-11-13, Asia/Manila: Complete, 7/7 items (100%).** H7.1–H7.7 were implemented in the global/scoped search state composition, `SearchProgress`, `useMessageSearch`, the serialized search request helper, shared search wording, and focused lifecycle/screen tests. People and Groups remain independently rendered while message counting is in progress; typed results retain their mounted structure and selected category; initial chat loading uses a stable themed skeleton; and the expensive message scan retains a deterministic 150 ms debounce while input updates immediately and submit flushes the latest value through the existing `SearchField` contract. Underlying per-scope loader promises are serialized after logical abort, invalidation bursts are coalesced, and late results remain generation/account/query guarded. No dependency, schema, native, navigation, backend, emulator, build, commit, push, deployment or Phase 8+ change was made. Verification is recorded in the [Phase 7 report](../docs/test-results/search/phase-07/report.md); the full mobile lint baseline remains pre-existing and unrelated. **Next phase ready to start: yes, Phase 8.**

<a id="phase-8"></a>

#### Phase 8 — Inline username search integration

**Purpose:** Make username lookup a first-class part of the search screen.

**Prerequisites:** Phase 6 result shell and Phase 7 query lifecycle are stable; existing exact-username RPC and direct-chat contracts are verified.

**Context inputs:** UI-10, current `findUser` repository/RPC and migration grants, `app/new-chat.tsx`, `app/search.tsx`, `openDirectChat`, history contracts, shared strings, and current username-handoff tests that Phase 8 will replace with inline-flow assertions.

**Affected components:** Global search route, a proposed search-local username lookup state/helper only if an existing seam is insufficient, shared search strings, and global-search tests. `/new-chat` changes only if caller audit finds a compatibility fix necessary; no backend or migration change is planned.

**Baseline checks:** Existing `findUser` repository test, current `/new-chat` success/failure/offline behavior, direct-chat preflight/creation tests, account-scope checks, and a caller inventory proving which non-search paths still use `username`/`searchOrigin`.

**Work:**

- **H8.1** Add `Username` as a normal search filter alongside All, People, Groups and Messages. Selecting it searches the current field value without a separate full-width `Search username` action, including trim/one-leading-`@` normalization and local empty-candidate validation.
- **H8.2** Trigger the remote lookup automatically for the current non-empty query while the Username filter is selected, use one in-flight lookup per query/account generation, and invalidate late results on query/account/blur/clear changes using a bounded deadline.
- **H8.3** Adapt the existing `{ user_id, display_name }` RPC result to the People-row/opening contract without exposing broader directory data.
- **H8.4** Reuse the existing exact-username lookup, cached-People eligibility preflight, remote New Chat `openDirectChat` path, history recording, duplicate suppression, and repeated-tap guard without applying the local allowlist to an uncached exact-username result.
- **H8.5** Render username lookup loading, success, no-match, offline, rate-limit, failure, and retry states inside the search screen.
- **H8.6** Remove the separate username CTA/screen dependency from global search, remove the search route's dependency on `/new-chat`, and preserve `/new-chat` only for non-search callers until a separate caller audit confirms whether it can be retired.

**Exit gate:** Search can complete username lookup and open the eligible result without leaving the search route; all failure/retry/offline paths are explicit; existing non-search username callers remain compatible.

**Phase 8 progress/status — 2026-11-13, Asia/Manila: Complete, 6/6 items (100%).** H8.1–H8.6 were completed in the global search route, the search-local `UsernameResults` seam, shared search wording, and focused screen tests. Username is now a normal filter beside All, People, Groups and Messages; selecting it automatically looks up the normalized current field value without a separate full-width `Search username` action or separate find-by-username screen. The lookup trims whitespace, removes one leading `@`, rejects empty candidates locally, and uses the authenticated `find_user` contract with bounded cancellation/late-result guards. Loading, no-match, offline, rate-limit, generic failure, and retry states remain inside the global search screen. Message scanning is disabled while Username is selected. Successful remote results use the existing guarded `openDirectChat` and history path without a `/new-chat` navigation; cached People openings retain their eligibility preflight. The current working-copy caller inventory found no non-search `/new-chat` references, and the route file was already deleted by pre-existing user work; it was not restored or modified. The mobile AGENTS route-directory wording conflicts with the actual `apps/mobile/app` layout, which was preserved. Repomix 1.18.1 produced a 17-entry Phase 8 packet under [`supabase/repomix/phase-08-20261113/`](../supabase/repomix/phase-08-20261113/), with no security findings. The revision packet is [`final-context.xml`](../supabase/repomix/phase-08-username-filter-20261113/final-context.xml), with 17 entries and no security findings; its SHA-256 is recorded in the accompanying generation log. Workspace typecheck, Phase-8-owned ESLint, whitespace checks, and the focused search/people Jest suites (2 suites/27 tests) passed. Full mobile lint retains the unchanged baseline of 21 problems (17 errors/4 warnings) in unrelated files. Optional device evidence was not run. No dependency, migration, backend, build, deployment, commit, push, or Phase 9+ work was started. **Next phase ready to start: yes, Phase 9.**

<a id="phase-9"></a>

#### Phase 9 — Single transition and focus stabilization

**Purpose:** Remove flicker and animation contention.

**Prerequisites:** Phase 6 stable geometry and Phase 7 stable query state; version-matched Expo/RN animation guidance rechecked before changing APIs.

**Context inputs:** UI-04, `SearchToolbar`, `transition.ts`, root `_layout.tsx` search-crossfade setup, `SearchField`, reduced-motion/theme contracts, and current navigation tests.

**Affected components:** Search transition configuration, toolbar/focus lifecycle, and focused transition/keyboard tests only. Preserve unrelated route animations and calling/navigation work.

**Baseline checks:** Existing route-entry/back behavior, `transitionEnd` focus behavior, reduced-motion setting, keyboard/safe-area geometry, and no-service component tests.

**Work:**

- **H9.1** Select one native-driven 200–250 ms transition strategy.
- **H9.2** Remove or disable the competing toolbar morph if the native route fade is retained, or remove the route fade if the toolbar expansion is retained.
- **H9.3** Ensure input focus occurs once after the chosen transition and is not retriggered by rerenders or route cover/uncover events.
- **H9.4** Preserve reduced-motion behavior and verify interrupted open/close/back transitions.
- **H9.5** Verify stable filter placement with component layout and keyboard-state assertions. Visual keyboard observations are optional.

**Exit gate:** Transition, one-time focus, interrupted navigation, reduced motion and keyboard-layout tests pass. Visual flash and animation observations are optional.

**Phase 9 progress/status — 2026-11-13, Asia/Manila: Complete, 5/5 items (100%).** H9.1–H9.5 were completed in the existing root search crossfade, `SearchToolbar`, global/scoped search focus lifecycle, and focused transition/screen tests. The retained Expo Router JS-stack card transition is a single 250 ms timing crossfade; the toolbar no longer reads `CardAnimationContext` or animates a second field morph. `useSearchInputFocus` waits for a non-closing `transitionEnd`, guards the input with a per-entry ref state, suppresses cover/uncover and rerender refocus, and focuses immediately when reduced motion collapses the transition. Scoped chat search now uses the same lifecycle. The global filter row keeps its fixed 60 dp geometry and keyboard-persistence contract. Version-matched Expo SDK 57 Router/Reanimated documentation was rechecked before changing the transition/focus APIs; the repository's stale `src/app` route wording remains outside this phase and the actual `apps/mobile/app` routes were preserved. Repomix 1.18.1 produced the initial 14-entry packet and final 14-entry packet under [`supabase/repomix/phase-09-20261113/`](../supabase/repomix/phase-09-20261113/), both security-clean. The four Phase 9 feature suites passed (33 tests); owned ESLint passed. Full mobile lint retains 20 unrelated baseline problems (16 errors/4 warnings), the current workspace typecheck is blocked by untracked concurrent memo errors, and the focused accessibility source test retains the unrelated `VoiceNotePlayer.tsx:69` failure. Optional MuMu/ADB evidence was not run. No dependency, migration, backend, build, deployment, commit, push, or Phase 10+ work was started. Full evidence is in the [Phase 9 report](../docs/test-results/search/phase-09/report.md). **Next phase ready to start: yes, Phase 10.**

<a id="phase-10"></a>

#### Phase 10 — Compact rows and rendering optimization

**Purpose:** Increase information density while reducing unnecessary React work.

**Prerequisites:** Phase 6 geometry and Phase 7 query states are stable; Phase 5 has recorded current row/list behavior and any stress-fixture limits.

**Context inputs:** UI-05/UI-06/UI-07, `SearchResultRow`, `HighlightedText`, `SearchScreen`, `SectionList`/`FlatList` usage, theme typography, MessageText highlight behavior, and V07/V08/V10 evidence.

**Affected components:** Shared search row/highlight components, global/scoped list configuration, and focused row/accessibility/performance tests. Do not alter unrelated chat rows or broad list abstractions.

**Baseline checks:** Current row height/labels/highlights, dynamic text behavior, Markdown tests, Pressable accessibility-source test, and synthetic 10,000-message query/list fixture before tuning.

**Work:**

- **H10.1** Apply the finalized 48 px avatar, 12 px gap, 64–72 px row minimum, title/metadata/snippet hierarchy, two-line snippet cap, and subtle-divider rules.
- **H10.2** Move message count/source metadata into compact secondary or trailing presentation without removing details.
- **H10.3** Memoize `SearchResultRow`, render callbacks, section headers, footers, empty states, and loading states.
- **H10.4** Cache or memoize highlighted-text ranges for unchanged text/query pairs.
- **H10.5** Tune rendering only where tests or measurements justify it. Preserve the current clipping behavior unless an optional Android check supports changing it.
- **H10.6** Preserve dynamic text growth, Markdown/search highlights, accessibility labels, focused-message navigation, and virtualization.

**Exit gate:** Row, accessibility, contrast and render-count tests pass. The synthetic 10,000-message check verifies bounded query work, and tests confirm virtualization. Device scrolling and frame measurements are optional.

**Phase 10 progress/status — 2026-11-13, Asia/Manila: Complete, 6/6 items (100%).** H10.1–H10.6 were completed in the shared search row/highlight components, global and scoped search list configuration, blank-search suggestion list, and focused tests. Search rows now use 48 dp avatars, 12 dp spacing, 72 dp minimum height with dynamic growth, compact title/metadata/snippet hierarchy, two-line snippets, and subtle token-based separators. `SearchResultRow`, scoped rows, global item rows, section callbacks, empty/loading states, and suggestion loading are memoized with explicit stable comparisons/callbacks. Highlight ranges use a bounded 256-entry text/query cache shared by plain snippets and Markdown-rendered message text; Markdown highlighting continues to operate on visible rendered leaves only. Global, scoped, and blank-search result lists remain virtualized with bounded initial/batch/window settings; `removeClippedSubviews` remains unchanged because dynamic text and focused navigation have no required device proof. The 10,000-message/100-chat query fixture passed with batches capped at 200 source rows.

The final Phase 10 Repomix 1.18.1 packet is [`final-context.xml`](../supabase/repomix/phase-10-20261113/final-context.xml), with 25 actual entries and no security findings; the initial packet is beside it. Version-matched Expo SDK 57 and React Native list guidance were checked before editing. Workspace typecheck passed after the final edit; owned ESLint passed; the affected focused batch passed 6/7 suites and 73/74 tests, with the sole failure the pre-existing `a11yPressableSource` finding at `apps/mobile/src/components/VoiceNotePlayer.tsx:69`; accessibility render tests passed. Focused row/matching/Markdown/scoped tests passed 4 suites/44 tests, global and scoped virtualization assertions passed, the highlight-cache regression passed, and the synthetic query suite passed 15/15 tests including the 10,000-message fixture. Full mobile lint retains 20 unrelated baseline problems (16 errors/4 warnings). `git diff --check` passed. Optional MuMu/ADB device scrolling and frame measurements were not run. No dependency, migration, backend, deployment, commit, push, or Phase 11+ work was started. **Next phase ready to start: yes, Phase 11.**

<a id="phase-11"></a>

#### Phase 11 — Blank-search, history, and no-results polish

**Purpose:** Finish the compact discovery experience without duplicating actions.

**Prerequisites:** Phase 6 state shell, Phase 7 loading lifecycle, and Phase 8 username action contract are complete at their source/unit gates.

**Context inputs:** UI-02/UI-08/UI-09, `SearchSuggestions`, history module/cleanup path, Dialog/Button/Avatar/EmptyState contracts, shared strings, and existing history tests.

**Affected components:** Blank-search suggestions/history UI, empty-state composition, shared search strings, and focused history/visual/accessibility tests. Preserve storage semantics and sign-out cleanup.

**Baseline checks:** Current history load/error/write/clear/edit tests, sign-out cleanup test, blank-state result-resolution behavior, and current duplicate CTA paths.

**Work:**

- **H11.1** Keep Recent searches as a compact horizontal rail with stable loading, edit, remove, clear, and Done behavior.
- **H11.2** Show Clear all only when history exists.
- **H11.3** Keep Suggested rows at approximately 64–72 px and retain all existing details.
- **H11.4** Show only one username action in any blank, results, or no-results state.
- **H11.5** Compact the no-results icon, spacing, body copy, and CTA while keeping the empty state centered below the filters.
- **H11.6** Verify theme tokens, text scaling, compact width, labels and Back behavior with source and component checks. Native keyboard and screen-reader observation are optional.

**Exit gate:** Blank/history/no-results states have no duplicated actions, no layout jump, and no accessibility or theme regression.

**Phase 11 progress/status — 2026-11-13, Asia/Manila: Complete, 6/6 items (100%).** H11.1–H11.6 were completed in the existing blank-search suggestions/history UI, global no-results composition, shared search strings, and focused screen tests. Recent searches retain a stable loading rail, horizontal resolved-history rail, explicit Edit/Done mode, removable 72 dp rows, confirmed Clear all, durable-write retry, and a separate Reset path for unsupported history payloads so Clear all is never shown without visible history. Suggested content is hidden during edit mode, and derived edit state exits automatically after the durable list becomes empty. Global no-results content is centered below the fixed filters with a 48 dp icon, tighter spacing, concise copy, and a 48 dp Clear search CTA that clears both the controlled field and query state. The Username filter remains the only username action; no search-specific `/new-chat` CTA or route was added. Existing history durability and sign-out cleanup semantics were preserved.

The pre-edit mobile typecheck passed; the final affected mobile typecheck is currently blocked by the unrelated concurrent `apps/mobile/src/components/MainHeader.tsx:80` tuple error, while shared typecheck and Phase 11-owned ESLint pass. The Phase 11 screen suite passes 26/26 tests with the repository-local Jest cache, and history/sign-out cleanup passes 11/11 tests; the earlier default-timeout baseline had one pre-existing slow first screen test, which passes under the established 20-second diagnostic timeout. `git diff --check` passes. Full mobile lint retains the pre-existing 20-problem baseline outside the owned Phase 11 files; owned lint reports no findings. The initial scoped Repomix packet contained 23 entries; the post-edit packet is [`final-context.xml`](../supabase/repomix/phase-11-20261113/final-context.xml), with generation output in [`final-generation.log`](../supabase/repomix/phase-11-20261113/final-generation.log). Optional MuMu/ADB keyboard, screen-reader, theme, compact-width and native Back observations were not run. No dependency, migration, backend, deployment, commit, push, or Phase 12 work was started. **Next phase ready to start: yes, Phase 12; it remains out of scope for this execution.**

<a id="phase-12"></a>

#### Phase 12 — Integrated verification, performance gate, and handoff

**Purpose:** Validate the complete hardening pass and document measured outcomes.

**Prerequisites:** Complete the required Phases 5–11 gates and resolve relevant source ownership conflicts.

**Context inputs:** UI-01–UI-12, V00–V16, affected-file hashes, phase reports and synthetic fixture procedures. For optional device work, include the approved MuMu identity/artifact and disposable fixture details.

**Affected components:** Full affected search surface and tests; evidence/report files under `docs/test-results/search/`. No unrelated cleanup, migration, build, deployment, or route removal.

**Baseline checks:** Re-run only the affected commands justified by changed files, compare with Phase 5 baseline, and preserve exact diagnostics for unrelated failures.

**Work:**

- **H12.1** Run targeted search, history, username, navigation, MessageText/highlight, accessibility, typecheck, lint, and shared test suites.
- **H12.2** Run the full relevant mobile regression suite with bounded execution and preserve unrelated baseline failures honestly.
- **H12.3** Verify themes, accessibility, history, navigation, offline/cached state, pending/deleted targets and username failure/retry with automated checks. The V16 device matrix is optional.
- **H12.4** Use deterministic timing and a synthetic stress fixture to verify debounce, progress, cancellation, scan overlap and batching. Optionally measure native input-to-visible latency, frame stability and scrolling.
- **H12.5** Confirm 0 full-screen loading replacements after typing and 0 overlapping active scans.
- **H12.6** Perform caller discovery and remove only feature-obsolete hardening code if it exists; if no safe obsolete code exists, record that result. Do not remove `/new-chat` until the non-search caller audit is complete.
- **H12.7** Record evidence, remaining blocked observations, rollback scope, and final readiness status.

**Exit gate:** Applicable automated checks and synthetic performance assertions pass. Record baseline failures, cleanup, rollback and final readiness. Report any device checks separately with actual outcomes.

**Phase 12 progress/status — 2026-11-13, Asia/Manila: Complete, 7/7 items (100%).** H12.1–H12.7 are complete. The phase used the required Git baseline → ripgrep discovery → reader validation → scoped Repomix → XML analysis → original-source verification workflow. The focused packet contains 72 current entries, passed Repomix security checks, and has SHA-256 `79B1A21C0F6FD4EA1A9D314297CCCFB072DEF46D8B546258CF01E4C0C6ED8B83`; the broader packet is retained with SHA-256 `8CB03CC2A14C9436FA25B4395E66469E27EA448C23FB8D7CDE79DAEB33F9BEE0`. The new deterministic tests verify no scan at 149 ms, scan start at 150 ms, controlled completion at 160 ms and total completion within 300 ms, while the typed search shell remains mounted during message counting with no full-screen loading replacement. Existing lifecycle coverage verifies serialized native-read overlap at one active read, cancellation/timeout, invalidation, pending/deleted filtering, account boundaries, history, accessibility, highlighting, navigation and the synthetic 10,000-message/100-chat fixture with 200-row source batches. The current caller audit found no non-search `/new-chat` source caller; `NewConversationMenu` uses the global search Username filter, and the already-deleted `apps/mobile/app/new-chat.tsx` was not restored. No obsolete code was safely removable.

Affected mobile and shared typechecks passed; the corrected shared Vitest baseline passed 22 files/182 tests; the Phase 12-owned ESLint run passed; the focused search/accessibility regression passed 15 suites/123 of 124 tests, with the one failure matching the pre-existing unlabeled `VoiceNotePlayer.tsx:69` source-test finding; and the full mobile regression passed 467 of 471 tests across 74 suites, with the same four pre-existing failure categories retained in the report. Full mobile lint retains its 20 unrelated baseline problems (16 errors/4 warnings). The default Jest cache remains sandbox-blocked by transform-cache `EPERM`, so repository-local cache results were used. No device timing or visual observations were run because V16 is optional. Full evidence, exact commands, diagnostics, rollback scope and readiness are in the [Phase 12 report](../docs/test-results/search/phase-12/report.md). No dependency, schema, migration, backend, deployment, commit, push or later phase was started. **Next phase ready to start: no later phase exists in this search plan.**

### 12.11 Phase dependencies and implementation mapping

| Phase | Depends on | Primary source areas | Existing plan coverage |
|---|---|---|---|
| Phase 5 | Completed Phase 0–4 evidence | Search routes, components, tests and existing evidence | V00, V10, V16 (optional) |
| Phase 6 | Phase 5 | `app/search.tsx`, `SearchSuggestions`, shared layout/theme components | UI-01/UI-02/UI-06/UI-09, V12/V16 (optional) |
| Phase 7 | Phase 6 | `useMessageSearch`, global/scoped result states, SearchField | UI-02/UI-03, V01/V07/V12/V13/V16 (optional) |
| Phase 8 | Phase 6–7 | Search people/username lookup, `findUser`, direct-chat/open-chat flow | UI-10, V02/V03/V05/V15 |
| Phase 9 | Phase 6–7 | `SearchToolbar`, root search transition/focus lifecycle | UI-04, V12/V15/V16 (optional) |
| Phase 10 | Phase 6–7 | `SearchResultRow`, `HighlightedText`, list configuration | UI-05/UI-06/UI-07, V07/V08/V10/V14/V16 (optional) |
| Phase 11 | Phase 6–8 | `SearchSuggestions`, history UI, empty states | UI-02/UI-08/UI-09, V02/V06/V12/V16 (optional) |
| Phase 12 | Phases 5–11 | Full affected search surface and handoff evidence | UI-01–UI-12, V10, V12–V15, V16 (optional) |

No phase authorizes coding during this planning turn. Implementation begins only when explicitly requested, at Phase 5, with each later phase gated by the preceding phase's evidence. Device availability does not gate any phase.

## 13. Current planning-refinement record

**Date:** 2026-11-12, Asia/Manila. **Classification:** plan refinement only; no implementation started by this pass.

### Material changes made

- Corrected the status/baseline language to distinguish the existing working-copy search implementation and historical Phase 0–4 evidence from the not-yet-started UI-hardening work.
- Added stable UI-01–UI-12 requirements with concrete acceptance criteria, implementation-phase ownership, and V12–V16 verification coverage.
- Replaced temporary `U0`–`U7` labels with executable Phase 5–Phase 12 names that continue the existing Phase 0–4 sequence.
- Added prerequisites, context inputs, affected components, baseline checks, numbered Hn.n work items, and exit gates for every hardening phase.
- Resolved the username-flow decision: global search performs the existing authenticated exact-username lookup in place; `/new-chat` remains only for non-search compatibility until a caller audit supports retirement.
- Added current working-copy source identities and a freshness classification to the context index. The historical Phase 4 packet is retained as supplemental evidence, not treated as the current hardening baseline.
- Preserved all previously accepted search scope, account/permission rules, offline behavior, pending-message behavior, history durability, Markdown/navigation compatibility, emulator-only/ADB-only constraints, dependency/build limits, and unrelated-issue boundaries.

### Planning-only checks

| Check | Status | Evidence or reason |
|---|---|---|
| Applicable repository instructions read | Passed | `apps/mobile/AGENTS.md` and `supabase/AGENTS.md` were read; actual routes confirmed under `apps/mobile/app`. |
| Working-copy status and relevant diffs inspected | Passed | Current status shows extensive pre-existing/concurrent tracked and untracked changes; no destructive cleanup was performed. |
| Current hardening sources inspected | Passed | Routes, transition/focus, SearchField, query lifecycle, rows, suggestions/history, username route/RPC, strings, dependencies, and focused tests were read or searched at their relevant contracts. |
| Current source identities refreshed | Passed | Current hashes are recorded in `Plans/context/DoloGram_Search_Context_Index.md`. |
| Requirements-to-work-to-verification coverage | Passed | SR-01–SR-14 remain mapped to P1–P4/V00–V11; UI-01–UI-12 map to Phase 5–12/V12–V16. |
| Plan/context diff whitespace check | Passed | `git diff --check -- Plans/DoloGram_Search_Implementation_Plan.md Plans/context/DoloGram_Search_Context_Index.md` returned no whitespace errors. The LF/CRLF notice is a working-copy normalization warning, not a diff error. |
| Application lint/typecheck/tests/build/migrations/services/runtime | Not run | Explicitly prohibited by this planning boundary. Historical evidence remains dated and separately classified. |

### Remaining blockers and independent work

No unresolved product decision prevents execution. B04 and B05 cover current baselines and ownership. B06 identifies the inline `findUser` seam for Phase 8. B02 and B03 apply only to optional device checks. Source-only planning, test design, and context preparation can continue independently. Device and artifact availability affect only optional observations under the current policy.

## 14. Second-pass quality-audit record

**Date:** 2026-11-12, Asia/Manila. **Classification:** plan audit and refinement only; no implementation or operational verification.

### Audit inputs and targeted rechecks

- Reviewed this consolidated plan, Sections 8–9 safeguards, D01–D12 decisions, the current context index, Phase 0–4 reports/runtime notes, and the applicable mobile/Supabase instructions.
- Reused unchanged source identities and historical evidence. Re-read only sources needed to resolve material questions: the current scoped search route, `useMessageSearch`/search request deadline behavior, `openDirectChat`, current global search username handoff, the `findUser` repository/RPC grant, and focused search tests.
- Confirmed the current scoped route already uses full-history/pending pagination and explicit errors; the earlier 200-row/silent-error description was stale and has been corrected.
- Confirmed the exact-username RPC returns only `{ user_id, display_name }` to authenticated callers. The plan now distinguishes locally eligible People results from uncached exact-username results so the latter use the existing New Chat direct-chat path rather than an incompatible local allowlist preflight.

### Material corrections made

| Audit ID | Defect | Repair |
|---|---|---|
| AQ-01 | Section 2 described the scoped route as still using a 200-row snapshot, swallowing errors, and replacing navigation, although current source had Phase 3 pagination/error/push behavior. | Reclassified the current route as already integrated and made hardening preserve its contracts. |
| AQ-02 | The inline username proposal could apply local People eligibility to a remote exact-username result, making uncached new-contact lookup fail. | Separated local cached-People preflight from remote exact-username `openDirectChat`; added no-mutation-on-lookup-failure coverage. |
| AQ-03 | Username normalization, trigger timing, empty-candidate validation, cancellation, timeout, and late-result handling were not executable enough. | Defined explicit tap/submit trigger, trim/one-`@` normalization, empty rejection, one in-flight generation, bounded lifecycle, invalidation, and late-settlement handling. |
| AQ-04 | “Zero overlapping scans” could be read as only a UI-generation property even though an aborted native read may still settle. | Required serialization/coalescing of underlying loader promises when physical cancellation is unavailable, plus overlap instrumentation. |
| AQ-05 | The 200–300 ms/progress targets had ambiguous timing anchors and UI-07 was partly an implementation-presence claim. | Anchored latency to the final keystroke/debounce event and changed UI-07/V14 to observable render-count and runtime behavior assertions. |
| AQ-06 | Phase 4’s incomplete native gate could be misread as blocking all hardening work. | The earlier audit allowed Phases 5–11 to proceed and deferred native revalidation to Phase 12. The current policy makes V11 and V16 optional in every phase. |

### Audit outcome

The requirements remain bounded to the agreed search hardening and inline username lookup. No new feature, backend API, migration, dependency, device class, or unrelated cleanup was added. Existing account isolation, offline behavior, history durability, Markdown/navigation compatibility, caller preservation, recovery rules, and emulator-only/ADB-only constraints remain in force.

No tests, lint, typecheck, build, migration, service, ADB, or remote command was run during this audit. Document-level validation is limited to source/context inspection, plan traceability, and diff checks. Historical passes remain historical; failed, blocked, and unrun checks cannot satisfy current hardening gates.

**Readiness classification — Ready for execution.** Phase 5 can start without an external blocker because it is source/baseline preparation and may record runtime prerequisites as blocked. B04/B05 concern required baselines and ownership. B02/B03 apply only to optional device checks. B06 is a Phase 8 implementation seam. UI-01–UI-12 still require their Phase 5–12 implementation and applicable V12–V15 checks. V16 is optional.

## 15. Verification-policy revision — 2026-11-13, Asia/Manila

Applied the user's instruction to make every device check optional throughout the roadmap, acceptance mappings, phase gates, performance targets, decisions and progress rules. Required source and automated assertions remain mandatory, and a defect actually observed still requires diagnosis. Optional evidence cannot guarantee the absence of platform-specific bugs.

Phase 4 is complete under this revised policy using its recorded affected-check results, evidence/handoff, rollback and verified fixture/settings/process cleanup. Its unperformed observations remain explicitly optional, with no invented passes. Original search progress is 12/12 required items (100%); 5 of 13 plan phases are complete and 8 phases with 49 work items remain. Phase 5 is ready on request; none of Phases 5–12 was started.

Documentation verification checked all local Markdown link targets, the nine Phase 4–12 roadmap anchors, the eight future phase work-item counts and diff whitespace. Existing typecheck/lint/test results are dated evidence in Phase 4, not new runs during this documentation revision. No application, dependency, emulator, database or remote-service action was performed for this revision. Historical reports retain their original results and checkpoint statuses.

Repository-instruction discrepancy resolved: root `AGENTS.md` requires new Repomix packets/logs under `supabase/repomix/`; older instructions and historical packet paths used `docs/test-results/search/`. Section 8 now centralizes the current rule, preserving historical references. Revision context and document snapshots are indexed in `supabase/repomix/search-plan-policy-20261113/`.
