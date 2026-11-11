# Phase 12 context index — 2026-11-10

Workflow: Git baseline → ripgrep discovery → Reader validation → scoped Repomix → Reader XML analysis → original-source verification. Shared workflow rules remain in the execution request; this index records only phase facts.

## Checklist

- [x] Scope: M3-03, F5, AND-08/09, CMP-11; no Phase 13 policy/compression/toggle work.
- [x] Prerequisite: Phase 11 queue copies before enqueue, text-first upload/link ordering, retry recovery and signed URL helper confirmed in source.
- [x] Context inputs: plan overall sections 1–4 and full Phase 11; Phase 12 overview; v14 requirement rows and CMP-10/11 specifications; mobile instructions; actual dependency manifests.
- [x] Baseline checks started before implementation; logs retained alongside this index.
- [x] Acceptance: picker/permission/validation, draft strip, durable send, per-attachment display, zoom/playback/share, expiry/error recovery, automated checks and available MuMu checks. Optional unperformed native/hosted flows are explicitly pending in the phase report.

## Ownership and recoverability

Branch `main`, HEAD `96d0fca`. Application, shared package and plan were already untracked. `git-baseline.txt`, `tracked-baseline.patch`, `source-baseline.json` and `source-baseline.zip` identify and recover the existing source. Environment files are ignored and excluded from snapshots/context. No commits, pushes, deployments, remote migrations or external configuration changes are authorized.

## Packet identity and completed reads

- Cached Repomix 1.18.1; `repomix-phase12.xml`, 20 entries, 52,421 characters, estimated 14,243 tokens (not measured model usage). Security scan passed. Selectors and generation output: `repomix-generation.log`.
- Parsed entries extracted into `packet-reader.txt`: 45,629 characters, completely read at boundaries [0,12000), [12000,24000), [24000,36000), [36000,45629). One extraction error was corrected; the final continuation was read separately after a combined output exceeded its budget.
- Intended 20 files match actual entries; no unexplained omission. Plan was read directly, rather than adding its unrelated completed phases to the packet. The requirements extract preserves the cited v14 rows. Repowise is unavailable and was not used.
- Compression omits JSX, function bodies and constants. Original-source gaps resolved: full ChatComposer, MessageBubble, BottomSheet, queue attachments, media repository, query; chat route send/render/edit/action consumers; worker delivery bodies; SQLite media table and generated media type; config MIME lists; theme and Button contracts.
- Baseline hashes are in `source-baseline.json`; packet hash and included-source identities will be recorded in `packet-manifest.json`. New/changed files require fresh review, not reuse of their baseline conclusions.

## Initial requirement classification

| Requirement | Before implementation |
|---|---|
| Camera photo/video, gallery and document flows | Not started; disabled controls |
| Hold-to-record voice and permission refusal | Not started |
| Draft preview/remove/count and attachment-only send | Not started |
| Durable attachment enqueue/upload | Done in Phase 11, verified in source |
| Delivered media rows, pending previews and individual placeholders | Partially done; aggregate placeholder only |
| Photo zoom, video/voice playback, Android file share | Not started; viewer placeholder |
| Signed URLs | Partially done; authenticated 600-second helper exists, consumer refresh absent |
| Size/type/count validation | Partially done; shared validators exist, picker boundaries absent |

## Discrepancies and decisions

- Plan ends after Phase 11. Reconstruct only Phase 12 from its overview and v14; do not add later phases.
- Instructions describe `src/app`, while the established Expo Router root is `apps/mobile/app`. Modify the existing route in place; creating a second root would hide the established navigation.
- AND-08 mentions Low Signal compression, assigned explicitly to Phase 13 by the overview. Phase 12 connects to the existing queue; leaves that policy to Phase 13.
- v14's expo-av fallback is superseded by the plan's explicit Expo Audio/Video requirement.
- v14 media schema has no filename, MIME or byte-size columns. Actual Storage metadata supplies MIME/size; the media id is the durable received file name. Draft strips retain picker names. Cross-client original filenames require a separate metadata contract.
- Device identity changed: MuMu instance `MuMuPlayerGlobal-12.0-3/configs/extra_config.json` names `dologram`, its `vm_config.json` maps port 16480, and ADB sees the installed `com.dologram.app` there. Use `127.0.0.1:16480`; do not operate other instances.

