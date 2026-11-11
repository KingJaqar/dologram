# Phase 12 Android verification — Media UI

Date: 2026-11-10 (Asia/Manila). Status: Complete for implementation and available checks; optional manual verification remains.

## Scope and ownership

Implemented only Phase 12/M3-03: AND-08 pickers, CMP-10/11 drafts/attachments, recording, durable enqueue integration and AND-09 viewing. No Phase 13 delivery policy, compression, toggle or deferral was implemented. No dependency was added; manifests and lockfile are unchanged. No commit, push, deployment, remote migration or external service configuration change was made.

The original working copy was largely untracked. All 158 snapshotted inputs can be recovered by SHA-256 from `phase-12/source-baseline.zip`; `source-baseline.json`, Git baseline/patch and `review-owned.py` distinguish this phase from the original user work. Only eight existing source files and this selected phase's plan section changed; new media components/services/tests were added. `owned-existing.diff` contains the reviewable baseline comparison.

## Required workflow and prerequisite verification

Git baseline → ripgrep discovery → Reader validation → scoped Repomix → Reader XML analysis → original-source verification was completed before source edits. The detailed checklist, source identities, complete XML continuation boundaries, classified requirements and discrepancies are in [context-index.md](phase-12/context-index.md).

Cached Repomix 1.18.1 generated `repomix-phase12.xml`: 20 intended entries included, security scan passed, 52,421 characters, estimated 14,243 tokens. These are packet estimates, not measured model usage or savings. All 45,629 extracted entry characters were read in four bounded continuations. Omitted function/JSX bodies were checked against actual source. Hashes distinguish the original packet entries from changed current files; unchanged context was reused. Repowise was unavailable and not needed.

Phase 11's actual source supplies validated durable payloads, private copies before SQLite enqueue, message-first upload/link ordering, idempotent upload/media-row retries, startup recovery and the 600-second signed-URL helper. The new multi-file test exposed two prerequisite defects, both fixed: the shared private directory must be created idempotently, and partial destinations must be tracked before copy so failed copies can be removed.

Documentation read: Expo SDK 57 ImagePicker, DocumentPicker, Audio, Video, FileSystem, Sharing and Router; Expo llms index; React Native 0.86 Image and PanResponder; React effect cleanup guidance; Supabase Storage/signed-URL docs and changelog. Installed library signatures were checked, including DocumentPicker's actual function API, Audio recording/events, Video async replacement, and File/Directory operations. Recent Supabase changelog breaking entries concern Flutter and CLI; neither is changed here. Supabase skill security guidance was applied to existing authenticated Storage access.

## Changed behavior

| Requirement | Files/behavior |
|---|---|
| AND-08 / D-29 | `src/media/pickers.ts`, `model.ts`, shared validation/strings: camera photo/video, system gallery multi-selection, cached document selection, count/type/byte-size validation, visible permission/cancellation/provider errors. |
| CMP-10/11 | `ChatComposer.tsx`, chat route: preview/name/remove/count strip, attachment-only Send, durable enqueue, retained draft on failure, send/picker guards, text and reply preservation. |
| Voice | `VoiceRecordButton.tsx`: hold/release, cancel, permission/preparation race handling, bounded recording duration, background/unmount cleanup, fixed button location while status appears. |
| Media display | chat query, `MessageBubble.tsx`, `AttachmentTile.tsx`: cached rows, private local previews, individual missing-media placeholders, no deleted attachments, pending state retained across an early server echo. |
| AND-09 | existing media route, media query, `PhotoViewer`, `VideoPlayback`, `VoiceNotePlayer`, sharing/source helpers: member/live-message checks, photo pinch/pan and accessible zoom, video controls, inline voice position/progress/1x/2x/restart, Android share sheet. |
| D-113 | Authenticated signed URLs renew at configured expiry; foreground revalidation, coalesced requests, explicit retry after failure, timer/subscription cleanup, no persisted signed URLs. Playback position is preserved on source renewal. |

## Baseline and final checks

Full command output is retained in `phase-12/*.log`.

| Check | Baseline | Final |
|---|---|---|
| `npm run typecheck` | Pass, both workspaces | Pass, both workspaces |
| Shared Vitest | 17 files, 130/130 pass | 18 files, 137/137 pass |
| Full mobile Jest, host, `--runInBand` | 7 passing suites, 2 failing; 46 pass, 6 fail | 13 passing suites, same 2 failing; 70 pass, same 6 fail |
| New Phase 12 Jest tests | Not present | 6 suites, 24/24 pass |
| Recorder tests after final layout fix | Not present | 1 suite, 4/4 pass |
| Full mobile lint | 2 errors + 1 warning in `app/sign-up.tsx` | Identical pre-existing findings |
| Scoped mobile lint | N/A | Pass, no findings |
| Android production JS/Hermes export, host, 2 workers | Pass | Pass |

The same six baseline Jest failures are: two duplicate-account/username sign-up cases; sign-in invalid-email, blank-password, wrong-credentials and rate-limit cases. They are outside Phase 12 and were not modified. Existing warnings include Vite's configuration-loader warning and Node/Jest `punycode` deprecation. Metro also reports the existing missing `assets/icon.png`, two package-update notices, and inherited terminal color-variable warnings; these are outside Phase 12. No new JavaScript console error was observed during the verified device flows.

