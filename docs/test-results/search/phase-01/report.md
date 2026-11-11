# Search Phase 1 execution report

2026-11-11, Asia/Manila. **Complete — 3/3 items, 100%.** Search-plan progress:
6/12 predefined items, **50%**. Broader DoloGram project progress has no defined
denominator. Phase 2 is ready on its source/unit prerequisites and was not started.

## Scope and requirement classification

| Item | Entry classification | Delivered and verified |
| --- | --- | --- |
| P1.1 | Partially done: delivered batch/page scan existed; no summary/scoped-pending/lifecycle contract | Shared literal NFKC matching, source explanations, original-text snippets, complete delivered summaries, scoped pages, account/chat-filtered pending statuses/IDs and echo/tombstone suppression. Shared lifecycle invalidates cache/queue/preferences, debounces 150 ms, fences generations, observes focus via `active`, reports read/timeout/unavailable states and supports explicit retry. |
| P1.2 | Partially done: uncontrolled field existed; controlled state and reusable rows/ranges absent | Controlled/immediate-change and uncontrolled/prefilled field contracts, clear/submit/debounce cleanup, shared strings, Unicode original-text ranges, themed highlighted text and reusable accessible result rows. Field retains a 40px visual surface within a 44px control area; clear target is 44×44 without horizontal hitSlop overlap. |
| P1.3 | Not started: broad group-picker contact adapter was unsuitable for search | Separate search people adapter with allowlist plus caller-membership join, deduplication, canonical/direct nickname matching, blocked-person exclusion across groups, Saved Messages shortcut, existing direct lookup, explicit-deleted-direct reopening compatibility, deterministic generic people/group name ranking. |

The five changed existing application/test sources are query.ts, SearchField.tsx,
shared strings, chatList/query.ts and query.test.ts. New foundation modules/tests
are enumerated in validation.json. No dependency, lockfile, schema, migration,
production route, direct-chat creation, history, Markdown renderer, remote service,
calling integration, commit, push, deployment or native build was changed.

## Acceptance gates

| Phase 1 assertion | Status and direct evidence |
| --- | --- |
| V01 query/count/cursor | **Met.** 260 rows/35 old matches, exact 30+5 tied-timestamp pages, complete counts, literal SQL input, Unicode, account/allowlist/tombstone/media exclusion and zero results. Separate 10,000-message/100-chat fixture yields 100 summaries of 100 matches using 51 reads, each bounded to 200 source rows. Only requested pages and one summary per chat are retained. |
| V02 field | **Met.** Controlled/uncontrolled/prefill, immediate change, default forward-style 150ms debounce, immediate clear/backspace, pending-submit flush, external-value cancellation and timer cleanup. Existing global caller regression passes. |
| V03 candidates/ranking | **Met.** Real in-memory SQL with coexisting account memberships, group-only/ignored/deleted sources, blocked direct person through group, canonical/nickname matching, unique self shortcut and stable rank tie order. Read/cancel/deadline errors reject. Adapter performs no create operations; opening/creation/remote username assertions remain Phase 2. |
| V04 scoped data/pending | **Met.** Same full-history predicate/pagination as global; queued/sending/failed retain ID/status separately from delivered totals; wrong sender/chat, sent rows, deleted and paged-out echoes omitted. Missing membership and disallowed scopes reject before queue access. Pending bubble navigation remains Phase 3. |
| V07 request lifecycle | **Met.** Deferred old reads across query/account/chat changes cannot publish; clear/blur/unmount cancel; cache/queue/preference bursts hide old data and debounce to one new scan; refocus rereads; deadline reports timeout with no retry loop, consumes late rejection, and explicit retry recovers; listeners/timers removed. Screens must pass stable loader callbacks that refresh eligibility, `active` from focus, and all candidate chat IDs as `observedChatIds`. Screen integration remains Phases 2–3. |
| V08 pure highlight ranges | **Met.** Repeated/overlapping matches, compatibility ligature/full-width expansion, combining characters, Turkish dotted I, contextual Greek sigma, Hangul composition and emoji map to original UTF-16 positions. Plain rows use theme tokens and growing layout. Markdown leaf integration is Phase 3. |
| Callers/no new failures/no migrations or dependencies | **Met.** Workspace and strict native-fixture typechecks pass; feature, existing caller, accessibility, chat-list and shared suites pass. Lint retains precisely the baseline findings below. |

## Checks and evidence

Exact commands, PID, exit status, durations and complete output are retained in
each check directory's JSON/log pair. The bounded supervisor permits 120 seconds
for targeted Jest and 300 seconds for lint/typecheck/shared checks. No check timed
out in this phase and no assertion was skipped or weakened.

| Check | Baseline | Final |
| --- | --- | --- |
| `npm run typecheck` | Passed | Passed, `field-correction/typecheck.log` |
| Mobile `npm ... run lint` | Failed: 13 errors/3 warnings | Failed: same 13 errors/3 warnings, `final-after-field/lint.log`; zero new findings |
| Existing search/chat/Markdown suites | 4 suites/23 tests passed | 4 suites/29 tests passed, `final-after-field/targeted-mobile.log` (includes expanded query tests) |
| Phase 1 foundation suites | New suites did not exist | 6 suites/36 tests passed, `final-after-field/foundation.log` |
| Shared Vitest | 20 files/149 tests passed | 20 files/149 tests passed, `regression-checks/shared.log` |
| Accessibility source/render | Phase 0 evidence reviewed | 2 suites/6 tests passed, `regression-checks/accessibility.log` |
| Chat-list hook/preferences | Existing checks discovered after prerequisite fix | 2 suites/9 tests passed, `prerequisite-regressions/chat-list.log` |
| Evidence-only fixture strict typecheck | Not applicable | Passed, `fixture-typecheck.log` |
| Snapshot/hash/restore/packet/scope audit | 28 pre-edit source/config snapshots | Passed, `validation.json` and `final-identities.json`; no unowned snapshot changes |
| Full mobile suite/build/export | Not required for this foundation baseline | Not run; full suite and integrated performance/platform gates remain Phase 4 |

