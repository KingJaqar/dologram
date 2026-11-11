# DoloGram Memo Chat Implementation Plan

Prepared and audited on 2026-11-11, Asia/Manila.

Status is **Ready for execution, implementation not started**. The second-pass readiness assessment is in Section 20. All MEM acceptance criteria and execution work items are **not run**. Source inspection and document-consistency checks establish planning evidence only. Start with the [Memo Chat context index](context/DoloGram_Memo_Chat_Context_Index.md) for source identities, inspection boundaries, findings, and unresolved prerequisites.

## 0. Planning boundary and shared execution rules

### 0.1 Evidence and scope

**Verified** means inspected in the current original source or identified official documentation. **Reported** means historical evidence with an unverified current runtime/source match. **Proposed** means a planned change or default. **Unresolved** means a named prerequisite in Section 18 with an affected requirement and next action. Existing source paths are identified in Section 2. Section 4 paths and interfaces are proposed unless explicitly identified as existing.

This polishing pass permits edits to this existing plan and its one context index. Supporting inspection is read-only. Implementation, dependency installation, application/data edits, migrations, builds, service startup, deployment, and device operations belong to later authorized execution. Section 15 remains a suggestion backlog and adds no execution acceptance requirements.

### 0.2 Context and change discipline during execution

1. Re-establish the working-copy baseline, inspect scoped diffs and applicable instructions, validate reusable source identities, prepare only missing context, analyze relationships, and verify conclusions against original source. The current app and many related inputs are untracked. Before editing them, preserve a recoverable scoped snapshot or patch that includes relevant untracked inputs. Do not reset, overwrite, or clean unrelated work.
2. Maintain the single context index. Refresh changed files and their dependent findings. Targeted originals suffice for this plan. If a packet is later used, record intended/actual scope, identities, exclusions, omissions, and complete read/continuation boundaries. Treat packet guidance as reference material. Exclude `.env*`, account/session contents, real messages, credentials, signing files, private diagnostic payloads, and generated app bundles from context artifacts.
3. Deliver complete production-ready paths within the active milestone. Required paths need working handlers, error feedback, cleanup, and acceptance evidence. Preserve existing callers/contracts/runtime discovery. Reuse conventions and introduce dependencies or adapters only for a demonstrated need. Remove feature-obsolete code/assets after caller checks, with unrelated cleanup recorded separately.
4. Establish affected lint/typecheck/test baselines before editing. Record passed, failed, blocked, or not run with source/build/target identity and diagnostics. Separate pre-existing failures from regressions. Never weaken assertions or disable checks to obtain a pass. Rerun affected checks after changes and broaden only for a concrete dependency or new failure.
5. Bound requests, jobs, timers, listeners, render updates, and retries. After two failures for the same reason, retain diagnostics, diagnose, and change approach or report the specific blocker. Do not rerun an unchanged failed/blocked check without a concrete code, configuration, dependency, or investigation outcome that justifies it. Record the result and continue independent work instead of entering a testing loop. Stop task-created processes when no longer needed and preserve pre-existing services. Ordinary source diagnostics must exclude secrets and private content.
6. A blocked probe does not stop independent authorized work. Acceptance requiring that probe remains incomplete. Ask only for a genuinely unavailable resource, material scope decision, or restricted action whose authorization is absent. Reuse existing authorization for covered actions.

### 0.3 Testing environment and resource constraints

The user's current standing authorization directly establishes **MuMu Player `dologram`** as the main testing environment, package **`com.dologram.app`**, and **ADB-only control**. Preserve emulator-only testing and the exclusion of physical-device/computer-use/desktop automation. Covered actions include reset, install/reinstall/launch/restart, account creation/login, available provided or publicly documented passwords/PINs, test-item creation/modification/deletion, app-data clearing, and necessary emulator-setting changes. Perform these autonomously within the assigned emulator and authorized test accounts when implementation is requested. Do not ask the user to repeat covered permissions, supply an already available credential, or perform an available login/account-creation step. LDPlayer is an alternative only when actually assigned. Never infer access to another instance from its presence.

A live serial, current APK, runtime capabilities, and current service state remain technically unverified in this audit. Discover them through ADB during execution instead of assuming an old serial. If essential access information is genuinely unavailable, identify that exact missing fact and affected check, then continue independent work. Questions and status requests do not suspend authorized execution. Pending manual verification cannot block implementation or other phases whose actual dependencies are satisfied. Section 14.4 distinguishes those dependencies from completion/release gates. This audit still performs no operational verification.

Reuse a compatible approved client/artifact. SQLCipher, key storage, editor natives, sharing configuration, or alarm configuration may require a replacement native artifact. Establish exact native/config delta, artifact fingerprint, build quota, source-upload permission, and EAS profile before any build. The recorded build workflow uses cloud EAS and excludes local native builds. Historical reports mention a source-upload authorization block and a build allowance. Neither establishes current permission or remaining quota. Native capability checks remain blocked if a matching artifact cannot be obtained, while independent domain/server tests can continue.

Backend tests use disposable identities/data in a confirmed isolated configuration or approved scoped test target. Verify project identity, recipient allowlist, credentials source, reset procedure, and side-effect isolation. A container or a historical test account name alone proves none of these. Suppress real notification/email dispatch outside designated test recipients. Two isolated client identities/stores can exercise concurrency within the authorized environment. Additional live client environments require established access. Hardware-specific assertions that the assigned emulator cannot exercise remain blocked, without introducing a physical-device requirement.

### 0.4 Execution progress reporting

Apply this subsection only after implementation is authorized. Each numbered checkbox in Section 14 is one stable work item with weight 1. Its completion requires its implementation and mapped verification to be finished. The last verification item is the phase's acceptance gate. It stays incomplete while any required phase observation is failed, blocked, or not run.

Calculate current-phase completion as completed item weight divided by total required item weight, multiplied by 100, rounded to a whole percentage. Do not report 100% with an unmet gate. Record legitimate scope/weight changes and their effect. Report overall project progress separately only if its denominator is defined. A later phase is ready when its stated prerequisites are met, even if independent work in another phase continues.

After each execution work session use the required form and then state next-phase readiness.

> Current execution phase: [name] — [X]% complete. Completed: [verified work]. Remaining: [required work]. Blockers: [none or specific blocker].
>
> Next phase ready to start: [yes/no and unmet prerequisite, if any].

## 1. Product outcome and delivery scope

Add **New Memo Chat** to the existing New bottom sheet. A memo opens as a personal conversation that works offline from its first save. It holds messages, recordings, photos, videos, documents, links, arbitrary file attachments, and large editable memo notes. Users can organize, find, protect, remind themselves about, export, recover, synchronize, and eventually collaborate on that content.

The defining experience is dependable capture followed by fast retrieval and useful follow-through. Assess differentiation through user testing of those complete workflows. Market uniqueness has not been established by this plan.

Android is the first delivery target, matching the existing mobile app. Keep platform-independent domain contracts reusable by iOS and web. Each additional platform needs its own persistence, sharing, security, editor, and notification validation.

All eight requested feature groups and the eight requested additions are in the roadmap. Staged milestones allow usable releases while later capabilities are built. A milestone's completion does not imply completion of the full feature.

### 1.1 Proposed defaults

These defaults resolve implementation gaps without requiring a product decision before local development. They remain adjustable after prototypes and user testing.

| Decision | Proposed behavior |
| --- | --- |
| Initial identity | Memos belong to the active DoloGram account. An already authenticated account can create and use local memos offline, including while token refresh is unavailable. First-time account registration still requires connectivity. Guest mode is a possible later feature. |
| Initial creation | One guarded tap creates one local memo with a generated ID and editable default title, then opens it. Rename and protection are optional actions. |
| Storage | Every new memo starts as Local only. Uploading begins only after the owner selects synchronization or sharing. |
| Cloud placement | Synced and Cloud storage share one replication protocol. Their difference is the device's attachment retention policy. Every edit first commits locally. |
| Notes | Title, description, and structured body. The body supports 500,000 Unicode code points including newlines, with no separate line-count limit. |
| Short messages | Reuse the existing 4,096-character message contract. Offer Create memo note when a draft exceeds the short-message limit. Preserve the full draft during conversion. |
| PIN | Optional six digits per memo on each device. Each authorized device enrolls its own PIN. The memo's requirement to enroll protection can synchronize. |
| Reminders | Personal by default. A bulk selection creates one reminder linked to all selected items. Separate reminders and shared recipients are explicit choices. |
| Trash | Manual cleanup is the initial default. Owner/Admin can explicitly enable 30-day retention. Local-only or unsynchronized sole-copy originals still require an explicit purge confirmation. |
| History | Automatic checkpoints plus named versions. Start with 30 days and 100 automatic checkpoints per note. Show storage use and preserve named versions until explicit removal. |
| Collaboration | Owner, Admin, Senior, Junior, and Viewer. Permissions apply to the memo and its content. |
| Concurrent note editing | Optimistic revision checks with preserved conflict copies. Live simultaneous editing is a later enhancement. |

### 1.2 Requirement coverage

| ID | Observable acceptance criterion | Delivery phases | Verification |
| --- | --- | --- | --- |
| MEM-01 | In airplane mode, either existing New-sheet entry point creates one memo despite repeated taps. Save a text entry, restart the process, and reopen the same entry. | P1 | V01, V02 |
| MEM-02 | Capture and reopen each requested content class, including ZIP/EXE/APK/unknown files. Losing the source URI after acknowledged save preserves the private original. Failed/partial imports remain recoverable and visibly incomplete. | P1, P2 | V02, V03 |
| MEM-03 | Exercise every Section 3 transition, interrupt/retry it, and observe the correct resulting mode. Local-only content creates no cloud backlog. Enabling sync bootstraps retained state and preserves edits made during bootstrap without replaying discarded local history. Eviction never removes the sole verified copy. Shared-copy behavior completes in P7. | P1, P6, P7 | V02, V08, V09 |
| MEM-04 | A query finds matching content older than the initial timeline window in each promised indexed field, including tokens/phrases across artificial note-chunk boundaries. Opening a snippet reaches the matching item/block and Back restores results. Rebuild/errors remain visible. Note-body completion follows P4. | P3, P4 | V04, V05 |
| MEM-05 | Select each of the nine filters on overlapping fixtures. Results match Section 6 once per item, only the active filter shows its label, and screen-reader selection and enlarged text remain usable. Note-image completion follows P4. | P3, P4 | V04, V05, V12 |
| MEM-06 | Create offline reminders for one item and a frozen bulk selection. Interrupted target-set construction never activates a subset. At the supported due time receive the configured alert/sound, snooze/complete it, and open guarded targets. Trashing the whole memo suspends its reminders when observed. Denied access and missed delivery have truthful status. Alarm-mode completion requires its P5 native gate. | P5, P6, P7 | V07, V08, V09 |
| MEM-07 | Enroll a six-digit PIN, fail/restart/retry, unlock, and exercise auto-lock through all entry points. A valid email reset preserves content. Expired/replayed/wrong-account codes fail. Missing keys select backup/sync recovery rather than an empty replacement vault. | P0, P1, P4, P6 | V01, V06 |
| MEM-08 | A 500,000-code-point body saves/reopens with images and newlines. A 500,001st code point is refused without truncating the existing draft. The card shows title/two-line description and the modal supports verified save/update/delete. | P0, P4 | V05 |
| MEM-09 | Export the same representative note to all four formats, open/parse each output, and verify text and image/format rules in Section 7. Failed/cancelled export never reports a complete file. | P4 | V05, V10 |
| MEM-10 | Compare storage totals against fixture originals, history, trash, indexes, and temporary copies. Cleanup previews reclaimable bytes and preserves protected originals. Measure Section 13 targets on the assigned emulator profile. | P2, P8 | V03, V11 |
| MEM-11 | Invite/accept users in each role, attempt every allowed/forbidden action directly through API/storage, transfer ownership concurrently, and revoke an offline editor. Server authorization and private recovery follow Sections 11-12. | P7 | V09 |
| MEM-12 | Add/rename/remove tags and bulk associations, restart, and retrieve the same live items by tag. Duplicate creation reuses one normalized identity, rename collisions leave both tags unchanged, and Junior/Viewer actions obey Section 6.2. | P3, P7 | V04, V09 |
| MEM-13 | Personal pins remain private to their user. Authorized shared-pin changes converge. Viewer/Junior attempts outside the role matrix fail without changing shared state. | P3, P7 | V04, V09 |
| MEM-14 | Trash/restore single and selected items or a whole memo. Verify references, reminder suspension, and explicit reactivation. Retention follows the selected policy and never auto-purges an unconfirmed sole local copy. Permanent purge removes scoped body/drafts/history/index content while preserving other live references and replay-safe deletion markers. | P2, P4, P5, P6, P7 | V03, V05, V07, V09 |
| MEM-15 | Preview/compare an earlier note version and restore it as a new revision. The prior current version and referenced images survive, including interrupted restore and a concurrent remote edit. | P4, P6 | V05, V08 |
| MEM-16 | Share text/URL and single/multiple files from Android apps on cold/warm start. Choose an authorized destination, replay the intent, and verify one durable capture. Denied/expired URI grants preserve verified work and offer recovery. | P5 | V13 |
| MEM-17 | Export an encrypted complete archive offline, restore it on a fresh installation with only its passphrase, and compare the manifest/content. Wrong password, corruption, interruption, and duplicate job replay never expose a false complete import. | P2, P4 | V10 |
| MEM-18 | Observe Saving until commit, Saved on this device after commit, and Synced only after authoritative acknowledgment/required assets. Lost responses, quota limits, conflicts, and partial downloads expose the correct recoverable status. | P1, P6 | V02, V08 |
| MEM-19 | Terminate before/after each journal stage and retry save/import/export/migration/upload/bulk-target construction. Reopen the last acknowledged state or explicit recovery job with stable IDs, no duplicate publication, and no incomplete reminder activation. | P1-P8 | V02, V03, V05, V07, V08, V10, V14 |
| MEM-20 | Expire cloud credentials, switch/sign out/remove an account, and clear cache. Local access follows the enrolled-vault gate, other accounts see no data, originals survive ordinary cleanup, and explicit erase/key-loss paths provide truthful outcomes. | P1, P4, P6 | V01, V06 |
| MEM-21 | Verify every route, notification, share, search, file-open, and export guard with wrong-account/locked fixtures. Both themes, labeled controls, touch targets, focus, and enlarged text pass the accessibility matrix. | P1-P8 | V06, V07, V12, V13 |
| MEM-22 | Disable each delivered capability, interrupt a schema upgrade, and open with a supported prior/newer-schema build. Preserve compatible read/export access or show a recovery/upgrade action without initializing over existing data. | P8 | V14 |

## 2. Verified repository foundations

The working copy is the baseline. Much of the repository is currently untracked, so inspect original files and preserve unrelated work during execution. Older implementation plans contain historical observations and task-specific operating decisions. Recheck current source and applicable instructions before using them.

