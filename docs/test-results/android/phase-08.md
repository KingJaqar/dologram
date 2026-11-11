# Android Phase 8 — New chat, new group and chat info

Date: 2026-11-10 (Asia/Manila)

## Scope

Phase 8 only: M2-07, AND-10, AND-11, AND-12, D-42, D-46, D-58, D-70, D-91, D-124 and the Android share of T-38. Phase 9 chat messaging and Phase 14 archive/mute/folder actions are out of scope.

## Repository and context validation

- Repository instructions: `apps/mobile/AGENTS.md` applies. No `CLAUDE.md` was found.
- The source plan ends after Phase 7 even though its overview lists Phase 8. The Phase 8 requirements were reconstructed from the overview and v14 contracts and added back to the plan.
- Phase 0 through Phase 7 are marked complete in the plan and their phase result files exist. The current source confirms the Phase 7 cache/query/sync exports consumed by Phase 8 (`loadChatListRows`, `cache_profiles`, `resyncNow`, cache-change notifications).
- A scoped `repomix-phase8.xml` packet was generated from the plan, mobile instructions, Phase 8 routes/helpers/components, shared chat/repository contracts, sync/cache dependencies and Phase 7 result. The refreshed packet contains 54 selected files and 5,617 lines; its relevant entries were read before original-source verification.
- Expo SDK `~57.0.32`, Expo Router `~57.0.30`, React Native `0.86.3` and the matching versioned Expo Router/SQLite documentation were checked before source validation.

## Implemented behavior

- New chat performs exact username lookup, shows the single result/no-result/error states, disables Find offline, reuses an existing cached direct chat, and follows the D-124 direct-chat insert order when creating one.
- New group validates the title, counts code points, offers only people from shared cached chats, caps selection at 99 besides the creator, creates the chat/member rows online, reports rejected member inserts, and opens the group.
- Chat info reads cache-first, renders direct/group identity and roles, shows loading/error/empty/offline states, allows only group owners to add/remove members, lets any group member leave after confirmation, and deletes the local cache after leave.
- Contact and member rows expose the required checkbox, disabled, role and Remove accessibility state.
- Mute, Archive, folder actions and message behavior remain deferred to their owning phases.

## Checks run

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS; mobile and shared workspaces exit 0 |
| `npm --workspace @dologram/shared run test` | PASS; 15 files, 125/125 tests |
| `npm --workspace @dologram/mobile run lint` | PRE-EXISTING; only `app/sign-up.tsx` reports 2 errors and 1 unused-variable warning |
| Mobile Jest full suite | PENDING/ENVIRONMENT; no output after 60 seconds, stopped to avoid a test loop |
| Phase 8 `PeopleRows.test.tsx` | PENDING/ENVIRONMENT; same Jest startup hang, stopped |
| `npx expo export --platform android` from repo root | PRE-EXISTING INVOCATION FAILURE; root resolves Expo's `../../App` entry instead of the mobile Router app |
| `npx expo export --platform android` from `apps/mobile` | PENDING/ENVIRONMENT; Metro started but produced no completion within 60 seconds, stopped |

## Device verification

The plan names `emulator-5554`, but it is not present in the current ADB inventory. The connected MuMu Android 12 instance with `com.dologram.app` is `emulator-5560`; no other emulator was modified. A fresh live route run was not completed because the development bundle/Metro server was unavailable. Existing Phase 8 screenshots under `docs/test-results/android/phase8_shots/` were reviewed as prior evidence only.

## Optional remaining verification

Pending and non-blocking under the owner instruction:

1. With accounts A, B, C and G on the hosted M1 schema, run T-38: duplicate A–B direct chat, third direct member, A adding C to a group, B leaving, owner leaving/ownership transfer, invalid `channel` chat type, 101st member, unauthorized owner row, and A foregrounding after removal.
2. On `emulator-5560`, start the Expo development build with Metro, sign in as A, open New chat and New group, exercise the successful and offline/error states, create a group, open Chat info, add/remove a member as owner, and leave the group. Capture the route and cache-prune result.

## Status

Phase 8 is complete for client implementation, source validation, documentation and available automated checks. Optional hosted-backend and fresh-device verification remains pending and does not block Phase 9.
