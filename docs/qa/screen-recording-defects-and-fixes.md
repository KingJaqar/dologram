# Screen recording: finalized defects and fixes

Reviewed recording: `MuMuNxDevice_OcnIBJ7M0x.mp4` (03:50). Review date: 2026-11-11.

Timestamps are approximate unless subsecond values are given. Findings describe recorded behavior, not proof of server failures. Source changes below have been implemented; native visual and gesture outcomes still require replay on an Android device/emulator. No deployment or native-device validation is claimed.

## Defect register

### D01 — Folder input hides entered text (High)
- Evidence: 02:15–02:35; Rename at 02:39–02:41. Character counts increase but text is invisible and the selection handle sits below the shallow field.
- Source finding: shared TextField used `flex: 1` in an unconstrained column while also setting a fixed height. The field could shrink independently of its text.
- Fix implemented: remove vertical flex sizing; stretch horizontally, give the input a 48-point minimum height and explicit vertical padding. This applies to creation and renaming.
- Accept when: typed/pasted folder names, cursor and selection remain visible with the keyboard open/closed, including increased font size. Create and rename a folder and verify the displayed name matches.

### D02 — Main navigation appears unresponsive after account switch (High)
- Evidence: 03:34–03:40. Top navigation presses leave All chats visible; Settings/account controls later remain usable.
- Cause not established from the recording. Existing root freezing and retained nested navigation state are plausible contributors.
- Mitigation implemented: keep the main screen unfrozen and remount its child navigation/header per authenticated user. This discards the previous account's navigation and folder selection state. Header remains mounted during outgoing transitions (D12).
- Accept when: switch accounts repeatedly, then open Chats, Archive, Ignored and Settings. Each destination must visibly change, with correct account data. This finding remains pending native reproduction/verification.

### D03 — Unavailable-chat error flashes during valid navigation (Medium)
- Evidence: around 00:45 and 00:47–00:48 when moving between group 123 and Chat info.
- Source finding: Chat info/profile used a delayed-spinner flag to decide whether loading had finished. Before the spinner delay elapsed, `info === null` rendered an unavailable error. Chat info also discarded reload requests while another read was in progress.
- Fix implemented: gate errors/empty content on actual loading state; delay only the indicator. Scope chat info snapshots/errors to both account and chat; reject stale reads, allow newer reads, and protect confirmed mutations from older results. The conversation screen also no longer displays its empty state before the initial read completes.
- Accept when: rapidly navigate between chat, info and profile with deliberately slow cache reads. No unavailable error may appear while loading. A genuinely absent chat must still show Retry after the read finishes.

### D04 — Archive labels contradict success feedback (Medium)
- Evidence: 01:20–01:29. Archive/Unarchive labels lag success notifications.
- Source finding: success was announced before a full resync and local reread completed.
- Fix implemented: apply the server-confirmed member state immediately, write that row to the local cache and reload before success feedback. Invalidate older pending reads. If caching fails after server success, retain confirmed state and retry synchronization rather than report a failed mutation.
- Accept when: Archive becomes Unarchive and vice versa without a second tap, even with delayed resync; no duplicate mutation or false failure is reported after server success.

### D05 — Group profile labels the group as a person (Medium)
- Evidence: 00:49–00:51. Group 123, with two members, is displayed as “Chat member — 123”.
- Fix implemented: group profiles show actual group members, self/role labels, and an “Open group chat” action. Direct-chat profiles retain their contact-specific content. Opening the conversation dismisses back to its existing route instead of stacking another copy over Chat info.
- Accept when: a group lists its actual members and opens its group chat; direct and Saved Messages profiles remain appropriate. Back navigation must not loop through duplicate conversation screens.

### D06 — Light-mode system status icons remain white (Medium)
- Evidence: around 02:00 and 02:02. White clock/signal/battery indicators blend into the pale background.
- Fix implemented: root native-stack status-bar style derives from the resolved application scheme. Navigation theme colors also derive from the same application palette.
- Accept when: clock and all status icons are dark in Light mode and light in Dark mode, including when opening chats and returning from modals.

### D07 — Unchecked folder checkboxes have poor contrast (Medium)
- Evidence: 02:44–02:47. Unchecked border is barely visible on the dark sheet.
- Fix implemented: use the secondary text color for the unchecked boundary instead of the separator token; retain explicit checked state and checkbox accessibility state.
- Accept when: both states are distinguishable on dark/light surfaces and the complete row remains selectable.

### D08 — Empty chat preview leaves a leading separator (Low)
- Evidence: 00:00–00:04 and 03:32–03:40. Empty group subtitle begins “· 12:02 PM”.
- Fix implemented: render the separator only when non-whitespace preview text precedes the timestamp.
- Accept when: an empty chat displays a clean timestamp; a populated chat still displays preview, separator and timestamp.

### D09 — Account switch briefly shows a misleading empty list (Medium; observed symptom, cause unconfirmed)
- Evidence: 03:17–03:20. “Account switched” and “No chats yet” appear before conversations become visible after folder/All interactions.
- Fix implemented for the confirmed loading fall-through: the list renders a pending surface until its local read finishes, delaying only its skeleton. Account-keyed main navigation also resets folder selection.
- Remaining distinction: local cache can legitimately be empty before the first remote sync. This patch does not claim to eliminate all first-sync latency or suppress a genuinely empty result.
- Accept when: switch to cached and uncached accounts under slow/offline conditions. Pending reads must not show an empty result; after synchronization, chats must appear without a tab change. If a completed local-empty read still misleads users during initial remote sync, expose initial-sync readiness explicitly before declaring the inbox empty.