| Existing source | Integration consequence |
| --- | --- |
| `apps/mobile/package.json` | Expo 57, React Native 0.86.3, SQLite, file system, document/media pickers, audio/video, notifications, sharing, and resumable-upload libraries are present. Installed modules still need matching native artifacts. |
| `apps/mobile/src/components/TabBar.tsx` | Exports `NewSheetContent`, currently containing New chat and New group. Add the memo action here. |
| `apps/mobile/src/components/HeaderNavActions.tsx` | Reuses `NewSheetContent`. Verify both header and tab entry points. |
| `apps/mobile/src/components/BottomSheet.tsx` | Existing modal supports gestures and animations but has a 90% maximum height and no editor save/dismiss contract. Add a focused note-editor wrapper or compatible extension. |
| `apps/mobile/src/queue/db.ts` | The existing database contains the messenger queue and synchronized cache. Memo originals need their own durable lifecycle. |
| `apps/mobile/src/queue/attachments.ts` and `attachmentFiles.ts` | Existing private-copy patterns are useful. Sent-queue cleanup removes queue attachment copies, so memo originals need separate ownership. |
| `apps/mobile/src/storage/localData.ts` | Sign-out cleanup deletes queue/cache data. Integrate memo lifecycle explicitly instead of assuming the existing cleanup preserves every local asset. |
| `apps/mobile/src/auth/accountSession.ts` and account/sign-out callers | Add generation-scoped teardown to every session-change path. Preserve existing calling and push-registration coordination. |
| `apps/mobile/src/auth/AuthProvider.tsx::applySession`, `app/_layout.tsx::RootNavigator`, `src/auth/accountSession.ts::switchToSavedAccount` | Current navigation requires `signedIn`, and switching refreshes a server session. Offline memo-vault identity/entry must be implemented explicitly without manufacturing a Supabase session or granting offline cloud/chat privileges. |
| `apps/mobile/src/chatList/ConversationListScreen.tsx::openChat`, `ChatOrganizationActions.tsx`, `src/folders/cache.ts`, migration `016_align_messenger_schema.sql` | Rows currently open `/chat/[chatId]`; archive/mute/folder writes use ordinary membership APIs, and `folder_chats.chat_id` references `chats`. Memo routing/preferences/folder links need type-aware adapters. |
| `apps/mobile/src/search/query.ts`, `matching.ts`, and `request.ts` | Current search has explicit scope/identity, bounded cache scanning, delivered/pending matching, and shared normalization/preview/deadline helpers. Reuse compatible presentation/matching/cancellation contracts through a memo source adapter. Keep its FTS implementation separate from messenger cache membership/sequence assumptions. |
| `packages/shared/src/chats/direct.ts` | Saved Messages has special one-member direct-chat semantics. Introduce a memo domain with its own IDs and persistence contracts. |
| `packages/shared/src/config/index.ts` and `validation/attachment.ts` | Existing messages have a 4,096-character limit, 10 attachments, MIME allowlists, and 10/50 MiB media limits. Memo limits and arbitrary-file support require an explicit policy. |
| `apps/mobile/src/notifications/pushNotifications.ts` | One global notification handler currently applies message preferences. Extend typed dispatch and foreground presentation for memo reminders alongside message/call behavior. |
| `apps/mobile/app/_layout.tsx` notification-response effect | Currently recognizes only `call_id` and `chat_id`. Add typed account-bound memo/reminder routing, cold-start handling, and payload validation here, while preserving current response subscriptions. |
| `apps/mobile/src/calls/audioOwnership.ts` | `registerRecorderStop`, `registerPlaybackPause`, `isCallAudioOwned`, and `acquireCallAudio` already coordinate call/recorder/player ownership. Register memo consumers and define alarm arbitration at this boundary. |
| `apps/mobile/src/media/shareFile.ts` | Existing outgoing sharing validates against chat attachment rules. Memo export needs validation compatible with its own formats. |
| `apps/mobile/app/`, `app.json`, and `app.config.js` | Use actual Expo Router routes and config plugins. Validate the full existing configuration, including concurrent calling changes. |
| `Plans/DoloGram_Search_Implementation_Plan.md` | Coordinate shared search UI and normalization. Memo search has additional scope and a different storage source. |

Official SDK 57 documentation exposes SQLite full-text search and SQLCipher, plus incoming sharing APIs marked experimental. Verify the installed SDK's declarations and a matching native build during P0. [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)

Verified configuration gaps are bare `expo-sqlite` and `expo-sharing` plugin entries. The installed sharing plugin defaults `android.enabled` to false. Incoming raw payload APIs exist, but configured intent filters and runtime support are unverified. `expo-secure-store`, biometric APIs, streaming crypto, a rich editor, and document-export engines are proposed dependency needs, with final selections assigned to P0. Existing media upload resolves some already-exists errors as success and buffers small uploads. Memo verification/cancellation cannot inherit those semantics unchanged.

The latest local migration filename observed is `030_calling_provider_webhooks.sql`. Its presence does not establish deployed history. Existing SQL tests are transactional assertion scripts, and mobile SQLite/picker/notification tests use mocks. They establish reusable conventions, without proving native memo persistence, file integrity, or alarm behavior. Historical Phase 17 results are reported evidence only, as indexed in C8.

A final source-freshness check found concurrent edits to search query/helpers and related plans. The changed search contracts and recorded environment rules were rechecked at original-source locations. Source identities in the context index reflect that refresh. Other tasks' edits were preserved. Revalidate again before execution, especially search exports, shared strings, and chat-screen consumers.

## 3. Storage modes and account lifecycle

### 3.1 Replication and residency

Model two independent settings in the domain. `replication` is `local` or `synced`. `residency` is `keep_all` or `on_demand` on each device. The three product labels are presets over these settings.

| Label | Replication | Device retention |
| --- | --- | --- |
| Local only | Local | Keep all originals |
| Synced | Synced | Keep all originals on the creating device. New devices show download progress and completeness. |
| Cloud storage | Synced | Retain searchable text and metadata. Download attachments on demand and allow Keep offline per item/memo. |

Always keep unsynchronized changes and their original attachments. A remotely stored attachment may be evicted only when its exact revision has a verified remote object, no unfinished operation references it, and the user has allowed eviction. Local-only and Keep offline originals are protected from cache cleanup.

Local only creates no remote memo rows, media objects, content previews, or background content extraction requests. User-triggered email recovery contacts the account service. Document this exception in the recovery UI without uploading memo content.

### 3.2 Safe transitions

1. **Local only to Synced** atomically captures a manifest of current content and retained history/trash intended for synchronization, records its local revision watermark, and enables generation-bound outbox capture for subsequent edits. The persisted bootstrap job creates the remote memo idempotently and publishes that retained state. Subsequent edits depend on the bootstrap revision for their entity. Reconcile acknowledgments before reporting completion. Local content remains usable throughout. Discarded/pruned historical local operations never become a retrospective upload queue.
2. **Synced to Cloud storage** changes residency only after remote verification. Offer a preview of reclaimable bytes and honor offline pins.
3. **Synced to Local only** is an owner action for a private memo. Download and verify all referenced content, complete pending operations, then explicitly choose what happens to the remote copy. Keeping a remote copy must retain a truthful Cloud copy retained status. Deleting it needs a recoverable, idempotent server operation and acknowledgment.
4. **Shared memo to Local only** offers Create private local copy. The shared memo and other members retain their lifecycle until the owner separately deletes or unshares it. Copying creates new IDs and removes membership grants.
5. **Interrupted transition** resumes from its persisted journal. Never infer upload completion from an optimistic UI or a lost response.

### 3.3 Identity and retention

- Store account identity on every operation, database handle, notification, import job, and asynchronous callback. Invalidate prior-account UI and work on session change.
- Cache clearing removes replaceable downloads and indexes selected for rebuilding. It preserves memo originals, unsynchronized changes, and backup/recovery metadata.
- Ordinary sign-out closes memo handles, clears decrypted editor/media state and temporary exports, locks protected memos, and pauses account workers. Retained originals become available only after the same account is selected and locally authorized again.
- Account switching uses the same teardown. Every sign-out caller must use it, including account-management and automatic auth-failure paths.
- Removing a saved account offers retain locked local memos or explicitly erase them, with export available first. An explicit server-account deletion flow must disclose and resolve local memo retention separately.
- Before server-account deletion, resolve shared ownership and offer a portable encrypted backup of local-only and pending content. Explain how retained account-bound data will be accessed afterward. If that local access path is unavailable, offer verified backup/import into another account or explicit erasure instead of promising that signing back into a deleted account will recover it.
- This retention rule integrates with an account-deletion path if one is present at execution. No server-account-deletion entry was found among inspected mobile callers, so this feature does not add an unrelated account-deletion screen/service. Memo owner constraints must still prevent orphaned shared ownership during an authorized backend account removal.
- Offline access for a previously enrolled account uses its local account binding and applicable device/PIN gate. Session expiry alone cannot delete local memos. Re-authentication is required before renewed cloud access.
- Android uninstall/app-data clearing and device loss can remove originals and device keys. Restorable encrypted backup is the recovery route for local-only content on another installation.

### 3.4 Offline identity and conversation integration

At the first successful online enrollment, persist a minimal account-to-vault binding protected by the device key store. Offline vault selection verifies that binding and the configured device/local gate. It can open only that account's retained memo routes. It never supplies a fake session to `AuthProvider`, starts cloud workers, or unlocks messenger/account-management routes. Preserve the existing mandatory-password-change flow. If enrollment/key material is unavailable, show re-authentication or backup recovery instead of creating a replacement identity.

Add a narrow memo-local entry to root navigation for an enrolled account when cloud refresh is unavailable. Return to the normal chat list when a valid session is restored. Opening another saved account while offline requires its own locally enrolled gate and does not call `switchToSavedAccount` as though refresh had succeeded. Explicit removal/erasure invalidates that account's local binding. Cover signed-out cold start, expired session, account change, and delayed auth events with the same generation checks.

Extend list presentation through a discriminated conversation identity such as existing chat or proposed memo. Preserve existing `ChatListItem` callers through a compatible extension/adapter and use namespaced list/preference keys. Memo rows route to `/memo/[memoId]`. Local archive, ignore, star, mark-unread, and mute preferences remain durable offline. For local-only memos unread is zero unless explicitly marked. For shared memos, count distinct new/updated items from other members after the user's read position. The existing Groups filter continues to represent ordinary group chats. Memos appear in All and applicable Unread/Starred views.

Use a proposed `memo_folder_links` association owned by the user in the durable memo store to combine memos with existing cached folders. Never insert a local memo ID into `folder_chats`. P6 can replicate memo-folder associations through a memo-specific user-scoped table. Folder deletion removes the association without deleting the memo. Existing folder creation/server semantics remain intact. Ordinary chat organization continues through its existing API, while memo organization dispatches through the memo repository. Per-conversation mute affects collaborator updates. Personal reminder delivery remains governed by its explicit reminder preferences and OS controls.

## 4. Local architecture and crash consistency

### 4.1 Module boundaries

| Proposed location | Responsibility |
| --- | --- |
| `packages/shared/src/memos/` | Types, validation, filter classification, permissions, reminder semantics, revisions, and sync operations. Reuse existing helpers where their contracts match. |
| `apps/mobile/src/memos/storage/` | Account-scoped durable database, file ownership, migrations, integrity checks, import/export journal, and storage accounting. |
| `apps/mobile/src/memos/` | Repositories, lifecycle, queries, search, editor integration, reminder coordinator, sync adapters, and components. Keep boundaries proportional to implementation size. |
| `apps/mobile/app/memo/[memoId]/` | Timeline, search, details, storage, members, trash, reminder management, and version routes as needed. |
| `apps/mobile/app/memo/[memoId]/note/[noteId].tsx` | Note editor presented as a modal sheet with an expanded editing state. Direct links pass through account and lock checks. |
| `apps/mobile/app/handle-share.tsx` | Durable incoming-share capture and destination selection. |
| `supabase/migrations/<next>_memo_*.sql` | Memo schema, constraints, authorization, mutation functions, and storage policy. Allocate sequence numbers at execution time. |

Use one separate encrypted memo database per account as the initial architecture. This keeps messenger cache cleanup independent and avoids an open database per memo. Protect all memo payloads, search indexes, history, journals, and attachment filenames in that account database. Per-memo PIN authorization remains an additional application access gate as specified in Section 9.

Enable foreign keys, indexed pagination, transactional migrations, and a measured journal/checkpoint policy. Serialize related mutations through a repository transaction. Database and file-system changes require a persisted journal because they do not share one atomic transaction.

For the initial database adapter, serialize **all** access to each account handle while using its keyed `withTransactionAsync` connection. Apply the encryption key before schema/pragma reads, then foreign-key and journal settings. No repository query may interleave into another operation's transaction. Close only after active work is checkpointed/drained or safely journaled. Verify FK enforcement and rollback with real native tests. SDK 57 documents that exclusive transactions use another connection whose settings are not inherited, so adopting that API needs its own key/FK proof. [SDK 57 transaction behavior](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite.md)

### 4.2 Proposed local records

| Record | Essential data and invariants |
| --- | --- |
| `memos` | Stable UUID, owning account, creator, title, description, replication, revision, timestamps, deletion state. |
| `memo_items` | Stable UUID, memo ID, author ID, kind, caption/text, revision/base revision, timestamps, deletion state. Stable local ordering includes a tie-break ID. |
| `memo_assets` | Asset UUID, original name, detected/declared MIME, extension, plaintext byte size/hash, encrypted-object byte size/hash, encryption version, opaque local path, remote version, availability. |
| `memo_item_assets` | Item/asset references, placement, caption, and order. Reference ownership covers current notes, history, trash, exports, and pending jobs. |
| `memo_notes` and `memo_note_blocks` | Note ID, title, description, ordered stable block IDs, schema version, body count, current revision, and image references. |
| `memo_note_versions` | Revision parents, checkpoint metadata, author, operation ID, and immutable block snapshot/manifest. Use shared immutable blocks where measured beneficial. |
| `memo_tags` and `memo_item_tags` | Normalized tag identity, display form, memo scope, and item associations. |
| `memo_pins` | Item ID, personal/shared scope, actor, order, and revision. |
| `memo_reminders` and targets | Reminder owner, explicit recipients, target IDs, schedule/timezone, recurrence, definition revision, target-set building/ready/cancelled state, reviewed target counts, and deletion semantics. |
| `memo_reminder_deliveries` | Device/account, occurrence ID, OS schedule ID, schedule revision, and presentation/completion status. |
| `memo_operations` | Generation-bound cloud outbox for replication-enabled memos. Immutable operation UUID, device/account binding, entity IDs, base revisions, dependencies, retry state, payload reference, and server acknowledgment. Local-only saves finalize their local journal without waiting for a cloud receipt. |
| `memo_jobs` | Import/save/export/download/upload kind, stage, manifest, bytes, recoverable failure, temporary paths, and commit marker. |
| `memo_job_targets` | Proposed frozen bulk-selection rows keyed by job/item, with account/memo identity, selected revision, availability, and owning job lifecycle. Capture Select all with a database snapshot operation, then process bounded batches. Cleanup follows job completion/cancellation so abandoned selections cannot retain content indefinitely. |
| `memo_members` and invites | Cached effective grants and server revision for synced/shared memos. Local-only ownership remains local. |
| `memo_local_preferences`, `memo_folder_links`, and remote mappings | Per-user/device list preferences, folder association, and local-to-remote identity/generation mapping. Shared settings stay in their authoritative memo records. |
| `memo_fts` | Rebuildable index over authorized live items and chunked note text. No content from trash in default results. |
| `memo_storage_usage` | Incrementally maintained categories plus last reconciliation and completeness. |