The initial added-test run failed on the discovered six-placeholder/seven-bind
query bug, missing explicit test prop types, test-root replacement, and a queued
test-scheduler tick. These were diagnosed and corrected; original failures remain
under first-checks. A subsequent visual-target adjustment used a removed RN
StyleSheet member; typecheck caught it, and the installed 0.86 `absoluteFill`
contract fixed it. No suppression or weakened assertion was introduced.

Baseline lint findings remain in group-name, info, nicknames, new-group,
chats/preferences, MessageFocusOverlay and Toast tests. Their full baseline and
final diagnostics are retained. None is in owned production code. Existing Node
SQLite experimental/punycode and shared config-loader warnings remain recorded.

## Native query observation and limits

Fresh MuMu config reads identify `MuMuPlayerGlobal-12.0-3`, playerName `dologram`,
ADB port 16480. Host ADB lists `127.0.0.1:16480`; other devices were untouched.
The installed package path matches Phase 0's inventory. Used the existing client
with a new evidence-only entry, not a new build or a product route.

`native.log` records the isolated in-memory SQLite result: delivered 30+5 old
matches, complete delivered count 35, scoped first page 30 and one failed pending
match with its queue ID/status. The fixture probes its outbound network fence,
imports no auth/sync/queue workers, closes the memory database in finally and
never reads sessions or connects to a backend. The exercised fixture process has
zero ReactNativeJS errors/warnings.

Observed first-page query wall time was **104.45 ms**, both pages **110.42 ms**,
and a separate complete-count scan **31.29 ms**. These are one native sample under
concurrent verification load, not UI latency, an average or the later 100ms/10k
platform gate. No performance improvement or V11 stress pass is claimed.

Instrumentation caveat: the raw native result's `cancelledReadCount: 6` includes
six subsequent count/scoped reads because the metric was calculated at final
serialization. The immediate zero-read assertion before those calls passed.
The evidence-only source now captures the metric immediately; that bookkeeping
correction was not rerun on-device. The raw log is preserved without alteration.

The first sandbox-only Metro endpoint did not receive the emulator request;
diagnosis moved the task server to host access and the native fixture then loaded.
The task's 8085 server sessions were stopped and only its added 8085 reverse was
removed. All six pre-existing mappings (including 8084) were preserved. cleanup.json
confirms no 8085 listener and no initial background-server process. Fixture app
was stopped. No emulator settings or application data were cleared.

## Workflow, decisions and recovery

Followed Git baseline → narrow ripgrep discovery → prior evidence/source identity
validation → scoped Repomix 1.18.1 → complete Reader XML analysis → original-source
verification. Repowise was unnecessary. `packet.json` records selectors, all 15
actual entries, SHA-256, security enabled, no compression and six read boundaries
(195/195/195/195/195/80 lines; all below 12,000 characters). All six extracted
chunks were read completely. No selector omission or compression gap remains.
Original sources supplied schema, queue pending conversion, chat-list loader,
preferences, field callers, Avatar/theme and direct-chat contracts outside the
packet. Dependency manifests/lockfile identities are preserved in snapshots.

Non-obvious decisions:

- The six-placeholder/seven-bind defect in `chatList/query.ts` is a strictly
  necessary prerequisite to reuse `findDirectChatId` with the existing source-row
  representation. Corrected one extra binding, preserving SQL/consumer behavior.
  In-memory SQL and existing hook/preferences regressions pass.
- Existing global `searchCachedMessages` signature remains callable, including
  the already-cancelled zero-read result. New scoped requests enforce membership
  before pending reads. Counts publish only after complete scans. Match-source
  fields are additive for old callers.
- SearchResultRow and HighlightedText are Phase 1 foundation contracts; they are
  deliberately not wired into later-phase routes or Markdown rendering here.
- Mobile AGENTS' src/app sentence differs from actual app routes. No route was
  created or moved, so Phase 1 has no instruction conflict requiring a deviation.
- Existing deleted direct chats can be resolved for explicit reopening through
  a person known in an eligible group, but cannot supply search content. Blocked
  direct people are omitted even when a group would otherwise supply them.

Restore only an individually owned changed file from `baseline/source/<path>`
after checking for subsequent user edits; never reset the working copy. For new
files, compare final-identities.json before removing any task-owned file. Both
tracked and untracked user inputs are preserved; HEAD cannot recover most source.
Packets/snapshots exclude secrets, .env, signing/session data and private messages.
See the central context index for framework references, complete read coverage,
source identities and the Phase 1 checklist.

## Remaining work

No Phase 1 blocker or required manual gate remains. Full product theme/large-font
and retained navigation, connected account fixtures, Markdown integration and
10k native scrolling/cancellation/performance are later-phase verification, with
steps in V05/V08/V11 of the plan. Existing lint errors and calling/native-client
compatibility beyond the exercised fixture remain out of scope. Phase 2 is ready;
no Phase 2–4 implementation was started.
