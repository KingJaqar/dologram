# Calling plan polishing context index

Date: 2026-11-11 (Asia/Manila). Scope: source inspection and refinement of the existing voice/video implementation plan only. No application implementation or environment operation was authorized or performed.

## Entry points and identities

- Revised plan: `Plans/DoloGram_Voice_Video_Calling_Implementation_Plan.md`.
- Recoverable pre-polish plan: [plan-before.md](plan-before.md). It contains the original planning text only.
- Initial working-copy status: [git-status-before.txt](git-status-before.txt); branch `main`, application/Plans/docs largely untracked, no tracked/staged application diff reported. A committed revision cannot stand in for these inputs.
- Exact initial identities: [source-baseline.json](source-baseline.json), SHA-256 for 288 application/configuration/instruction/evidence files, including untracked sources. Fingerprinting does **not** claim each file was read or tested.
- Concurrent-change refresh: [source-refresh.json](source-refresh.json), initial/current hashes and affected paths. Changes appeared after the initial fingerprint. This task did not modify them. See freshness below.
- Prior polishing-pass static document checks: [validation.json](validation.json). Current second-pass audit checks: [audit-2-validation.json](audit-2-validation.json). Initial check output retained separately as [validation-first.json](validation-first.json); its preservation assertion failed because of concurrent edits, not task application writes. Do not turn that initial result into an unchanged-source claim.

## Applicable instructions and scope rules (S0)

Read completely: `supabase/AGENTS.md` and `apps/mobile/AGENTS.md`. No root/ancestor AGENTS or CLAUDE.md was found by the bounded discovery. No new mandatory repository-wide packet workflow was found for this calling plan. Existing Android phase reports used scoped Repomix packets; they are historical reference workflows, not authority to run another phase.

Required migration numbering preserves applied versions and checks target history. Mobile instructions require versioned Expo docs, Expo-compatible installation and lint/typecheck during implementation. Actual routes are under `apps/mobile/app`, despite generic `src/app` wording. Existing Android plan Sections 1-3.3 and Phase 17 were inspected for owner constraints: MuMu-only device work, EAS cloud-only native builds, and historical upload/verification restrictions. The latest user request governs this polishing pass and calling verification integrity. Do not inherit optional-manual completion or physical-phone language.

## Scoped source groups and inspected locations

Use these groups as the phase context inputs. Paths are relative to `G:\codebase\DoloGram`; full content identities are in the manifests. Ranges/symbols specify actual inspected scope, not a whole-file-read claim for large sources.

| Group | Inspected source locations | Findings / consumers |
| --- | --- | --- |
| S1 — stack/config | `package.json`; `apps/mobile/package.json`, `app.json`, `app.config.js`, `eas.json`, `tsconfig.json`; `packages/shared/package.json`; `docs/versions.md` SDK/native tables; migration/config filenames; PATH discovery | Expo ~57.0.32 / RN 0.86.3; npm workspaces; no LiveKit in manifests. Existing development/preview APK profiles. Generated Android directory and `apps/mobile/dologram-dev.apk` exist; binary compatibility/approval is unverified. Node/npm, ADB/EAS found; Deno/psql/Supabase CLI not on PATH. No binary/device/tool service was launched. |
| S2 — database/contracts | `supabase/migrations/016_align_messenger_schema.sql` lines 1-178 and 316-449; `018_enable_saved_messages_self_chat.sql` complete; `023_notification_delivery_preferences.sql` complete; 022 table contract and current migration filenames; shared database type/repository discovery; `supabase/config.toml` | Current keys `chats.chat_id`, `chats.type`, membership/auth IDs; private membership helper; saved messages can be one-member direct chats. No call/rate/scheduler schema in scoped discovery. Message push channel constraint cannot be reused for calls. Current versions 025 group avatars / 026 shared nicknames. Deployed history uninspected. |
| S3 — auth boundaries | `AuthProvider.tsx`, `accountSession.ts`, `useAccountSwitch.ts`, `storage/localData.ts` complete; settings sign-out around 124-162; manage-accounts removal/logout around 185-241; AccountSwitcherPopover sign-out around 103-141; sign-in/up activation caller search; root layout complete across explicit chunks | Account replacement uses `activateAccountSession`; multiple direct `auth.signOut` callers bypass local-data clearing. Cleanup needs pre-change old-JWT hook plus generation guards. Auth guard distinguishes signedIn/mustChangePassword. |
| S4 — UI/audio | `VoiceRecordButton.tsx`, `VoiceNotePlayer.tsx`, `VideoPlayback.tsx` complete; `TopBar.tsx` relevant props/styles; `Button.tsx` props/sizing; `ThemeProvider.tsx` accessibility interface; `chat/query.ts` snapshot type; chat route header; chat-info preferences/block/history-entry sections; `netState.ts` and `lowSignal.ts` complete; `chats/preferences.ts` preference/update/pinning boundaries; Icon.tsx and shared icon map re-read completely after concurrent refresh | Recorder preparation/finally audio-mode changes can race call acquisition; pause-on-blur is insufficient once a call is minimized. Global provider must be outside chat route lifecycle. Current local block/preferences are device-only. Icon renderer has explicit registry; adding only semantic names yields null glyphs. Preserve concurrent asset-backed star work. |
| S5 — notifications | `pushNotifications.ts` lines 1-112, Android channel setup 113-132, lifecycle/responses 261-end; `notifications/preferences.ts` complete; existing send-push function auth/recipient/delivery sections and active-user helper contract; `supabase/functions/sign-in-username/index.ts` auth/config preamble; notification payload test sample | Existing optional-native capability loading, startup response replay/clear, message-only foreground handler/channel matching and active-account delivery checks. Call-specific foreground handling, channel registration, preference projection, state validation and expiring dispatch are missing. Secrets were not read. |
| S6 — verification harness | mobile `jest.config.js` and `eslint.config.js`; shared `vitest.config.ts`; `scripts/scan-mobile-bundle.ps1` complete; SQL test headers/fixtures/role assertions; Deno payload test sample; account-switch/notification/media test imports/mocks and assertions sampled | Existing npm scripts confirmed; SQL transactional tests, no confirmed pgTAP runner; Deno tests present but executable absent from PATH. Scanner currently covers Supabase/admin patterns, so future implementation must add LiveKit patterns. Existing test sample mocks are synthetic; no real credentials collected. |
| S7 — historical evidence | `docs/test-results/android/phase-17.md` and `phase-17/context-index.md` complete; Phase 16 relevant result/remaining-verification tail; `docs/builds.md` complete; relevant Android plan Phase 17 | Reports typecheck/shared/export/scan passes, pre-existing sign-up lint failure, full-Jest hang, and blocked EAS upload. These are dated historical reports, **not** current passes or source-matched calling evidence. Build ledger is not current quota. Latest reported MuMu endpoint differs from original serial; live identity remains unresolved. |