Keep security credentials in the key vault. Database values can reference keys through opaque identifiers. Device-only paths, PIN verifiers, and OS notification identifiers stay device-local.

### 4.3 Attachment/save commit protocol

1. Create a job with a stable operation ID and stage `prepared`. Validate available space and source access.
2. Stream the source into an encrypted staging object with bounded buffers. Calculate size and integrity information without whole-file base64 conversion.
3. Flush and finalize the staging object using the selected storage API's verified durability semantics. Persist the manifest and stage `staged`.
4. Promote to a unique immutable final path on the same storage volume. Use an atomic rename when supported. Otherwise journal the copy, verify the destination, and retain the source until finalization is complete.
5. Commit item rows, asset references, revision, accounting changes, and the journal's `committed` marker in one database transaction. Add a generation-bound outbox operation in that transaction when replication is enabled or bootstrapping. Local-only saves finish with a local receipt/revision and have no pending cloud operation.
6. Display Saved on this device only after the durable transaction completes. Indexing and remote replication can continue separately.
7. Garbage-collect abandoned staging/final objects only after journal reconciliation proves they are unreferenced. A missing or invalid asset yields an explicit repair state.

Startup and foreground recovery reconcile unfinished jobs by ID. Replaying a completed stage must be harmless. Inject termination before and after every stage boundary during verification.

After a local-only job's committed state is reconciled, release its temporary asset/revision leases and compact its journal metadata without requiring connectivity. Current content, named/history/trash retention, and active jobs determine what stays referenced. Future optional synchronization is not itself a retention reference. A replication-enabled memo keeps its outbox and required original revisions while the device is offline. Remote acknowledgment releases those outbox references through the normal retention/accounting transaction.

Saved acknowledgments cover the process-termination durability demonstrated by the selected native primitives and database configuration. Power-loss guarantees require a verified file flush/rename and database sync policy. P0 records those semantics and any unsupported guarantee instead of assuming that a JavaScript promise implies stable storage.

## 5. Capture, attachments, and timeline

- Reuse the existing composer, rendering, pickers, theme, audio playback, and recording coordination through adapters. Memo saves commit to the memo repository and optionally create replication work.
- The normal capture paths include composer send, paste, recording, camera/gallery, file picker, note insertion, Android share, restored draft, and import. Every path follows the same validation and durability rules.
- Store the original filename, byte size, MIME hints, detected type where available, source URI handling result, import time, and optional original URL. Never make a temporary picker URI the only copy.
- The existing document picker uses `copyToCacheDirectory: true`, which can create a plaintext temporary copy. A memo adapter must stream directly from an authorized source where supported or register that plaintext copy as a short-lived lease with cancellation/crash cleanup. Apply the same rule to thumbnail generation, editor image decoding, recording output, and upload/export staging. Final retained originals and derived memo assets use encrypted storage.
- Accept ZIP, EXE, APK, and unknown binary formats as stored file objects. Display a file card and explicit open/export actions. Validate external-open intents, use temporary scoped grants, and clean decrypted temporary copies when safe. External applications control their own retained copies.
- Accept empty ordinary files with a visible zero-byte size. Reject invalid empty image/audio/video captures with a recoverable explanation. Sanitize display/export filenames independently from opaque internal paths and resolve same-name exports without overwriting another file silently.
- File classification uses reliable content information where practical, then MIME and extension. Preserve mismatches visibly when opening would be misleading. Arbitrary file storage does not require executing or unpacking the file.
- Introduce memo-specific policy configuration. Proposed cloud caps initially reuse the current 10 MiB image/recording and 50 MiB video/file values until P0 validates higher provider/client limits. Local imports above cloud caps can remain local with a visible Sync blocked by file limit state. Saving locally must not fail solely because remote quotas are unavailable.
- A mixed memo can contain locally saved items that are still blocked from sharing. Label those items Only on this device and show incomplete sync at memo level. Never publish a note/card as fully shared while a required asset is unavailable remotely. Offer supported compression/copy choices without discarding the original.
- Local capture uses available-space checks, a configurable safety reserve, and byte-streamed processing. A proposed 1 GiB local single-file target must pass P0 before being advertised. Do not invent an unlimited-file-size promise.
- Preserve original quality by default. Derived thumbnails and optional compressed upload variants have separate identities and sizes. Low Signal settings can defer uploads without changing the sole local original.
- Paginate the timeline by stable creation order and ID, initially 50 items per page. Load note cards from summaries without loading their bodies. Keep selection by ID across pages and support select-all-matching through a persisted/query-defined selection with a visible count.
- Memo entries join the chat list through a typed conversation adapter that supports local titles, previews, pins, folders, archive, search routing, and badges. Recheck every caller that assumes a direct/group chat or server sequence. Memo deletion opens its trash lifecycle.

## 6. Filters, tags, pins, and search

### 6.1 Required filter behavior

Keep the requested order and use accessible icons from the existing icon system. The active tab shows icon plus label, inactive tabs show icons, and the row scrolls horizontally while keeping the selected tab visible. Maintain 44-logical-pixel touch targets, selected announcements, larger-text support, and both themes.

| Filter | Matching content |
| --- | --- |
| All | All live timeline items |
| Messages | Text entries and memo notes |
| Photos | Items with photo assets, including note images |
| Videos | Items with video assets |
| Photos & Videos | Union of photo and video matches, deduplicated |
| Audios | Voice recordings and imported audio assets |
| Files | Document assets such as PDF, DOCX, XLSX, TXT, and Markdown |
| Links | Items containing extracted HTTP/HTTPS URLs or explicit link cards |
| Others | Archives, installers, unknown formats, and remaining binary attachments |

An item may match several filters. A note containing photos and links appears once in each applicable filter. Photo/audio/file views can show attachment tiles that navigate to the containing item and exact attachment. Type counts must state whether they count items or assets.

### 6.2 Organization and retrieval

- Tags are scoped to a memo. Normalize display names with NFKC and trim surrounding whitespace, then use locale-independent lowercase for identity. Proposed validation is 1-64 display-name Unicode code points. Preserve the chosen display case. Creating a duplicate resolves to the existing canonical tag and adds only a missing authorized association. Renaming to an existing normalized name fails atomically with collision feedback and leaves both tags/associations unchanged. Tag deletion removes its associations without deleting content. Support add/remove in bulk and keyboard-friendly entry.
- Owner/Admin/Senior can rename/delete shared tag definitions and manage associations on any item. Junior can create/reuse labels while tagging their own content and add/remove only their own content's associations. Junior cannot rename/delete a shared definition or alter another author's associations. Viewer cannot mutate shared tags. A stale operation against a deleted tag is rejected and does not recreate it implicitly.
- Personal pins are per user, including Viewer. Owner/Admin/Senior manage shared pins and their global order. Junior can pin/unpin only their own items, appending new shared pins without reordering another author's pins. This is the default role behavior, with no unassigned enablement setting or proposal workflow.
- Search message text, note title/description/body, captions, original filenames, URLs, and tags offline. Exclude locked memos from global snippets/counts until authorized. Scoped search requires the same memo unlock guard.
- Use FTS5 with a documented tokenizer and safe bound query construction. Never pass arbitrary user input directly as SQL or unescaped full-text syntax. Support phrases and prefixes explicitly. Substring, punctuation, Unicode normalization, emoji, CJK, and diacritic behavior require test fixtures and truthful UX.
- Index long notes in bounded chunks with item/block offsets. Deduplicate at the item level, retain useful snippet positions, and open the matching block rather than only the note's beginning.
- Artificial storage/index boundaries must preserve the logical item's token positions and query continuity. Carry token-continuation metadata and verify cross-boundary candidates through bounded adjacent-chunk reads as needed. A chunk break cannot become an artificial word separator or make a phrase disappear. Confirm this for edits that move a hit across a boundary, Unicode combining sequences, long tokens, quoted phrases, and prefixes. Routine tokenizer/adapter implementation can vary, but the boundary-equivalence fixtures must match the same unchunked logical text under the supported query semantics. Cancellation/deadlines and bounded buffers still apply.
- Reuse current `matching.ts` normalization/range semantics only within bounded display windows. Its non-ASCII highlight path normalizes growing prefixes, so passing a complete 500,000-character body can create superlinear work. Derive the hit location from the index, extract a proposed maximum 2,048-code-point context window, map its local offsets back to the block/document, and test Unicode boundaries. Do not refactor ordinary chat matching to solve this memo-specific integration.
- Combine text search with type, date, author, tags, pins, and reminder state. Persist filter/query state when navigating to a result and back.
- Show index rebuild/progress and partial results honestly. Ordinary edits update searchable text transactionally where cheap. Large-note indexing uses a revision-marked incremental job so an older result cannot masquerade as current.
- OCR, audio transcription, and document-body extraction are later opt-in capabilities. Until extraction exists, show which fields are searchable. Any cloud extraction requires explicit content-upload consent for local-only memos.