### D10 — Camera actions have no visible result (Medium; suspected)
- Evidence: 00:20–00:23. Apparent attempts on Take photo/Record video show no camera flow, while Gallery opens afterward. Delivered taps and emulator camera availability cannot be proved from pixels.
- Source finding/mitigation implemented: the sheet's drag recognizer requested every touch from its start. It now requests only downward vertical movement beyond the drag threshold, leaving taps to child controls. Its dismissal callback also uses the current handler rather than the initially captured handler.
- Existing picker behavior already requests camera/audio permission and returns readable permission/launch errors. It is retained.
- Accept when: each button reliably launches the appropriate camera on a supported device; denied permission or missing camera yields visible feedback; cancel returns to the composer; dragging the sheet still dismisses it. Physical-device verification remains required.

### D11 — Bottom white strip flashes when tapping a chat (Medium)
- Evidence: approximately 00:01.85 for 123 and 00:04.95 for white. A full-width white bottom rectangle appears briefly in Dark mode.
- Fix implemented: apply the application palette to the navigation theme, default stack content and nested main-stack backgrounds; keep the same Android navigation-bar surface on both sides of chat transitions. Keep the outgoing layout intact (D12).
- Accept when: record repeated enter/back cycles in both themes and inspect frames. No bright default surface may appear at the bottom. Source changes are implemented; this visual outcome requires native verification.

### D12 — Chat list jumps into the status-bar region before sliding (Medium)
- Evidence: 00:01.8–00:02.1, 00:04.9–00:05.2 and 00:07.3–00:07.6. Main toolbar disappears and All/list rows move upward before the horizontal transition.
- Source finding: MainHeader returned null whenever global route segments stopped matching the main group. Global segments update while the outgoing list remains visible.
- Fix implemented: retain the last main section and keep the header mounted while the conversation route animates. Maintain the same header height and safe-area layout.
- Accept when: the folder strip/chat rows retain their vertical positions throughout entry and Back animations, with no overlap at the clock. A regression test covers header retention when global segments change to chat.

### D13 — Toolbar controls flicker during Back navigation (Medium)
- Evidence: 00:03.15–00:03.5 and 00:06.3–00:06.7. New/account controls appear briefly beside the outgoing conversation header, then disappear from the settled main toolbar.
- Fix implemented for the shared structural cause: keep MainHeader attached to its own main layout, retain its last section while covered, preserve its themed background and avoid main-screen freezing. Account switches recreate the main subtree.
- Accept when: the destination toolbar has the same controls and dimensions before, throughout and after Back, including repeated rapid entry/exit. Native verification remains necessary.

## Corrections and exclusions

- Folder selection was checked and then unchecked before closing. “0 chats” is consistent; a membership-save failure is not established.
- Voice recording briefly enters recording state around 00:17. Complete recording/delivery was not demonstrated.
- Search, media, pinned messages, notifications and account management do open; quick Back navigation must not be labeled a failed route.
- The display name was edited from alex123 to alex1 before saving; alex1 afterward is correct.
- Chat customization is not proven broken by viewing an empty conversation without a message showing the selected accent.
- Performance/debug overlay counters and emulator limitations are not proof of production performance or backend failures.

## Verification

Regression coverage added for outgoing-header retention, stale chat-info reads, confirmed archive state surviving an old read, loading without false unavailable errors, group-profile semantics and empty-preview timestamps. The existing mobile suite also covers picker permission/launch failures and account switching.

Native acceptance cases above remain outstanding.

- `npm run typecheck`: passed for both mobile and shared workspaces.
- Existing full mobile suite: 32 suites / 227 tests passed.
- Targeted regression run after the new tests: 4 suites / 21 tests passed (includes new and existing tests in those suites; do not add this to the full suite count).
- ESLint on the 15 other changed source/test paths: passed.
- Full mobile lint: 9 existing errors and 1 existing warning remain. These involve synchronous state updates in effects (`chat/[chatId]/index.tsx`, `new-group.tsx`, `MessageFocusOverlay.tsx`), color literals in `chats/preferences.ts`, a test probe assignment in `Toast.test.tsx`, and the conversation callback's missing `pinnedMessageIds` dependency. Those pre-existing sections were not changed by this work.
- Jest initially could not write its system temporary transform cache; using `--cacheDirectory G:/codebase/DoloGram/apps/mobile/.jest-cache/recording-review` resolved that environment issue.
- No Android build, emulator replay, physical camera check or deployment was performed.

## Reference APIs

The implementation was checked against Expo SDK 57 documentation: https://docs.expo.dev/versions/v57.0.0/ and https://docs.expo.dev/versions/v57.0.0/sdk/router/; navigation guidance: https://docs.expo.dev/router/advanced/stack/; responder and input behavior: https://reactnative.dev/docs/panresponder and https://reactnative.dev/docs/textinput.