## Reusable-context validation and exclusions

The existing compressed `repomix-phase17-final.xml` hash matches its index: `A50A285A8A47EBAE8EF0D760E34698152612128525AC92AAB33B876B2388B3D2`; 120 file entries. Its header and selected manifests were checked. Root package/EAS text matches current source, but the mobile manifest was not identical as serialized, and both `supabase/AGENTS.md` and current migration 026 are absent. Therefore the packet is not accepted as a complete fresh calling context. It was not read in full, and no claim of complete packet analysis is made. Original sources above close the relevant gaps. No new packet was generated because targeted reads plus identity manifests cover this planning scope; no usage-savings claim is made.

Excluded from content reads/packets: `.env` and credentials/signing directories, auth/account stores, native generated project contents, node_modules, binary media/APK contents, dist outputs, unrelated large repomix packets and DOCX files. Directory/filename discovery and hashes do not establish deployed/native runtime state. Required source chunks that were truncated in early combined output were followed by narrower reads of needed sections; uninspected ranges are not relied on as verified behavior.

## Freshness and concurrent edits

The initial preservation check found concurrent edits in folders UI/repository and shared strings/icons/renderer. Their before/current hashes are retained in source-refresh.json. Re-inspected the complete `Icon.tsx`/semantic icon map and searched current strings/call/folder relationships. Folder-only behavior remains out of scope; no folder code or asset was changed. Refreshed calling finding: Phase 3 must update both icon map and renderer registry and preserve asset-backed star behavior. Earlier findings remain valid where dependent source identities still match; no old test passes were reused for changed code.

If a relevant file changes again, invalidate its findings and refresh that source/dependents before implementation. Do not regenerate unchanged context or restore a concurrent edit. The task's write operations target only the existing plan and this artifact directory.

## Current findings and unresolved prerequisites

The plan preserves one-to-one Android-first calling with foreground, push and native-background milestones. It now contains CALL-01 through CALL-18, V0-V8 verification mapping and Phases 0-8 phase contracts with five equal-weight required items. None is implemented or passed by this review.

B1 dedicated database/history/fixtures; B2 compatible native artifact, upload authority/current quota; B3 assigned MuMu identity and permitted peer; B4 approved SQL/Deno/mobile runners; B5 test provider/webhook/Cron/push configuration; B6 later Android native bridge/state matrix. Evidence, affected requirements, recommended next action and independent work are centralized in plan Section 14. No prerequisite requires a question during plan polishing.

Separate findings: old Android release gate, sign-up lint, historical Jest hang, root gen:types placeholder, broad direct-chat/block/web/admin/iOS work. Do not repair these to complete the calling plan.

## Official references checked during this pass

- Expo SDK 57 index and llms.txt; LiveKit Expo guide (native dependency/plugin candidates and development-client requirement).
- LiveKit token grants/lifecycle, JS RoomServiceClient/RemoveParticipantOptions, Room Service revocation seconds/cutoff, server SDK Deno support, and webhook delivery/verification.
- Supabase function authentication and Cron/quickstart, including documented second-based schedules; actual target installation is unresolved.
- LiveKit published Build quotas (5,000 participant minutes, 50 GB downstream, 100 participants); project allowance/remaining budget uninspected.
- Expo notification behavior and Android Core-Telecom/foreground-service reference pages for Phase 7 discovery; no bridge or native integration was selected or verified.

