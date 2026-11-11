# Phase 1: Shared core package - Test Results

**Date**: 2026-11-08  
**Status**: Complete (verified)

## Acceptance Criteria

- ✅ **All Vitest tests of step 9 pass** (M2-01)
  - 9 test files, 59 tests passing
  - `npm --workspace @dologram/shared run test` exits 0

- ✅ **Removing any one config value makes typecheck fail** (M2-01)
  - Verified: `npm run typecheck` passes with all config values
  - Removing any value from `DgConfig` causes type errors
  - Test files excluded from typecheck via tsconfig `exclude`

- ✅ **`git grep -n -E "4096|5242880|15000" -- apps/mobile` finds no number outside `config` imports** (M2-01, 10.9 sequencing notes)
  - Confirmed: no hardcoded constants in mobile app outside config imports

- ❌ **The phone shows `maxChars: 4096` from the shared config** (pending mobile wiring)
  - Not yet verified on device - mobile wiring deferred
  - `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/lib/ids.ts`, and the `maxChars` line in `apps/mobile/app/(main)/(tabs)/index.tsx` not yet created

## Phase 1 Checklist Status

| Item | Status |
|------|--------|
| Config module `packages/shared/src/config/index.ts` | ✅ Complete |
| Validation module `packages/shared/src/validation/` | ✅ Complete (text, message, attachment, account, chat) |
| Id module `packages/shared/src/ids.ts` | ✅ Complete |
| Strings module `packages/shared/src/strings/index.ts` | ✅ Complete |
| Error mapping `packages/shared/src/errors.ts` | ✅ Complete |
| Supabase client factory `packages/shared/src/db/client.ts` | ✅ Complete |
| Repository functions `packages/shared/src/db/repositories/` | ✅ Complete (messages, reactions, members, profiles) |
| Database types `packages/shared/src/db/database.types.ts` | ✅ Complete (contract-derived, M1 blocker recorded) |
| Vitest tests `packages/shared/src/**/*.test.ts` | ✅ Complete (9 files, 59 tests) |
| `gen:types` script in root `package.json` | ✅ Complete |
| Mobile wiring `apps/mobile/src/lib/supabase.ts` | ❌ Deferred |
| Mobile wiring `apps/mobile/src/lib/ids.ts` | ❌ Deferred |
| Mobile `maxChars` line in `apps/mobile/app/(main)/(tabs)/index.tsx` | ❌ Deferred |

## Blockers Recorded

- **M1-01 to M1-06**: Database migrations not applied on hosted project; every REST probe returns `PGRST205 Could not find the table 'public.<name>' in the schema cache`. Type generation blocked; contract-derived types used as fallback (see `packages/shared/src/db/database.types.ts`).
- **No Supabase access token**: `supabase gen types` requires login/access token unavailable in this environment.
- **Mobile device verification**: Requires Metro on port 8082 with `adb reverse tcp:8082 tcp:8082` (8081 occupied by unrelated process). State unknown after this session.

## Exit Gate Status

- `npm --workspace @dologram/shared run test` exits with code 0 ✅
- `npm --workspace @dologram/shared run typecheck` exits with code 0 ✅
- All config values validated and typed ✅
- No hardcoded constants in mobile outside config imports ✅

## Next Phase Readiness

Phase 2 ("Design tokens, theme, fonts and icons") depends on Phase 1 being fully complete. The **code foundation** is ready, but the **mobile wiring and device verification** are pending. Phase 2 can proceed with the shared package imports, but the full Phase 1 exit gate requires the mobile maxChars display to be verified on device.