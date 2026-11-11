# DoloGram search planning context index

## Phase 1 execution context — 2026-11-11

This supplement is current for Phase 1 and supersedes planning-only statements
below where they concern the completed foundation. Phase 2–4 work was not started.
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

No unresolved Phase 1 requirement or blocker remains. Search-plan progress is
6/12 items (50%); Phase 1 is 3/3 (100%). Broader project progress is undefined.
Phase 2 is ready but not started. Remaining integrated runtime/connected-data/
Markdown/navigation/performance gates stay assigned to Phases 2–4. Historical
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