Direct URLs are cited beside claims/discovery instructions in the plan. Public documentation is evidence of documented capability, not proof of app/version compatibility.

## Verification status for this planning pass

- Source/instruction/configuration inspection: completed for the locations above; unresolved external state explicitly recorded.
- Static requirement/phase/Markdown/local-link/source-refresh checks: see validation.json for exact result and final plan hash.
- Initial whole-baseline unchanged assertion: failed because concurrent source edits were detected; diagnostic retained, relevant dependencies refreshed. No application edit was made by this task.
- Application lint/typecheck/tests/export/native build/migrations/services/device/cloud access: **not run**, outside the requested plan-refinement boundary. No implementation completion or phase percentage is asserted.


## Second-pass quality audit — 2026-11-11

Scope: candidate-plan audit only; no implementation, operational verification, emulator control, build, migration, service or application test run. The user's new standing testing authorization is recorded in plan Section 0: main MuMu Player dologram, ADB-only, autonomous authorized test-account/login/data/reset/install operations, no repeated approval, and pending checks must not halt independent execution. It applies when execution is requested, not during this audit.

Reused this index, both unchanged AGENTS files, prior validation/decision records and unchanged source findings. Verified current identities against the prior manifest/refresh; did not regenerate/read a large packet. [audit-2-sources.json](audit-2-sources.json) records changed and newly relevant source identities. Read only current manifest versions/scripts, changed Jest configuration, and new migration 027 to resolve specific freshness uncertainties. Confirmed the new referenced test mock exists; its runtime result is unverified. Preserved changed header/lockfile/user files without unrelated inspection or modification. Prior S1/S2/S6 facts are supplemented as follows: SDK/RN/scripts remain unchanged; Jest now has a Reanimated mock mapping; migration numbering now ends at 027. Previous historical test statuses remain historical.

Candidate snapshot: [audit-2-before.md](audit-2-before.md). Material repairs, with reasons and affected sections, are logged in plan 14.1. They cover lifecycle vs token retries, ownership-aware snapshots/teardown, late provisioning/deletion cleanup, logical duration-cap enforcement during provider outage, optional-preview scope, Phase 7 selection/background lifecycle, backward Phase 5/Phase 6/Phase 8 dependencies, standing authorization and independent-work rules. Original one-to-one Android-first goal and required verification/progress safeguards are preserved. Five equal-weight work items per phase remain the denominator; no execution percentage is reported.

Final classification in plan 14.4: **Ready for execution starting with Phase 0**, not implemented/operationally verified/release ready. B1-B6 are later technical/resource gates with affected requirements, exact next actions and independent work, not blanket pre-execution blockers. Phase 0 starts by preserving current inputs and establishing a bounded current baseline; no emulator/account-testing permission needs renewal. The audit stops at that readiness gate; no further polishing cycle is initiated.

Static artifact checks and final plan identity: [audit-2-validation.json](audit-2-validation.json). Application/runtime results remain **not run**. Source/content differences due to concurrent user work are preserved rather than misreported as unchanged application files. Only this plan and necessary context artifacts were written by the audit.

Final freshness boundary: additional concurrent `BottomSheet.tsx`, `ChatComposer.tsx` and `MediaPickerPanel.tsx` edits were detected in the closing fingerprint and preserved. Their contents were not re-audited or assumed unchanged. Phase 0 must refresh affected S4 caller/consumer context before implementation, as already required by Sections 0 and 14.4. This does not prevent starting Phase 0 or constitute evidence that those edits pass/fail any behavior. The audit ends at its assessed readiness gate.

## Conditional owner setup checklist — 2026-11-11

Added plan Section 15 in response to the owner request. OWNER-01 through OWNER-04 cover only genuinely missing LiveKit account/project access, isolated Supabase/secret-management access, replacement-artifact/cloud-build access, and later Firebase/FCM setup. Existing authorized configuration and account access must be reused first. Human verification/MFA remains owner-side only when required; ordinary cloud setup and all standing ADB/account/data testing remain agent work. No missing owner action is currently confirmed. This adds no execution phase or runtime work and does not reopen the completed audit.

Consulted current official LiveKit project/authentication references, Supabase Edge Function secrets documentation and Expo FCM V1 credential documentation; URLs are cited in Section 15. Distinguished Android google-services.json configuration from the private FCM service-account key; neither credential contents nor account secrets were accessed. [owner-checklist-validation.json](owner-checklist-validation.json) records current plan hash and static preservation/checklist checks. Prior audit validation is historical to its plan hash. No application source, service, build, migration or emulator operation was performed.

## Phase naming update — 2026-11-11

Renamed the current plan phases to Phase 0 through Phase 8, including requirements, dependencies, gates, owner checklist and readiness references. Proposed phase evidence filenames are phase-NN.md (00 through 08). Scope, order, work items and acceptance requirements are unchanged. Historical snapshots/validation records retain their original labels and hashes. Current structural verification and plan identity: [phase-naming-validation.json](phase-naming-validation.json). No application or operational changes were performed.
