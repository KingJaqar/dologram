# DoloGram User Web — Phase 9 Context Index

Phase: 9 — Settings dialog, theme setting and sign-out (WEB-14, F1, D-51, D-83, D-109 (5), D-W17, T-10, T-40 theme, T-49, TW-08).
Status: complete for required local/automated checks; optional D-W26 observations not run.
Evidence: `supabase/repomix/user-web-phase-09-20261116/pack.xml` (22 files, 162,455 chars, security check clean), `docs/test-results/web/phase-09.md`.

## Verified findings

| ID | Finding | Source |
|---|---|---|
| F-9-01 | Settings/Profile triggers already open the `settings` overlay from the rail and tab bar; the overlay is history-backed, one Back per overlay. | `features/shell/OverlayProvider.tsx`, `components/NavRail/NavRail.tsx`, `components/TabBar/TabBar.tsx`, `lib/useOverlayHistory.ts` |
| F-9-02 | Theme is applied before paint from `dg.theme`; `setThemeSetting` applies immediately and returns a persistence error; `useThemeSetting`/`useResolvedTheme` are the only readers. | `theme/ThemeScript.tsx`, `theme/useTheme.ts`, `theme/useTheme.test.tsx` |
| F-9-03 | Shared icons have no `theme.*` names; browser-only mapping must not change the mobile semantic map. | `packages/shared/src/theme/icons.ts`, `components/Icon/Icon.tsx`, `components/Icon/Icon.test.tsx` |
| F-9-04 | Sign-out already ran through `SessionController.performSignOut` plus a registered account-store cleanup; `lib/session/signOut.ts` did not exist. | `lib/session/session.ts`, `lib/store/StoreProvider.tsx` |
| F-9-05 | The wipe owner is `IndexedDbStore.wipe()` → `clearAccount()` (logical clear of all owner rows, identity reset) → bounded `deleteDatabase` returning `retained`. | `lib/store/IndexedDbStore.ts` |
| F-9-06 | The retained-cleanup record used a private constant in `session.ts`; startup never retried the blocked deletion. | `lib/session/session.ts` (pre-edit) |
| F-9-07 | `strings.settings` already provides Appearance/Theme/System/Light/Dark/Chats/Account/About/Change password/Sign out/`signOutBody(count)`/`signOutTitle`/`signOutConfirmBody`; `strings.common.noConnection` exists and `cancel` did not. | `packages/shared/src/strings/index.ts` |
| F-9-08 | Installed `@supabase/auth-js` sign-out with `scope: 'local'` removes the local session first and then attempts the revocation request; a fetch failure is returned as an error without restoring the session. | `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` |
| F-9-09 | Playwright 1.65.1 `check()` clicks the control's centre, so a clipped native radio is intercepted by the visible label. | `e2e/theme` failure log |
| F-9-10 | Next 16 client navigation needs an RSC payload, so an offline route change fails; C-5 excludes service workers. | `e2e` offline log, plan C-5 |

## Source identities (SHA-256, post-edit)

| File | SHA-256 |
|---|---|
| `apps/web/src/features/settings/SettingsDialog.tsx` | `7d5124bab1ee19cb5895bf7cf015dbb6a523930736bc0ebcb7a51bada341a944` |
| `apps/web/src/lib/session/signOut.ts` | `98213595d149c8c1a6c2df82420c8f26fedea532a344daef3fdb42bf938ebca6` |
| `apps/web/src/lib/session/session.ts` | `db188e94ee611be91878a9a6ac841e95b6ec8e24cd6bea92a4ef8da3eb56f93c` |
| `apps/web/src/lib/session/RouteGuard.tsx` | `3206fac204693748cb347ebaf45589490b84a2f84c222b1cb3d530fde17630d0` |
| `apps/web/src/lib/store/IndexedDbStore.ts` | `b4bf3a4b2076e2a37ba624e2d40a8b9eaf2d7a46b3f7447a45514d94de426dc0` |
| `apps/web/e2e/phase-09-settings.spec.ts` | `b34846c804297be13580ba3b309950a0ad1035d70ef40d284d8832e04e9a56c4` |
| `packages/shared/src/strings/index.ts` | `3609fb11d57d58af46a2c4e7a123f26f742c6135623a9e9143075dd238ebecf7` |
| `apps/web/next.config.ts` | `457cfd4ef244df8667813f9cd9d677f084c4d435cd74424a0721e30aab7ba9fe` |
| `apps/web/src/components/Icon/webIcons.ts` | `586592f0d36f5785c642f3ff46b6afdf0dafdb72982cc2ef9f5cce61338a3732` |

## Completed reads

Originals read in full for this phase: `apps/web/AGENTS.md`, root `AGENTS.md`, plan Phase 8/9 sections, `docs/test-results/web/phase-08.md`, `next.config.ts`, `package.json`, `.env.example`, `theme/useTheme.ts`, `theme/ThemeScript.tsx`, `theme/tokens.css`, `app/globals.css`, `features/shell/{OverlayProvider,MainLayout,ListPane,useDocumentTitle}`, `components/{Dialog,Button,IconButton,Avatar,TopBar,NavRail,TabBar}`, `lib/useOverlayHistory.ts`, `lib/useModal.ts`, `lib/session/{session,SessionProvider,RouteGuard,recovery}`, `lib/store/{IndexedDbStore,StoreProvider,useStoreQuery}`, `lib/worker/leader.ts`, `lib/queue/worker.ts`, `lib/sync/host.ts`, `features/auth/AuthForm.tsx`, `app/(auth)/change-password/page.tsx`, `app/(main)/*`, `features/diagnostics/QueueDiagnostics.tsx`, `e2e/{helpers/api,phase-04-auth,phase-05-store,phase-06-queue,phase-06-host,phase-08-shell,phase-01-production}`, `playwright.config.ts`, `scripts/e2e-server.mjs`, `scripts/e2e-environment.mjs`, `packages/shared/src/theme/icons.ts`, `packages/shared/src/strings/index.ts` (settings/common blocks), `packages/shared/src/queue/types.ts`, `eslint.config.mjs`, `stylelint.config.mjs`, `tsconfig.json`, plus the installed auth-js sign-out implementation.

## Decisions and unresolved items

- `quiesce()` now only broadcasts; the local owner treats a quiesce as remote. Harnesses and Phase 5–7 specs were re-run (all pass).
- Startup completes a retained wipe before restoring an owner; a still-blocked deletion keeps `retainedWipeMessage` for the next start.
- Browser-only theme icons (`theme.system`/`theme.light`/`theme.dark`) live in `components/Icon/webIcons.ts`; the shared map is unchanged (asserted).
- Unresolved/optional: live-account revocation, physically blocked `deleteDatabase` on a real profile, non-Chromium repeats of the new spec, manual T-10 change-password.