## Documentation

Read Expo SDK 57 ImagePicker, DocumentPicker, Audio, Video, FileSystem, Sharing and Router pages, plus Expo llms index; React Native 0.86 Image/PanResponder and React effect documentation. Verified actual installed TypeScript signatures, notably the DocumentPicker page's inaccurate component label versus the installed `getDocumentAsync` function. Supabase skill and Storage signed-URL docs read; existing client is supabase-js 2.119.0.

## Baseline findings

- Typecheck: pass both workspaces. Shared tests: 130/130 pass; existing Vite config warning.
- Full lint: pre-existing sign-up errors (2) and unused-variable warning (1).
- Sandboxed mobile Jest stalled and was stopped. Host baseline: 46 passing tests, 6 failing tests, 7 passing suites and 2 failing suites; exact failures are in the phase report.
- Sandboxed export transformed 3,747 modules then Hermes could not write its temporary output. Host baseline export passed with two workers.
- Sandboxed ADB could not start; host ADB succeeded. Device/backend flows remain to be exercised after implementation.

## Final verified context

- Source reads: full existing composer/bubble/BottomSheet/attachment enqueue/media repository; full chat query; chat route imports/state, load/subscriptions, send/edit/reaction/delete handlers, message renderer, composer and action consumers. Original schema migrations V1–V4 and media row types checked. New media helpers/components and their effects/styles/cleanup reviewed in full; unchanged unrelated auth screens were not edited.
- `packet-manifest.json` binds packet entries to their pre-edit source hashes, separately records current hashes, and marks changed entries. The original compressed analysis of those changed entries is superseded by current source review and `owned-existing.diff`; unchanged entries remain valid. `final-source-hashes.json` identifies the final implementation/test sources. `review-owned.py` verified all 158 original inputs recoverable by content hash, despite duplicate base filenames in the snapshot ZIP.
- Final typecheck: pass both workspaces. Shared tests: 137/137, 18 files. Phase 12 mobile tests: 24/24, 6 suites; focused recorder after its final layout fix: 4/4. Full mobile suite: same 6 baseline auth failures, 70 passing tests; no Phase 12 failures. Full lint unchanged at 2 errors/1 warning in sign-up; scoped lint passes. Final host Android/Hermes export passes. Logs retain full diagnostics; no checks are claimed from prior sessions.
- Available MuMu acceptance: real attach menu/gallery, draft name/preview/count/remove controls, attachment-only offline enqueue, local preview/status, photo viewer/zoom, and force-stop/reopen persistence passed. Voice recording gestures did not establish a native recording and are explicitly pending; video/voice playback/share/pinch and hosted A/B/C tests are optional pending manual verification. Unit tests verify permission refusal, cancellation, preparation races, upload echo, member/deleted guards and URL refresh/cleanup.
- Hosted Auth reports `mailer_autoconfirm=false`; example-domain signup was refused. No account session was replaced or external configuration changed. No hosted chat or message was created.
- MuMu's mobile-data service command stalled; bounded ADB reboot timed out; installed manager help supplied the successful instance-3 restart. Final cleanup removed only the fixture, its private queued files and seeded media. ADB reconnected after Wi-Fi restoration: boot complete, Wi-Fi setting 1 (enabled), fixture count 0. Original session/permissions retained.
- Generated task-owned baseline/final export directories were removed after their successful validation; logs and source recovery evidence remain. Phase 12: complete for implementation/available checks/documentation. Optional steps and scope discrepancies are recorded in `../phase-12.md`. Phase 13 was not started.
- Final cleanup screen returns to the original empty chat list with connectivity restored. Native dev-client startup logs contain an `onWindowFocusChange` SoftException before JavaScript starts; it is recorded as an out-of-scope native startup warning. No JS console error was observed in the verified media flows. All 25 final implementation/test hashes still match.