FTS5 supplies tokenized retrieval, ranking, and snippets. Its matching rules need deliberate configuration and verification for the supported languages. [SQLite FTS5](https://sqlite.org/fts5.html)

## 7. Memo notes, editing, history, and export

### 7.1 Document model and editor

- Store title and description separately from body blocks. Proposed limits are 128 title code points and 500 description code points. The 500,000-body-code-point limit counts visible text, newlines, and captions stored as body text. Image bytes and formatting are accounted separately.
- No independent line-count restriction is imposed. Each newline consumes one body character, so a finite character limit also bounds possible lines.
- Support paragraphs, headings, emphasis, lists, checkboxes, links, quotes, code blocks, and inline images in an explicit versioned schema. Reject or sanitize unsupported markup without executing embedded scripts or remote HTML.
- Benchmark both a 500,000-character single paragraph and a highly fragmented document. Internal chunk boundaries may divide large text runs while preserving logical paragraphs, formatting ranges, selection, composition, and Unicode boundaries.
- Pack short paragraphs into bounded editor pages/chunks as needed. A newline must not require its own permanently mounted React component or heavyweight editor object. Search navigation, undo/redo, paste, selection, and character counts must work across chunk boundaries. Put limits on formatting depth/serialized metadata separately from the promised body capacity.
- Use a proven editor integration compatible with SDK 57 after a P0 prototype. If a WebView-based editor is selected, expose a minimal validated bridge, disable arbitrary navigation, restrict resource loading, and keep the document local. Mount only bounded editor/render work. Large documents must not be reconstructed across the bridge on every keystroke.
- Display the note as title and description only in the timeline, truncating the description after two lines. Tapping opens the note modal with edit, explicit Save, delete, history, and export actions. Expand within the modal for extended editing and keyboard space.
- Use the requested Google Docs-inspired document hierarchy with an editable title, description, body, and compact formatting toolbar. Keep Save/saving status, undo/redo, and the document actions accessible when the keyboard opens. Reuse DoloGram's existing typography, theme, safe areas, and reduced-motion behavior. This specifies the intended editor interaction without asserting a current Google Docs screen match.
- Use autosave alongside Save. Proposed debounce is 750 ms with a 3-second maximum dirty interval during continuous input. UI says Saving until persistence acknowledges the revision. Back, swipe-dismiss, account change, and app background request a flush. If flushing fails, preserve a durable recovery draft and show the unsaved state before dismissal where lifecycle permits.
- A repository/disk failure may prevent the recovery draft from being durable too. Keep the editor's unsaved buffer, display the failure, and offer retry or an authorized export/copy action. A user-driven dismiss/account switch waits for a successful save or an explicit discard. Forced OS termination restores only previously durable state. Do not claim guaranteed recovery when both writes failed.
- Process death can occur before the last keystroke reaches durable storage. Restore the last acknowledged revision and any durable draft. Never label unacknowledged edits as saved or promise recovery of uncommitted keystrokes.
- Inline images reuse the durable asset protocol. A note save includes references only to verified local assets. Offline cloud-only images show placeholders and download controls without corrupting the body.

### 7.2 Version history

Create a version on explicit Save, before restore, after a meaningful idle checkpoint, before destructive transforms, and on a conflicting remote edit. Coalesce autosave checkpoints to avoid a full 500,000-character snapshot every second. Use immutable manifests with reused blocks or measured delta/checkpoint storage.

Show author, device/time, named version, and changed-text summary. Restore creates a new current revision and retains the previous current state. History keeps image references alive. Pruning only removes assets after reference checks across live notes, versions, trash, backup jobs, and pending replication.

The automatic-history policy removes eligible checkpoints when either their age exceeds 30 days or retaining them would exceed the newest 100 automatic checkpoints. The current revision and named versions are outside that automatic-pruning set. Active jobs/replication references temporarily protect required revisions, with excess retained bytes shown in storage accounting. Pruning resumes only after those references are safely released.

### 7.3 Export contracts

| Format | Required output |
| --- | --- |
| DOCX | Title, description, supported formatting, lists, and embedded images. Verify by opening the generated file and checking representative content. |
| PDF | Paginated reading output with text, images, headings, selectable text where supported, and font handling for tested languages. |
| TXT | UTF-8 text preserving paragraph/newline structure, with explicit placeholders for images and optional image captions. |
| Markdown | Supported Markdown, escaped text, and relative image paths. Offer a ZIP containing the Markdown and an assets folder. |

Export is a cancellable journaled job over a stable note revision. Check required cloud assets, free space, format support, and destination access before reporting success. Keep partial output separate from finished files. Large export must be processed outside latency-sensitive UI work. Display unsupported formatting honestly and retain the source note.

## 8. Trash, storage accounting, and encrypted backup

### 8.1 Trash and resource ownership

- Soft-delete items, notes, and entire memos with deletion revision, actor, timestamp, and original location. Hide trashed content from normal timeline/search/filter counts.
- Moving an item to trash suspends related personal reminder occurrences on this device. Shared target behavior follows Section 10. Restoring asks whether to reactivate future reminders and never immediately fires stale alarms.
- Trashing an entire memo applies the same rule to all its nested targets. Local observation journals cancellation of its scheduled occurrences, and server jobs treat a trashed parent as unavailable. Other disconnected devices reconcile when they observe the change. Restore leaves future occurrences suspended until explicit reactivation and preserves past occurrences as missed/completed.
- Restore retains identity and references, unless its shared parent is unavailable or authorization has changed. Offer an authorized private recovery copy where applicable.
- Show retained bytes before permanent deletion. Require explicit confirmation for permanent deletion of local-only originals. Retention cleanup must account for active jobs and other live references. Named versions remain protected during routine history pruning.
- Manual trash cleanup is the initial default. Owner/Admin may explicitly enable the offered 30-day retention policy after reviewing its deletion scope. Workers recheck the current policy revision, deletion time, permissions, and protected references before committing. Local-only or unsynchronized sole-copy originals become eligible for a user-reviewed purge batch and are not silently auto-purged. Disabling retention invalidates uncommitted cleanup work under the same revision check. Shared server cleanup follows the accepted memo policy rather than an individual member's device clock.
- Permanently purging a note/item removes its recoverable body, drafts, versions including named versions, search entries, and owned reminder context. Show this full scope before confirmation. A blob still referenced by another live item remains for that item. Shared/server purge must remove reachable payloads while retaining minimal content-free deletion/operation markers needed for synchronization. Provider backup retention and copies outside DoloGram require accurate disclosure.
- Resolve active backup/export leases before purge. Let the user cancel those jobs or explicitly finish the export before deletion. Invalidate remote snapshots that could expose purged payloads and return a fresh-snapshot action. Purge promises logical removal from accessible DoloGram state. Flash-storage forensic erasure is outside that guarantee.
- Pending unsynchronized deletion is reversible. Synced tombstones survive long enough to handle stale devices. Section 11 defines the catch-up and resurrection rules.

### 8.2 Storage dashboard

Report per memo and account totals for messages/notes, original media by type, other files, history, trash, search/index overhead, thumbnails, replaceable downloads, and temporary jobs. Show device free space, verified cloud bytes, pending-upload bytes, and offline availability.

Separate logical attributed size from physical allocated bytes when content is shared/deduplicated. Maintain incremental counters transactionally and run bounded reconciliation jobs to detect drift. Counts remain marked Calculating until reconciled. Temporary peak space for imports, encryption, backups, and exports is part of admission checks.

Proposed cleanup actions are remove replaceable downloads, remove thumbnails, rebuild index, review largest files, prune automatic history, empty trash, and export then remove a selected local memo. Each action previews recoverability and affected bytes. Do not automatically evict the only verified copy.

### 8.3 Encrypted backup/import

- Provide an offline export of selected memos or the entire local library, including notes, history selection, tags, pins, reminder definitions, and original assets. Membership grants and device PINs are excluded. Imported reminders start disabled until reviewed.
- Use a versioned encrypted archive with authenticated encryption, a random archive key, a password-derived wrapping key from a strong passphrase or generated recovery secret, and documented KDF parameters. A six-digit PIN is insufficient for a portable backup password.
- Store an encrypted authenticated manifest containing content hashes, sizes, source IDs, schema version, encryption/KDF version, and completeness. Keep only the minimal format/KDF bootstrap header outside encryption. Support streaming encryption/decryption and bounded-memory verification. Validate crypto choices and maintained native support in P0.
- Export from a consistent manifest while edits continue as later revisions. A backup becomes Complete only after every selected object is included and verified. Cloud-only items require download first or an explicitly labeled partial backup.
- Pin the exported revision manifest and referenced assets for the job's lifetime so concurrent edits, trash cleanup, and history pruning cannot invalidate a running backup. Release those references after verified completion or cancellation. If using a database snapshot, include its journal state correctly through a supported snapshot/backup API.
- Import validates the passphrase, manifest authentication, supported version, paths, counts, sizes, hashes, and reference graph before exposing imported memos. Never trust archive paths or execute attachments. Limit expansion and per-entry resource consumption.
- Journal import with stable job IDs and stage into a separate namespace. Commit a verified memo atomically. Retrying the same job cannot duplicate imported items. A separately requested import defaults to a new local copy, with collision handling shown explicitly.
- Imported/shared-export content becomes a private local copy owned by the importing account. Preserve original authorship as provenance, separate from current authorization. Remap IDs and remove server identifiers that could grant or mutate access.
- Verify a complete restore on a fresh installation using only the archive and its passphrase. Device-bound SecureStore data cannot be the only decryption input for a portable backup.

## 9. PIN protection, encryption, and recovery

### 9.1 Security model

The initial cloud design uses authenticated access, private object storage, transport protection, and provider encryption. The service can process synced plaintext content. Application-managed end-to-end encryption requires a separate key-sharing/recovery design and is a future product decision. All cloud disclosures and marketing must match the implemented model.

Local memo data uses a random account database key and authenticated file encryption with unique per-object keys/nonces or a reviewed equivalent. Store only small key material in OS-protected storage. Keep keys out of logs, AsyncStorage, exported diagnostics, notification payloads, and backups unless appropriately wrapped. Database journal and temporary-file handling must be verified under SQLCipher. [Expo SQLite encryption](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)

The optional memo PIN authorizes access through the application. Because the initial architecture has one encrypted database per account, it does not give every memo an independently PIN-encrypted database. Document this threat model. A fully compromised running device or modified client can bypass application access checks. Independent cryptographic isolation of individual memos would require a different key/index layout and a separate prototype.

Use reviewed crypto libraries and OS-backed key protection. Prefer native streaming primitives for large attachments. P0 must validate SDK 57 compatibility, maintenance, licensing, backup behavior, and failure handling before selecting exact dependencies. SQLCipher covers database data. Attachment files and portable archives require their own encryption implementation.

Choose a maintained authenticated streaming format that detects reordered, duplicated, truncated, and tampered chunks and binds the final manifest. Verify chunks before releasing their plaintext to a decoder or consumer. Keep original-content integrity hashes distinct from encrypted-storage hashes. Deduplication, if introduced, stays within the authorized account/memo scope and cannot reveal another user's content presence.

### 9.2 Access and key lifecycle

- Offer six-digit PIN enrollment with confirmation and optional biometric access. Generate a salted, slow verifier combined with a device-held secret. Benchmark KDF cost and keep verification off latency-sensitive UI work.
- Persist failed-attempt counters and increasing retry delays. Proposed behavior begins a delay after five failures. Process restart cannot reset the attempt history. Do not automatically destroy personal content after failures.
- Default auto-lock is immediate on account switch/sign-out and after one minute in the background. Offer stricter lock-on-background. Remove decrypted previews, player/editor buffers, search snippets, and temporary exports on lock as far as supported by the runtime.
- Every route, deep link, share destination, notification tap, global search result, preview, export, version-history view, and background content action goes through account and memo authorization. Lock state must never depend solely on whether a screen was opened normally.
- Background replication may execute previously authorized persisted operations under the current account/membership grant without displaying protected content. Creating new content, reading previews, playback, and export require the memo's local gate. P0 selects a key-availability policy compatible with that distinction. If OS key access is unavailable, pause the worker and show Unlock device to resume after authorized entry.
- A newly authorized sync device sees protected content locked until it enrolls its own local access gate. PIN values and verifiers do not synchronize. Roles and signed-in identity still determine permission to obtain cloud content.
- Biometric enrollment changes and secure-key invalidation must produce a recovery path. Keep an independently recoverable protected key envelope where the design permits it. Never replace an unavailable database key with a new key against existing ciphertext.
- Resetting a PIN preserves content and the existing encryption key. Rotating an encryption key is a separate resumable operation with old/new envelope versions and verified completion.
- Local-only users can create a high-entropy offline recovery secret for resetting the local gate. Full device/key-loss recovery additionally requires an encrypted backup. Explain both outcomes before calling setup complete.

### 9.3 Email-authorized PIN reset

1. The user requests recovery for the currently bound account and memo on an enrolled device. Show that email verification needs internet access.
2. Issue a purpose-specific, short-lived challenge bound to account, device/local challenge nonce, and reset action. Send a code to the account's already verified email. Reuse a compatible established account verification flow only after inspecting its session effects.
3. Validate the code through a rate-limited server endpoint. Proposed defaults are 10-minute expiry, five verification attempts, and bounded resend frequency. Return a one-use, short-lived reset authorization bound to the original challenge.
4. The enrolled device verifies the authorization and resets the local access verifier. It preserves the key envelope and lets the user enroll a replacement PIN.
5. Invalidate the challenge and record a content-free security event. Do not switch the active account, silently change the account email, or use this flow to grant memo membership.

The existing forgot/reset-password flow sends a recovery link and calls `exchangeCodeForSession`, so it cannot be reused as a purpose-bound PIN-code endpoint without changing its semantics. Add a dedicated endpoint and configured mail transport in P6. Bind the recipient to the authenticated account's authoritative email. Verify actual email-confirmation state. If no verified recovery address exists, perform address-possession enrollment before enabling email PIN recovery, without globally changing sign-up policy. An expired session can use normal account re-authentication first. The challenge's local identifiers are opaque and convey no memo title/content. Rate-limit request and verification separately, store only protected code/token material, and atomically consume the successful authorization.

Email verification alone cannot reconstruct a missing local encryption key or deleted local-only files. If the device still has its protected key, reset can restore local access. If keys/files are gone, offer a verified synced copy or portable encrypted backup. Without either source, report the loss honestly.

SecureStore is suitable for small secrets and has platform-specific backup, uninstall, and biometric-invalidation behavior. Verify the exact key lifecycle in a matching build. [Expo SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md), [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

## 10. Reminders and Android capture

### 10.1 Reminder scheduling

- Persist the reminder and target IDs before scheduling with the OS. Record separate desired schedule and actual OS scheduling status. A saved definition with denied permissions displays Notifications disabled or Exact timing unavailable.
- Schedule through the operating system using local notifications/alarms. A JavaScript timer cannot provide process-independent delivery. Local-only reminders work without a server connection. Cloud push supplies shared/multi-device events after connectivity resumes. [Expo Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- Model one-time absolute schedules and recurring wall-clock schedules separately. Store IANA timezone and recurrence intent. Proposed wall-clock behavior follows the chosen timezone, moves nonexistent daylight-saving times to the next valid time, and fires once at the earlier occurrence of an ambiguous time. Preview the next occurrence.
- Each occurrence has a stable ID derived from reminder identity and schedule revision. Persist OS identifiers, reconcile after restart/reboot, time/timezone change, permission change, and schedule edit, and cancel superseded occurrences. Bound scheduling to the platform-supported horizon with visible coverage.
- Offer snooze, reschedule, repeat, complete, cancel, and a reminder list. Distinguish a notification presented from a reminder completed by the user. A target edit changes the linked content while the reminder retains a clear schedule and optional original context reference.
- Freeze bulk selection as persisted target IDs in the account-scoped store at the user's Select all/selection action. Record its memo/query generation and selected revisions without loading the full ID set into React state. Newly created or newly matching items do not enter that selection. At final review, report selected/live/unavailable counts and require review of a changed set before scheduling. A zero-live-target set cannot create an active reminder.
- Build large target sets through the existing journal/job infrastructure with explicit `building`, `ready`, and `cancelled` states on the reminder/target set. Commit the definition and transition to `ready` atomically only after the frozen set is validated. OS scheduling and server dispatch consume only `ready` sets. Restart/retry resumes the same job/IDs, while cancellation/account changes remove or retain staged rows according to journal recovery. No interrupted batch can schedule a completed subset as though the full selection succeeded.
- Trashing a target marks it unavailable to the reminder. A reminder with remaining live targets continues with a reduced-count explanation. If no targets remain, suspend it. Permanent removal retains a generic unavailable-target record for history without preserving deleted private text.
- Restore keeps past occurrences completed/missed and offers to re-enable future occurrences. A reminder whose due time passed while the phone was off appears in missed reminders after reconciliation. Device power-off, app force-stop, and OS restrictions affect delivery.
- Use generic lock-screen wording for protected memos. Opening a reminder checks the account, membership, lock, and target existence. Switching accounts cannot reveal the previous account's content. Account sign-out cancels this device's account reminders and restores them after authorized reopening.
- Memo reminder payloads use an explicit event kind, account ID, memo identity/generation, reminder ID, and occurrence ID. Keep bulk target lists in storage, with bounded payload size. Validate UUIDs/type before routing. A cold-start or wrong-active-account response waits behind account/vault authorization before consumption. Unknown/deleted targets show unavailable feedback. A remote memo absent locally requires authorized bootstrap instead of silently creating an empty memo.
- Subscribe to memo-local notification responses even when cloud authentication is unavailable for an enrolled local vault. Separate memo channel/preferences from the message handler's `messages-v2-*` assumptions. Use bounded stable channel IDs for supported sound variants. Cloud push registration still requires its existing valid cloud session. Reset handled-response identity on account transition and deduplicate by event/occurrence within the authorized account.

### 10.2 Sound and exact alarm behavior

Offer ordinary reminders with selectable notification sound first. An Alarm option that rings persistently until dismissed is an Android-specific milestone within P5. Prototype the required alarm receiver, audio/service lifecycle, snooze/dismiss UI, and interaction with calling/recording before advertising this capability.

Check notification permission, channel state, exact-alarm access, and relevant sound restrictions. Ask for platform access in context when the user selects alarm behavior. Exact alarms and full-screen alerts have additional Android access and store-policy constraints. Provide an accurate fallback status when access is unavailable. Respect the user's sound and interruption settings. [Android alarm scheduling](https://developer.android.com/develop/background-work/services/alarms), [Exact-alarm access](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)

Persist schedule changes with a reconciliation journal so losing the process between cancel and reschedule is recoverable. Test reboot, process kill, force-stop/relaunch, clock/timezone changes, Doze, permission revocation, and denied sound access. Platform delivery observations must be recorded separately from automated schedule-state correctness.

An active call owns audio focus. A due alarm keeps its visible notification and defers persistent ringing while the call owns audio, with snooze/dismiss still available. On ownership release, reconcile the still-active occurrence before ringing. Register alarm playback with the existing recorder/player stop boundary and add only the minimal ownership notification needed for resumption. Recording/playback interrupted by a call/alarm is safely finalized/paused and resumes only through an explicit user action. Verify these transitions against the current calling implementation.

### 10.3 Shared and multiple-device reminders

Personal reminders belong to the creating user. Shared reminders name recipients explicitly, are editable by their creator within current role permissions or by an authorized moderator, and appear in recipient reminder lists. Recipients choose their own audible delivery preferences.

Per-device delivery is the initial honest model. A user can select reminder-enabled devices, with current device enabled by default. Offline devices can produce duplicate alerts across devices. Cross-device completion synchronizes and cancels future delivery when connectivity permits. Deduplicate local and push delivery on the same device using occurrence IDs and one notification coordinator. Exactly-once audible delivery across disconnected devices is not a feasible guarantee.

### 10.4 Android share target

- Support Android text, URLs, single files, and multiple files, including cold start, warm start, background resume, and repeated intents. Validate incoming action, MIME, size, filename, and URI grants.
- Use the installed SDK 57 incoming-sharing API if the P0 probe passes. Its documented experimental status requires a tested fallback, potentially a focused config plugin/native adapter. Recheck actual exported APIs before adding a third-party dependency. [Expo incoming sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/), [Android receiving shared data](https://developer.android.com/training/sharing/receive)
- The current installed declarations export `getSharedPayloads`, `clearSharedPayloads`, and `useIncomingShare`. Enable the existing plugin's `android.enabled`, `singleShareMimeTypes`, and `multipleShareMimeTypes` for the supported classes and route the incoming scheme through a proposed `app/+native-intent.ts`. Read raw payloads for offline capture. `getResolvedSharedPayloadsAsync` can perform network resolution and must not run implicitly for local-only capture. Clear SDK payload state only after durable intake/explicit cancellation. Runtime replay after clearing remains covered by job IDs.
- Copy source URIs into bounded durable encrypted staging while grants remain valid. Record a share job ID. Destination choice follows capture, with a clear retry/cancel path for incomplete items. Replayed intents cannot duplicate a completed capture.
- Require an enrolled account. When signed out, show account selection before importing into account storage. If the OS grant expires before authorization, explain that the user must share again. Never assign content to whichever account becomes active later without an explicit destination selection.
- For a locked destination, stage under the authorized account, then require memo unlock before committing. A proposed Capture inbox in Section 15 can receive unassigned captures. It uses the same encrypted storage and retention accounting.
- Preserve browser source URL and shared text as provenance. Link-preview fetching is explicit for local-only content. Handle malformed URIs and unsupported remote providers without losing already verified captures.

## 11. Synchronization and cloud data model

### 11.1 Backend contracts

Use dedicated memo tables in the existing backend and private memo object storage. Reuse authentication, typed repository/result conventions, resumable upload support, and subscription lifecycle helpers where compatible. Do not route durable memo originals through messenger cache eviction or sent-queue cleanup.

The proposed server tables mirror synchronized memo entities, memberships, invites, tags, shared pins, reminders, versions, and assets. Add operation receipts, per-memo change records, snapshot metadata, deletion markers, and usage counters. Device paths, key-vault references, local PINs, personal drafts, and OS notification identifiers remain local.

Apply RLS to all exposed memo tables and object-access policies. Enforce author, membership, role, parent memo, deletion state, byte limits, and revision constraints on the server. Use transactional RPCs for multi-entity mutations. Narrow service credentials stay server-side, and any privileged path independently verifies the caller's action. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Candidate operations are create memo, apply item/note revision, finalize asset, trash/restore/purge, change settings, invite/accept/revoke, change role, transfer ownership, fetch changes, fetch snapshot, and close remote copy. Specify input/output/error contracts during P6. Follow `supabase/AGENTS.md` for migration numbering and inspect current migration history before allocation/application.

### 11.1.1 Proposed API and schema contracts

Names here are proposed contracts, not existing functions. Final SQL/HTTP names may follow repository conventions while preserving these semantics. Authenticated RPCs derive the actor from the verified session. Privileged workers accept identities only from a trusted job record and recheck effective permission. Direct client table writes that could bypass revisions, receipts, locks, or ownership checks are revoked or equivalently constrained. Security-definer functions use a fixed safe search path, qualified objects, narrow grants, and explicit authorization.

| Contract | Input and validation | Committed result |
| --- | --- | --- |
| Create memo | Client memo/operation UUIDs, current remote generation, title/description, and bounded settings. Owner is the authenticated user. Duplicate requests are checked against their original actor/payload. | One memo, exactly one owner, one receipt, authoritative revision/change position. |
| Apply mutation | Operation UUID, entity identity/type, expected remote revision, resolved predecessor, mutation kind, validated fields, and required asset/block IDs from the same memo/generation. Author identity on existing content is immutable. | Atomic item/note/reference/tag/pin change, receipt, usage delta, and change record, or a typed conflict/permission/validation outcome with no partial publication. |
| Begin/finalize asset | Memo/asset identity, original-content size/digest/type, reservation, upload lease, and upload-attempt ID. Enforce quota and ownership at reserve and publication. | Opaque upload location and pending verification job, followed by verified immutable asset metadata or a recoverable rejection. Reuse requires matching bytes. |
| Fetch changes | Memo generation and durable cursor, bounded page size, current membership. | Ordered changes, watermark/minimum retained position, continuation, or Snapshot required. |
| Create/read snapshot | Authorized memo/generation and optional snapshot ID/page cursor. Snapshot has a fixed watermark, expiry, and size bound. Recheck access on every page. | Immutable revision references and asset manifest consistent at that watermark, with a later catch-up position. |
| Membership/settings action | Memo revision, action UUID, target user, expected role/owner state, role or invite identity. Invite acceptance is bound to its intended authenticated recipient. | Serialized invite/member/settings/ownership result and receipt, with one owner preserved. |
| PIN recovery request/verify | Authenticated account, purpose, local challenge/nonce binding, and code when verifying. Recipient is resolved server-side. | Rate-limited delivery, expiry, and one-use reset authorization, without a new app session or memo membership grant. |
| Remove remote copy | Owner, expected memo revision/generation, complete-local-copy acknowledgment, and operation UUID. | Closed remote generation followed by verified application-managed payload cleanup and a durable deletion receipt. |

Proposed tables additionally include immutable `memo_item_revisions`, `memo_changes`, `memo_operation_receipts`, snapshot manifests/leases, private recovery challenges, and bounded memo maintenance/reminder jobs. Composite parent constraints bind notes, blocks, assets, tags, roles, and reminder targets to the same memo/generation. Index live timeline order, author, asset references, operation state/dependencies, change position, due jobs, and membership lookup. Personal pins/reminders/preferences are additionally user-scoped.

Validate text length by Unicode code points on client and server, distinct from bytes. Stage note blocks and publish one verified revision manifest only after every block/asset is available. Proposed transport limits are 16,384 text code points per packed text chunk and 256 KiB per mutation/block batch, with a separately validated total formatting-metadata budget. Long paragraphs retain logical identity across chunks. The existing calling HTTP helper's 8,192-byte body limit is call-specific and cannot be reused unchanged for notes. Error contracts distinguish authentication, permission, validation, revision conflict, quota, rate limit/retry-after, unsupported schema/generation, unavailable asset, and transient service failure. Raw provider failures never appear as successful empty reads.

Server-side checksum work must fit the deployed worker's measured CPU/memory/time limits. If the platform cannot hash a maximum permitted asset in one request, use a resumable bounded worker/checksum facility or preserve Finalizing upload until an identified compatible worker finishes. Do not assume Edge Function background work is unlimited. [Hosted function limits](https://supabase.com/docs/guides/functions/limits)

### 11.2 Durable outbox and acknowledgment

1. For a replication-enabled memo, commit each local mutation and its immutable operation ID in the memo database transaction. Mark its local revision Saved and remote state Pending. Local-only mutation journals complete through Section 4.3 without creating remote dependencies.
   Preserve immutable intent/revision content and a dependency on the previous unsent operation for the same entity. Resolve that predecessor to its acknowledged server revision before submitting its successor. Freeze the submission envelope on first attempt. Lost-response retry uses that exact envelope/ID. Own offline edits must not conflict merely because an earlier local save has now synchronized. A true intervening remote edit preserves the affected local chain as conflict/recovery work.
2. Drain operations in dependency order. Creating the memo precedes remote items. Upload/finalize required assets before publishing references that claim they are remotely available.
3. Upload immutable objects to opaque memo-scoped paths with resumable transfer. Under the initial service-readable cloud design, decrypt local objects through a bounded stream and transmit their original content over TLS. Do not upload device-key-encrypted blobs as though other devices could read them. On download, validate original-content integrity and encrypt into the receiving device's storage. If the chosen upload API needs a plaintext temporary file, use a private lease with admission checks, bounded lifetime, and crash cleanup. Stage objects are inaccessible as published content and are eventually reconciled/cleaned. [Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
4. Verify remote original-content length and digest through a supported storage checksum or a bounded trusted finalization worker. A client-supplied digest alone does not prove remote integrity. Until verification completes, retain the only local copy and show Finalizing upload. The worker must have quotas, retries, and safe orphan cleanup.
5. The server validates current permissions and base revisions in one transaction, records the operation receipt, commits entity changes, and returns authoritative revision/change position. Retrying the same operation ID returns its original result. Bind operation IDs to the actor and memo to reject conflicting reuse. Publication rechecks membership even if an upload/finalization was authorized earlier.
6. Keep operation receipts for the lifetime of the remote memo initially. Future receipt compaction must include an epoch/snapshot protocol preventing old operations from replaying as new writes. After permanent purge, receipts retain the minimum identity/result needed for replay safety, with purged content payloads removed.
7. Persist acknowledgment before marking Synced or considering local eviction. If a response is lost, query/retry by the same operation ID. Local edits remain usable during timeout, rate limit, quota failure, or expired authentication.

Use bounded backoff with jitter and a manual retry option for terminal errors. Connectivity return can make eligible work due but cannot spin on authorization, quota, or unsupported file errors. Wi-Fi-only upload, charging preference, and Low Signal mode are explicit worker policies.

Bootstrap records the replication intent and manifest watermark in the same local transaction so there is no edit-capture gap. Keep its referenced revisions/assets leased until publication or explicit cancellation is reconciled. New mutations can save immediately and queue behind the appropriate bootstrap dependencies. A lost create/publish response retries the persisted generation/operation IDs. Cancelling before remote work releases local bootstrap leases. If remote work may have succeeded, use the remote-copy removal protocol before claiming Local only again. No entire local edit history is required to create the first cloud copy.

### 11.3 Catch-up, conflicts, and deletion

- Allocate per-memo change positions under a memo-row lock acquired by every mutation transaction. Keep allocation, mutation, and receipt in the same transaction. A plain global sequence or device timestamp is insufficient to prove commit-ordered catch-up.
- Fetch ordered changes after the durable cursor, apply a page transactionally, and advance the cursor only after application succeeds. Realtime events prompt catch-up. They are hints, and disconnected devices can recover through the authoritative log.
- Note saves compare base revision. Independent edits to different items can apply. Concurrent edits to the same note preserve the local draft/conflict version, fetch the server revision, and let the user compare/merge. Metadata uses field-level expected revisions where useful. Membership and settings use server serialization.
- A stale offline edit cannot resurrect a trashed/deleted entity automatically. Preserve the rejected local work in private recovery and offer an explicit new item if the user still has copy rights.
- Keep a minimal deleted-identity marker for the lifetime of the memo. Proposed change-log retention is 90 days, subject to storage measurement. Devices behind the minimum retained position must download a consistent snapshot, rebase pending work with revision checks, and handle deleted IDs explicitly.
- Snapshot export is a coherent server revision. Reconcile paginated reads against its watermark. Do not mix arbitrary pages from different live states and advance past unseen edits.
- Build snapshots from immutable item/note revisions at the chosen watermark, with a bounded lease protecting required versions during generation/read. Use a materialized manifest or versioned lookup. Never hold an open database transaction across HTTP page requests. Expired/invalidated snapshots restart explicitly while preserving local outbox work. Purge invalidates snapshots containing the removed payload.
- A new device takes a snapshot, records its watermark, then catches up later changes before claiming it is current. Download completeness is tracked independently. Existing devices never replace unsynchronized originals wholesale during snapshot refresh.
- Shared membership removal takes effect at the server immediately for new authorized requests. Cached content may remain readable while a device is disconnected. On observed revocation, lock the shared memo, cancel relevant work/reminders, remove cached shared material according to policy, and preserve rejected own drafts privately when permitted.
- Revocation cannot recall files already exported, screenshots, offline copies, or previously issued links before their expiry. Use short-lived signed asset access, proposed at 60 seconds for memo downloads, and evaluate an authenticated proxy if stricter revocation is required.

### 11.4 Visible state and remote-copy removal

Expose compact per-memo and per-item states with details available on tap. Local-save status and remote status are separate fields.

| Local state | Remote/availability state |
| --- | --- |
| Saving, Saved on this device, Save failed, Recovery draft available | Local only, Pending sync, Uploading, Synced, Downloading, Available offline, Online access required, Waiting for Wi-Fi, Quota exceeded, Conflict, Access removed, Sync failed |

Remote-copy removal is a journaled owner action with dependencies, job progress, and a server receipt. While deletion is pending or a cloud copy is intentionally retained, show Sync paused and Cloud copy retained. Set the Local only label only after the chosen remote deletion is acknowledged. Other users' exported copies remain outside this guarantee.

Re-enabling sync after acknowledged remote removal creates a new remote identity/generation and fresh operation namespace. Keep local IDs stable through explicit mappings and allocate fresh remote IDs where necessary. Old-generation operations, hints, and offline devices cannot recreate or mutate the newly linked copy. When removing a cloud copy, the final local verification includes current items, retained versions, trash selected for retention, and every required original. A partially downloaded library cannot be declared a complete local copy.

### 11.5 Server jobs and reminder delivery

Add bounded persisted jobs for asset finalization/orphan cleanup, snapshot expiry, retention/purge, and due shared-reminder delivery. These belong to the memo schema/service, with the same per-memo locking, lease, retry, and idempotency rules. Reuse existing scheduling infrastructure only after target inspection confirms it. P6/P7 must configure an identified scheduler/worker and record its cadence, authorization, concurrency limit, timeout, and monitoring. Local-only saves/reminders require none of this infrastructure.

For due reminders, atomically claim each occurrence/recipient delivery, recheck membership and target state, respect recipient preferences, and send generic account-bound payloads to designated devices. Use stable occurrence IDs for deduplication. Provider acceptance is recorded as accepted, with actual device presentation unknown until observed. Network response loss can still produce a duplicate alert, so no exactly-once audible guarantee is claimed. Local scheduling and remote push follow one device coordinator and explicit route type. Existing message INSERT webhooks and call workers do not automatically provide memo delivery.

## 12. Sharing and role enforcement

An invitation to a local memo first opens a review of what will upload and asks the owner to enable sharing. Acceptance binds an existing authenticated user identity to the memo. Invite tokens expire, are revocable and single-use where appropriate, and cannot grant a higher role than the inviter may assign.

| Capability | Owner | Admin | Senior | Junior | Viewer |
| --- | --- | --- | --- | --- | --- |
| Read live content | Yes | Yes | Yes | Yes | Yes |
| Create content | Yes | Yes | Yes | Yes | No |
| Edit/trash/restore own content | Yes | Yes | Yes | Yes | No |
| Edit/trash/restore others' content | Yes | Yes | Yes | No | No |
| Shared tag definitions/global pin order | Yes | Yes | Yes | Create/reuse tags with own content only, without rename/delete/global reorder | No |
| Shared tag associations/pin-unpin | Any content | Any content | Any content | Own content only | No |
| Personal pins/reminders | Yes | Yes | Yes | Yes | Yes |
| Memo settings/appearance | Yes | Yes | No | No | No |
| Invite/manage lower roles | Yes | Yes | No | No | No |
| Promote/demote Admin | Yes | No | No | No | No |
| Transfer ownership/delete entire memo | Yes | No | No | No | No |
| Permanently purge own items | Yes | Yes | Yes | Yes, subject to retention policy | No |
| Permanently purge others' items | Yes | Yes | Yes, subject to retention policy | No | No |

Admin control applies to the memo's content, membership, settings, and supported appearance options. Website administration, arbitrary themes/plugins, and app-wide user administration would be additional products. The supplied role description's site terminology is adapted to memo scope here.

Enforce one active owner. Ownership transfer, acceptance, and role changes execute transactionally under the memo lock. Admin cannot remove/demote the owner, promote themselves, or manage peer Admins. An owner leaving a memo must transfer ownership or explicitly delete it. Server checks run again when an offline operation reaches the server.

Any user who can read content can create their own personal reminder and private pin. Shared reminders require content-authoring rights, explicit recipients, and recipient delivery controls. Version restore follows the permission on the underlying note, and creates a new authored revision. Moderation records include actor and action while avoiding unnecessary content duplication.

Authorized readers can export permitted visible content or keep it offline in the initial design. UI restrictions cannot prevent a reader retaining a copy. Imported backups grant ownership only of the imported private copy and never restore remote roles or invitations.

## 13. Resource budgets and operational behavior

### 13.1 Proposed performance acceptance targets

These are initial targets for the assigned Android emulator configured near a 4 GB RAM reference profile where supported. Record emulator/host identity, APK/build configuration, dataset, warm/cold state, and measurement method. They are not current measured capabilities or proof of performance on physical phones. P0 establishes baselines and P8 measures the completed feature within the authorized environment. Adjust targets only with documented product reasoning and evidence.

| Workload | Initial target |
| --- | --- |
| Open an already initialized local memo | First 50-item page visible within 500 ms at p95 on a warm process |
| Local short-text save | Durable acknowledgment within 300 ms at p95, excluding large attachment processing |
| Indexed scoped search | First useful page within 300 ms at p95 after debounce on a warm index with 100,000 items |
| Large note input | p95 input-to-visible-update below 100 ms, with no repeated UI-thread stalls above 200 ms |
| Large-note open | Editable first viewport within 1.5 seconds at p95, with remaining work progressive |
| Memory | No whole-library materialization. Additional active memo/editor memory target below 150 MiB on the reference profile. Record peak native and JS memory separately. |
| Large-file processing | Transfer/encryption buffers stay bounded as file size grows. Initial total processing-buffer target is at most 32 MiB per active job, excluding required codec/player buffers. |
| Idle resources | No continuous polling or background JavaScript loop. Workers wake for pending work, connectivity, platform scheduling, or user action. |

Test libraries with 100,000 mixed items, 1,000 memos, multiple maximum-size notes, 10,000 small attachments, and a multi-gigabyte file collection using available disk. Exercise the 1 GiB single-file target only after capability confirmation. Test the worst shapes separately and then a representative combined dataset. Include low-storage conditions and the supported minimum Android profile established in P0.

### 13.2 Bounded work

- Start with one active upload and one active download, plus one low-priority indexing/import job. Tune using measurements. Foreground editing and playback take priority over maintenance.
- Use a small database connection policy, prepared statements where useful, indexed queries, and cancellation with account/query generations. Batches yield between steps. Backgrounding checkpoints and pauses nonessential work through supported platform scheduling.
- Create thumbnails at bounded dimensions. Virtualize image grids and timeline rows. Dispose decoded images, players, recorders, editors, subscriptions, and decrypted asset leases when their owners leave.
- Playback/export may require decrypted temporary files. Manage them with scoped leases, restrictive app-private paths, lifecycle cleanup, and startup reconciliation. Never delete an in-use file or reuse a prior account's decrypted path. Long media needs bounded decryption/player support established in P0.
- Disk admission accounts for originals, staging, history, backups, and temporary decrypted copies. Proposed free-space reserve is the larger of 100 MiB or 5% of currently free space before a new large job. Recheck as processing progresses and report required/available bytes.
- Cloud quotas are checked before remote work and enforced server-side. Storage/egress, revision retention, abandoned uploads, notification jobs, and backups need a measured cost model. Local saving remains available while cloud quotas are exceeded if local capacity permits.
- Diagnostics use operation IDs, durations, byte counts, failure classes, and queue depth. Exclude body text, filenames, URLs, PINs, email codes, archive passwords, signed URLs, and encryption keys. Local-only content must not leak through analytics or crash reporting.

## 14. Execution phases and acceptance

Section 0 contains the shared execution, environment, evidence, and reporting rules. P0-P8 in the requirement matrix are shorthand for Phase 0 through Phase 8. Each phase below has stable equal-weight work items and an exit gate. Baselines and context inputs are centralized in the following tables. All work items and gates are currently **not run**.

### 14.1 Context inputs, affected components, and baseline selection

The C0-C8 groups resolve to original paths, inspected symbols/ranges, and SHA-256 identities in the context index. Refresh changed identities before using them. Read each phase's Dependencies paragraph together with Section 14.4's consumed-input rules. An upstream phase label does not require closing its unrelated manual observations before independent coding starts. Checkbox items define the phase's scope/change set.

| Phase | Context inputs | Existing affected components and proposed change area | Pre-change baseline/check selection |
| --- | --- | --- | --- |
| Phase 0 | C0-C8 | Manifests/config, native capability declarations, current auth/route/media/notification contracts, backend policies, and isolated development prototypes | B0, B1, available B2/B3. Record artifact/tool/target discoveries and individual native probe results. |
| Phase 1 | C0, C1, C2, C3, C8 | NewSheetContent, RootNavigator/AuthProvider boundaries, account-session/sign-out callers, ChatListItem/list/organization adapters, proposed memo repository/vault | B0, B1; existing accountSwitch/authProvider/chat-list suites in B2; new V01/V02 native persistence cases. |
| Phase 2 | C2, C4, C7, C8 | Picker/model adapters, queue-copy ownership boundary, recording/playback coordination, proposed asset/trash/archive/accounting jobs | B0, B1; queue/media/audio suites in B2; V03/V10 native file/restore fixtures. |
| Phase 3 | C1, C3, C6, C8 | Memo FTS adapter, list/global search integration, filters, organization/preferences; preserve ordinary chat search callers | B0, B1; existing search/organization suites in B2; new V04/V12 memo fixtures. |
| Phase 4 | C0, C1, C2, C4, C6, C8 | BottomSheet wrapper, memo note editor/revisions/export/lock guards, key store and backup format extension | B0, B1; affected B2 paths plus V05/V06/V10 native editor/key/export evidence. |
| Phase 5 | C0, C1, C4, C5, C8 | Global notification presentation/response routing, audioOwnership registrations, sharing plugin/raw payloads, proposed native-intent intake/reminder scheduler | B0, B1; notification/audio suites in B2; V07/V13 ADB flows using a matching artifact. |
| Phase 6 | C0, C1, C2, C3, C5, C7, C8 | Memo SQL/RPC/storage/jobs, dedicated PIN mail endpoint, outbox/snapshots/identity mappings/folder associations and notification backend integration | B0, B1, B3; V06/V08 with isolated stores/client identities and authorized dispatch sinks. |
| Phase 7 | C1, C3, C5, C7, C8 | Memo role/invite/ownership/storage authorization, shared content/reminder state, private conflict recovery | B0, B1, B3; V09 concurrent/API/storage operations plus affected V06-V08. |
| Phase 8 | Relevant refreshed groups | Delivered memo paths, compatibility/recovery controls, measured profiling and release capability configuration | B0-B4 as relevant, complete V01-V14 evidence for advertised scope. Preserve known unrelated failures. |

### 14.2 Confirmed command contracts and runners

These commands are planned for later authorized execution. None was run during this polishing pass. Avoid broad commands that launch a service or write app output during planning. Use an existing approved runtime without speculative dependency/tool downloads.

| ID | Confirmed command and working directory | Evidence and limitations |
| --- | --- | --- |
| B0 | `npm run typecheck` from repository root | Root workspace script exists. Record the current baseline and affected post-change result. |
| B1 | `npm run lint --workspace @dologram/mobile` from repository root | Mobile script invokes Expo lint. Historical sign-up failures need fresh attribution. |
| B2 shared | `npm run test --workspace @dologram/shared` from repository root | Runs Vitest. Add proposed memo-domain cases using existing conventions. |
| B2 mobile | `npm run test --workspace @dologram/mobile -- --runInBand` from repository root | Runs Jest. Historical full-suite hang is unverified now. Bound the initial run and retain output. On a reproduced hang, diagnose and select targeted suites without reporting the full suite passed. |
| B2 targeted | Append `--runTestsByPath` and verified paths relative to `apps/mobile` to the mobile command | Existing paths include `src/queue/__tests__/db.test.ts`, `src/media/__tests__/pickers.test.ts`, `src/calls/__tests__/audioOwnership.test.ts`, `src/notifications/__tests__/pushNotifications.test.ts`, `src/chatList/__tests__/ChatOrganizationActions.test.tsx`, `src/__tests__/accountSwitch.test.tsx`, `src/search/__tests__/query.test.ts`, and `src/search/__tests__/SearchScreen.test.tsx`. Confirm the selected set for each change. New memo paths must exist before naming them as runnable. |
| B3 | Runner/target discovery required in P0 before recording an exact SQL/API/Deno command | SQL tests are transactional assertion scripts under `supabase/tests`; no confirmed pgTAP command is assumed. Locate an approved PostgreSQL/test runner and any required Edge runtime, validate help/version, and confirm the target before executing fixtures. Generate types against that identified schema. Root `gen:types` contains placeholder target arguments and is not an executable target-specific instruction. |
| B4 export | `npx expo export --platform android` from `apps/mobile` | Confirmed script/tool convention, with generated output only during authorized implementation. A JS export validates bundling rather than APK/native behavior. Match output identity before scanning. |
| B4 scan | `npm run scan:mobile-bundle` from repository root | Existing PowerShell scanner. Inspect supported output path and generated artifacts before use. Native build commands/profile require artifact/quota/authorization discovery under Section 0.3. |

Native SQLite, crypto, editor, alarm, URI-grant, and key-store observations need an identified development-only harness/ADB procedure in P0. Existing Jest mocks cannot provide these results. Reuse an applicable existing dev entry if appropriate. Keep test fixtures inaccessible in release and exclude private content/secrets. For each new V group, record exact selected commands, fixture inputs, expected outcomes, runtime identity, timeout, and evidence location in the context index before running it.

### 14.3 Requirement-to-work ownership

Verification items at the end of each owning phase exercise its delivered subset. Where a requirement spans phases, all owning work and relevant V-group scenarios must pass before that requirement is complete.

| Requirements | Owning implementation items |
| --- | --- |
| MEM-01 | MC1.2, MC1.3 |
| MEM-02 | MC1.3, MC2.1, MC2.2 |
| MEM-03 | MC1.1, MC6.2, MC6.5, MC7.4 |
| MEM-04 | MC3.3, MC3.4, MC4.1 |
| MEM-05 | MC3.1, MC4.1 |
| MEM-06 | MC5.1, MC5.2, MC5.3, MC6.1, MC6.3, MC7.3 |
| MEM-07 | MC0.2, MC1.1, MC1.4, MC4.4, MC4.5, MC6.4 |
| MEM-08 | MC0.4, MC4.1, MC4.2 |
| MEM-09 | MC0.5, MC4.3 |
| MEM-10 | MC2.3, MC2.5, MC8.1 |
| MEM-11 | MC7.1, MC7.2, MC7.4, MC7.5 |
| MEM-12, MEM-13 | MC3.2, MC7.3 |
| MEM-14 | MC2.3, MC4.2, MC5.1, MC5.5, MC6.1, MC6.5, MC7.4 |
| MEM-15 | MC4.2, MC6.5 |
| MEM-16 | MC0.6, MC5.4 |
| MEM-17 | MC0.3, MC2.4, MC4.6 |
| MEM-18 | MC1.5, MC6.2 |
| MEM-19 | MC1.1, MC2.4, MC4.1, MC5.1, MC5.2, MC6.2, MC6.5, MC8.3 |
| MEM-20 | MC1.4, MC4.4, MC6.4 |
| MEM-21 | MC1.4, MC3.4, MC4.4, MC5.5, MC8.2 |
| MEM-22 | MC8.3, MC8.5, MC8.6 |

MC0.1 establishes all affected baselines, MC0.7 addresses MEM-06 native feasibility, and MC0.8 consolidates the scoped contracts. MC3.5 supports MEM-04/MEM-21 navigation/error behavior. MC8.4 verifies the complete product workflows. All last-numbered phase items are verification/exit gates under Section 0.4. No phase's accepted work is removed from the denominator because verification is unavailable.

### 14.4 Development-entry dependencies versus completion gates

Pending manual/native/provider verification stays in its owning work item's denominator and prevents that item's acceptance and the owning phase's 100% claim. It does not prevent independent implementation. The following are the contracts consumed by later work, without an implicit requirement to close every unrelated observation in an earlier phase. Available contract/unit checks must support the implemented interface being consumed. Mocks can support interface development and never substitute for a required native/API observation.

| Work that may start | Required implementation input | Independent work while other evidence is pending |
| --- | --- | --- |
| Phase 0 discovery | Current plan, source identities, applicable instructions, and standing testing authorization | MC0.1 can start without a new APK, deployed memo service, mail provider, or second app endpoint. Individual native probes wait for their actual artifact/capability. |
| Phase 1 | Defined local identity, keyed database, transaction, journal, and key-vault contracts from MC0.1-MC0.3 | Domain, route, and repository implementation need not wait for DOCX/PDF, incoming-sharing, or alarm observations in MC0.4-MC0.7. Native save acceptance still needs the matching database/key evidence. |
| Phase 2 | Implemented P1 commit/recovery/account-lifecycle interfaces and the selected streaming crypto/archive adapter contracts | Asset/trash/accounting code need not wait for unrelated editor/alarm probes. Each real file/restore gate remains unverified until exercised. |
| Phase 3 | Implemented item/asset/list identity and ownership/query contracts from P1/P2 | Search/filter/tag/pin development need not wait for fresh-install backup or playback observations. P4 supplies later note/body integration. |
| Phase 4 | Defined editor/export/key interfaces plus implemented local revisions, assets, account guards, and archive contracts | Notes, PIN, history, and exports can progress independently of later email service deployment. Email reset remains incomplete until MC6.4. |
| Phase 5 | Implemented asset/guard/journal/audio-ownership interfaces and the relevant P0 scheduling/share contracts | Reminder and share work can progress independently of each other's platform checks. A missing alarm observation cannot stop ordinary reminder/share code. |
| Phase 6 | Implemented local revision/outbox/file identity contracts and the specified backend mutation/snapshot contracts | Private-sync and server-authorization work need not wait for alarm verification. MC6.3 consumes the P5 reminder contract. Mail transport affects MC6.4 specifically. |
| Phase 7 | Implemented backend serialization, mutation/receipt, asset-access, identity-generation, and revision contracts from MC6.1/MC6.2/MC6.5 | Roles/invites/collaboration code need not wait for email PIN delivery, native alarm, or an unavailable second live app endpoint. Required API/native observations remain explicitly incomplete. |
| Phase 8 | The implemented subset being assessed and its measurable fixtures | Inspect/profile completed paths while other phases continue. Release only the capabilities whose acceptance evidence is complete. |

Report next-phase readiness against these consumed inputs and name any blocked dependent item. Do not convert a blocked required check into optional status, remove its weight, claim a parent phase complete, or advertise an unverified capability merely because later implementation can proceed.

### Phase 0 — Feasibility prototypes and contract decisions

Starting prerequisites are this plan, applicable instructions, and current working-copy/context inspection. MC0.1 discovers the assigned emulator's actual profile, tooling, and artifact state. Individual native probes then require their concrete compatible runtime under Section 14.4. An unidentified APK/profile is not a prerequisite to beginning source and artifact discovery.

- [ ] **MC0.1** Establish existing application baseline and identify affected messenger, calling, notification, and search contracts.
- [ ] **MC0.2** Prototype SQLCipher with FTS5, migration/reopen, key retrieval, journal behavior, and backup exclusions in a matching SDK 57 artifact.
- [ ] **MC0.3** Select and measure maintained native streaming encryption/KDF support. Demonstrate encrypted 1 GiB file processing, integrity failure detection, bounded memory, and recoverable cancellation if advertising that limit.
- [ ] **MC0.4** Prototype maximum-size note editing, long paragraphs, many lines, Unicode input/composition, image handling, autosave, and modal dismissal. Compare editor choices against measurable criteria before adopting one.
- [ ] **MC0.5** Prototype DOCX/PDF generation on maximum-size representative notes. Document supported formatting and peak memory.
- [ ] **MC0.6** Probe installed incoming sharing, cold/warm intent routing, multi-file grants, and compatible native configuration.
- [ ] **MC0.7** Probe scheduled notifications and persistent alarm behavior under current Android access requirements. Establish fallback UX and supported platform matrix.
- [ ] **MC0.8** Finalize storage, encryption, PIN recovery, role rules, file caps, test profiles, and cloud cost assumptions in this plan.

MC0.8 is the Phase 0 gate. It requires every scoped dependency to have verified prototype evidence or an identified executable alternative with a verified capability boundary. Mere library selection or a mock does not close a required native probe. Independent domain work can proceed when its own inputs are established. The 1 GiB file target remains exploratory. Unsupported optional sizes may be recorded without blocking the requested content classes at the validated cap. Required editor, encryption, and alarm work remains incomplete until its applicable gate is met.

### Phase 1 — Durable local memo core

Dependencies are the P0 persistence/key-management contracts. This phase implements the encrypted database and key vault needed by later PIN and backup UI.

- [ ] **MC1.1** Add memo domain contracts, account database, schema versioning, asset ownership, local receipt/journal completion, and startup recovery. Local-only saves create no retained cloud backlog.
- [ ] **MC1.2** Add New Memo Chat to shared New sheet content with duplicate-tap protection, local creation feedback, shared string/icon/public export contracts, and discovery from both sheet callers.
- [ ] **MC1.3** Implement local text timeline, draft restore, memo rename/details, namespaced list/organization/folder adapters, and type-aware memo navigation under Section 3.4.
- [ ] **MC1.4** Implement offline enrolled-vault entry, every account/session teardown path, cache-cleanup retention, sign-out/removal handling, and stale callback guards. Preserve cloud/chat/must-change-password guards.
- [ ] **MC1.5** Show local-save state independently of future sync state. Hide unavailable features through milestone capability configuration.
- [ ] **MC1.6** Verify V01 and V02, plus unaffected ordinary chat/New group paths.

Exit requires airplane-mode create/save/reopen, recovery through injected termination, account isolation, and cache-cleanup survival.

An older native client missing SQLCipher/key-store capabilities must still open existing ordinary chat flows. Memo creation/read requires its compatible artifact and shows a truthful update/recovery action when unavailable. Never silently create plaintext memo storage as a fallback.

### Phase 2 — Attachments, trash, storage, and backup foundation

Dependencies are P1 and the selected streaming crypto/archive contracts.

- [ ] **MC2.1** Implement durable photo/video/audio/document/arbitrary-file capture through the available composer, recording, paste, camera/gallery, and file-picker paths. P4 adds note-image insertion and P5 adds Android incoming-share capture through the same commit protocol.
- [ ] **MC2.2** Add playback/open/export leases and cancellation, recording/calling audio coordination, and filename/type preservation.
- [ ] **MC2.3** Add trash/restore/permanent removal, explicit manual/opt-in retention eligibility, parent-memo lifecycle events for later reminder integration, reference-based reclamation, and local storage accounting.
- [ ] **MC2.4** Implement encrypted archive export/import with a fresh-install restore path and resumable job reconciliation.
- [ ] **MC2.5** Add low-space admission and largest-content review.
- [ ] **MC2.6** Verify V03 and V10 across empty, partial, corrupt, duplicate, large, and interrupted transfers.

Exit requires all requested attachment classes to persist offline, recover safely, and survive encrypted backup/restore. A broad local pilot can begin once core recovery and privacy checks pass.

### Phase 3 — Indexed search and organization

Dependencies are P1/P2 item and asset metadata. Coordinate with ongoing messenger search work.

- [ ] **MC3.1** Implement all nine filter tabs, counts, accessible selection, and bounded attachment views.
- [ ] **MC3.2** Add the fixed tag/pin identity, validation, collision, and role semantics in Section 6.2 plus persisted frozen bulk-selection targets. P7 applies shared server authorization.
- [ ] **MC3.3** Build revision-aware FTS indexing/rebuild and scoped queries with phrase/prefix matching, boundary-continuity fixtures, snippets, and block navigation hooks.
- [ ] **MC3.4** Integrate memo list/global search while enforcing locked-memo exclusion and account ownership.
- [ ] **MC3.5** Preserve navigation/search state and communicate index progress/read errors.
- [ ] **MC3.6** Verify V04 and V12 on delivered text/asset/tag/pin fixtures, large libraries, and supported language cases. P4 later completes note-body/image/snippet scenarios under MEM-04/MEM-05.

Exit requires retrieval of older items beyond the initial timeline window, correct overlapping filters, and no protected-content leakage.

### Phase 4 — Large notes, protection UI, and complete exports

Dependencies are P0 editor/export selection, P1 encrypted storage, and P2 archive/asset contracts. Email reset's deployed service completes with P6.

- [ ] **MC4.1** Add block-based note persistence, title/description cards, expandable modal editing, bounded image insertion, autosave, and recovery drafts. Complete note-body/image filters and indexing, including cross-chunk search/navigation and offset mapping.
- [ ] **MC4.2** Add version checkpoints, named history, compare/restore, and reference-aware pruning.
- [ ] **MC4.3** Implement DOCX/PDF/TXT/Markdown export, stable-revision jobs, format limitations, and cleanup.
- [ ] **MC4.4** Add PIN enrollment, verifier/cooldown, lock routing, optional biometrics, offline recovery secret, and key-invalidated feedback.
- [ ] **MC4.5** Define and test the purpose-bound email-reset contract without exposing an unfinished production handler. P4 exposes working local/offline recovery. P6 enables the email-reset entry with its functioning service and offline/error states.
- [ ] **MC4.6** Extend backups to cover notes/history. Verify V05, V06, and V10 against boundary inputs and interrupted saves.

Exit requires maximum-size note behavior within measured resource limits, format-verified exports, and tested local lock/recovery behavior. Email recovery remains explicitly pending until its P6 end-to-end verification.

### Phase 5 — Reminders and Android share capture

Dependencies are P2 durable assets, P4 access guards, and P0 native probes. Reminder work and share capture can be implemented independently within this phase.

- [ ] **MC5.1** Add reminder selection, schedules, atomic ready-state publication of frozen bulk targets, recurrence/timezone handling, snooze/complete, missed reminders, and reminder list. Integrate whole-memo trash/restore suspension and explicit reactivation.
- [ ] **MC5.2** Extend notification presentation/response routing by typed account-bound event, including offline vault/cold-start taps, channel preference separation, and OS schedule reconciliation.
- [ ] **MC5.3** Add exact-access checks and persistent alarm adapter where supported. Record regular reminders and Alarm capability separately.
- [ ] **MC5.4** Add incoming share routing, durable staging, account/destination selection, grant-expiry recovery, and duplicate-intent handling.
- [ ] **MC5.5** Integrate reminder/lock/share behavior with sign-out, recording, and active calls.
- [ ] **MC5.6** Verify V07 and V13 through real platform entry points on an authorized matching test environment.

Exit requires offline reminder scheduling/presentation evidence and cold/warm Android sharing. Persistent alarm release requires its own native evidence. Regular reminders retain their labeled capability if Alarm work remains pending.

### Phase 6 — Private cloud synchronization and email recovery

Dependencies are P1-P4 storage/revision contracts and reviewed backend contracts. Local reminders from P5 can continue independently.

- [ ] **MC6.1** Add schema/RLS/storage policy, specified mutation contracts, commit-ordered changes, receipts, immutable snapshot/rebase, private cloud quotas, and bounded maintenance/reminder job infrastructure.
- [ ] **MC6.2** Implement atomic retained-state bootstrap plus subsequent generation-bound outbox capture, verified asset uploads, catch-up, resumable transitions, download residency, and visible sync status. Release acknowledged/cancelled leases safely.
- [ ] **MC6.3** Add per-user/device reminder metadata sync and the occurrence/recipient dispatch coordinator. Verify server job claim/retry/authorization with isolated recipients and integrate the P5 client contract.
- [ ] **MC6.4** Deploy the purpose-bound email-reset endpoint and complete online/offline/replay/account-binding verification.
- [ ] **MC6.5** Add predecessor-aware offline mutation chains, private multi-device conflict resolution, deletion markers, old-cursor recovery, and cloud removal/re-link generation transitions.
- [ ] **MC6.6** Verify V06 and V08, including API-level authorization checks and response-loss recovery.

Exit requires two independently identified local stores/clients converging after offline edits, verified transitions in both directions and re-link, preserved conflicts, and functioning email PIN reset on an enrolled device. Use an isolated paired-store/API fixture within the assigned environment if a second app endpoint is unavailable. Record what was observed in the app versus the fixture. Additional live-client evidence stays unverified until an allowed second endpoint exists.

### Phase 7 — Shared memos and roles

Dependencies are P6 server serialization, storage access, and revision behavior.

- [ ] **MC7.1** Add invite review/acceptance, member list, role assignment, leave/remove, ownership transfer, and shared-memo settings.
- [ ] **MC7.2** Enforce the full role matrix in database/API/object paths and client affordances.
- [ ] **MC7.3** Add shared pins/tags/reminders, recipient preferences, actor attribution, and moderation history.
- [ ] **MC7.4** Handle role changes during offline edits, invite replay, revoked downloads, shared trash, and private local-copy creation.
- [ ] **MC7.5** Validate usage quotas and ownership-delete behavior with multiple members.
- [ ] **MC7.6** Verify V09 and collaboration-relevant V06-V08 through direct API operations and concurrent clients.

Exit requires rejected unauthorized operations, serialized ownership changes, safe offline rejection/recovery, and consistent shared-content state.

### Phase 8 — Scale, accessibility, recovery, and staged release

Dependencies are the delivered capabilities being released. This phase can begin earlier for completed milestones and repeats only as new features affect its coverage.

- [ ] **MC8.1** Measure V11 workloads and resolve query, rendering, file-copy, editor, and background resource regressions.
- [ ] **MC8.2** Run the V12 accessibility matrix and verify both themes, enlarged text, keyboard, reduced motion, and screen readers.
- [ ] **MC8.3** Exercise V14 migrations, rollback compatibility, feature disablement, cloud outages, quota exhaustion, and recovery-only access.
- [ ] **MC8.4** Verify complete capture/retrieval/reminder/recovery/mode-choice workflows using representative fixtures. External usability research is advisory and requires its own participants/authorization if pursued.
- [ ] **MC8.5** Publish supported limits, platform behaviors, privacy/recovery explanations, and milestone capability labels.
- [ ] **MC8.6** Complete the release acceptance gate and capability matrix for local-pilot, notes/reminder, private-sync, and collaboration milestones. Record rollback and content-free monitoring procedures. Perform actual distribution only under its applicable authorization.

Exit requires evidence for every advertised capability and the completed requirement matrix for that release. Full Memo Chat completion requires MEM-01 through MEM-22 across their delivery phases, including all requested additions.


## 15. Additional suggestions for DoloGram's distinctive experience

These are proposed enhancements beyond the committed roadmap above. Prioritize by observed user value, local reliability, and resource cost. Incorporate one at a time through the same acceptance process.

| Priority | Suggestion | Benefit and implementation boundary |
| --- | --- | --- |
| Highest | **Capture inbox** | A local destination for incoming shares, quick text, and recordings before choosing a memo. Reuses durable capture and offers later filing with tags. It reduces the number of choices needed during capture. |
| Highest | **Saved searches and smart collections** | Save queries such as unreviewed links, upcoming reminders, or PDFs with a tag. Store queries over existing items so moving/copying files is unnecessary. |
| Highest | **Links between memo items** | Reference a message, note paragraph, image, or recording timestamp and show backlinks. Use stable item/block IDs and unavailable-target handling. This helps a growing library remain navigable. |
| High | **Source and context preservation** | Keep original URL, original filename, capture date, optional author attribution, and links to related items. A future web clipping tool can save selected text with its source after an explicit action. |
| High | **Offline readiness view** | Show exactly which items are available without connectivity and offer Prepare for offline use with required bytes and progress. This builds on existing residency metadata and verified downloads. |
| High | **Review and action view** | Combine upcoming reminders, overdue items, and checkboxes into an optional view linked to the original content. Completion updates the source. Users can enable it per memo. |
| Medium | **Reusable memo and note templates** | Packing lists, study collections, voice journals, project logs, and meeting notes. Templates create ordinary editable content and need no separate execution engine. |
| Medium | **Privacy-aware OCR and transcription** | Make screenshots and recordings searchable. Prefer measured on-device processing where practical. Show language/model limitations and require explicit cloud processing for content that would leave the device. |
| Medium | **Encrypted device-to-device transfer** | Move a local library to another phone using an authenticated transfer or portable backup with integrity verification. Reuse the backup manifest rather than introducing another data format. |
| Later | **Optional local assistance** | Suggest tags or candidate reminder dates from selected content, with user confirmation. Benchmark battery/memory and keep generated suggestions distinguishable from saved facts. |

The strongest early combination is fast capture, trustworthy local saving, precise search, links between related content, and reminders attached to the original material. Validate that combination with people who repeatedly save and retrieve mixed media. Avoid claiming that a long feature list alone establishes novelty.

## 16. Verification matrix

| ID | Scenarios and evidence required |
| --- | --- |
| V01 | New-sheet entry points, duplicate taps, memo list routing, cached offline identity, token expiry, sign-out, every account-switch/removal path, stale callbacks, cache cleanup, and account isolation. |
| V02 | Local transaction outcomes, draft preservation, process termination at every save stage, lost acknowledgments, journal replay, duplicated operation IDs, local-only journal/lease reclamation with no cloud backlog, reopening, and honest save status. |
| V03 | All asset types, source-grant expiry, mismatched MIME, zero-byte/oversize policy, bounded file handling, disk-full failures, playback leases, trash/restore/purge including version/draft cleanup, manual/opt-in retention and policy-change races, protected history references, accounting reconciliation, and cleanup safety. |
| V04 | All filters and overlaps, note/image/link matches, empty/64/65-code-point tag validation, normalized duplicates and rename collisions, fixed pin/association permissions, frozen bulk selection, historical results, chunk offsets, cross-boundary tokens/phrases/prefixes and edits, language/tokenizer equivalence, deleted/locked exclusions, cancellation, rebuilds, and navigation restoration. |
| V05 | 0/499,999/500,000/500,001 body code points, emoji/combining text, long single paragraphs, many newlines, input composition, image-heavy notes, modal/keyboard behavior, autosave/process death, revision restore, 100/101 automatic checkpoints and the 30-day boundary, protected named/current/job-referenced revisions, and generated document inspection. |
| V06 | PIN verification and persisted cooldowns, bypass attempts through every route/intent, lock cleanup, key invalidation/rotation, biometric fallback, email expiry/replay/rate limits, wrong account/device nonce, reset with retained key, and missing-key recovery. |
| V07 | Single/bulk reminders, termination during target-set construction, no activation before ready, changed/unavailable target review, whole-memo trash/restore, DST/zone changes, schedule edit races, overdue/off targets, OS denial, blocked channels, silent settings, locked content, restart/reboot, kill/force-stop/relaunch, persistent alarm audio ownership, duplicate push/local occurrences, and multi-device completion. |
| V08 | Offline edit/create, same-note conflicts, local-encrypted to cloud-original round trips, remote digest mismatch, resumable uploads/downloads, server acceptance with lost response, expired sessions, rate limits/quotas, all mode transitions, local-to-cloud bootstrap with concurrent edits/pruned history/cancellation, eviction guards, change-log gaps, out-of-order hints, stale snapshots/cursors, new-device bootstrap, and old-client resync. |
| V09 | Every role/action through direct API and storage access, Junior tag-definition/global-order denials versus own-association/pin permissions, normalized tag/rename concurrency, role escalation attempts, concurrent invite/ownership mutations, revoked offline edits, deleted-parent reminder dispatch, private recovery copies, shared reminder permissions, and foreign-memo asset references. |
| V10 | Wrong passphrase, tampered ciphertext/manifest, unsupported archive version, path traversal, excessive expansion, missing/duplicate assets, interrupted backup/import/export, collision policy, complete fresh-install restore, and all four note export formats. |
| V11 | Proposed performance datasets, p95 latency/memory, low free space, background/foreground, playback during indexing, concurrent edits/uploads, battery/idle behavior, slow disk/network, and replacement-download reclamation. |
| V12 | Screen reader labels/order, active/inactive filters, 44-pixel targets, keyboard and modal focus, enlarged text, landscape/tablet adaptation where supported, reduced motion, contrast, and both themes. |
| V13 | Android Sharesheet from browsers/gallery/files/recorders, text+URL, single/multiple assets, cold/warm/background launches, repeated intents, signed-out/locked targets, partial grant failures, interrupted staging, and destination-account binding. |
| V14 | Upgrade/restart during migration, previous supported schema, newer-schema read protection, database corruption detection, backup recovery, capability disablement, rollback build behavior, server outage, and recovery/export access after a feature flag changes. |

Use shared unit tests for classification, permissions, recurrence, and revisions. Use real SQLite integration tests for transaction/journal/index behavior, API/database tests for authorization and concurrency, and assigned-emulator/ADB tests for native lifecycle, sharing, editor input, alarms, and file-system behavior. Deterministic state-machine tests supplement platform observations. Test on disposable memo data, with controllable clock/network/storage failure injection and isolated backend recipients. Every V01-V14 group is currently **not run**.

Do not mark native timing, biometric hardware behavior, file durability, or export layout verified solely because a mocked unit test passes. Record checks as passed, failed, blocked, or not run, with limits of the evidence. Optional biometric hardware observations unsupported by the assigned emulator remain explicitly unverified. Verify the PIN fallback and keep unsupported optional biometric controls unavailable.

## 17. Release, migration, and recovery controls

- Use independently readable capability configuration for local memos, notes, reminders, alarm mode, sharing capture, private sync, and collaboration. Turning off cloud features pauses network work while preserving local reading/editing/export where technically compatible.
- Migrations are versioned, transactional where possible, restartable, and additive until older supported clients are retired. Keep a recoverable pre-migration snapshot/backup for destructive transformations with sufficient space checks.
- A database newer than the running build opens a safe compatibility/recovery screen. Never initialize an empty schema over an unreadable existing database. Provide export through a compatible recovery path or upgrade instructions when the old build cannot decode it.
- Server changes deploy compatible read/write contracts before clients use new operations. Older clients encountering unsupported revisions must stop affected writes and request update rather than discard unknown content.
- Separate cloud rollback from local schema rollback. A feature flag cannot reverse a database migration. Document the minimum compatible build and restoration procedure per release.
- Before broad rollout, verify recovery from process interruption, key unavailability, missing assets, corrupt imports, and failed upgrades. A local pilot still requires dependable local save/restore and privacy behavior.
- Track save-failure rate, recovery-job outcomes, sync backlog age, conflict counts, import verification failures, free-space refusal, and p95 foreground latency. Provide user-visible repair/export actions linked to each recoverable failure class.

## 18. Unresolved prerequisites, consequences, and out-of-scope findings

The plan is executable starting at Phase 0 discovery/prototypes when implementation is authorized. No unanswered question prevents completing this polishing pass. The following runtime/resource facts remain unresolved. New feature code is planned work, not evidence of an external blocker. None of these entries grants permission to build, deploy, start services, or modify data during polishing.

| ID | Evidence and unresolved fact | Affected requirement/gate | Next action and independent work |
| --- | --- | --- | --- |
| U01 | Current config does not enable SQLCipher/incoming sharing. Matching installed APK/native fingerprint, live MuMu identity, current EAS quota, and any necessary external upload access remain unverified technical/resource facts. Emulator/account/test-data actions already have the user's standing authorization. | MEM-01/02/07/08/16/17, MC0.2-MC0.7 native portions | In Phase 0 use ADB to identify the assigned instance and approved artifact, compare native deltas, and reuse a matching client. Do not ask again for covered install/reset/login/credential/data actions. If a replacement requires a genuinely unavailable external resource or permission, identify only that gap. Continue independent work under Section 14.4. |
| U02 | Native streaming crypto/KDF, editor, and export engines are unselected. SQLCipher/FTS and the 500,000-character/large-file targets have documentation support or design rationale but no memo-specific native measurements. | MEM-02/07/08/09/17, MC0.2-MC0.5 | Prototype maintained SDK-compatible candidates with the specified boundary datasets and failure injection. Choose a working adapter before dependent coding. Keep 1 GiB as an exploratory size. Schema, classification, permission, and journal-state work can continue with explicit adapter contracts. |
| U03 | Persistent alarms need native scheduling/audio/access support and current store-policy compatibility. Assigned emulator API/access, Doze/reboot behavior, and biometric simulation support are unverified. | MEM-06/07/21, MC0.7, MC4.4, MC5.3/MC5.6 | Establish the exact API/build/platform support matrix in the assigned emulator, then implement and verify supported adapters. Keep unsupported observations blocked and capability labels truthful. Continue ordinary scheduling/state, sharing, editor, and sync work. Physical-device access is not a resolution requirement. |
| U04 | No memo schema/function implementation appears in the inspected local paths. Remote deployment state, actual isolated target, applied migration history, usable PostgreSQL/Edge runner, provider checksum support, notification/email recipients, and current quotas are unconfirmed. | MEM-03/06/07/11/15/18/19, Phase 6/Phase 7 integration gates | Discover the authorized configuration and approved test facility in Phase 0, then record exact commands/targets. Implement specified contracts and isolate side effects before integration. If infrastructure/action authorization is absent, identify that specific gap. Local features and deterministic server/domain tests continue. |
| U05 | Email confirmation/enrollment for actual accounts and a purpose-bound mail transport are unverified. Existing reset-password code exchanges a session and does not supply the requested dedicated PIN code. | MEM-07, MC4.5/MC6.4 | Implement the dedicated verified-recipient challenge flow, inspect actual account confirmation state without exposing user data, and verify sender configuration with a designated test recipient. Offline PIN/recovery and local note features remain independent. |
| U06 | Phase 17 reported typecheck/shared-test passes, unrelated sign-up lint errors, a full-Jest hang, and a blocked EAS upload on older source. Current memo checks and performance are not run. | All evidence-dependent gates, especially V11/V14 | Re-establish B0-B3 selectively in Phase 0. Retain diagnostics, attribute existing failures, and diagnose a reproduced hang before choosing targeted runners. Add real native integration coverage. Planning and independent implementation do not need a false full-suite pass. |
| U07 | A second authorized live app endpoint is unconfirmed. Existing rules assign one named emulator. | MEM-03/11/15/18, V08/V09 live-client observations | Use independently identified local stores/API clients in the assigned test harness for required protocol/concurrency gates. Document that evidence boundary. Use another app endpoint only if access is already established or a specific additional resource is authorized. No second physical device is required. |

### 18.1 Findings outside this implementation scope

- The existing global messenger database migration/open behavior and sent-queue cleanup are compatibility boundaries. Build the memo store's own required safety behavior without rewriting those unrelated subsystems.
- Existing ordinary-chat MIME/size restrictions and its missing persistent filename field remain ordinary-chat contracts. Memo-specific arbitrary-file/filename support is new scoped work.
- Historical sign-up lint failures and the full-suite runner hang are not memo product requirements. Diagnose test execution as necessary for relevant evidence and record unrelated source defects separately.
- Root `gen:types` has placeholder target arguments. Discover a target-specific generation command for memo schema execution, without turning unrelated script cleanup into this polishing task.
- `docs/builds.md` contains a historical allowance/build record. Actual current quota/pricing and permissions require verification. This pass does not rewrite build documentation or infer availability.
- Guest mode, iOS/web feature parity, global PIN credentials, independent per-memo cryptographic vaults, application-managed end-to-end encryption, simultaneous collaborative editing, and Section 15 suggestions remain outside the committed execution scope.

## 19. Consolidated decisions, audit changes, and next step

The goal and requested feature/addition set are preserved. Android-first delivery, local-only creation, the three storage presets, 500,000-code-point notes, per-device PIN gates over account encryption, service-readable cloud sync, and the role matrix remain proposed defaults from the existing plan. Refinements below correct missing integration or verification details.

| Decision | Material refinement and reason |
| --- | --- |
| D01 | Separate enrolled local-vault identity from cloud auth. Current root/session-switch source otherwise makes offline-first entry depend on a server session. Existing mandatory-password-change/cloud/chat authorization remains enforced. |
| D02 | Dispatch memo conversation routing/organization through typed adapters and memo-specific folder links. Ordinary list routes and `folder_chats` cannot accept local memo semantics. |
| D03 | Use serialized keyed database access and verify FK/durability behavior. SDK 57 exclusive-transaction connection settings cannot be assumed to inherit key/foreign-key configuration. |
| D04 | Preserve an unsaved editor buffer when both primary save and recovery-draft writes fail. A disk failure cannot be solved by promising another infallible disk write. |
| D05 | Specify dedicated PIN-code service/mail verification and raw incoming-share configuration. Existing recovery links change session state, and existing sharing config is disabled for incoming intents. |
| D06 | Define offline operation predecessors, frozen retry envelopes, immutable snapshot revisions, purge invalidation, and fresh remote generations after re-link. These close conflict/retry/resurrection gaps in the original sync outline. |
| D07 | Assign bounded server jobs for checksum, retention, and shared reminders, with explicit provider/worker limits and accepted-versus-observed delivery states. The existing message webhook does not implement these paths. |
| D08 | Add exact command contracts, context identities, named unresolved prerequisites, Phase 0-8 names, stable weighted work items, measurable gates, and required execution-only reporting. All runtime results remain not run. |
| D09 | Keep additional novelty suggestions advisory. Replace required external usability sessions with executable fixture workflows so absent research participants do not become an invented implementation prerequisite. |
| D10 | Refresh concurrent search contracts and bound snippet/highlight inputs before reuse. The current prefix-normalizing range helper is suitable for bounded display text and needs a memo-specific window adapter for maximum-size notes. |

Next authorized execution begins at Phase 0. Independent Phase 1 preparation can start when its named persistence/identity contracts are established. During this polishing pass, only plan/context checks can pass. No implementation percentage is reported.

## 20. Second-pass quality audit and execution readiness

**Ready for execution.** No unresolved prerequisite prevents Phase 0 discovery and available baseline preparation from starting after the planning-only boundary is lifted. Later native/backend/provider observations retain their explicit dependencies and acceptance gates. This classification establishes a workable execution sequence, with no implementation, runtime, or performance result implied.

The candidate plan and all 79 indexed source fingerprints matched the prior inspected versions at this audit's baseline. Unchanged source context was reused. Defects and ambiguities below were resolved against the plan's own contracts without rereading unchanged application files or regenerating packets. The user's latest standing emulator authorization is incorporated in Section 0.3. Existing goals, feature scope, security model, platform restrictions, recovery safeguards, MEM IDs, V IDs, and 56 equal-weight execution items are preserved.

| Audit item | Material correction | Affected work and evidence |
| --- | --- | --- |
| QA01 | Separate development-entry dependencies from phase completion/release gates. Apply current standing emulator/account/credential/data authorization directly and prohibit unchanged-check testing loops. Pending manual verification remains incomplete while independent implementation continues. | Sections 0.2-0.4 and 14.4, all phase readiness reports, U01. |
| QA02 | Resolve unspecified tag normalization/collisions, Junior shared-definition rights, and the unassigned shared-pin enablement setting. Fix own-content association/pin behavior and retain moderator control of global definitions/order. | MEM-12/13, MC3.2/MC7.2/MC7.3, V04/V09. |
| QA03 | Require search equivalence across artificial note/index chunks and assign note-body/image index integration explicitly. Storage layout cannot silently lose a supported token/phrase/prefix match. | MEM-04/05, MC3.3/MC4.1, V04/V05. |
| QA04 | Freeze bulk IDs, publish target sets atomically as ready, and suspend reminders for a trashed parent memo. Interrupted building cannot activate a subset. Restore requires explicit future reactivation. | MEM-06/14/19, MC3.2/MC5.1/MC5.2/MC5.5/MC6.3/MC7.4, V03/V07/V09. |
| QA05 | Resolve manual versus 30-day trash behavior and age/count history pruning. Preserve named/current/actively referenced revisions and prevent unconfirmed auto-purge of sole local copies. | MEM-10/14/15, MC2.3/MC4.2/MC6.1/MC7.4, V03/V05/V09. |
| QA06 | Make remote outbox creation conditional on replication intent. Release completed local-only journal leases, bootstrap retained state on opt-in, and atomically capture subsequent edits. Old discarded local revisions cannot become a permanent cloud backlog. | MEM-03/10/18/19, MC1.1/MC6.2/MC6.5, V02/V03/V08. |

No Section 15 suggestion became required scope. Existing ordinary-chat restrictions, historical lint/runner issues, type-generation placeholder arguments, optional platform parity/E2EE, and other Section 18.1 findings remain outside this implementation task.

### 20.1 Remaining dependencies and exact next actions

- **Start with MC0.1.** Refresh the scoped working-copy/context baseline, preserve recoverable inputs before any implementation edit, and establish B0-B3 availability/results with bounded commands. Source inspection is sufficient to start this work. U06 governs historical failures and runner diagnosis.
- **U01-U03 affect native portions of MEM-01/02/06/07/08/09/16/17/21.** Use the authorized ADB connection to identify MuMu `dologram`, inspect the installed artifact/capabilities, and reuse a compatible client. Run MC0.2-MC0.7 probes when their concrete runtime exists. Establish any needed external artifact/build resource and quota only if reuse is insufficient. Continue the independent inputs in Section 14.4.
- **U04-U05 affect cloud/sharing/recovery portions of MEM-03/06/07/11/15/18/19.** Identify the actual approved target, migration history, runner, scheduler/checksum facility, and designated email/push recipients. Configure and test the specified services during their owning execution phases. Local functionality and contract tests proceed independently.
- **U07 affects multi-client observations under MEM-03/11/15/18.** Establish the isolated paired-store/API fixture in the assigned environment first. Additional live endpoints are used only when actually available/authorized. Fixture evidence and live-app observations stay separately labeled.

No user question or repeated testing-permission request is needed to finish this audit. Stop this polishing pass after document/context validation and this readiness assessment. All application acceptance checks remain **not run**, and implementation starts only under an implementation request.