Sandbox limitations were diagnosed rather than retried unchanged: Jest stalled there, ADB could not start its daemon, and Hermes could not write its temporary binary. Host execution completed all three kinds of checks. Intermediate implementation diagnostics were fixed before final validation; the final owned diff has no new type/lint/test/build findings.

## ADB observations

The verified MuMu configuration identifies instance 3 as `dologram`, Android 12, ADB `127.0.0.1:16480`, package `com.dologram.app`. The historical plan serial is stale. No other emulator was operated. `native-tools.py` contains bounded, device-specific helpers; it has no polling/retry loop.

The app was loaded from the local Metro server on 8092 with ADB reverse. An offline-only fixture chat and PNG/text files were inserted only in the assigned emulator, using its existing signed-in test session; no hosted chat/message was created. Wi-Fi was confirmed off before enqueue. Native screenshots/UI XML prove:

- `chat-initial`: themed composer and offline banner.
- `attach-menu`: photo, video, gallery and file entries.
- `gallery-picker` through `test-image-folder`: Android picker and navigation to only the seeded PNG.
- `draft-final`: selected image, filename, removal control, `1 / 10`, attachment-only Send.
- `queued-final`: one queued photo, local preview and queued caption; SQLite also reported `queued`.
- `photo-viewer`, `photo-zoom`: private local preview opens and zoom works; rendered screenshot was inspected.
- `restart-persistence`: the queued item and photo preview survived force-stop and reopen while offline.

An earlier send observation coincided with Fast Refresh and changed navigation; it was not counted as a pass. With source edits paused, the independent final queue/viewer/restart checks above passed. Android's system SQLite CLI lacks `json_extract`; the verification used plain SQL and Python JSON parsing instead. Neither diagnostic changed app code to accommodate the test tool.

Voice-recording gestures were attempted, including observing a longer hold, but did not yield a verified native recording. No claim is made that native recording, playback, video capture or sharing passed. These remain optional device checks; the recorder's permission, hold/release, duplicate-release, cancellation and preparation-race behavior pass targeted automated tests. Camera permission was initially ungranted and microphone permission granted; these permissions were not changed.

The emulator's Android services stalled on the optional mobile-data command. A bounded ADB reboot also timed out. After reading the installed manager's help, `MuMuManager.exe control -v 3 restart` succeeded and boot completion was verified. The local fixture/test files/private queue copies were then removed and original enabled Wi-Fi restored; final cleanup evidence is recorded below.

Final cleanup verification: ADB reconnected to the same instance after the Wi-Fi transition; boot completion was `1`, Wi-Fi setting was `1` (enabled), and the fixture chat count was `0`. Original account session and camera/microphone permissions were retained. Task-owned export directories were removed after verification; successful build logs remain.

`final-clean-state` shows the original empty chat list after cleanup, with no offline banner. App-specific logs show React Native's native development-client startup `onWindowFocusChange` SoftException before `Running "main"`; this native startup warning remains outside Phase 12, and no JavaScript console error was observed in the verified media flows. The final 25 implementation/test source hashes match their verification identities.

## Acceptance

| Criterion | Status |
|---|---|
| Picker entry points, refusal/cancel/type/size/count behavior | Met in code/tests; gallery also observed on MuMu |
| Draft strip/count/remove/attachment-only Send | Met in render tests and device observations |
| Private multi-file enqueue and failure cleanup | Met in targeted tests; single-photo durable enqueue/restart also observed |
| Cached media, per-missing-row placeholders, pending/deleted/access behavior | Met in source/query tests and photo device flow |
| Photo viewer and zoom controls | Met on device; two-finger pinch remains optional manual verification |
| Video/inline voice/file sharing implementation | Met in source/type validation; full native flows pending manual verification |
| URL expiry, explicit retry and cleanup | Met in fake-clock tests; hosted expiry test pending manual verification |
| T-11/T-20/T-52 hosted multi-account/cross-client/bucket behavior | Pending manual verification, optional |

## Optional remaining verification

1. Start Metro for the mobile workspace and reverse its port to the `dologram` instance. In a member chat, deny/allow camera permission, capture photo/video, record/release/cancel voice notes and deny microphone permission. Confirm visible refusal messages and retained drafts after failures.
2. Select permitted documents, remove/re-add drafts, send a caption with several attachments, and open a file through the Android share sheet. Play video and inline voice, inspect progress/restart/1x/2x, leave/background the screen and confirm playback stops. Pinch/pan photos to both zoom limits.
3. With A/B/C fixtures and hosted media schema/Storage/RLS available, run T-52 across clients and its exact bucket byte/type boundaries. Run T-11 as non-member C and test issued-URL expiry with a short injected lifetime. Run T-20 under throttling and T-07 during upload with force-stop.

Hosted Auth currently reports `mailer_autoconfirm=false`, contradicting the plan's earlier confirmation-off note. An attempted example-domain test signup was rejected (`email_address_invalid`); no new session or account was installed, and no owner email or external configuration was changed. Original filenames are absent from the media schema: drafts show picker names, received file rows use the stored object identifier plus real Storage MIME/size. Cross-client original filenames need a separately agreed metadata contract.

## Progress

Current phase: 100% implementation, available checks and documentation; optional manual checks remain. Overall: 13/20 Android phases, 65%. Phase 13 client work is ready; its independent M3-08 hosted prerequisite still needs verification. No later phase was started.
