# DoloGram User Web Implementation Plan

Source document: DoloGram_Documentation_v14 (binding). This plan covers only the user web app `apps/web` (Next.js). It adds no feature, no table, no policy and no function to Supabase.

## 1. Purpose and how to use this plan

**Purpose.** Build the MVP user web app (screens WEB-01 to WEB-14 of Section 11.3) on the fixed backend contract of Sections 5, 6 and 10.5. Each phase leaves the app runnable with `next dev` and testable in a browser.

**How to use it.**

- Run one phase per work session, in order. Do not start a phase until the previous phase's exit gate passes.
- Every step is a `- [ ]` checkbox. Tick it only when its result is true. A phase is done when every acceptance criterion is "yes" and its exit gate passes.
- A step blocked by a gap (Appendix B) is marked blocked in the phase's test log entry, not skipped (10.1 Rules).
- Every command is PowerShell (Windows PowerShell 5.1), run from the repository root `G:\codebase\DoloGram` unless the step says otherwise. Chain commands with `;` and `if ($?) { ... }`, never `&&`.
- When a step installs a package without a version in v14: pin the current stable version at install time with `--save-exact` and record it in the environment record of the repository README (M0-01), section "Web dependencies".
- Test results go to `docs/test-results/web/phase-NN.md` (one file per phase), next to the milestone logs of 10.7.
- The appendices hold every decision (D-W01 to D-W20), flag (PF-W1 to PF-W14) and assumption this plan adds. Temporary IDs get the next free D-nn and PF-n when they are merged into the decision log.
- Conventions: MUST, SHOULD and MAY as in RFC 2119 (10.1). "Assumption:" marks a claim not verified when this plan was written. Terms follow the document: queued, sending, sent, failed (LS-2); Saved Messages; chat list; Force Low Signal Mode; and so on.

**Scope.**

- In scope: MVP flows F1 to F9 as they apply to the web client (Section 3.5, 11.3), LS-1 to LS-4 and LS-7 to LS-10 (the web subset of Section 3.4), and the web parts of M2-01 to M2-13, M3-01 to M3-04, M4-01 to M4-04, the web part of M4-07, and R-5 of 10.8.
- Out of scope: the Android app, the admin web, and every backend task. V2 and V3 web screens (WEB-15 to WEB-20) are out of scope too (D-W13). On web there is no Low Signal compression, no Wi-Fi deferral and no Force switch (D-19): LS-5 applies only through its "No connection" row, and LS-6 does not apply.

## 2. Conflicts and gaps found

Where a conflict exists, this plan follows the document. Each item has a flag or decision in the appendices.

| # | Conflict or gap | Where | Handling |
|---|---|---|---|
| C-1 | The inputs `DoloGram_Android_Implementation_Plan.md` and `DoloGram_Admin_Web_Implementation_Plan.md` do not exist in `G:\codebase\DoloGram\Documentation` or anywhere else in the repository when this plan was written. Their package and component names cannot be reused by name. | Prompt; repository | PF-W1. The plan reuses the names v14 fixes: the `packages/shared` modules of M2-01 to M2-03 and M2-05, the component names and paths of 12.10 (D-138), and CMP-nn (D-139). Every phase that needs a shared module first checks whether it exists. If it does, the phase uses it as is. If it does not, the phase builds it to the M2-nn specification and leaves the mobile half (the expo-sqlite adapter, the netinfo source) to the Android plan. |
| C-2 | The prompt allows "Vercel Hobby or local run". D-115 settles this: contacts use the Vercel Hobby production address, and `next dev` is for development only. | Prompt vs D-115, 6.5 | Follow D-115. Phase 19 deploys to production. |
| C-3 | The prompt makes M0 and M1 the only prerequisites, but `packages/shared` (M2-01 to M2-03, M2-05) is client code that 10.6 builds for both clients in M2. | Prompt vs 10.4, 10.6 | This plan builds the web half of `packages/shared` when it is missing (C-1). It is frontend code, so it does not change the backend contract. |
| C-4 | The send rate limit and its DG429 rejection (M3-08) are built in M3, not M0 or M1. T-21 needs them. | Prompt vs M3-08 | PF-W5. The client handles DG429 from Phase 6 on, tested with injected faults. The T-21 web run in Phase 19 is blocked until M3-08 is done. |
| C-5 | F1 says that with an existing session "the app opens to cached chat history". D-109 (8) forbids a service worker, so reloading the page while the browser is offline cannot load the app at all. | F1, 6.1 vs D-109 (8) | PF-W3, D-W05. Cached history is shown in an open tab and on any load the browser can serve. No service worker is added. |
| C-6 | 11.3 says the web queue retries "only while the tab is open". D-109 (6) and LS-3 say the worker runs only while the browser tab is in the foreground. | 11.3 vs D-109, LS-3, D-117 | Follow D-109: the worker runs only while `document.visibilityState` is `visible` (D-W04). PF-W6. |
| C-7 | D-44 says unread counts come from one query. The contract has no unread-count function, and a count per chat through the API is one query per chat. | D-44 vs 10.5 contract | PF-W4, D-W16. The resync of M2-05 keeps the full history of every chat in IndexedDB, so the unread counts come from one local IndexedDB query. |
| C-8 | Postgres Changes needs a channel. With "Allow public access" disabled (M0-07), a channel may have to be private, and the Realtime authorization policies of M1-05 cover only `chat:<chat_id>` topics. | 6.4, M0-07, M1-05 | PF-W2. Phase 7 checks the join first. If it is refused, the gap goes to the owner as a backend change outside this plan, and the interim fallback is a resync on every 15-second worker tick. |
| C-9 | The supported browsers include desktop Safari (D-109 (9)), but the owner's computer runs Windows. Playwright's WebKit build is not Safari. | D-109 (9), T-50 vs the fixed Windows environment | PF-W9. WebKit stands in for Safari during development. The Safari row of T-50 needs a Mac (a contact's computer is acceptable); otherwise it is recorded as unverified and D-85 item 16 applies. |
| C-10 | The contract creates a direct chat in three inserts (chats, the creator's member row, the other member's row). There is no single function that creates it, so a failed second member insert leaves a one-member direct chat. | D-70, D-124, M2-07 | PF-W7. Before creating a direct chat, the client refreshes the chat list and opens an existing direct chat with that user if there is one. The leftover case is recorded and not repaired by the client. |
| C-11 | The device-only tests T-03, T-07 and T-08 and the Force-toggle half of T-41 cannot run on web (D-19, D-64). | 7.2, 10.7 | The Android plan runs them. The web plan runs TW-10 (the web form of LS-9 for T-07) and the web half of T-41. |

## 3. Prerequisites and environment checklist

### 3.1 Backend contract (must be done before Phase 0)

Every item is a Section 10 task. Phase 0 checks each one from its own acceptance criterion and stops if one is missing.

| Task | What the web app relies on |
|---|---|
| M0-01 | Accounts (Supabase, Vercel, GitHub private repository D-62) and the tool record in the README. |
| M0-02 | Repository layout of 10.2 with npm workspaces (D-100): `apps/web`, `packages/shared`, `supabase/`, `scripts/`, `docs/`. |
| M0-03 | Hosted project jsyqtfsidtfahytcwutp, Tokyo (D-48, D-56). |
| M0-04 | Local stack and linked CLI (needed only for `supabase gen types`). |
| M0-05, M0-06 | Email and password sign-in, **self-service sign-up ON** (D-163 supersedes D-04), **email confirmation OFF for now** (D-163), phone off, minimum password length 12, JWT expiry 900 seconds (D-47, D-114), password-reset email enabled with the web reset URL added to the Auth redirect-URL allow-list (D-181), sign-in rate limits recorded (D-85 item 17). |
| M0-07 | Realtime public access disabled, authorization enabled. |
| M0-09 | `apps/web` placeholder (App Router), Vercel Hobby project that deploys `main` (D-115). |
| M0-10 | `.env.example` files and secret hygiene. |
| M1-01 to M1-06 | Schema, RLS, triggers, publication (messages, message_media, reactions), Realtime authorization for `chat:<chat_id>`, the two Storage buckets (D-75). |
| M1-03 trigger (self-service) | On an `auth.users` INSERT it reads `raw_user_meta_data->>'username'` and `->>'display_name'` to create the `profiles` row and the Saved Messages chat, and propagates a username unique violation so self-service `auth.signUp` fails atomically with no orphan user (D-163). |
| M1-07 | API tests (`packages/shared/tests/api`). |
| M1-08 | Test accounts A, B, C and G, fixture chats A-B, A+B and A+B+G, `scripts/create-user` and `scripts/disable-user`. |
| M1-09 | T-05, T-10, T-11, T-14, T-15, T-16, T-22 pass (`docs/test-results/M1.md`). |
| M3-08 (later) | Rate limits and DG429. Needed only for the T-21 run in Phase 19 (C-4). |

### 3.2 Tools on the owner's Windows computer

| Item | Check command (PowerShell) | Pass |
|---|---|---|
| Node.js (version recorded at M0-08) | `node --version` | Prints the recorded version. |
| npm with workspaces | `npm --version` | Prints a version; `npm query .workspace` lists `apps/web` and `packages/shared`. |
| Git | `git --version` | Prints a version. |
| Supabase CLI | `supabase --version` | Prints a version. |
| Browsers | Current Chrome, Edge and Firefox installed | Each opens `http://localhost:3000`. |
| Physical Android device D with Chrome | Chrome opens a page on the computer's LAN address | Used in Phase 19 (T-50, Chrome on Android). |

### 3.3 Environment variables for the web app

Names follow 10.2 (D-100). Only `NEXT_PUBLIC_` variables reach the browser, and no secret may use that prefix. Values are never written into this plan, the repository or a commit.

| Name | File or place | Secret | Use |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | `apps/web/.env.local`; Vercel Production and Preview | No | `https://jsyqtfsidtfahytcwutp.supabase.co` (D-56). |
| NEXT_PUBLIC_SUPABASE_KEY | `apps/web/.env.local`; Vercel Production and Preview | No | Publishable key, the only key in the browser (D-56). |
| NEXT_PUBLIC_DG_LATENCY | `apps/web/.env.test.local` only | No | `1` turns on latency capture in test builds (D-W09). Never set on Vercel Production. |
| NEXT_PUBLIC_DG_BUILD | Set in `next.config.ts` from VERCEL_GIT_COMMIT_SHA (first 7 characters) or `local` | No | Build string in About (WEB-14). |
| TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD (and B, C, G) | `apps/web/.env.test.local` | Password: yes | Playwright sign-ins (10.2). |
| E2E_BASE_URL | Shell variable for one run | No | Target of a Playwright run. The default is `http://localhost:3000`; Phase 19 sets the production address. |
| SUPABASE_SECRET_KEY, SUPABASE_DB_URL, SUPABASE_ACCESS_TOKEN | Never in `apps/web` | Yes | Read only by the bundle scan of Phase 0 and Phase 19 from the owner's shell, to search for them (T-42). |

`apps/web/.env.local` and `apps/web/.env.test.local` MUST be matched by `.gitignore` (M0-10).

### 3.4 Free-plan ceiling

The app is designed for 2 to 10 daily users, with the Supabase Free plan limits of 7.1 as the ceiling (D-41). The web client keeps one Realtime connection per browser (D-W04, D-43) and joins `chat:<chat_id>` only for the open chat.

## 4. Phase overview

| Phase | Name | Goal | Depends on | Document IDs covered |
|---|---|---|---|---|
| 0 | Prerequisites, workspace and tooling | Confirm the contract and give `apps/web` its test, lint and scan tooling. | M0, M1 | 10.2, M0-09, M0-10, D-62, D-100, D-115, T-42 (script) |
| 1 | Shared package integration | Make `packages/shared` config, validation, ids, strings, types, client and errors usable from the web. | 0 | M2-01, D-27 to D-30, D-90, D-100, D-113, D-116, D-122 |
| 2 | Design tokens, fonts, icons and theme bootstrap | Generate `tokens.css` from the shared tokens and apply the theme before first paint. | 1 | 12.2, 12.3, 12.10, D-83, D-95, D-129 to D-131, D-134, D-138, D-144, M4-02 |
| 3 | Base and state components | Build the shared web components and the loading, empty and error patterns. | 2 | 12.4 (CMP-01 to CMP-03, CMP-05, CMP-06, CMP-15 to CMP-21, CMP-23), 3.5 Loading and Error, D-95, D-134, D-136 |
| 4 | Sign-in, sign-up, forgot password, forced password change and session | Email and password sign-in, self-service sign-up (username + display name) and email password reset, with the forced change for admin-created accounts and a persistent session. | 3 | F1, WEB-01, WEB-01b, WEB-02, 5.1, D-47, D-51, D-78, D-86, M2-04, D-163, D-181, T-10 |
| 5 | IndexedDB local store | Persist queue, cache and sync state in IndexedDB, with one worker tab. | 4 | M2-02, 6.1, 6.2 local records, D-06, LS-9, LS-10 |
| 6 | Queue core and delivery worker | Deliver text through the local queue with LS statuses, retries and idempotency. | 5 | M2-03, LS-1 to LS-4, LS-7 to LS-10, D-10, D-12, D-27, D-77, D-93, D-109, T-09, T-18, T-19 |
| 7 | Sync module | Keep the cache current through Postgres Changes and sync_seq resync. | 6 | M2-05, 6.4, D-40, D-43, D-91, T-13 |
| 8 | Responsive shell and navigation | Rail, tab bar, panes and dialog history at the 768 and 1280 px breakpoints. | 7 | WEB-03, 12.6, 12.7, CMP-32, CMP-33, D-35, D-142, D-145 |
| 9 | Settings dialog, theme setting and sign-out | Settings with theme choice, change password, About and sign-out that wipes local data. | 8 | WEB-14, F1, D-51, D-83, D-109 (5) |
| 10 | Chat list and archive view | List chats from the cache in D-94 order, with unread counts and the offline banner. | 9 | F2, WEB-04, WEB-05, CMP-09, CMP-13, CMP-14, D-12, D-19, D-92, D-94, M2-08 |
| 11 | New chat, New group and chat info | Find users, create chats and groups, manage members, leave groups. | 10 | WEB-11, WEB-12, 3.2 Chat, D-42, D-46, D-58, D-70, D-88, D-91, D-124, M2-07 |
| 12 | Chat thread and Markdown | Render the message list, bubbles, separators and Markdown safely. | 11 | WEB-06 (read), CMP-07, CMP-22, D-05, D-30, D-99, D-143, M2-06, T-12 |
| 13 | Composer, sending and delivery status | Send text through the queue, with the status captions, Retry and Discard. | 12 | F3, F7, CMP-08, CMP-10, LS-2, D-93, D-132, D-143, M2-09, M2-12, M4-04, T-01, T-02, T-19 |
| 14 | Message actions | Reply, forward, copy, react, edit and delete. | 13 | F3, F4, WEB-07, WEB-08, CMP-12, CMP-34, D-22, D-31, D-50, D-76, D-109 (4), D-133, M2-09, M2-10, M3-04, T-06, T-17 |
| 15 | Typing indicators and read receipts | Show typing and seen state over Broadcast, and keep last_read_seq current. | 14 | F6, D-23, D-57, D-92, D-118, M2-11, T-37, T-51 |
| 16 | Attachments: pipeline and attach UI | Queue and upload photos, videos, voice notes and files. | 15 | F5, WEB-09, LS-4, D-29, D-39, D-75, D-90, D-109 (7), D-113, D-116, M3-01 to M3-03, T-20, T-52 |
| 17 | Media display and viewer | Show tiles and rows, placeholders and the media viewer with signed-URL refresh. | 16 | WEB-10, CMP-11, D-113, 12.3 Attachment tiles, T-11 (client re-run) |
| 18 | Folders, archive and mute controls | Archive, mute and folder management, synced across devices. | 17 | F9, WEB-13, D-24, D-94, D-109 (1), M4-01, T-36, T-49 |
| 19 | Hardening and release gate | Run the cross-cutting, browser, latency and security checks, then deploy production. | 18 | 3.5 cross-cutting, 12.8, M4-03, M4-04, M4-07 (web part), R-5, D-82, D-115, T-01, T-40, T-42, T-49, T-50 |

## 5. Phases

---

### Phase 0: Prerequisites, workspace and tooling

**Goal:** Confirm the M0 and M1 contract, and give `apps/web` its unit, end-to-end, lint and bundle-scan tooling.

**Depends on:** M0-01 to M0-10 and M1-01 to M1-09 (3.1).

**Implements:** 10.2 (repository layout, environment variables), M0-09, M0-10, D-62, D-100, D-115, D-W08, D-W11, T-42 (web scan script).

**Steps**

- [ ] 1. **Contract check.** Open `docs/test-results/M1.md` and confirm T-05, T-10, T-11, T-14, T-15, T-16 and T-22 are recorded as passed on the hosted project. If any is missing, stop: this plan does not start (3.1). Record the check in `docs/test-results/web/phase-00.md`.
- [ ] 2. **Workspace check.** Confirm that `apps/web` and `packages/shared` are npm workspaces. If `apps/web` is missing, M0-09 is not done: stop.

  ```powershell
  npm query .workspace | Select-String '"location"'
  ```

- [ ] 3. **Environment file.** Create `apps/web/.env.local` from `apps/web/.env.example` (M0-10) with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY. Create `apps/web/.env.test.local` with TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD and the same pair for B, C and G. Add `apps/web/.env.test.local` to `apps/web/.env.example` as a commented line naming the variables, with no values. Confirm both files are ignored:

  ```powershell
  git check-ignore apps/web/.env.local apps/web/.env.test.local
  ```

- [ ] 4. **Source layout (D-W11).** Create these folders, each with a `.gitkeep`:
  - `apps/web/src/app` (routes of 12.6)
  - `apps/web/src/components` (one folder per component, 12.10)
  - `apps/web/src/features` (screen logic per flow: `auth`, `chatList`, `chat`, `media`, `settings`, `folders`)
  - `apps/web/src/lib` (supabase client, store adapter, worker host, media helpers)
  - `apps/web/src/theme` (generated `tokens.css`, `ThemeScript.tsx`)
  - `apps/web/e2e` (Playwright specs, one file per phase: `phase-NN-<name>.spec.ts`)

  ```powershell
  'app','components','features','lib','theme' | ForEach-Object { New-Item -ItemType Directory -Force "apps/web/src/$_" | Out-Null; New-Item -ItemType File -Force "apps/web/src/$_/.gitkeep" | Out-Null }; New-Item -ItemType Directory -Force apps/web/e2e | Out-Null
  ```

- [ ] 5. **Unit test tooling (D-100, D-W08).** Install Vitest (the document's unit and API test runner), jsdom and Testing Library for component tests, and fake-indexeddb so the IndexedDB adapter can run under Node. Pin each at install time and record it.

  ```powershell
  npm install --workspace apps/web --save-dev --save-exact vitest jsdom @testing-library/react @testing-library/user-event fake-indexeddb
  ```

  Create `apps/web/vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']` and `passWithNoTests: true`. `src/test/setup.ts` imports `fake-indexeddb/auto`. Add `"test": "vitest run"` to `apps/web/package.json`.
- [ ] 6. **End-to-end tooling (D-W08).** Install Playwright, which is free under Apache-2.0, to drive Chromium, Firefox and WebKit from Windows.

  ```powershell
  npm install --workspace apps/web --save-dev --save-exact @playwright/test; if ($?) { npx --workspace apps/web playwright install chromium firefox webkit }
  ```

  Create `apps/web/playwright.config.ts`:
  - `testDir: './e2e'` and `use.baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000'`
  - `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`, used only when E2E_BASE_URL is unset
  - projects `chromium`, `firefox`, `webkit`, `msedge` (channel `msedge`) and `chrome` (channel `chrome`)
  - load `.env.test.local` with `process.loadEnvFile('.env.test.local')`. Assumption: the Node version recorded at M0-08 is 20.12 or later, which has `process.loadEnvFile`; fallback the `dotenv` package.

  Add `"e2e": "playwright test"` to `apps/web/package.json`.
- [ ] 7. **API helper for end-to-end assertions.** Create `apps/web/e2e/helpers/api.ts`. It exports `signInAs(user: 'A'|'B'|'C'|'G')`, which returns a supabase-js client signed in with that test account's own session through the publishable key (D-16; never the secret key). It also exports `countMessages(client, messageId)`, which returns the number of `messages` rows with that message_id. Every later spec counts rows through this helper.
- [ ] 8. **Lint (D-95, 12.10).** Install `eslint-plugin-jsx-a11y` (the D-95 label check) and Stylelint (12.10 color check), each pinned and recorded.

  ```powershell
  npm install --workspace apps/web --save-dev --save-exact eslint-plugin-jsx-a11y stylelint stylelint-config-standard
  ```

  In `apps/web/eslint.config.mjs`, extend the Next.js config created by M0-09 and add `jsxA11y.flatConfigs.strict`. Add the `no-restricted-syntax` rule of 12.10, which rejects string literals matching `#[0-9a-fA-F]{3,8}`, `rgb(` or `rgba(` outside `apps/web/src/theme`. Create `apps/web/.stylelintrc.json` with `"extends": "stylelint-config-standard"` and `"rules": { "color-no-hex": true }`, with `apps/web/src/theme/tokens.css` in `ignoreFiles`. Add `"lint": "next lint && stylelint \"src/**/*.module.css\""`. Assumption: `next lint` is still the lint entry in the Next.js release pinned at M0-09; fallback `eslint .`.
- [ ] 9. **Bundle secret scan (T-42, web part).** Create `scripts/scan-web-bundle.ps1`. It builds nothing. It reads the values of SUPABASE_SECRET_KEY, SUPABASE_DB_URL and SUPABASE_ACCESS_TOKEN from the owner's shell environment, searches every file under `apps/web/.next` (client and server output) for each value and for the prefix `sb_secret_`, prints only the file name of each hit (never the value), and exits 1 if anything is found. Assumption: Supabase secret keys start with `sb_secret_`; the value search is authoritative either way. The full T-42 run across the three bundles stays with M4-07.

  ```powershell
  npm run build --workspace apps/web; if ($?) { powershell -File scripts/scan-web-bundle.ps1 }
  ```

- [ ] 10. **Placeholder spec.** Create `apps/web/e2e/phase-00-smoke.spec.ts`: open `/`, expect HTTP 200 and a `<title>` of `DoloGram`. Set the root metadata title in `apps/web/src/app/layout.tsx` to `DoloGram`.

**Deliverables:** `apps/web` with `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.stylelintrc.json`, the D-W11 folders and `e2e/helpers/api.ts`; `scripts/scan-web-bundle.ps1`; `docs/test-results/web/phase-00.md`; the README environment record updated with the pinned versions.

**Acceptance criteria**

- [ ] `docs/test-results/M1.md` records all seven M1 tests as passed. (T-05, T-10, T-11, T-14, T-15, T-16, T-22, read only)
- [ ] `git check-ignore` prints both env file paths.
- [ ] `npm run test --workspace apps/web` exits 0.
- [ ] `npm run lint --workspace apps/web` exits 0.
- [ ] `scripts/scan-web-bundle.ps1` exits 0 on the placeholder build. (T-42, web part)
- [ ] The smoke spec passes in Chromium.

**Exit gate:** `npm run e2e --workspace apps/web -- phase-00 --project=chromium` passes.

**Risks and fallbacks**

- M1 not finished: the plan cannot start. Fallback: none; wait for M1-09.
- Playwright browser download blocked by a proxy: install a single browser with `npx playwright install chromium` and run only `--project=chrome` against the installed Chrome.

---

### Phase 1: Shared package integration

**Goal:** Make the `packages/shared` config, validation, ids, strings, types, client factory and error mapping of M2-01 usable from `apps/web`.

**Depends on:** Phase 0.

**Implements:** M2-01, D-10, D-27, D-28, D-29, D-30, D-35, D-46, D-57, D-77, D-89, D-90, D-95, D-100, D-113, D-116, D-122, LS-8, 5.5, D-W01, D-W18.

**Steps**

- [ ] 1. **Inventory (C-1).** List what `packages/shared/src` already holds. Each module below that exists and exports the named functions is reused unchanged. Each missing one is built in step 2, to the M2-01 specification, in the path given.

  ```powershell
  Get-ChildItem -Recurse packages/shared/src -Include *.ts | Select-Object FullName
  ```

  | Module | Path | Exports the web uses |
  |---|---|---|
  | Config | `packages/shared/src/config/index.ts` | `queue` (timerMs 15000, backoffBaseMs 2000, factor 2, capMs 60000, jitter 0.2, maxAttempts 8, maxUnsent 200; D-27), `media` (smallBucket `chat-media-small` 10485760 bytes, largeBucket `chat-media-large` 52428800 bytes, tusThresholdBytes 6291456, allowedTypes of 5.5, maxAttachments 10; D-29, D-75, D-90, D-116), `text` (maxCodePoints 4096, counterFrom 3900; D-30), `signedUrlSeconds` 600 (D-113), `typing` (sendEveryMs 3000, hideAfterMs 5000; D-57), `paging` (listPage 50, resyncPage 500; D-44, M2-05), `reactionPalette` (the 8 code points of 12.3) |
  | Validation | `packages/shared/src/validation/index.ts` | `countCodePoints` (Array.from, D-116), `trimDg` (the D-116 character class), `isBlank`, `validateMessageText(text, attachmentCount)`, `validateAttachment(file)`, `validateEmail` (D-116 pattern), `validateNewPassword` (at least 12, D-47), `validateUsername` (`^[a-z][a-z0-9_]{4,31}$`, D-89), `validateDisplayName` (1–64), `validateFolderName` (1 to 32, D-24), `validateGroupTitle` (1 to 64, D-109) |
  | Ids | `packages/shared/src/ids/index.ts` | `newId()`: `crypto.randomUUID()` on web (D-100) |
  | Strings | `packages/shared/src/strings/index.ts` | `strings` grouped by screen, camelCase keys (12.10). Values are the quoted strings of Sections 11 and 12 (D-127) |
  | Errors | `packages/shared/src/errors/index.ts` | `classifyError(e)`, which returns `{ kind: 'delivered' }` for 23505 (LS-8), `{ kind: 'rateLimited', retryAfterSeconds }` for DG429 with the seconds from the error detail (D-77), `{ kind: 'network' }` for a fetch failure or HTTP 5xx or 408, `{ kind: 'auth' }` for 401, and `{ kind: 'permanent', message }` for any other rejection (D-W18) |
  | Database types | `packages/shared/src/db/types.ts` | Generated with `supabase gen types typescript --linked` |
  | Client factory | `packages/shared/src/client/createClient.ts` | `createDgClient({ url, key, storage?, fetch? })` around `createClient` of `@supabase/supabase-js` with an injectable fetch for fault tests (M2-01) |
  | Topics | `packages/shared/src/realtime/topics.ts` | `chatTopic(chatId)` returns `chat:<chat_id>` (D-100, M2-11) |

- [ ] 2. **Build each missing module** with its unit tests next to it (`*.test.ts`, Vitest). Install supabase-js into the shared package if it is absent; it is the only Supabase client (D-W01).

  ```powershell
  npm install --workspace packages/shared --save-exact @supabase/supabase-js; if ($?) { supabase gen types typescript --linked | Out-File -Encoding utf8 packages/shared/src/db/types.ts }
  ```

  The validation tests MUST cover these M2-01 cases:
  - blank and whitespace-only text with 0 attachments is refused, and attachment-only text is accepted (D-30)
  - 4096 emoji are accepted and 4097 refused (D-116)
  - text with only spaces, tabs and line feeds is blank
  - a file of 10,485,760 bytes is accepted as a photo and one of 10,485,761 bytes is refused
  - `application/x-msdownload` is refused
  - an eleventh attachment is refused

  A missing config value fails the typecheck: export the config `as const satisfies DgConfig`.
- [ ] 3. **Web client singleton.** Create `apps/web/src/lib/supabase.ts`, which exports `getSupabase()`. It calls `createDgClient` with `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_KEY` and the SDK defaults: localStorage session storage, `autoRefreshToken: true`, `persistSession: true` (M2-04). It throws `Error('Missing NEXT_PUBLIC_SUPABASE_URL')` or `Error('Missing NEXT_PUBLIC_SUPABASE_KEY')` when a variable is absent, so a misconfigured build fails at startup instead of defaulting (M2-01). Import it only from Client Components (`'use client'`). No route handler, server action or server component calls Supabase (D-W01).
- [ ] 4. **Transpile the shared package.** In `apps/web/next.config.ts` set `transpilePackages: ['@dologram/shared']`, using the package name of `packages/shared/package.json`. Add `"@dologram/shared": "*"` to `apps/web/package.json` dependencies, then run `npm install`.
- [ ] 5. **Development page.** Create `apps/web/src/app/dev/page.tsx`. It is a Client Component that calls `notFound()` when `process.env.NODE_ENV === 'production'`. It shows:
  - the config values of step 1
  - `newId()` output
  - the result of `fetch(NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/health', { headers: { apikey: NEXT_PUBLIC_SUPABASE_KEY } })` as "Auth reachable: yes or no"

  Later phases add sub-pages under `apps/web/src/app/dev/`.
- [ ] 6. **Spec.** Create `apps/web/e2e/phase-01-shared.spec.ts`: on `/dev`, "Auth reachable: yes" is visible and the queue timer shows 15000.

**Deliverables:** the shared modules of step 1 with tests; `apps/web/src/lib/supabase.ts`; `apps/web/src/app/dev/page.tsx`; the phase spec.

**Acceptance criteria**

- [ ] `npm run test --workspace packages/shared` passes, including every validation case of step 2.
- [ ] `npm run typecheck` (root, M0-02) passes against the generated types.
- [ ] `/dev` shows "Auth reachable: yes" in `next dev`.
- [ ] A production build returns 404 for `/dev` (`npm run build --workspace apps/web; npm run start --workspace apps/web`, then open `/dev`).
- [ ] Removing NEXT_PUBLIC_SUPABASE_KEY from `.env.local` makes `/dev` show the "Missing NEXT_PUBLIC_SUPABASE_KEY" error (restore it afterwards).

**Exit gate:** `npm run test --workspace packages/shared; if ($?) { npm run e2e --workspace apps/web -- phase-01 --project=chromium }` passes.

**Risks and fallbacks**

- The Android plan builds the same shared modules with different export names: the first plan to land owns them, and the other adapts its imports. This plan does not fork a module. PF-W1.
- `supabase gen types --linked` fails because the CLI is not linked: run `supabase link --project-ref jsyqtfsidtfahytcwutp` (M0-04), then retry.

---

### Phase 2: Design tokens, fonts, icons and theme bootstrap

**Goal:** Generate `apps/web/src/theme/tokens.css` from the shared token set, bundle Inter, JetBrains Mono and Lucide, and apply the theme before first paint.

**Depends on:** Phase 1.

**Implements:** 12.2, 12.3, 12.10, M4-02 (web part), D-83, D-95, D-129, D-130, D-131, D-134, D-138, D-144, TW-03, TW-04.

**Steps**

- [ ] 1. **Token source.** If `packages/shared/src/theme/tokens.ts` does not exist, create it with every value of 12.2 and these groups:
  - `color.light` and `color.dark`, with the token tree of 12.2 (`bg.app`, `bg.surface`, through `media.text`), including the neutral palette and the `#000000` `color.bg.app` dark value of D-144
  - `avatarFills` (7 values)
  - `type` (11 tokens)
  - `space` (`0` to `11`), `radius`, `elevation` (`webLight` and `webDark` strings), `motion`, `z`

  The 12.2 tables are the single source; copy the hex values exactly.
- [ ] 2. **Icon map.** If `packages/shared/src/theme/icons.ts` does not exist, create it with the semantic-name-to-Lucide-name table of 12.3 (for example `'status.queued': 'clock'`, `'nav.chats': 'message-circle'`). Add the size table `icon.xs` 14 / stroke 2, through `icon.xl` 48 / stroke 1.5.
- [ ] 3. **CSS generator.** Install `tsx` (it runs the TypeScript generator under Node) at the root, pinned and recorded. Create `packages/shared/scripts/generate-tokens-css.ts`. It writes `apps/web/src/theme/tokens.css` with:
  - `:root { ... }` holding every light color and every non-color token as `--dg-<dot name with hyphens>` (for example `--dg-color-bg-app`, `--dg-space-5: 16px`, `--dg-radius-bubble: 22px`, `--dg-z-toast: 600`, `--dg-motion-duration-base: 200ms`)
  - `[data-theme="dark"] { ... }` holding the dark colors and dark elevations
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` with the same dark values, so System follows the media query (12.10)
  - `@media (prefers-reduced-motion: reduce) { :root { ... } }`, which sets every duration except `--dg-motion-duration-fast` to `0ms` (D-134)

  Add `"tokens": "tsx packages/shared/scripts/generate-tokens-css.ts"` to the root `package.json`.

  ```powershell
  npm install --save-dev --save-exact tsx; if ($?) { npm run tokens }
  ```

- [ ] 4. **Token sync test (12.10, TW-04).** Create `packages/shared/src/theme/tokens-css.test.ts`. It regenerates the CSS in memory and fails if it differs from the committed `apps/web/src/theme/tokens.css`.
- [ ] 5. **Contrast test (12.10, D-95, TW-04).** If `packages/shared/src/theme/contrast.test.ts` does not exist, create it. It computes every pair of the 12.2 contrast table in both themes with the WCAG 2.x relative-luminance formula, and fails below 4.5:1 for text and 3:1 for non-text.
- [ ] 6. **Fonts (D-130).** In `apps/web/src/app/layout.tsx`, load `Inter` (weights 400, 500, 600, 700, normal and italic) and `JetBrains_Mono` (400) from `next/font/google` with `display: 'swap'` and `subsets: ['latin']`. Expose them as `--dg-font-sans` and `--dg-font-mono` through each font's `variable` option, on `<html>`. next/font self-hosts the files at build time, so no font is fetched from Google at runtime (12.10). Assumption: next/font downloads the font files during `next build` on Vercel and locally; checked in this phase's acceptance criteria.
- [ ] 7. **Global CSS.** Create `apps/web/src/app/globals.css`:
  - import `../theme/tokens.css`
  - `html { font-size: 100%; }`
  - type tokens in rem (16 px = 1 rem: `body.lg` 1rem/1.375rem)
  - `body { background: var(--dg-color-bg-app); color: var(--dg-color-text-primary); font-family: var(--dg-font-sans); }`
  - a `.dg-visually-hidden` utility
  - `:focus-visible { outline: 2px solid var(--dg-color-focus-ring); outline-offset: 2px; }` (D-136)
- [ ] 8. **Theme bootstrap (D-83, TW-03).** Create `apps/web/src/theme/ThemeScript.tsx`. It renders an inline `<script>` in `<head>` that reads `localStorage.getItem('dg.theme')` inside `try`/`catch`: `light` or `dark` sets `document.documentElement.dataset.theme`, and `system`, a missing value or an error leaves the attribute unset. Create `apps/web/src/theme/useTheme.ts`, which exports `getThemeSetting()`, `setThemeSetting('system'|'light'|'dark')` (writes `dg.theme` and updates `data-theme` at once) and `useResolvedTheme()` (reads `matchMedia('(prefers-color-scheme: dark)')` while the setting is System). Add `suppressHydrationWarning` on `<html>`, because the attribute is set before hydration.
- [ ] 9. **Icon component (D-131).** Install `lucide-react`, pinned and recorded. Create `apps/web/src/components/Icon/Icon.tsx` with props `name` (a key of `icons.ts`), `size` (`'xs'|'sm'|'md'|'lg'|'xl'`), optional `label` and optional `spin`. It renders the mapped Lucide component with the size and stroke of 12.3 and `currentColor`. With `label` it sets `role="img"` and `aria-label`; otherwise `aria-hidden="true"`. Screens never import `lucide-react` directly (12.10). Enforce this with `no-restricted-imports` for `lucide-react` outside `src/components/Icon`.

  ```powershell
  npm install --workspace apps/web --save-exact lucide-react
  ```

- [ ] 10. **Token page.** Create `apps/web/src/app/dev/tokens/page.tsx`. It renders one swatch per color token with its name, every type token as a sample line, and one `Icon` per semantic name, plus three buttons that call `setThemeSetting` with System, Light and Dark.
- [ ] 11. **Spec.** Create `apps/web/e2e/phase-02-theme.spec.ts`:
  - with `localStorage dg.theme = 'dark'` set through `page.addInitScript`, the computed `background-color` of `body` on first load is `rgb(0, 0, 0)` and `<html>` has `data-theme="dark"`
  - with `colorScheme: 'dark'` emulated and no stored value, the color is also `rgb(0, 0, 0)`
  - with `light`, it is `rgb(255, 255, 255)`
  - the page requests no URL on `fonts.googleapis.com` or `fonts.gstatic.com`

**Deliverables:** `tokens.ts`, `icons.ts`, the generator, the `tokens` script, the generated `apps/web/src/theme/tokens.css`, the sync and contrast tests, `ThemeScript.tsx`, `useTheme.ts`, `Icon`, `globals.css`, `/dev/tokens`.

**Acceptance criteria**

- [ ] The contrast test passes for every 12.2 pair in both themes. (TW-04; part of T-40)
- [ ] The token sync test passes, and editing one value in `tokens.ts` without running `npm run tokens` makes it fail.
- [ ] A hex literal added to any `apps/web/src/components/**/*.module.css` fails `npm run lint --workspace apps/web` (12.10).
- [ ] The theme spec passes: no flash of the wrong theme on first paint. (TW-03)
- [ ] No request to a Google Fonts host is made. (12.10)

**Exit gate:** `npm run test --workspace packages/shared; if ($?) { npm run e2e --workspace apps/web -- phase-02 --project=chromium }` passes.

**Risks and fallbacks**

- A Lucide icon of 12.3 is renamed in the pinned release: correct the name in `icons.ts` only (12.3 Assumption).
- next/font cannot reach Google Fonts during the build: place the Inter and JetBrains Mono release files (SIL Open Font License 1.1) in `apps/web/src/theme/fonts` and use `next/font/local` with the same variable names (D-130 fallback, adapted to web).

---

### Phase 3: Base and state components

**Goal:** Build the reusable web components and the 300 ms loading, empty and error patterns that every later screen uses.

**Depends on:** Phase 2.

**Implements:** 12.4 CMP-01 (Button, IconButton), CMP-02 (TextField), CMP-03 (SearchField), CMP-05 (Avatar), CMP-06 (Badge), CMP-15 (BottomSheet), CMP-16 (Dialog), CMP-17 (Toast, ToastProvider), CMP-18 (Skeleton), CMP-19 (EmptyState), CMP-20 (ErrorState), CMP-21 (TopBar), CMP-23 (Menu); 3.5 Loading and Error; D-95, D-134, D-136; 12.8 Roles and states, Focus order, Touch targets; TW-06.

**Steps**

- [ ] 1. **One folder per component.** Each component lives at `apps/web/src/components/<Name>/<Name>.tsx` with `<Name>.module.css`, camelCase class names, and every color, space, radius, motion and z value taken from `var(--dg-…)` (12.10). Use the 12.10 primitive for each:
  - `Button`, `IconButton`: `<button type="button">`
  - `TextField`: `<input>` or `<textarea>` with `<label>`
  - `SearchField`: `<input type="search">`
  - `Avatar`, `Badge`: `<span>`
  - `Dialog`: `<dialog>` opened with `showModal()`
  - `BottomSheet`: `<div role="dialog">` fixed to the bottom
  - `Toast`: a root-level `<div role="status">`
  - `Skeleton`: `<div aria-busy="true">` with a CSS gradient animation
  - `EmptyState`: `<section>`
  - `ErrorState`: `<section role="alert">`
  - `TopBar`: `<header>`
  - `Menu`: a `<div role="menu">` popover in a portal
- [ ] 2. **Button (CMP-01).**
  - Variants: Primary, Secondary, Text, Danger, Icon.
  - Height 44 on the user web, minimum width 88, `radius.md`, label `label.lg`.
  - States: pressed, disabled (`color.bg.disabled` and `color.text.disabled`), loading (the spinner replaces the label after `motion.delay.loading`, with `aria-busy="true"`).
  - IconButton: a 40 visual circle in a 44 target, with a required `label` prop that becomes `aria-label` (12.8).
- [ ] 3. **TextField and SearchField (CMP-02, CMP-03).** Props: `label`, `helper`, `error`, `counter`, `type`, `autoComplete`, `disabled`. The error text shows `status.failed` at `icon.xs` and `color.danger` and is linked with `aria-describedby`. The password type has the show and hide IconButton (`action.showPassword`, `action.hidePassword`). SearchField uses `radius.full` and `action.search`.
- [ ] 4. **Avatar and Badge (CMP-05, CMP-06).**
  - Avatar: sizes 24, 28, 40, 48, 56, 64 and 96. Initials are the first code point of the first two words, uppercased, counted with Array.from. The fill index is the sum of the UTF-16 code units of the id, modulo 7, from `avatarFills` (12.3), with initials always `#FFFFFF` read from the token.
  - Avatar variants: `saved` (`chat.saved` on `color.brand.primary`), `deleted` (`person.deleted`) and `former` (`person.former`), both on `color.badge.muted.bg`.
  - Put the fill-index function in `packages/shared/src/theme/avatar.ts` so Android uses the same rule.
  - Badge: `radius.full`, `label.sm`, brand and muted variants.
- [ ] 5. **Overlays (CMP-15, CMP-16, CMP-23).**
  - Dialog: variants `form` (520 wide from 768 px, full screen below) and `confirm` (400 wide), `radius.xl`, `elevation.3`, scrim `color.scrim`, `z.dialog`.
  - Dialog behavior: focus trapped by the native modal dialog, focus returned to the opener on close, Escape closes (12.6), title in `title.md`.
  - BottomSheet: below 768 px only, top corners `radius.xl`, `z.sheet`, enter over `motion.duration.slow` with `motion.easing.enter`.
  - Menu: positioned in a portal at `z.menu`, `role="menu"` with `menuitem` children, arrow-key navigation, Escape closes. A disabled item shows its reason ("No connection") as a second line in `body.sm`.
- [ ] 6. **Overlay history hook (12.6).** Create `apps/web/src/lib/useOverlayHistory.ts`. Opening an overlay calls `history.pushState({ dgOverlay: id }, '', location.href)`. A `popstate` event closes the top overlay. Closing it by a control calls `history.back()` when the top state is that overlay. This makes the browser back button close an open dialog or overlay first (TW-06). Dialog, BottomSheet and (in Phase 17) the media viewer use it.
- [ ] 7. **Toast (CMP-17, D-134).**
  - `ToastProvider` is mounted once in the root layout and exposes `useToast().show({ text, action? })`.
  - Toasts use `color.toast.*`, `elevation.2` and `z.toast`. They last 4000 ms, or 6000 ms with an action, and are one at a time with the newest replacing the current one.
  - The container is `role="status"`, so a toast is announced politely.
- [ ] 8. **Loading rule (D-95).** Create `apps/web/src/lib/useDelayedFlag.ts`: `useDelayedFlag(active, 300)` returns true only after `active` has been true for 300 ms (`motion.delay.loading`). Skeleton (CMP-18) and every spinner render only when this flag is true. The shimmer stops under reduced motion, and the spinner keeps turning next to a text label (D-134).
- [ ] 9. **Empty and error states (CMP-19, CMP-20).** EmptyState props: `icon`, `title`, `body`, optional `action`. ErrorState props: `title`, `body` (the error text from the strings module), optional `onRetry`. Retry shows only when the action can be repeated (3.5 Error, D-95). Error text always comes from `strings`, never from a raw server message (D-35).
- [ ] 10. **TopBar (CMP-21).** Height 56, fill `color.bg.app`, bottom border `color.border.subtle`, `z.sticky`. Variants: chat list (wordmark "DoloGram" in `title.lg`, no Low Signal chip on web, D-19), screen (back IconButton `nav.back` and title in `title.md`) and chat (filled in Phase 12).
- [ ] 11. **Gallery.** Create `apps/web/src/app/dev/components/page.tsx`, which renders every component in every state of its 12.4 table, in both themes, using the Phase 2 theme buttons.
- [ ] 12. **Tests.** Create `apps/web/src/components/<Name>/<Name>.test.tsx` for Button (loading after 300 ms only), Dialog (Escape closes, focus returns), Menu (arrow keys) and Avatar (the fill index, and initials "AM" for "Ana María Reyes"), and `apps/web/src/lib/useOverlayHistory.test.ts` (back closes). Create `apps/web/e2e/phase-03-components.spec.ts`: on `/dev/components`, Tab reaches every button in visual order, every interactive element has an accessible name (Playwright `getByRole` with a name for each), opening the Dialog and pressing the browser back button closes it while the URL stays the same (TW-06), and a Toast is announced through `role="status"`.

**Deliverables:** the components listed under Implements, `useOverlayHistory.ts`, `useDelayedFlag.ts`, `packages/shared/src/theme/avatar.ts`, `/dev/components`, the unit tests and the phase spec.

**Acceptance criteria**

- [ ] No spinner or skeleton appears for a wait under 300 ms, and one appears for a wait over 300 ms. (D-95; part of T-40)
- [ ] `npm run lint --workspace apps/web` reports no jsx-a11y error. (D-95; part of T-40)
- [ ] The browser back button closes the top dialog first. (TW-06)
- [ ] Every component renders in Light and Dark with token colors only (the lint color check passes).
- [ ] Icon buttons are at least 44 by 44 px (Playwright `boundingBox()` check in the spec). (D-136)

**Exit gate:** `npm run test --workspace apps/web; if ($?) { npm run e2e --workspace apps/web -- phase-03 --project=chromium }` passes.

**Risks and fallbacks**

- `<dialog>` focus behavior differs in Safari: the Phase 19 T-50 run checks it. Fallback: a `div role="dialog" aria-modal="true"` with a manual focus trap in the same component.
- SwitchRow (CMP-04) is not built: the user web has no switch in the MVP (WEB-14 has no Force switch, D-19).

---

### Phase 4: Sign-in, sign-up, forgot password, forced password change and session

**Goal:** Sign in or create an account with email and password, reset a forgotten password by email, force the first password change for admin-created accounts, persist and refresh the session, and guard every route.

**Depends on:** Phase 3.

**Implements:** F1, WEB-01, WEB-01b (sign-up), WEB-02, 5.1, 12.5 (Sign-in, Sign-up and Forced password change templates), 12.6 (redirect rules), M2-04 (web), D-47, D-51, D-78, D-86, D-114, D-116, D-W01, D-W17, D-163 (self-service sign-up, supersedes D-04), D-181 (self-service password reset), T-10 (UI re-run), T-45 (web part).

**Steps**

- [ ] 1. **Session provider.** Create `apps/web/src/lib/session/SessionProvider.tsx` (Client Component), mounted in `apps/web/src/app/layout.tsx` inside ToastProvider. State shape:

  ```ts
  type SessionState =
    | { status: 'loading' }
    | { status: 'signedOut' }
    | { status: 'mustChangePassword'; userId: string; email: string }
    | { status: 'signedIn'; userId: string; email: string };
  ```

  - On mount it calls `getSupabase().auth.getSession()`, which reads localStorage and needs no network, so an existing session restores offline (F1).
  - It subscribes to `onAuthStateChange`, which covers SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and USER_UPDATED.
  - `mustChangePassword` is derived from `session.user.app_metadata.must_change_password === true` (D-78).
  - Expose `useSession()`.
  - After every TOKEN_REFRESHED, call `getSupabase().realtime.setAuth(session.access_token)`, so joined private channels get the new JWT (D-114). Assumption: supabase-js forwards a refreshed token to Realtime by itself; the explicit call is harmless if it does.
- [ ] 2. **Route groups (12.6).**
  - Create `apps/web/src/app/(auth)/layout.tsx` (centered column, no shell), `(auth)/sign-in/page.tsx`, `(auth)/sign-up/page.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx` and `(auth)/change-password/page.tsx`.
  - Move the placeholder home to `apps/web/src/app/(main)/page.tsx`, inside `(main)/layout.tsx`.
  - Each page file is a thin server component that renders one Client Component from `src/features/auth` (D-W01, D-100).
- [ ] 3. **Guards (12.6).** Create `apps/web/src/lib/session/RouteGuard.tsx`, used by both route-group layouts:
  - `loading`: render nothing for 300 ms, then a centered spinner (`useDelayedFlag`).
  - `signedOut` on a `(main)` route: `router.replace('/sign-in')`.
  - `mustChangePassword` on any route other than `/change-password`: `router.replace('/change-password')`.
  - `signedIn` on `/sign-in`, `/sign-up` or `/forgot-password`: `router.replace('/')`. (`/reset-password` stays reachable so a recovery can complete.)
  - Do not use Next.js middleware: the session lives in localStorage, which middleware cannot read (D-W01).
- [ ] 4. **Sign-in screen (WEB-01).** Create `apps/web/src/features/auth/SignInForm.tsx` with the 12.5 Sign-in template:
  - wordmark (`display`), title "Sign in" (`title.lg`), Email (`autocomplete="email"`, `type="email"`), Password (`autocomplete="current-password"`, show and hide), a full-width Primary "Sign in", a "Forgot your password?" link (`body.sm`, `color.text.secondary`) opening `/forgot-password` (D-181), and a "Create account" link (`body.sm`) opening `/sign-up` (D-163); phone sign-in stays off

  Validation: `validateEmail` (D-116) before any request. On submit, call `signInWithPassword({ email, password })` and map the errors in `mapSignInError`:
  - code `invalid_credentials`, or any 400 → "Email or password is incorrect." for both wrong email and wrong password
  - HTTP 429 → "Too many attempts. Try again in a few minutes."
  - network failure → the CMP-20 text with Retry

  While `navigator.onLine` is false, Sign in is disabled with "No connection" under it, and the form listens to the `online` and `offline` events. On success the guard sends the user to `/change-password` or `/` (F1).
- [ ] 5. **Change password (WEB-02).** Create `apps/web/src/features/auth/ChangePasswordForm.tsx`:
  - New password and Confirm password, helper "At least 12 characters" (D-47), and Save
  - Save is enabled only when `validateNewPassword` passes and the two fields match
  - while forced, there is no back button and nothing else loads (D-78); from Settings (`/change-password?from=settings`) the TopBar has `nav.back`

  On Save, call `auth.updateUser({ password })` and then `auth.refreshSession()`, so the new JWT lacks the flag (D-78). Access does not wait for the refresh, because `is_active_user()` reads `auth.users` (D-86). Save is offline-disabled with "No connection". Server errors show above the button. A rejected weak password shows the server's reason mapped to "Choose a password of at least 12 characters." from strings.
- [ ] 6. **Sign out (basic).** Add `signOutLocal()` to `apps/web/src/lib/session/signOut.ts`, which calls `auth.signOut({ scope: 'local' })`. This ends only this browser's session, works offline and leaves the user's Android session alone (D-W17). Phase 9 adds the unsent-items warning and the IndexedDB wipe. Add a temporary "Sign out" Text button on `(main)/page.tsx`; Phase 8 removes it.
- [ ] 7. **Strings.** Add `strings.signIn.*` (title, email, password, submit, forgot ("Forgot your password?"), wrongCredentials, rateLimited, noConnection), `strings.signUp.*` (title "Create account", email, password, confirmPassword, username, usernameHelper, displayName, submit, signInLink, emailTaken, usernameTaken), `strings.forgotPassword.*` (title "Forgot password", email, submit "Send reset link", sent "Check your email for a reset link.", back), `strings.resetPassword.*` (title "Reset password", newPassword, confirm, helper, save, mismatch, tooShort) and `strings.changePassword.*` (title, body "Choose a new password to keep using DoloGram.", newPassword, confirm, helper, save, mismatch, tooShort) with the 12.5 wording.
- [ ] 8. **Spec.** Create `apps/web/e2e/phase-04-auth.spec.ts`:
  - wrong password for A shows "Email or password is incorrect.", and no session is stored (`localStorage` has no `sb-` auth key)
  - an unknown email shows the same text
  - a correct password for A opens `/`
  - a reload keeps A signed in
  - `context.setOffline(true)` on `/sign-in` disables Sign in and shows "No connection"
  - signing out returns to `/sign-in`
  - visiting `/` signed out redirects to `/sign-in`
  - the `/sign-in` screen shows a "Create account" link and a "Forgot your password?" link
  - on `/sign-up`, an invalid email, a 4-character username, mismatched passwords and an 11-character password each show a field error and send nothing
  - creating an account with an already-registered email shows `strings.signUp.emailTaken` and stores no session
  - "Send reset link" on `/forgot-password` shows the "Check your email…" confirmation
  - a recovered `/reset-password` accepts a new password and opens `/`
- [ ] 9. **Manual forced-change check (T-10, T-45 web part).** The owner creates a throwaway account with `scripts/create-user` (M1-08), or with ADM-04 once M4-08 exists. Sign in with it on the web: `/change-password` opens and no other route loads. An API read with that session returns no rows (D-78). After Save, `/` opens and the old password fails. Record the result in `docs/test-results/web/phase-04.md`.
- [ ] 10. **Sign-up screen (WEB-01b, D-163).** Create `apps/web/src/features/auth/SignUpForm.tsx` and `(auth)/sign-up/page.tsx` per the 12.5 centered template: wordmark, title "Create account" (`title.lg`), Email (`autocomplete="email"`, `type="email"`), Password (`autocomplete="new-password"`, show and hide), Confirm password, Username (helper "Letters, numbers and underscores, 5–32 characters, starting with a letter", the `^[a-z][a-z0-9_]{4,31}$` rule of D-89), Display name (1–64), a full-width Primary "Create account", and an "Already have an account? Sign in" link to `/sign-in`. Validation before submit: `validateEmail`, `validateNewPassword`, password === confirm, `validateUsername`, `validateDisplayName`. Submit: `getSupabase().auth.signUp({ email, password, options: { data: { username, display_name: displayName } } })`. With email confirmation off (D-163) Supabase returns a session immediately, so `onAuthStateChange` fires `SIGNED_IN` and the guard routes to `/`; there is no separate sign-in step. A self-created account sets its own password, so it carries no `must_change_password` flag and skips Change password. Error mapping: email already registered → `strings.signUp.emailTaken`; username collision (the M1-03 trigger's unique violation propagated, D-163 prerequisite) → `strings.signUp.usernameTaken`; weak password → `strings.changePassword.tooShort`; HTTP 429 → `strings.signIn.rateLimited`; network failure → the CMP-20 text with Retry. The client cannot pre-check username availability (profiles RLS shows only the own row and chat members' rows), so the taken-username case is reported from the signUp error. While `navigator.onLine` is false, Create account is disabled with "No connection".
- [ ] 11. **Forgot password (D-181).** Create `apps/web/src/features/auth/ForgotPasswordForm.tsx` and `(auth)/forgot-password/page.tsx`: Email + a full-width Primary "Send reset link"; on submit call `getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })` and, on success, show `strings.forgotPassword.sent` ("Check your email for a reset link.") and stay on the screen. Create `(auth)/reset-password/page.tsx`: it receives the recovery code in the URL; call `getSupabase().auth.exchangeCodeForSession(window.location.href)`, then show New password + Confirm (same validation as step 5), whose Save calls `auth.updateUser({ password })` and routes to `/`. Add the web production URL and `http://localhost:3000` to the Auth redirect-URL allow-list (M0-05). Both screens are offline-disabled with "No connection".

**Deliverables:** `SessionProvider.tsx`, `RouteGuard.tsx`, `signOut.ts`, `SignInForm.tsx`, `SignUpForm.tsx`, `ForgotPasswordForm.tsx`, `ChangePasswordForm.tsx`, the `(auth)` and `(main)` route groups (now also `sign-up`, `forgot-password` and `reset-password`), the strings, the phase spec and the manual log.

**Acceptance criteria**

- [ ] A wrong email or password creates no session and shows one message for both. (F1, T-10)
- [ ] A correct password opens the chat list route, or Change password for a flagged account. (F1, T-10, T-45 web part)
- [ ] A new account can be created at `/sign-up` with email, password, username and display name; after sign-up it opens `/` without a forced password change, and its `profiles` row exists. (D-163, T-10)
- [ ] A duplicate email shows `strings.signUp.emailTaken` and a taken username shows `strings.signUp.usernameTaken`, and neither creates a session or orphans an `auth.users` row. (D-163)
- [ ] "Send reset link" sends a reset email; opening the link opens `/reset-password`, the new password is accepted, and the old password then fails. (D-181)
- [ ] The session survives a page reload and refreshes without user action (checked by leaving a tab open past 15 minutes and seeing TOKEN_REFRESHED logged on `/dev`). (5.1, D-114)
- [ ] Offline sign-in and sign-up are disabled with "No connection". (F1)
- [ ] While forced, every route redirects to `/change-password`. (D-78)
- [ ] The manual forced-change check of step 9 is logged as passed in `docs/test-results/web/phase-04.md`. (T-10, T-45 web part)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-04 --project=chromium` passes.

**Risks and fallbacks**

- The auth error code differs in the pinned supabase-js release: `mapSignInError` maps on HTTP status (400 → wrong credentials, 429 → rate limited) as well as on `code`, with unit tests.
- Repeated test sign-ins hit the sign-in rate limit (D-85 item 17): specs sign in once per worker and reuse Playwright `storageState`.
- The M1-03 trigger does not propagate a username unique violation: the client receives a generic 500; show `strings.signUp.usernameTaken` for any 500 during sign-up and record as gap PF-W15 for the backend fix.

---

### Phase 5: IndexedDB local store

**Goal:** Persist the queue, the cache and the sync state in IndexedDB behind the shared LocalStore interface, with one worker tab per browser.

**Depends on:** Phase 4.

**Implements:** M2-02 (web adapter), 6.1 Local persistence, 6.2 (Local queue record, Local sync state), D-06, D-12, LS-9, LS-10, D-W02, D-W03, D-W04, TW-01, TW-02.

**Steps**

- [ ] 1. **Interface (C-1).** If `packages/shared/src/store/LocalStore.ts` does not exist, create it with M2-02's contract:

  ```ts
  export interface LocalStore {
    // queue (6.2 Local queue record)
    putQueueItem(item: QueueItem): Promise<void>;
    getQueueItem(tempId: string): Promise<QueueItem | undefined>;
    listQueue(filter?: { status?: QueueStatus[]; chatId?: string }): Promise<QueueItem[]>;
    deleteQueueItem(tempId: string): Promise<void>;
    countUnsent(): Promise<number>; // queued + sending + failed (D-93)
    // cache
    upsertRows<T extends CacheTable>(table: T, rows: CacheRow<T>[]): Promise<void>;
    deleteChatData(chatId: string): Promise<void>; // D-91
    // sync_state (6.2 Local sync state)
    getCursor(chatId: string): Promise<number>;
    setCursor(chatId: string, cursor: number): Promise<void>;
    // blobs (web attachments, M3-02)
    putBlob(key: string, blob: Blob): Promise<void>;
    getBlob(key: string): Promise<Blob | undefined>;
    deleteBlob(key: string): Promise<void>;
    clearAll(): Promise<void>; // sign out, D-109 (5)
    subscribe(listener: (change: StoreChange) => void): () => void;
  }
  ```

  `QueueStatus` is `'queued'|'sending'|'sent'|'failed'` only (LS-2). `CacheTable` is `'chats'|'chat_members'|'profiles'|'messages'|'message_media'|'reactions'|'folders'|'folder_chats'`. If it is missing, also create the shared contract suite `packages/shared/src/store/contract.ts`, exporting `runLocalStoreContract(makeStore)`. It contains M2-02's tests: write, close, reopen and read return identical data; status takes only the four values; an older schema version upgrades without data loss.
- [ ] 2. **Adapter.** Install `idb` (ISC), a small promise wrapper around IndexedDB, pinned and recorded. Create `apps/web/src/lib/store/IndexedDbStore.ts` with database `dologram`, version 1 (D-W03):

  | Object store | Key path | Indexes |
  |---|---|---|
  | `queue` | `temp_id` | `by_status` (status), `by_chat_order` ([chat_id, enqueue_order]) |
  | `chats` | `chat_id` | none |
  | `chat_members` | [`chat_id`, `user_id`] | `by_user` (user_id) |
  | `profiles` | `user_id` | none |
  | `messages` | `message_id` | `by_chat_seq` ([chat_id, seq]), `by_chat_created` ([chat_id, created_at]) |
  | `message_media` | `media_id` | `by_message` (message_id) |
  | `reactions` | [`message_id`, `user_id`, `emoji`] | `by_message` (message_id) |
  | `folders` | `folder_id` | none |
  | `folder_chats` | [`folder_id`, `chat_id`] | `by_chat` (chat_id) |
  | `sync_state` | `chat_id` | none |
  | `blobs` | key string (`media_id`) | none |
  | `meta` | key string | none (holds `enqueueCounter`, `pendingRead:<chat_id>`, `schemaVersion`) |

  ```powershell
  npm install --workspace apps/web --save-exact idb
  ```

  `upgrade(db, oldVersion)` creates the stores for version 1 and is the single place later versions add stores or indexes, so an upgrade keeps data (M2-02). Every write goes through one `readwrite` transaction per call. The adapter keeps no copy of the data in memory; IndexedDB is the source of truth for the UI (D-W02).
- [ ] 3. **Change notification across tabs (D-W04).** After every committed write, `IndexedDbStore` calls its local listeners and posts `{ table, keys }` on `new BroadcastChannel('dg-store')`. Other tabs' stores re-emit the change to their listeners. Create `apps/web/src/lib/store/useStoreQuery.ts`: `useStoreQuery(query, deps)` re-runs an async read when a matching change arrives and returns `{ data, loading }`, built on `useSyncExternalStore` with a cached snapshot.
- [ ] 4. **Worker leadership (D-W04).** Create `apps/web/src/lib/worker/leader.ts`. `runAsLeader(onLead)` calls `navigator.locks.request('dg-worker', async () => { await onLead(); })` and holds the lock for the tab's life, so exactly one tab per browser runs the delivery worker and the Realtime subscriptions (Phases 6 and 7) and the other tabs read IndexedDB. When the leader tab closes, the lock passes to another tab. Assumption: the Web Locks API exists in every D-109 browser; checked by T-50, fallback a BroadcastChannel heartbeat election in the same file (the tab with the lowest random id that answered within 2 seconds leads).
- [ ] 5. **Store provider.** Create `apps/web/src/lib/store/StoreProvider.tsx` (inside SessionProvider). It opens `IndexedDbStore` once per signed-in session and exposes `useStore()`. It runs LS-9 startup recovery: every queue item in `sending` is put back to `queued` with `next_attempt_at = Date.now()`.
- [ ] 6. **Contract tests (TW-01).** Create `apps/web/src/lib/store/IndexedDbStore.test.ts`. It calls `runLocalStoreContract(() => new IndexedDbStore(fakeIndexedDbFactory))` and adds: a stored `File` round-trips as a Blob with the same size and type; `countUnsent` counts queued, sending and failed but not sent; `deleteChatData` removes the chat's rows from every cache table and its `sync_state`.
- [ ] 7. **Store page.** Create `apps/web/src/app/dev/store/page.tsx` with buttons "Write sample queue item", "List queue", "Clear all", a line "Leader: yes/no" from `leader.ts`, and a live count per store from `useStoreQuery`.
- [ ] 8. **Spec (TW-02).** Create `apps/web/e2e/phase-05-store.spec.ts`:
  - open `/dev/store` in two pages of one context: exactly one shows "Leader: yes"
  - close the leader page: the other shows "Leader: yes" within 2 seconds
  - "Write sample queue item" in one page updates the count in the other within 1 second
  - after `page.reload()` the item is still listed (LS-9)

**Deliverables:** `LocalStore.ts` and `contract.ts` (if they were missing), `IndexedDbStore.ts`, `useStoreQuery.ts`, `leader.ts`, `StoreProvider.tsx`, the tests, `/dev/store` and the phase spec.

**Acceptance criteria**

- [ ] The shared contract suite passes against the IndexedDB adapter. (M2-02, TW-01)
- [ ] Data survives a reload and a browser restart (manual: close Chrome, reopen `/dev/store`, the item is listed). (LS-9, LS-10)
- [ ] Exactly one tab is the leader, and leadership moves when it closes. (TW-02)
- [ ] An item left in `sending` before a reload shows `queued` after it. (LS-9)

**Exit gate:** `npm run test --workspace apps/web; if ($?) { npm run e2e --workspace apps/web -- phase-05 --project=chromium --project=firefox }` passes.

**Risks and fallbacks**

- Storing a `File` in IndexedDB fails in one browser (PF-W12): store `await file.arrayBuffer()` with its `type` and `name` in the `blobs` record and rebuild a `Blob` on read. The adapter hides the difference.
- Safari private windows give IndexedDB a small quota: unsupported for daily use; the app shows the CMP-20 error with "This browser can't store messages for offline use." when `open()` fails.

---

### Phase 6: Queue core and delivery worker

**Goal:** Deliver text messages through the IndexedDB queue with the LS-2 statuses, the D-27 and D-77 retry rules, strict per-chat row order and LS-8 idempotency.

**Depends on:** Phase 5.

**Implements:** M2-03 (web host), LS-1, LS-2, LS-3, LS-4 (row-first ordering), LS-7, LS-8, LS-9, LS-10, 6.3 (web queue), D-10, D-12, D-19, D-27, D-77, D-93, D-109 (6), D-117 (4), D-W04, D-W18, T-09 (automated), T-18, T-19, T-41 (web part).

**Steps**

- [ ] 1. **Queue item shape.** In `packages/shared/src/queue/types.ts` (create it if missing):

  ```ts
  type QueueItem = {
    temp_id: string;            // = message_id (D-10)
    chat_id: string;
    payload: {
      content: string;
      reply_to: string | null;
      attachments: QueuedAttachment[]; // empty until Phase 16
    };
    status: 'queued' | 'sending' | 'sent' | 'failed'; // LS-2
    retry_count: number;
    next_attempt_at: number;    // epoch ms (D-77)
    enqueue_order: number;      // per-device counter from meta.enqueueCounter
    row_state: 'absent' | 'unknown' | 'stored'; // D-93 Discard rule
    force_low_signal: false;    // LS-6 snapshot; always false on web (D-19)
    last_error: string | null;  // strings key of the last failure
  };
  ```

- [ ] 2. **State machine (shared, M2-03).** If `packages/shared/src/queue/QueueCore.ts` does not exist, build it as a pure module over `LocalStore`, an injected `Clock`, an injected `Connectivity` (`isConnected(): boolean`, `onChange(cb)`) and an injected `Sender` (`insertMessage(row)`, `softDelete(messageId)`, and from Phase 16 `uploadAttachment(...)` and `insertMedia(...)`). Its functions:
  - `enqueue(item)`: writes the item before any network call, with `status: 'queued'` (LS-1). It refuses a new item with `strings.composer.queueFull` ("Can't queue more than 200 unsent messages. Send or discard some first.") when `countUnsent() >= 200` (D-27, D-93).
  - `tick()`: one worker pass. For each chat, take its lowest `enqueue_order` item whose row is not yet stored. If that item is failed or backing off, the chat is blocked for row inserts. Other chats are never blocked, and attachment uploads never block (D-93). An item is attempted only when `now >= next_attempt_at` (D-77).
  - Attempt: set `sending`, then call `insertMessage({ message_id, chat_id, sender_id, content, reply_to, attachment_count })`. The result is handled by `classifyError`:
    - success → `row_state: 'stored'`, and `sent` when there are no attachments
    - `delivered` (23505) → `stored` and `sent` (LS-8)
    - `rateLimited` → back to `queued` with `next_attempt_at = now + retryAfterSeconds * 1000`, without counting (D-77)
    - `network` while `isConnected()` → `retry_count + 1` and `next_attempt_at = now + backoff(retry_count)`; at 8 → `failed`
    - `network` while not connected → `queued`, not counted (LS-7)
    - `permanent` → `failed` at once with its message (D-W18)

    A network failure also sets `row_state: 'unknown'`, because the server may have stored the row (T-09).
  - `backoff(n)`: `min(60000, 2000 * 2^(n-1))`, multiplied by a random factor in [0.8, 1.2] (D-27).
  - `onConnectivityRegained()`: every `queued` item gets `next_attempt_at = now`, and `retry_count` is not reset (LS-7).
  - `retry(tempId)`: `failed` → `queued`, `retry_count = 0`, `next_attempt_at = now` (D-93).
  - `discard(tempId)`: when `row_state` is `absent`, delete the item. When it is `stored` or `unknown`, it needs a connection: call `softDelete(message_id)`. A "no row" result for `unknown` is treated as absent. Then delete the item. Offline, it throws `OfflineError`, and the UI disables Discard (D-93, LS-7).
  - `recoverOnStartup()`: `sending` → `queued` (LS-9).
- [ ] 3. **Web connectivity (D-12).** Create `apps/web/src/lib/worker/webConnectivity.ts`. `isConnected()` returns `navigator.onLine`. `onChange` listens to the window `online` and `offline` events. The Network Information API is not used (D-12). Every connection counts as the LS-5 Normal row, and offline as "No connection" (D-19, D-93).
- [ ] 4. **Web sender.** Create `apps/web/src/lib/worker/supabaseSender.ts`:
  - `insertMessage` calls `getSupabase().from('messages').insert(row).select('message_id, chat_id, sender_id, content, reply_to, attachment_count, seq, sync_seq, edited_at, deleted_at, created_at').single()` and writes the returned row into the `messages` cache.
  - `softDelete` calls `.update({ deleted_at: new Date().toISOString() }).eq('message_id', id).select('message_id')`. The server sets the time and clears content (D-76). Zero returned rows means the row was never stored.
  - `sender_id` is the session user id.
- [ ] 5. **Worker host (D-109 (6), D-117 (4)).** Create `apps/web/src/lib/worker/DeliveryWorker.tsx`, mounted in `(main)/layout.tsx`. Only the leader tab (`runAsLeader`) runs it, and only while `document.visibilityState === 'visible'`. Every one of these calls `tick()`:
  - a `setInterval` of `config.queue.timerMs` (15 s) while a connection is reported (LS-3)
  - the `online` event (after `onConnectivityRegained()`)
  - `visibilitychange` to `visible`
  - a new enqueue

  On `hidden` it clears the interval. An in-flight request is allowed to finish, and nothing starts in the background (D-109). Ticks never overlap: a running tick sets a flag and a new call waits for it.
- [ ] 6. **Queue unit tests.** Create `packages/shared/src/queue/QueueCore.test.ts` with a fake clock and a fake sender covering:
  - every transition queued → sending → sent | failed
  - a dropped response after the server stored the row, then a retry that gets 23505, leaving one row in the fake server and the item `sent` (T-09 automated)
  - 8 connected failures → `failed` (T-18)
  - disconnected failures not counted
  - DG429 waits its seconds without counting
  - regained connection makes items due at once with the count kept
  - a blocked first item holds back the second item of the same chat but not another chat (D-93)
  - the 201st unsent item is refused
  - Retry resets the count
  - Discard with `row_state: 'stored'` offline throws, and online soft-deletes
  - startup recovery
- [ ] 7. **Queue page.** Create `apps/web/src/app/dev/queue/page.tsx`. It sends text to the signed-in user's Saved Messages: the Saved Messages chat id is read from `chats` where `type = 'direct'` and `direct_key = <user id>` (D-70), fetched once through the API. It shows a list of queue items with temp_id, status, retry_count and next_attempt_at, plus Retry and Discard buttons. It also has an "Inject failure" switch that makes `supabaseSender` throw a network error on its next five calls (fault-injectable fetch, M2-03).
- [ ] 8. **Spec (T-19, T-41 web part).** Create `apps/web/e2e/phase-06-queue.spec.ts`:
  - signed in as A, `context.setOffline(true)`, send "T-19 <uuid>" on `/dev/queue`: the item shows `queued`
  - `setOffline(false)`: the item reaches `sent` within 20 seconds
  - `countMessages(A, message_id)` returns 1 (T-19)
  - with "Inject failure" on and online, the item retries and shows `failed` after 8 attempts (the spec injects shorter `config.queue` timings through `window.__dgTestConfig`, honored only when `NODE_ENV !== 'production'`), then Retry delivers it (T-18, T-41)
  - offline, Discard on a failed item whose `row_state` is `unknown` is disabled (T-41)

**Deliverables:** `packages/shared/src/queue/types.ts` and `QueueCore.ts` with tests (if they were missing), `webConnectivity.ts`, `supabaseSender.ts`, `DeliveryWorker.tsx`, `/dev/queue` and the phase spec.

**Acceptance criteria**

- [ ] Every queue transition test passes. (M2-03, LS-2, LS-7)
- [ ] A message sent offline is stored exactly once after the browser goes online. (T-19, LS-10, LS-8)
- [ ] A lost response followed by a retry leaves exactly one row. (T-09 automated)
- [ ] Exhausted retries show `failed`, which stays visible with Retry and Discard. (T-18)
- [ ] No delivery attempt starts while the tab is hidden (manual: switch tabs during an offline-to-online change; the item sends when the tab returns). (D-109 (6), T-49 part)
- [ ] The 201st unsent item is refused with the D-27 message. (T-41 web part)

**Exit gate:** `npm run test --workspace packages/shared; if ($?) { npm run e2e --workspace apps/web -- phase-06 --project=chromium }` passes.

**Risks and fallbacks**

- `navigator.onLine` reports true on a network without internet: an attempt then fails with a network error and counts toward the 8 (LS-7 counts only when "the device reported a connection"). Accepted; Retry recovers.
- The Android plan's `QueueCore` already exists with another signature: adapt `DeliveryWorker` to it. Do not create a second core (C-1).

---

### Phase 7: Sync module

**Goal:** Keep the IndexedDB cache equal to the server through Postgres Changes and per-chat sync_seq resync, behind the shared delivery interface.

**Depends on:** Phase 6.

**Implements:** M2-05 (web host), 6.4, D-14, D-40, D-43, D-44, D-91, D-123 (interface only), D-W04, D-W16, D-W19, T-13 (web form), T-38 (client part), TW-09.

**Steps**

- [ ] 1. **Delivery interface (D-43).** If `packages/shared/src/sync/MessageDelivery.ts` does not exist, create it:

  ```ts
  export interface MessageDelivery {
    start(handlers: {
      onRow(table: 'messages' | 'message_media' | 'reactions', row: unknown): void;
      onStatus(status: 'connected' | 'disconnected' | 'refused'): void;
    }): Promise<void>;
    stop(): Promise<void>;
  }
  ```

  Implement `PostgresChangesDelivery` in `packages/shared/src/sync/PostgresChangesDelivery.ts`. It uses one channel with three `postgres_changes` listeners (`event: '*'`, `schema: 'public'`, `table` = each of the three) and no client filter: RLS filters (6.4, M2-05). INSERT and UPDATE events are handled. No DELETE events exist, because no DELETE is granted (D-14). A database Broadcast implementation can replace it behind the same interface at the D-123 switch point.
- [ ] 2. **Channel authorization check (PF-W2, TW-09).** The channel topic is `db:<user_id>`. Before step 3, run this check on `/dev/sync` (step 6) as A: subscribe and wait for `SUBSCRIBED` or `CHANNEL_ERROR`. Assumption: a Postgres Changes subscription is authorized by table RLS and is accepted with "Allow public access" disabled when the channel is not private. Record the result in `docs/test-results/web/phase-07.md`.
  - If `SUBSCRIBED`: continue.
  - If refused: set `onStatus('refused')`. The sync engine then runs `resyncAll()` on every 15-second worker tick while the tab is visible (interim fallback), and the gap goes to the owner as a backend change (a `realtime.messages` policy for the `db:` topic), outside this plan.
- [ ] 3. **Sync engine (M2-05).** If `packages/shared/src/sync/SyncEngine.ts` does not exist, build it over `LocalStore`, `MessageDelivery` and a data source. Functions:
  - `fetchChatList()`: read `chats`, the caller's and the other members' `chat_members` rows (RLS returns rows of the caller's chats), the members' `profiles`, and the caller's `folders` and `folder_chats`. Upsert them all. Every cached chat absent from the fetch has `deleteChatData(chat_id)` run on it (D-91, T-38).
  - `resyncChat(chatId)`:
    1. Read `H = chats.next_seq` for the chat.
    2. For each of `messages`, `message_media` and `reactions`, fetch rows with `chat_id = chatId`, `sync_seq > cursor` and `sync_seq <= H`, ordered by `sync_seq`, in pages of 500 (M2-05), until a page returns fewer than 500 rows.
    3. Upsert every row by key, then `setCursor(chatId, H)`.

    The device clock is never used (D-40). Because the counter row stays locked until commit, every row with `sync_seq <= H` has committed when H is read (D-40), so no row is skipped (D-W19). Assumption: members can SELECT `chats.next_seq`; checked on the first run; fallback: cursor = the smallest of the three tables' highest fetched sync_seq.
  - `resyncAll()`: `fetchChatList()`, then `resyncChat` for every chat in sequence.
  - `onRow(table, row)`: upsert by key and never move the cursor (D-40: merging by key makes a duplicate harmless). An event naming an unknown chat triggers `fetchChatList()` (M2-05).
  - `refreshReadState(chatId)`: re-read the chat's `chat_members` rows. It runs on chat open, on foreground and on a read hint (Phase 15), because `chat_members` is not in the publication (M2-05).
- [ ] 4. **Web sync host.** Create `apps/web/src/lib/sync/SyncHost.tsx`, mounted in `(main)/layout.tsx` next to DeliveryWorker and run only by the leader tab (D-W04). On start, `visibilitychange` to visible, and the `online` event, it:
  1. re-subscribes the delivery channel (`stop()` then `start()`)
  2. calls `resyncAll()` (6.4: re-subscribe, then fetch)

  Non-leader tabs see every change through the BroadcastChannel of Phase 5. A `syncState` value in `meta` (`'idle'|'syncing'|'error'` with the last error key) drives the loading and error states of later screens.
- [ ] 5. **Full history in the cache (D-W16).** The first `resyncChat` from cursor 0 fetches the chat's whole history in pages of 500. The screens then page through the local cache 50 rows at a time (D-44, M2-08). Unread counts come from one IndexedDB query in Phase 10 (C-7).
- [ ] 6. **Sync page.** Create `apps/web/src/app/dev/sync/page.tsx`. It shows the channel status, and per chat the cached message count, the highest cached seq and the cursor, plus buttons "Resync now" and "Stop channel".
- [ ] 7. **Unit tests.** Create `packages/shared/src/sync/SyncEngine.test.ts` with a fake data source:
  - an event replayed twice leaves the cache unchanged
  - a skewed fake device clock does not change the cursor
  - rows written at the same sync_seq window by two senders all arrive
  - a chat missing from the list fetch is deleted locally with its cursor
  - an event for an unknown chat fetches the chat list
- [ ] 8. **Spec (T-13 web form, T-38 client part).** Create `apps/web/e2e/phase-07-sync.spec.ts`:
  - A on `/dev/sync`. B (API helper) inserts a message into A-B: A's count rises within 2 seconds without a reload.
  - Make A's page hidden (open a second tab in front, or call `page.evaluate` to dispatch `visibilitychange` with an overridden `visibilityState`). Then B inserts a message and edits it, and G inserts one into A+B+G at the same moment through `Promise.all`. A becomes visible: every message and the edit are cached, and the cursors equal `chats.next_seq`. (T-13)
  - A owner-side removal of B from a test group, done by A through the API helper, then B's page becoming visible: B's cache no longer holds that chat. (T-38 client part; the group is created by the spec and is not a fixture chat.)

**Deliverables:** `MessageDelivery.ts`, `PostgresChangesDelivery.ts` and `SyncEngine.ts` with tests (if they were missing), `SyncHost.tsx`, `/dev/sync`, the phase spec and the TW-09 result.

**Acceptance criteria**

- [ ] A second browser profile signed in as A shows the same cached history as the first (compare the counts on `/dev/sync`). (T-04 precondition)
- [ ] Missed messages, edits and concurrent inserts appear after the tab becomes visible, fetched by sync_seq. (T-13)
- [ ] A removed member's cache loses the chat on the next foreground. (T-38 client part, D-91)
- [ ] The channel join result is recorded, and the fallback runs if the join is refused. (TW-09, PF-W2)

**Exit gate:** `npm run test --workspace packages/shared; if ($?) { npm run e2e --workspace apps/web -- phase-07 --project=chromium }` passes.

**Risks and fallbacks**

- The channel is refused (PF-W2): the 15-second resync fallback keeps the data correct but breaks the T-01 latency budget of 2 seconds. The release gate of Phase 19 is blocked until the owner adds the authorization.
- A large first history fetch: at 2 to 10 users this is accepted (D-41). If a chat exceeds 10,000 cached rows, record the size in the test log for the owner.

---

### Phase 8: Responsive shell and navigation

**Goal:** Build the main layout with the navigation rail from 768 px, the bottom tab bar below 768 px, the list and chat panes, and dialogs as history state.

**Depends on:** Phase 7.

**Implements:** WEB-03, 11.3 Layout, 12.6 (user web routes, keyboard order), 12.7 (user web widths), CMP-15, CMP-23, CMP-32, CMP-33, D-35, D-128 (superseded), D-142, D-145, T-40 (breakpoint part).

**Steps**

- [ ] 1. **Layout module.** Create `apps/web/src/features/shell/MainLayout.tsx` and `MainLayout.module.css`, used by `apps/web/src/app/(main)/layout.tsx`. The breakpoints are only CSS media queries `(min-width: 768px)` and `(min-width: 1280px)`, so the first paint is correct with no JavaScript width check (12.7). Grid areas:
  - below 768 px: one column. The chat list route shows the list plus the TabBar at the bottom. The chat route shows the chat full screen with no TabBar and a back button to `/`.
  - 768 to 1279 px: `rail 72px | list 360px | chat 1fr`, with the list pane's right border 1 px `color.border.subtle`.
  - from 1280 px: `rail 72px | list 400px | chat 1fr`, plus an `info 360px` column when chat info is open (D-145).
- [ ] 2. **NavRail (CMP-33).** Create `apps/web/src/components/NavRail/NavRail.tsx` as `<nav aria-label="Main">`:
  - the "D" mark, Inter Bold 24 in a 48 square, linking to `/` with the label "DoloGram, chats"
  - Chats (`nav.chats`), active on every chat-list, archive and chat route with `aria-current="page"`, fill `color.bg.surface` and stroke 2.5
  - New (`nav.new`), which opens a Menu (CMP-23) with "New chat" and "New group"
  - Profile, the user's 24 Avatar at the bottom, label "Profile and settings", which opens the Settings dialog

  Items show their names as tooltips on hover and focus.
- [ ] 3. **TabBar (CMP-32).** Create `apps/web/src/components/TabBar/TabBar.tsx` as a `<nav>` fixed to the bottom, height 56 plus `env(safe-area-inset-bottom)`, rendered only below 768 px on the chat list. It has three icon-only items with the labels "Chats", "New" and "Profile and settings". New is a button with `aria-haspopup="dialog"` that opens a BottomSheet (CMP-15) with "New chat" and "New group". A tap on Chats while active scrolls the list to the top.
- [ ] 4. **Panes.**
  - `apps/web/src/features/shell/ListPane.tsx` hosts the chat list, filled in Phase 10.
  - `apps/web/src/features/shell/ChatPane.tsx` hosts the open chat. On `/` from 768 px it shows the EmptyState with `action.newChat` and "Select a chat" (11.3).
  - Routes: `(main)/page.tsx` (list), `(main)/archive/page.tsx` (archive, Phase 10) and `(main)/chat/[chatId]/page.tsx` (chat, Phase 12; this phase shows the TopBar with the chat id and a back button).
- [ ] 5. **Overlay state.** Create `apps/web/src/features/shell/OverlayProvider.tsx` with the state `{ kind: 'none' | 'newChat' | 'newGroup' | 'forward' | 'folders' | 'settings' | 'media', props?: object }`. Dialogs are state, not routes (12.6, D-128), and each open pushes a history entry through `useOverlayHistory` (Phase 3). This phase opens empty Dialog shells titled "New chat", "New group" and "Settings"; their contents arrive in Phases 9 and 11.
- [ ] 6. **Tab order (12.6).** DOM order is rail, top bar, banners, folder tabs, list, then the chat (top bar, messages, composer). Below 768 px the TabBar comes last in the DOM. No positive `tabindex` is used anywhere (`jsx-a11y/no-noninteractive-tabindex` and `tabindex-no-positive` are in the strict set).
- [ ] 7. **Document title.** Create `apps/web/src/features/shell/useDocumentTitle.ts`, which sets `document.title` to `DoloGram`, or `(<n>) DoloGram` when the total unread count n is above 0 (WEB-03, D-W15). The count comes from Phase 10; until then n is 0.
- [ ] 8. **Remove** the temporary Sign out button of Phase 4.
- [ ] 9. **Spec.** Create `apps/web/e2e/phase-08-shell.spec.ts`:
  - at viewport 767 by 900 the TabBar is visible and the NavRail is hidden; at 768 by 900 the NavRail is visible, the list pane is 360 px wide and "Select a chat" shows; at 1280 by 900 the list pane is 400 px wide (T-40 breakpoint part)
  - New opens a menu at 768 px and a bottom sheet at 767 px
  - the browser back button closes the Settings dialog without leaving `/`
  - Tab from the page start reaches the rail before the list

**Deliverables:** `MainLayout`, `NavRail`, `TabBar`, `ListPane`, `ChatPane`, `OverlayProvider`, `useDocumentTitle`, the `(main)` routes and the phase spec.

**Acceptance criteria**

- [ ] At 767 px the layout is one column and at 768 px two columns plus the rail. (T-40, D-35)
- [ ] From 1280 px the list pane is 400 px. (D-145)
- [ ] The tab bar is not shown on the chat route below 768 px. (D-142, 12.7)
- [ ] The browser back button closes a dialog first. (12.6, TW-06)
- [ ] Tab order follows rail, list, chat. (D-95, 12.6)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-08 --project=chromium` passes.

**Risks and fallbacks**

- A CSS grid of a later column does not collapse in one browser: checked in the T-50 run of Phase 19; fallback flexbox with the same widths in `MainLayout.module.css`.

---

### Phase 9: Settings dialog, theme setting and sign-out

**Goal:** Build the Settings dialog with the profile card, the theme choice, Change password, About and a sign-out that warns about unsent items and wipes this browser's data.

**Depends on:** Phase 8.

**Implements:** WEB-14, F1 (sign out, change password), 12.5 Settings template, D-51, D-83, D-109 (5), D-W17, T-10 (change password while signed in), T-40 (theme part), T-49 (sign-out part), TW-08.

**Steps**

- [ ] 1. **Dialog content.** Create `apps/web/src/features/settings/SettingsDialog.tsx`, opened by Profile (rail or tab bar) as a form Dialog (520 wide from 768 px, full screen below). Content, top to bottom:
  - Profile card, height 88: 64 Avatar, display name (`title.sm`) and `@username` (`body.sm` `color.text.secondary`), read from the cached `profiles` row of the session user
  - section "Appearance": a 3-option radio group, System, Light and Dark, with the icons `theme.system`, `theme.light` and `theme.dark`. A change calls `setThemeSetting` and applies at once (D-83)
  - section "Chats": Folders, which is hidden until Phase 18 adds WEB-13
  - section "Account": Change password, which navigates to `/change-password?from=settings` and is disabled offline with "No connection", and Sign out in `color.danger`
  - section "About": "DoloGram <version> (<build>)" in `body.sm`, with the version from `apps/web/package.json` (exposed through `next.config.ts` `env`) and the build from NEXT_PUBLIC_DG_BUILD

  No Force Low Signal Mode, app lock or notifications rows exist (D-19, F10, F11).
- [ ] 2. **Sign out (D-109 (5)).** Extend `apps/web/src/lib/session/signOut.ts` with `signOutAndWipe()`:
  1. `countUnsent()`. If it is above 0, show a confirm Dialog: "<n> unsent messages will be lost", with Cancel and the Danger button "Sign out".
  2. On confirm, the leader stops DeliveryWorker and SyncHost.
  3. `store.clearAll()`, then `indexedDB.deleteDatabase('dologram')`.
  4. Remove every localStorage key that starts with `dg.` except `dg.theme`, which is a device preference (D-83).
  5. `auth.signOut({ scope: 'local' })` (D-W17), then broadcast `signedOut` on `dg-store` so other tabs reload to `/sign-in`.

  Offline sign-out works, because nothing in it needs the network.
- [ ] 3. **Strings.** Add `strings.settings.*` with the section headers and labels of 12.5, `strings.settings.signOutWarning` = "{n} unsent messages will be lost", and `strings.settings.about` = "DoloGram {version} ({build})".
- [ ] 4. **Spec.** Create `apps/web/e2e/phase-09-settings.spec.ts`:
  - choosing Dark sets `data-theme="dark"` and survives a reload; choosing System with emulated `colorScheme: 'light'` shows a white background (T-40 theme part)
  - with two items queued offline on `/dev/queue`, Sign out shows "2 unsent messages will be lost", and after confirming, the `dologram` database is absent (`indexedDB.databases()` does not list it), `/sign-in` is shown and `dg.theme` is kept (T-49 sign-out part, TW-08)
  - offline Sign out without unsent items reaches `/sign-in` (TW-08)
- [ ] 5. **Manual check (T-10).** Signed in as a throwaway account, change the password from Settings, sign out, sign in with the old password (refused) and the new one (accepted). Log it in `docs/test-results/web/phase-09.md`.

**Deliverables:** `SettingsDialog.tsx`, `signOutAndWipe`, the strings, the phase spec and the manual log.

**Acceptance criteria**

- [ ] System, Light and Dark apply to every screen, and the choice survives a restart. (T-40, D-83)
- [ ] Sign out with unsent items warns, and then leaves the queue and cache empty. (T-49, D-109 (5))
- [ ] Sign out works offline. (TW-08)
- [ ] Change password while signed in works, and the old password stops working. (T-10, D-51)
- [ ] The dialog has no Low Signal, app lock or notification control. (D-19)
- [ ] The manual T-10 check of step 5 is logged as passed in `docs/test-results/web/phase-09.md`. (T-10)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-09 --project=chromium` passes.

**Risks and fallbacks**

- `indexedDB.deleteDatabase` is blocked by another open tab: the `signedOut` broadcast makes the other tabs close their connection (`db.close()`) before reloading. If the delete stays blocked for 5 seconds, `clearAll()` has already emptied every store, which meets D-109 (5).

---

### Phase 10: Chat list and archive view

**Goal:** Show the cached chat list in D-94 order with previews, statuses, unread counts, the Archived row, folder tabs and the offline banner, plus the Archive view.

**Depends on:** Phase 9.

**Implements:** F2, F7 (listing), WEB-04, WEB-05, 12.5 Chat list and Archive templates, CMP-06, CMP-08 (row icons), CMP-09, CMP-13 (offline banner only), CMP-14, CMP-18, D-12, D-19, D-23, D-44, D-70, D-89, D-92, D-94, D-109 (12), D-110, D-W15, D-W16, M2-08, T-04, T-36 (list order part).

**Steps**

- [ ] 1. **List query.** Create `apps/web/src/features/chatList/useChatList.ts` (on `useStoreQuery`). It returns, for the session user, every cached chat with:
  - `title`: the group title; for a direct chat the other member's display name (or "Deleted account" per D-110, or "Former member" when the profile is unreadable, D-89); "Saved Messages" when `direct_key` equals the user id (D-70)
  - `archived` and `muted_until` from the user's own `chat_members` row
  - `newest`: the cached message with the highest seq
  - `unread`: the count of cached messages from other senders with `seq > last_read_seq`, excluding deleted and expired ones (D-23, D-92), computed in one pass over the `messages` index (D-W16)
  - `ownLastStatus`: the LS-2 status of the user's newest queued item for the chat, otherwise `sent` or `seen` (Phase 15 fills seen)

  Order (D-94): non-archived chats only, by the `created_at` of the newest message, else `chats.created_at`, both descending, with ties by `chat_id`. Pending queue items count as the newest message by their enqueue time, so a chat moves up when the user sends.
- [ ] 2. **Preview text.** Create `packages/shared/src/format/preview.ts` (shared, so Android matches, C-1). `previewText(message, attachments)` returns the text with the Markdown markers `*`, `_`, backticks and `[text](url)` reduced to their text, or "Photo", "Video", "Voice note", "File" for an attachment-only message, or "Deleted message" (AND-03). In a group it prefixes the sender's display name and ": ", or "You: " (CMP-09).
- [ ] 3. **Time format (D-109 (12)).** Create `packages/shared/src/format/time.ts` with `Intl.DateTimeFormat` in the browser locale (D-W12): today shows the time, yesterday "Yesterday", within 7 days the weekday, older the date.
- [ ] 4. **ChatRow (CMP-09).** Create `apps/web/src/components/ChatRow/ChatRow.tsx` as a Next.js `<Link>` inside a `<ul>`:
  - height 72, 56 Avatar, name in `title.sm`
  - the `action.mute` icon when `muted_until` is in the future (D-94)
  - status icon (CMP-08, `icon.sm`) before the preview for the user's own last message, `color.danger` for failed; no Low Signal icons on web (D-132)
  - unread state in Inter Bold with a Badge (muted colors when muted)
  - the open chat with `color.bg.selected` and `aria-current="page"`
  - the accessibility label "<name>, <n> unread, muted, <preview>, <time>", leaving out parts that do not apply
  - a hover and focus `action.more` IconButton, right-click and Shift+F10, all opening the row Menu (CMP-23). In this phase its items are only "Leave group" (Phase 11), and Archive, Mute and Add to folder are added in Phase 18.
- [ ] 5. **ChatList screen (WEB-04).** Create `apps/web/src/features/chatList/ChatList.tsx`, rendered in ListPane:
  - TopBar (chat list variant)
  - the offline banner (CMP-13, step 6)
  - FolderTabs (CMP-14, `role="tablist"`): "All" plus the user's folders by name. A selected folder sets `?folder=<folder_id>` (12.6) and shows that folder's non-archived chats (D-94).
  - the "Archived (n)" row (`action.archive` in a 56 `color.bg.surface` circle) when archived chats exist, linking to `/archive`
  - the rows, rendered 50 at a time with more added on scroll (D-44)

  States: a loading Skeleton of 8 rows after 300 ms while the first sync runs with an empty cache; with a cache, the cached list plus a Toast with Retry on a sync error; with no cache and an error, ErrorState with Retry (12.5). There is no empty state, because Saved Messages is always listed (F2).
- [ ] 6. **Offline banner (CMP-13, D-12).** Create `apps/web/src/components/ConnectionBanner/ConnectionBanner.tsx`: height 40, `color.info.bg`, `status.offline` and "Offline: messages send when connected" in `body.sm` `color.info.text`, `role="status"`. It shows while `navigator.onLine` is false (`online` and `offline` events). There is no "waiting for Wi-Fi" banner and no Low Signal chip on web (D-19, WEB-04).
- [ ] 7. **Archive view (WEB-05).** Create `apps/web/src/app/(main)/archive/page.tsx` rendering `ArchiveList.tsx`: TopBar "Archived" with back, then archived chats in the same D-94 order. A new message does not move a chat out (D-94). Empty: EmptyState "No archived chats". Unarchive arrives in Phase 18.
- [ ] 8. **Document title.** Feed the total of `unread` over non-archived chats into `useDocumentTitle` (WEB-03, D-W15).
- [ ] 9. **Spec.** Create `apps/web/e2e/phase-10-chat-list.spec.ts`:
  - A sees Saved Messages, A-B, A+B and A+B+G
  - B sends to A-B through the API: A-B moves to the top within 2 seconds, its preview shows the text, the unread Badge shows 1 and the title starts with "(1)"
  - a second browser context signed in as A shows the same list order (T-04 list part)
  - `context.setOffline(true)` shows the offline banner, and the cached list stays visible after a client-side navigation
  - at 767 px a row opens the chat route full screen

**Deliverables:** `useChatList.ts`, `preview.ts`, `time.ts`, `ChatRow`, `ChatList`, `ConnectionBanner`, `FolderTabs`, `ArchiveList`, the archive route and the phase spec.

**Acceptance criteria**

- [ ] The list shows non-archived chats in D-94 order, with Saved Messages always present. (F2, D-94, T-36 order part)
- [ ] A new message reorders the list without a reload. (F2)
- [ ] Unread counts exclude own and deleted messages. (D-92)
- [ ] The offline banner follows the browser's online state, and the cached list stays visible offline. (F2 Offline, D-12)
- [ ] Two browsers signed in as A show the same list. (T-04 part)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-10 --project=chromium` passes.

**Risks and fallbacks**

- Recomputing unread counts on every store change is slow with long histories: memoize per chat on `(last_read_seq, highest cached seq)`, and recompute only the changed chat.

---

### Phase 11: New chat, New group and chat info

**Goal:** Find a user by exact username, open or create a direct chat, create a group, manage group members and leave a group.

**Depends on:** Phase 10.

**Implements:** WEB-11, WEB-12, 3.2 (1-on-1 & group chat), 12.5 New chat, New group and Group and chat info templates, M2-07 (web), D-26, D-42, D-46, D-58, D-70, D-88, D-91, D-124, PF-W7, T-22 (UI part), T-38 (UI part).

**Steps**

- [ ] 1. **New chat dialog (WEB-11).** Create `apps/web/src/features/newChat/NewChatDialog.tsx`, a form Dialog with:
  - a username TextField with the helper "Enter the exact username", and the Primary "Find"
  - Find calls `getSupabase().rpc('find_user', { username })`, which returns at most one row of `user_id` and `display_name` (D-42, D-88)
  - a result row (48 Avatar, display name) with Primary "Message", or "No user with that username" in `body.md` `color.text.secondary`
  - DG429 → "Too many searches. Try again in a minute." (D-46)
  - offline: Find disabled with "No connection"
- [ ] 2. **Open or create a direct chat (D-70, D-124, PF-W7).** Create `apps/web/src/features/newChat/openDirectChat.ts`:
  1. `fetchChatList()` (Phase 7).
  2. If a cached direct chat has exactly the session user and the target as members, navigate to it.
  3. Otherwise: `chat_id = newId()`; insert `chats { chat_id, type: 'direct', created_by: uid }`; insert the own row `{ chat_id, user_id: uid, role: 'owner' }` (D-124 branch 1); insert the other row `{ chat_id, user_id: target, role: 'member' }` (branch 2). The trigger sets `direct_key`.
  4. On 23505 from the second member row (the pair already has a direct chat), refresh the chat list, open the existing chat, and log the leftover chat id to `docs/test-results/web/phase-11.md` (PF-W7).
  5. DG429 on the chats insert → the D-46 chat limit text (`strings.newGroup.limit`).
- [ ] 3. **New group dialog (WEB-11).** Create `apps/web/src/features/newGroup/NewGroupDialog.tsx`:
  - a Group title TextField with a counter of 64 (`validateGroupTitle`, D-109)
  - "Members" header with "<n> selected"
  - a checklist (48 Avatar, name, checkbox, row height 64) of every cached profile that shares a chat with the user, excluding the user, sorted by display name (D-70)
  - at most 99 selected (D-58), with further checkboxes disabled
  - Create, disabled until the title is valid and offline ("No connection")

  Create inserts `chats { type: 'group', title }`, the own owner row, then one member row per selected user, and navigates to the new chat. The 21st chat in a day shows the D-46 limit text.
- [ ] 4. **Chat info (WEB-12).** Create `apps/web/src/features/chatInfo/ChatInfo.tsx`, shown when the chat route has `?info=1`. From 1280 px it is a third 360 px column; from 768 to 1279 px it replaces the chat in the right pane with a back button; below 768 px it is full screen (12.6, 12.7). Content:
  - 96 Avatar, title or display name (`title.lg`), and the username or "<n> members"
  - the action row (Mute, Archive, Leave): Mute and Archive are wired in Phase 18; Leave shows for groups only
  - for groups, the "Members" list (48 Avatar, name, "Owner" in `label.sm` for the owner role); the owner sees "Add members" first and a Remove item in each member row's Menu
  - direct chats show no member list and no Remove (D-70)

  Every action is disabled offline with "No connection" (12.5).
- [ ] 5. **Member actions.**
  - Add members opens the New group checklist without the title field. It inserts one member row per user, and a rejection (no shared chat, 101st member) shows the mapped text "This person can't be added." or "A chat can have up to 100 members." (D-58, D-70).
  - Remove deletes that member's `chat_members` row (owner only).
  - Leave asks "Leave this group?" in a confirm Dialog and then deletes the user's own row. Ownership passes on the server (D-91). The client then calls `deleteChatData(chat_id)` and navigates to `/`.
- [ ] 6. **Leave from the list.** Wire the ChatRow Menu item "Leave group" (groups only) to the same Leave action.
- [ ] 7. **Spec.** Create `apps/web/e2e/phase-11-new-chat.spec.ts`:
  - A finds B's exact username and "Message" opens the existing A-B chat (no new row)
  - a partial username shows "No user with that username" (T-22 UI part)
  - A creates the group "Web test <uuid>" with B: B's list shows it after B's next resync
  - A removes B: B's page, made visible, no longer lists it (T-38 UI part)
  - B is re-added, then B leaves: A's members list no longer shows B
  - offline, Find and Create are disabled

**Deliverables:** `NewChatDialog`, `openDirectChat.ts`, `NewGroupDialog`, `ChatInfo`, the member actions, the strings and the phase spec.

**Acceptance criteria**

- [ ] An exact username finds one user, and a partial one finds none. (D-42, T-22 UI part)
- [ ] Messaging a user with an existing direct chat opens it instead of creating another. (D-70)
- [ ] A group is created with the creator as owner, and its members see it. (3.2, D-124)
- [ ] The owner removes a member, and a member leaves; both lose the chat. (D-70, D-91, T-38 UI part)
- [ ] Every control is disabled offline. (12.5)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-11 --project=chromium` passes.

**Risks and fallbacks**

- Test groups accumulate on the hosted project: each spec run leaves its group, and the groups are harmless (D-63). The test log lists their ids.

---

### Phase 12: Chat thread and Markdown

**Goal:** Render the chat screen's message list from the cache with bubbles, grouping, time rows, date separators, the unread divider and safe Markdown.

**Depends on:** Phase 11.

**Implements:** WEB-06 (read path), 12.5 Chat screen template, CMP-07, CMP-21 (chat variant), CMP-22, 3.2 Text formatting, 5.5 (Markdown safety), M2-06 (web), D-05, D-22, D-30, D-44, D-85 item 2, D-89, D-99, D-109 (12), D-110, D-143, T-12, 12.8 Announcements and the "Skip to messages" link.

**Steps**

- [ ] 1. **Markdown renderer (M2-06, D-99).** Install `react-markdown`, pinned and recorded. Create `apps/web/src/components/MessageText/MessageText.tsx`:
  - `<ReactMarkdown skipHtml={false} components={…} urlTransform={safeUrl}>` with no rehype-raw, so raw HTML is never parsed as HTML (D-05)
  - `components` keeps `p`, `strong`, `em`, `code`, `pre`, `a` and `br`
  - headings `h1` to `h6`, `ul`, `ol`, `li`, `blockquote`, `table` and its parts, and `hr` render the plain text of their children inside a `<span>` (D-99)
  - `img` renders its `alt` text and is never fetched (D-99)
  - `safeUrl` allows `http:`, `https:`, `mailto:` and `tel:`; any other URL renders the link text without a link (M2-06)
  - links open with `target="_blank"` and `rel="noopener noreferrer nofollow"`
  - inline code and code blocks use `mono` on the bubble's quote fill (CMP-07)

  ```powershell
  npm install --workspace apps/web --save-exact react-markdown
  ```

- [ ] 2. **T-12 check first.** Create `apps/web/src/components/MessageText/MessageText.test.tsx`. The input `<script>alert(1)</script> <b>x</b> **unclosed [a](b` renders `<script>` and `<b>` as visible text, throws no error and creates no `<script>` or `<b>` element. `# Heading` renders as plain text, and `![alt](https://example.com/x.png)` renders "alt" with no `<img>`. If the tags are dropped instead of shown, create `apps/web/src/components/MessageText/remarkHtmlAsText.ts`, a remark plugin that turns every `html` node into a `text` node with the same `value`, and add it to `remarkPlugins` (D-85 item 2). Record which path applied in `docs/test-results/web/phase-12.md`.
- [ ] 3. **Thread query.** Create `apps/web/src/features/chat/useThread.ts`. It returns, from the cache, the chat's messages by seq ascending (delivered), followed by the chat's unsent queue items in `enqueue_order`, each with its LS-2 status (6.4). The window starts at the newest 50 and grows by 50 when the list is scrolled to the top (D-44). Each message joins its `message_media` rows, its non-removed reactions, its sender profile, and its `reply_to` parent.
- [ ] 4. **Grouping and rows (D-143).** Create `apps/web/src/features/chat/buildRows.ts`, a pure function with unit tests that turns the thread into:
  - date separators "Today", "Yesterday", then the date (D-109 (12))
  - time rows at the start of each day and above the first message after a gap of 60 minutes or more
  - bubble groups: consecutive messages of one sender less than 5 minutes apart (CMP-07)
  - the unread divider above the first message from others with `seq > last_read_seq`
- [ ] 5. **MessageBubble (CMP-07).** Create `apps/web/src/components/MessageBubble/MessageBubble.tsx` as an `<article>` inside a `role="log"` scroll container (12.10):
  - own bubbles right in `color.bubble.out.bg`, received left in `color.bubble.in.bg`
  - `radius.bubble` 22, with join corners `radius.bubbleJoin` 4 inside a group
  - maximum width 78% of the list and 560 px; message column at most 840 px from 1280 px (12.7)
  - received: a 28 Avatar beside the last bubble of a group, and in groups the sender name above the first bubble (`label.sm`)
  - the sender shown as "Deleted account" (D-110) or "Former member" (D-89) where they apply
  - no time inside the bubble: the time shows in a tooltip after 500 ms of hover from 768 px, and for 3000 ms after a tap below 768 px (D-143)
  - "edited" under the bubble when `edited_at` is set
  - the deleted placeholder: `chat.deleted` and "Deleted message" in italics, with no reactions, no quote and no menu (D-22)
  - a reply quote at the top, whose tap scrolls to the parent and highlights it for `motion.duration.highlight`
  - the accessibility label "<sender or You>, <text or attachment summary>, <time>, <status>"
- [ ] 6. **Chat screen.** Create `apps/web/src/features/chat/ChatScreen.tsx`, rendered by `(main)/chat/[chatId]/page.tsx`:
  - TopBar chat variant: back below 768 px, 40 Avatar, title, the member count for groups (the typing text arrives in Phase 15); a click opens `?info=1`
  - the offline banner
  - the message list with DateSeparator, UnreadDivider and JumpToBottom (CMP-22, with the unread count and the label "Jump to newest message")
  - the composer slot (Phase 13)

  The list keeps its scroll position when older rows load, and scrolls to the newest message on open. Roving tabindex: arrow keys move focus between bubbles (CMP-07 Focused).
- [ ] 7. **States (12.5).** First open with no cache and syncing: the chat Skeleton after 300 ms. No messages: EmptyState "No messages yet". An error with nothing cached: ErrorState with Retry. A chat id not in the cache after sync: ErrorState "This chat isn't available." with a link to the chat list.
- [ ] 8. **Accessibility (12.8).** The first focusable element of the chat route is a "Skip to messages" link, visible on focus, that moves focus to the newest bubble. A `role="log"` `aria-live="polite"` region announces each new incoming message in the open chat as "<sender>: <text>".
- [ ] 9. **Spec (T-12).** Create `apps/web/e2e/phase-12-thread.spec.ts`:
  - B sends the T-12 input of step 2 to A-B through the API: A's chat shows the tags as text, no dialog opens and no image request is made (`page.on('request')` sees no `example.com`) (T-12)
  - the date separator reads "Today"
  - scrolling to the top of a chat with more than 50 cached messages loads more (the spec seeds 60 messages through the API first)
  - a deleted message shows "Deleted message"

**Deliverables:** `MessageText` (and `remarkHtmlAsText.ts` if needed), `useThread.ts`, `buildRows.ts`, `MessageBubble`, `DateSeparator`, `UnreadDivider`, `JumpToBottom`, `ChatScreen`, the tests and the phase spec.

**Acceptance criteria**

- [ ] HTML and malformed Markdown display literally, nothing executes, a heading is plain text, and an image link loads nothing. (T-12, D-05, D-99)
- [ ] Messages are ordered by seq, with unsent items after the last delivered message. (6.4)
- [ ] Date separators read Today, Yesterday, then the date. (D-109 (12), T-49 part)
- [ ] Older messages load 50 at a time without the view jumping. (D-44)
- [ ] The "Skip to messages" link is the first focusable element. (12.8)

**Exit gate:** `npm run test --workspace apps/web; if ($?) { npm run e2e --workspace apps/web -- phase-12 --project=chromium }` passes.

**Risks and fallbacks**

- react-markdown drops HTML instead of showing it (PR-11): apply `remarkHtmlAsText` (D-85 item 2) and re-run T-12.
- Long threads render slowly: at 50 rows per window this is not expected at 2 to 10 users (D-W12). If a window renders in over 100 ms (Chrome Performance panel), record it and add `content-visibility: auto` on bubbles.

---

### Phase 13: Composer, sending and delivery status

**Goal:** Send text from the composer through the queue, show the CMP-08 status captions, Retry and Discard on failed items, and capture latency in test builds.

**Depends on:** Phase 12.

**Implements:** F3 (send text), F7, WEB-06 (composer), CMP-08, CMP-10, LS-1, LS-2, LS-7, LS-8, D-30, D-90, D-93, D-109 (7), D-116, D-132, D-143, M2-09 (send), M2-12, M4-04 (web capture), D-82, D-W09, T-01, T-02 (web form via T-19), T-18, T-19, T-41 (web part), T-49 (keyboard part).

**Steps**

- [ ] 1. **Composer (CMP-10).** Create `apps/web/src/components/Composer/Composer.tsx` as a `<form>` with a `<textarea>`, fixed to the bottom of the chat pane with `env(safe-area-inset-bottom)` padding on phones (12.7). Layout:
  - one pill with fill `color.bg.surface`, `radius.full` while one line and 22 when it grows, minimum height 44
  - Attach (`action.attach`, label "Attach"; wired in Phase 16) and Record (`action.record`, label "Record voice note"; Phase 16)
  - the Text button "Send" (label "Send"), shown only when the trimmed text is not blank or an attachment is present (D-30)

  The counter "3,912 / 4,096" appears from 3,900 code points (`countCodePoints`) and turns `color.danger` above 4,096, with Send disabled (D-30, D-116). Keyboard: Enter sends and Shift+Enter adds a line (D-109 (7)), and Enter during IME composition (`event.nativeEvent.isComposing`) does nothing. The composer stays enabled offline (LS-1). Drafts are not persisted (D-02).
- [ ] 2. **Send flow (LS-1).** `sendText(chatId, text, replyTo)` in `apps/web/src/features/chat/send.ts`:
  1. `validateMessageText(text, 0)`.
  2. `queue.enqueue({ temp_id: newId(), chat_id, payload: { content: text, reply_to, attachments: [] }, status: 'queued', retry_count: 0, next_attempt_at: Date.now(), row_state: 'absent', enqueue_order: next, force_low_signal: false, last_error: null })`.
  3. Clear the input and scroll to the newest message.

  A full queue keeps the text in the input and shows the D-27 toast (CMP-10 Error). The bubble appears at once from the queue as queued (LS-1). In Saved Messages the same flow applies, because it is a direct chat with one member (M2-12, F7).
- [ ] 3. **MessageStatus (CMP-08, D-132, D-143).** Create `apps/web/src/components/MessageStatus/MessageStatus.tsx`. Under each bubble on the right:
  - queued: `status.queued` and "Queued"
  - sending: `status.sending` rotating and "Sending"
  - failed: `status.failed` at `icon.lg` beside the bubble, and under it "Failed" with the Text buttons Retry and Discard (D-93)
  - "Sent" or "Seen" only under the user's last own message; Seen arrives in Phase 15

  Web never shows "waiting for Wi-Fi" or "sending (low signal)" (D-19, D-132). The status is part of every own bubble's accessibility label, also when no caption is drawn. A status change cross-fades over `motion.duration.fast`. A change to failed is announced "Message failed" through the live region (12.8).
- [ ] 4. **Retry and Discard (D-93).** Retry calls `queue.retry`. Discard calls `queue.discard`. While offline, Discard is disabled with "No connection" when `row_state` is `stored` or `unknown` (LS-7).
- [ ] 5. **Merge on delivery.** When a queue item becomes `sent`, its message row is in the cache (Phase 6 sender, or the Realtime event). `useThread` shows the cached row and drops the queue item from the view, keyed by message_id. Sent items are deleted from the queue store once their row is cached.
- [ ] 6. **Latency capture (M4-04, D-82, D-W09).** When `process.env.NEXT_PUBLIC_DG_LATENCY === '1'`:
  - the sender records `{ message_id, sendStart: Date.now() }` when Send is pressed
  - the receiver records `{ message_id, received: Date.now() }` when the message's Realtime event is merged

  Both push into `window.__dgLatency`. Production builds never set the variable. Create `apps/web/e2e/latency.spec.ts` (run in Phase 19): two browser contexts on one computer, A and B, so both read one clock (D-82). A sends 100 messages one at a time, each waiting for B's receipt. The spec computes the 95th percentile and writes the 100 values and the result to `docs/test-results/web/latency.json`.
- [ ] 7. **Spec.** Create `apps/web/e2e/phase-13-send.spec.ts`:
  - A sends "T-01 <uuid>" in A-B: the bubble shows "Queued" or "Sending" and then "Sent" under the last own message, and B's context shows it without a reload within 2 seconds (T-01 delivery part)
  - offline, A sends: the bubble shows "Queued"; online, it delivers and `countMessages` returns 1 (T-19, T-02 web form)
  - with failure injection (`/dev/queue` switch, read by the shared sender) the bubble reaches "Failed" with Retry and Discard, and Retry delivers it (T-18)
  - Shift+Enter adds a line and Enter sends (T-49 keyboard part)
  - a 4,097-code-point paste disables Send and turns the counter red
  - sending in Saved Messages works (F7)

**Deliverables:** `Composer`, `send.ts`, `MessageStatus`, the merge rule in `useThread`, the latency capture and `latency.spec.ts`, and the phase spec.

**Acceptance criteria**

- [ ] A sent message appears at once with a status, and on the other member's client without a refresh. (F3, T-01 delivery)
- [ ] Offline sends are queued and delivered exactly once after the browser goes online. (T-19, LS-8)
- [ ] Failed items stay visible with Retry and Discard, and Discard is disabled offline when the row may exist. (T-18, T-41 web part, D-93)
- [ ] Enter sends and Shift+Enter adds a line. (D-109 (7), T-49)
- [ ] No Low Signal label appears on web. (D-19, D-132)
- [ ] Saved Messages passes the same send checks. (F7, M2-12)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-13 --project=chromium` passes.

**Risks and fallbacks**

- The Realtime event and the insert response both write the row: the merge is by message_id, so the second write is a no-op (D-40).

---

### Phase 14: Message actions

**Goal:** Reply, forward, copy, react, edit and delete from the hover row, the menu and the message focus overlay, with the D-22 rules.

**Depends on:** Phase 13.

**Implements:** F3 (reply, forward, react), F4, F7 (forward into Saved Messages), WEB-07, WEB-08, 12.5 Message actions and Forward picker templates, CMP-03, CMP-12, CMP-23, CMP-34, 3.2 (Reply, Forward, Reactions, Message edit / delete), M2-09, M2-10, M3-04, D-22, D-31, D-50, D-76, D-109 (4), D-133, T-06, T-17.

**Steps**

- [ ] 1. **Action entry points (12.5 Message actions).**
  - From 768 px, hovering or focusing a bubble shows the hover row: React (`action.react`, label "React"), Reply (`action.reply`) and More (`action.more`, label "More actions"). React opens the ReactionPalette popover (CMP-12 in a CMP-23 popover). More opens the Menu.
  - Right-click, Shift+F10 and Enter on a focused bubble also open the Menu (CMP-07 Focused).
  - Below 768 px, a long press of 400 ms opens MessageFocusOverlay (CMP-34: `role="dialog"`, `aria-modal="true"`, label "Message actions") with the reaction pill above the bubble and the menu below it. A double tap toggles the user's own heart (palette position 2) within the D-22 rules (D-143).

  Menu items, in order:
  - Reply
  - Forward (hidden when the message has no text, D-109 (4))
  - Copy text (`navigator.clipboard.writeText`, Toast "Copied")
  - Edit and Delete (own, non-deleted messages)
  - Retry and Discard (own failed items)

  Deleted messages open nothing (D-22). Edit, Delete and reactions are disabled offline with "No connection" (D-22).
- [ ] 2. **Reply (3.2 Reply).** Reply sets the composer's reply bar: a 3-wide `color.brand.primary` bar, "Reply to <name>", one line of the parent, and Cancel (label "Cancel reply"); Escape cancels (WEB-06). The queued item carries `reply_to` = the parent's message_id. The parent is always in the same chat, so D-90 holds.
- [ ] 3. **Forward (WEB-08, D-31, D-50, D-133).** Create `apps/web/src/features/forward/ForwardDialog.tsx`, a form Dialog:
  - the notice "Attachments are not forwarded yet" (48 high row, `color.info.bg`, `body.sm` `color.info.text`) when the message has attachments (D-50, M3-04)
  - SearchField (CMP-03) filtering by title
  - chat rows without previews (48 Avatar and name, height 64), with Saved Messages first
  - empty search: "No chats match"

  A click on a row enqueues a new message in that chat with the copied text only (no attachments, no attribution, D-31) and closes the dialog with the Toast "Forwarded" (D-133). Forwarding works offline and queues (LS-1).
- [ ] 4. **Reactions (3.2 Reactions, D-22, D-76).** Create `apps/web/src/components/ReactionChips/ReactionChips.tsx` and `apps/web/src/components/ReactionPalette/ReactionPalette.tsx`:
  - the palette shows the 8 emoji of `config.reactionPalette` with the 12.3 labels, each in a 44 square
  - chips sit under the bubble with the count and the `color.bg.selected` style for the user's own reaction
  - a chip click or palette pick toggles the user's own reaction:
    - add: if a cached row `(message_id, user_id, emoji)` exists with `removed_at` set, update `removed_at: null`; otherwise insert `{ message_id, user_id, emoji }` (the trigger sets chat_id). A 23505 on insert falls back to the update.
    - remove: update `removed_at: new Date().toISOString()`, never DELETE (D-22)
  - with 3 active own reactions, the other emoji are disabled with "You can add up to 3 reactions"
  - offline, the palette is disabled with "No connection" (D-22)
  - a rejected write restores the chip and shows a Toast with Retry (CMP-12 Error)

  Reactions are written directly, not queued (D-22).
- [ ] 5. **Edit (F4, D-76).** Edit puts the original text in the composer with the edit bar ("Edit message", Cancel; Escape cancels) and the button "Save" (label "Save edit"). Save calls `update({ content }).eq('message_id', id).select('message_id, content, edited_at, sync_seq')`. The server sets edited_at (D-76). The returned row is merged. Zero returned rows → Toast "This message can't be edited." Online only.
- [ ] 6. **Delete (F4, D-22).** Delete opens a confirm Dialog "Delete for everyone?" with Cancel and the Danger button "Delete". It calls `update({ deleted_at: new Date().toISOString() })` with `.select(...)` and merges the row, so the placeholder shows at once and the server clears content (D-22). Reply quotes to a deleted parent show "Deleted message" (D-22). Online only.
- [ ] 7. **Spec.** Create `apps/web/e2e/phase-14-actions.spec.ts`:
  - A replies to B's message: the stored row has `reply_to` = the parent (API read), and B sees the quote
  - A forwards a text message to the A+B group: the target chat holds a new row with the same content
  - A forwards a message that has an attachment row (this case is written with `test.fixme` until Phase 16 adds attachments, and Phase 16 step 8 turns it on): the notice shows, only the text arrives, and no object is copied (T-17)
  - A adds a heart and B sees the chip without a reload; A removes it: B's chip disappears, the API shows `removed_at` set, and a direct DELETE of the reaction through the API as A removes no row (T-17)
  - A edits a message: B sees the new text and "edited"; A deletes it: B sees "Deleted message"; the same update by B through the API returns zero rows and leaves the message unchanged (T-06)
  - Forward is absent from the menu of an attachment-only message (D-109 (4), T-49 part)
  - offline, Edit, Delete and the palette are disabled

**Deliverables:** the hover row, `MessageFocusOverlay`, `Menu` items, `ForwardDialog`, `ReactionChips`, `ReactionPalette`, the edit and delete flows, the strings and the phase spec.

**Acceptance criteria**

- [ ] A reply stores reply_to, and the quote shows the parent. (T-17, 3.2 Reply)
- [ ] A forward copies only the text, with no attribution, and shows the attachment notice when it applies. (T-17, D-31, D-50, D-133)
- [ ] A reaction and its removal show on every member's client without a refresh, and removal is an UPDATE of removed_at. (T-17, D-22)
- [ ] The sender's edit and delete show in real time, and another member's update is rejected. (T-06, F4)
- [ ] Edit, delete and react are disabled offline. (D-22)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-14 --project=chromium` passes.

**Risks and fallbacks**

- The clipboard API is refused on an insecure origin: localhost and the Vercel HTTPS address are both secure contexts, so it is not expected. If it is refused, Copy text shows the Toast "Couldn't copy".

---

### Phase 15: Typing indicators and read receipts

**Goal:** Send and show typing over Broadcast, write last_read_seq with the read hint, and show Seen within 2 seconds.

**Depends on:** Phase 14.

**Implements:** F6, 3.2 (Read receipts, Typing indicators), 6.4 (channels, read hint), M2-11 (web), D-23, D-43, D-55, D-57, D-92, D-118, T-04 (read status part), T-14 (client re-run), T-37, T-51.

**Steps**

- [ ] 1. **Chat channel (D-43, 6.4).** Create `apps/web/src/features/chat/useChatChannel.ts`. While a chat is open and the tab is visible, it joins `getSupabase().channel(chatTopic(chatId), { config: { private: true, broadcast: { self: false } } })`, after `realtime.setAuth()` with the current access token (D-114). It leaves the channel when the chat closes or the tab hides. Only one `chat:` channel is joined at a time (D-43). Presence is never used (D-118). Assumption: `realtime.setAuth()` before subscribe is required for private channels in the pinned supabase-js; checked by the subscribe status in this phase.
- [ ] 2. **Typing send (D-57).** On composer input, if the text is not blank, the browser is online and at least 3000 ms passed since the last event, send `{ type: 'broadcast', event: 'typing', payload: { user_id, display_name } }`. Nothing is sent offline (F6).
- [ ] 3. **Typing display (D-118).** Keep a map `user_id → hideTimer` per open chat. Each typing event (re)starts a 5000 ms timer. A message from that user arriving in the chat removes the entry at once. The TopBar subtitle shows "<name> is typing..." for one typist and "<n> people are typing..." for more, in `color.brand.primary`, with "typing..." in a direct chat. The open chat's ChatRow preview shows the same text (CMP-09 Typing). The payload is advisory and is never stored (D-92).
- [ ] 4. **Read state (D-23, D-92).** Create `apps/web/src/features/chat/useReadState.ts`. When the chat is open, the tab is visible and the newest delivered message is rendered in view, it computes `seq` = the highest displayed seq.
  - If `seq` is greater than the user's cached `last_read_seq` and the browser is online: `update({ last_read_seq: seq }).eq('chat_id', id).eq('user_id', uid)`, then send `{ type: 'broadcast', event: 'read', payload: {} }`.
  - If offline: store `meta.pendingRead:<chat_id> = seq` and apply it on the next `online` event (D-23).

  last_read_seq never decreases: the client never writes a lower value, and the server enforces it.
- [ ] 5. **Seen (D-92).** On a `read` event, call `refreshReadState(chatId)` (Phase 7): it re-reads `chat_members` through RLS, so a forged hint changes nothing. A message shows "Seen" under the last own message when another member's `last_read_seq` is at least its seq: the other member in a direct chat, at least one other member in a group (D-92). The ChatRow status icon becomes `status.seen`. Read state is also refreshed on chat open and on foreground (M2-05).
- [ ] 6. **Unread divider and counts.** After the read update, the unread divider stays in place until the chat is closed, and the list's unread count drops to 0 (D-23).
- [ ] 7. **Spec.** Create `apps/web/e2e/phase-15-typing-read.spec.ts`:
  - B types in A-B while A watches: A sees "typing..." within 2 seconds, it hides 5 seconds after B stops, and it hides at once when B's message arrives (T-51)
  - with a counter on `chat:<id>`, 10 seconds of continuous typing produce at most 4 events (T-51)
  - in A+B+G, B and G type at once and A sees "2 people are typing..." (T-51)
  - A sends, B opens the chat: A shows "Seen" within 2 seconds without a reload (T-37)
  - in A+B, "Seen" shows once B has read it (T-37)
  - C joins `chat:<A-B id>` through the API helper and receives no event, or is refused (T-14 client re-run)
  - a second context of A shows the same Seen state after foreground (T-04 read part)
  - offline typing sends nothing (the counter stays 0)

**Deliverables:** `useChatChannel.ts`, the typing sender and indicator, `useReadState.ts`, the Seen display, the strings and the phase spec.

**Acceptance criteria**

- [ ] The typing indicator names one typist or counts several, hides after 5 seconds or when the message arrives, and is throttled to one event per 3 seconds. (T-51, D-57, D-118)
- [ ] An open chat shows Seen within 2 seconds of the other member's read. (T-37, D-92)
- [ ] A non-member's join of the chat channel is refused or delivers nothing. (T-14)
- [ ] No typing event leaves the browser offline. (F6)
- [ ] Read status is identical in two browsers of one account. (T-04)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-15 --project=chromium` passes.

**Risks and fallbacks**

- The private channel join fails with the publishable key: check the M1-05 policies with the T-14 result in `docs/test-results/M1.md`. If M1 passed and the web join still fails, record the exact error in the phase log; the fallback is read state refreshed on open and foreground only (the D-92 behavior without the hint), which fails T-37 and blocks the release gate.

---

### Phase 16: Attachments: pipeline and attach UI

**Goal:** Pick, paste, drop or record attachments, validate them, queue them in IndexedDB, and deliver them text-first with idempotent uploads.

**Depends on:** Phase 15.

**Implements:** F5, WEB-06 (paste, drop, voice), WEB-09, 12.5 Attach menu template, CMP-10 (attachment strip, voice on web), CMP-11 (composer tile, refused toasts), LS-4, LS-9, M3-01, M3-02, M3-03 (web), D-19, D-29, D-39, D-75, D-90, D-93, D-109 (7), D-113, D-116, D-W06, D-W07, D-W20, T-11 (upload part), T-20, T-52 (web part), TW-10.

**Steps**

- [ ] 1. **Media type mapping (D-W20).** In `apps/web/src/lib/media/classify.ts`:
  - a picked, pasted or dropped `image/jpeg`, `image/png` or `image/webp` → `photo` (bucket `chat-media-small`)
  - `video/mp4` or `video/webm` → `video` (`chat-media-large`)
  - a MediaRecorder recording → `voice` (`chat-media-small`)
  - every other allowed type of 5.5, including a picked audio file → `file` (`chat-media-large`)
  - any other type is refused (D-29, D-75, D-90)

  Size checks use `validateAttachment` in bytes: photo and voice 10,485,760, video and file 52,428,800 (D-116). There is no compression and no Wi-Fi wait on web (D-19).
- [ ] 2. **Attach entry points (WEB-09, D-109 (7)).**
  - Attach opens a hidden `<input type="file" multiple accept="<allowed types>">`. On a phone browser the device may offer its camera through the same input.
  - Paste: an `onPaste` handler on the composer adds `clipboardData.files`.
  - Drop: the chat pane listens to `dragover` and `drop`. While a file is dragged over, it shows the 2 px dashed `color.brand.primary` outline and "Drop files to attach" (CMP-10).

  Accepted files appear in the attachment strip: 64 by 64 tiles with a Remove button (label "Remove <file name>") and "n / 10" (D-90). Refused files show the CMP-11 toasts: "<file name> is too large. Photos and voice notes up to 10 MB, videos and files up to 50 MB.", "<file name> can't be sent. This file type isn't allowed." and "You can attach up to 10 files."
- [ ] 3. **Voice notes (D-109 (7), D-W07).** Create `apps/web/src/lib/media/recorder.ts`:
  - the MIME type is the first of `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4` for which `MediaRecorder.isTypeSupported` is true
  - the declared Content-Type drops the codecs parameter (`audio/webm` or `audio/mp4`), so it matches the D-29 list exactly
  - a click on Record starts it (`getUserMedia({ audio: true })`): the record button becomes "Stop and send", the pulsing `color.danger` dot (static under reduced motion) and the elapsed time "0:07" show, and Escape cancels (CMP-10)
  - recording stops at 15 minutes, as on Android (CMP-10), or earlier when the size reaches 10,485,760 bytes
  - a denied microphone permission does not start the action, and a CMP-20 dialog shows "DoloGram needs microphone access to record voice notes. Allow it in your browser's site settings." (F5, D-35)
- [ ] 4. **Queue payload (M3-02).** On Send with attachments:
  - for each file: `media_id = newId()`, `store.putBlob(media_id, file)`, and a `QueuedAttachment { media_id, media_type, bucket, content_type, size, name, uploaded: false, row_inserted: false }`
  - then enqueue the message with `attachment_count` = the number of files, as one item

  The web stores the File in IndexedDB, so an upload never depends on the picker (M3-02).
- [ ] 5. **Delivery order (LS-4, D-93).** Extend the shared `QueueCore` (or its web sender) so an item with attachments:
  1. inserts the message row with its `attachment_count`, the same strict per-chat row order as text
  2. then, without blocking later items of the chat, uploads each attachment and inserts its `message_media` row `{ media_id, message_id, media_type, compressed: false }` (the trigger sets chat_id and storage_path, D-90)
  3. becomes `sent` only when every attachment has `row_inserted: true`

  An upload failure backs off per attachment under the same D-27 and D-77 rules. An interrupted upload restarts from the beginning (D-93).
- [ ] 6. **Upload (M3-01, D-39, D-113, D-W06).** Create `apps/web/src/lib/media/upload.ts`. The path is `<chat_id>/<media_id>` with no extension (D-39).
  - Size at most 6,291,456 bytes: `storage.from(bucket).upload(path, blob, { contentType, cacheControl: '600', upsert: false })`.
  - Larger: `tus-js-client` against `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable` with:
    - headers `authorization: Bearer <access token>` and `x-upsert: false`
    - metadata `bucketName`, `objectName`, `contentType`, `cacheControl: '600'`
    - `chunkSize: 6 * 1024 * 1024`
    - `storeFingerprintForResuming: false`, so a restart begins again (D-93)

    Assumption: Supabase's resumable endpoint accepts the publishable key and a user JWT with 6 MB chunks, per its TUS documentation; checked by T-52 here, fallback the standard upload for files up to the 50 MB bucket cap.
  - An "already exists" result (HTTP 409 or the message "The resource already exists") counts as success (D-39). A 23505 on the `message_media` insert counts as success (M3-01).

  ```powershell
  npm install --workspace apps/web --save-exact tus-js-client
  ```

- [ ] 7. **Pending display.** Until Phase 17's tiles exist, an own pending attachment shows a placeholder tile with "Uploading", and each attachment without a media row shows "Waiting for upload" (CMP-07 Attachment placeholder).
- [ ] 8. **Spec.** Turn on the `test.fixme` attachment-forward case of `phase-14-actions.spec.ts` (T-17). Create `apps/web/e2e/phase-16-attach.spec.ts` with fixtures in `apps/web/e2e/fixtures/` (`photo.jpg` under 1 MB, `clip.mp4` under 5 MB, `big.bin` of 7,000,000 bytes declared as `application/zip`, `doc.pdf`):
  - A sends `photo.jpg` with the text "T-20" on a throttled Chromium connection (CDP `Network.emulateNetworkConditions`, 50 kB/s upload): B's context shows the text and a "Waiting for upload" placeholder before the upload completes, and A's item shows "Sent" only after the upload (T-20)
  - A sends a video, a file and a 3-second voice note (the spec grants the microphone with `--use-fake-device-for-media-stream`): each has one object and one `message_media` row (API read) (T-52 web part)
  - `big.bin` goes through TUS and arrives once (D-W06)
  - an 11th file shows "You can attach up to 10 files."
  - a 10,485,761-byte PNG is refused before queueing
  - paste of an image adds it to the strip (T-49 paste part)
  - with A in mid-upload of `clip.mp4`, `page.reload()`: after the reload the item is retried and delivered once, with one `message_media` row (TW-10, the web form of LS-9 and T-07)

**Deliverables:** `classify.ts`, `recorder.ts`, `upload.ts`, the attachment strip, paste and drop handling, the queue payload extension, the fixtures and the phase spec.

**Acceptance criteria**

- [ ] The text reaches other members before the upload completes, and the item shows sent only after every attachment is uploaded. (T-20, LS-4)
- [ ] Photo, video, voice note and file each produce one object and one media row. (T-52 web part, F5)
- [ ] Oversize, disallowed and eleventh files are refused before queueing with the CMP-11 text. (D-29, D-90)
- [ ] A reload mid-upload delivers the item once. (TW-10, LS-9)
- [ ] A denied microphone stops the action with the message. (F5)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-16 --project=chromium` passes.

**Risks and fallbacks**

- MediaRecorder produces a type outside D-29 in one browser: that browser cannot record voice notes; it is recorded under T-50 and D-85 item 16 applies.
- TUS fails (D-W06 Assumption): use the standard upload for every size up to 50 MB and record it in the phase log.

---

### Phase 17: Media display and viewer

**Goal:** Show photo and video tiles, voice and file rows, placeholders and the media viewer, with signed URLs that refresh after 10 minutes.

**Depends on:** Phase 16.

**Implements:** F5 (members see it), WEB-10, 12.3 (Attachment tiles and imagery), 12.5 Media viewer template, CMP-11, D-29, D-75, D-113, T-11 (client re-run), T-52 (open part), TW-07.

**Steps**

- [ ] 1. **Signed URL cache (D-113).** Create `apps/web/src/lib/media/signedUrls.ts`. `getSignedUrl(media)` returns a cached URL younger than 540 seconds, or calls `storage.from(bucket).createSignedUrl(storage_path, config.signedUrlSeconds)` (600). An `<img>`, `<video>` or `<audio>` error event calls `refresh(media)` once and retries. The cache lives in memory only and is never stored. For downloads, `createSignedUrl(path, 600, { download: name })`. Assumption: the pinned supabase-js supports the `download` option; fallback fetch the blob and save it through an object URL.
- [ ] 2. **Tiles and rows (CMP-11, 12.3).** Create `apps/web/src/components/AttachmentTile/AttachmentTile.tsx`, `VoiceNoteRow.tsx` and `FileRow.tsx`:
  - photo: width 240, height from the loaded image's ratio clamped 120 to 320, 240 by 180 before load; several photos form a 2-column grid of 119-wide tiles with a 2 gap; `color.skeleton.base` until loaded; label "Photo, <n> of <m>"
  - video: `color.bg.surface` with `media.video` at `icon.xl` and "Video · <size>", with no thumbnail generated (12.3)
  - voice: the 240-wide row with play and pause, progress, "0:12 / 0:45" and a 1x or 2x speed chip, on an `<audio>` element
  - file: `action.file`, the name with middle ellipsis, and "<size> · <TYPE>"; a click downloads
  - own pending upload: the local preview from `URL.createObjectURL(store.getBlob(media_id))`, with a 32 spinner on `color.scrim` and "Uploading"; the object URL is revoked on unmount
  - received but not uploaded yet: the CMP-07 placeholder, one per missing media row up to `attachment_count` (D-90)
  - renewal failure: `status.failed` and "Couldn't load. Tap to retry."
- [ ] 3. **Media viewer (WEB-10).** Create `apps/web/src/features/media/MediaViewer.tsx` as a full-screen overlay at `z.dialog` on `color.media.bg`, opened through OverlayProvider with history (12.6):
  - a 56 top bar with close (`nav.close`), the sender and time in `color.media.text`, and Download (`action.download`)
  - photo: centered, with scroll-wheel and double-click zoom
  - video and audio: the browser players
  - Left and Right arrow keys move between the attachments of the same message; Escape closes
  - the top bar hides after 3000 ms without input
  - loading: a 32 spinner; error: "Couldn't load. Tap to retry."
- [ ] 4. **Deleted media.** A deleted message renders the placeholder and no tiles (D-22). New signed URLs for it fail on the server (D-75), and the client does not ask for them.
- [ ] 5. **Spec.** Create `apps/web/e2e/phase-17-media.spec.ts`:
  - B opens A's photo, video, voice note and file from Phase 16: the photo loads, the video and audio elements report `readyState >= 1`, and the file download starts (T-52 open part)
  - with `config.signedUrlSeconds` injected as 5 through `window.__dgTestConfig`, a photo reloaded after 6 seconds gets a new URL and still displays (TW-07, D-113)
  - after A deletes the message, B's view shows "Deleted message" with no tile, and a `createSignedUrl` call by B through the API fails (T-11 client re-run, D-75)
  - C's API call for the object's signed URL fails (T-11)
  - the browser back button closes the viewer

**Deliverables:** `signedUrls.ts`, `AttachmentTile`, `VoiceNoteRow`, `FileRow`, `MediaViewer` and the phase spec.

**Acceptance criteria**

- [ ] Members open every media type. (F5, T-52)
- [ ] An expired signed URL is renewed without a visible change. (D-113, TW-07)
- [ ] A deleted message's media is not shown and cannot get a new URL. (D-75, T-11)
- [ ] A non-member gets no signed URL. (T-11)
- [ ] The viewer works with the keyboard and closes on back and Escape. (12.6, 12.8)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-17 --project=chromium` passes.

**Risks and fallbacks**

- A `video/webm` from Android does not play in Safari: the tile still offers Download; recorded under T-50.

---

### Phase 18: Folders, archive and mute controls

**Goal:** Archive, unarchive, mute and file chats in folders from the list and chat info, and manage folders in WEB-13, all synced across devices and disabled offline.

**Depends on:** Phase 17.

**Implements:** F9, WEB-04 (row actions), WEB-05 (Unarchive), WEB-12 (Mute, Archive), WEB-13, 12.5 Folders template, 3.2 (Folders, archive, mute), M4-01 (web), D-09, D-24, D-94, D-109 (1), T-36, T-49 (mute part).

**Steps**

- [ ] 1. **Row menu items.** Add Archive or Unarchive, Mute or Unmute, and Add to folder to the ChatRow Menu, and Unarchive to the Archive view's rows. Every item is disabled offline with "No connection" (D-24).
- [ ] 2. **Archive.** `update({ archived: true|false }).eq('chat_id', id).eq('user_id', uid).select(...)` on the user's own `chat_members` row (D-38). The returned row is merged, so the list moves the chat at once. A new message does not unarchive (D-94).
- [ ] 3. **Mute (D-109 (1), D-09).** Mute opens a Menu from 768 px or a BottomSheet below it, with 1 hour, 8 hours, 1 week and Until I unmute. It sets `muted_until` to now plus 1 hour, plus 8 hours, plus 7 days, or the string `'infinity'`. Unmute sets `null`. The muted icon shows while `muted_until` is in the future. Mute is a notification setting only, so a muted chat keeps its place (D-94).
- [ ] 4. **Folders dialog (WEB-13).** Create `apps/web/src/features/folders/FoldersDialog.tsx`, a form Dialog opened from Settings ("Chats: Folders", now shown) and from an `action.folder` IconButton at the end of the folder tabs. Content:
  - the folder list (row height 56: `action.folder`, the name in `body.lg`, "<n> chats" in `body.sm`) with a row Menu of Rename, Edit chats and Delete
  - "New folder"; New folder and Rename open a confirm Dialog with one TextField (1 to 32, counter, `validateFolderName`)
  - Edit chats: a checklist of the user's chats, which inserts and deletes `folder_chats` rows
  - Delete asks "Delete this folder? Its chats stay in your chat list." and deletes the `folders` row; folder_chats rows cascade and chats remain (D-94)
  - empty: EmptyState with `action.folder`, "No folders yet", "Group chats into folders that show as tabs on the chat list." and "New folder"
  - an eleventh folder, when the server rejects it, shows "You can have up to 10 folders." (D-24)
  - every control is disabled offline (D-24)
- [ ] 5. **Add to folder.** From a row: a Menu listing the folders with checkmarks. A pick inserts or deletes the `folder_chats` row.
- [ ] 6. **Chat info.** Wire Mute and Archive in WEB-12 to the same actions.
- [ ] 7. **Cross-device refresh.** Folder and archive settings are not in the publication, so `fetchChatList()` on foreground and online (Phase 7) refreshes them (M2-05). After a change on this browser, its own cache is updated from the returned rows at once.
- [ ] 8. **Spec (T-36).** Create `apps/web/e2e/phase-18-organize.spec.ts` with two contexts of A (one account, two clients):
  - in context 1, archive A-B, mute A+B for 1 hour, create the folder "Work <uuid>" with A+B
  - context 2, made visible, shows A-B only under Archived, A+B with the mute icon in place, and the folder tab listing A+B
  - B sends to A-B: it stays archived (D-94)
  - deleting the folder keeps A+B in the list
  - offline, the controls are disabled
  - Until I unmute stores `infinity` (API read) (T-49 mute part)
  - through the API, an eleventh folder and a 33-character name are rejected, and C reads zero rows of A's folders (T-36 API part)

**Deliverables:** the row menu items, the mute options, `FoldersDialog`, Add to folder, the chat info wiring, the strings and the phase spec.

**Acceptance criteria**

- [ ] Archive, mute and folder changes persist and show on A's other browser after foreground. (F9, T-36)
- [ ] Archived chats appear only in Archive and stay there when a message arrives. (D-94, T-36)
- [ ] Each mute option sets muted_until to the matching time, and Until I unmute sets infinity. (D-109 (1), T-49)
- [ ] Deleting a folder leaves its chats. (D-94)
- [ ] Every control is disabled offline. (D-24)

**Exit gate:** `npm run e2e --workspace apps/web -- phase-18 --project=chromium` passes.

**Risks and fallbacks**

- `'infinity'` is not accepted as a timestamptz string through PostgREST: Assumption that it is (Postgres accepts the literal `infinity` for timestamptz); checked by this spec, fallback the value `9999-12-31T23:59:59Z`, recorded as a gap for the owner because D-109 (1) names infinity.

---

### Phase 19: Hardening and release gate

**Goal:** Run the cross-cutting, accessibility, browser, latency and security checks, add the security headers, and deploy the web app to Vercel Hobby production.

**Depends on:** Phase 18.

**Implements:** 3.5 cross-cutting requirements, 12.8, 11.3 (Web-only behavior), M4-03 (web), M4-04, M4-07 (web part), R-5, 6.5 Next.js, D-35, D-82, D-85 item 16, D-95, D-109 (8) and (9), D-115, D-W10, D-W14, T-01, T-10, T-21, T-40, T-42, T-49, T-50, TW-05.

**Steps**

- [ ] 1. **Security headers (D-W10).** In `apps/web/next.config.ts` `headers()`, for every path:
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'` (plus `'unsafe-eval'` only when `NODE_ENV === 'development'`); `style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://jsyqtfsidtfahytcwutp.supabase.co; media-src 'self' blob: https://jsyqtfsidtfahytcwutp.supabase.co; connect-src 'self' https://jsyqtfsidtfahytcwutp.supabase.co wss://jsyqtfsidtfahytcwutp.supabase.co; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - `Referrer-Policy: no-referrer`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`

  The host is built from NEXT_PUBLIC_SUPABASE_URL, not typed. `'unsafe-inline'` for scripts covers the theme script and Next.js inline scripts; it is accepted because message text never renders as HTML (D-05).
- [ ] 2. **Cross-cutting pass (M4-03, 3.5, D-95, T-40).** Run and log in `docs/test-results/web/phase-19.md`:
  - every screen, with CDP throttling at 400 ms latency, shows a loading indicator only after 300 ms
  - with failure injection, every error shows its strings text and Retry where repeatable
  - `npm run lint --workspace apps/web` reports no jsx-a11y error
  - the contrast test passes
  - a manual Tab walk on WEB-01, WEB-04, WEB-06 and WEB-14 follows the visual order of 12.6
  - at 767 px one column and at 768 px two
  - browser zoom 200% keeps every function usable (12.8)
  - reduced motion (emulated) removes movement except fades (D-134)
  - with NVDA (free) on Windows, a new incoming message is announced and a failed item says "Message failed" (12.8)
- [ ] 3. **Cross-browser smoke (T-50, D-109 (9)).** Create `apps/web/e2e/smoke.spec.ts` with sign-in, sending and receiving text, sending a photo and a voice note, the T-19 offline queue and the theme switch. Run it in Chrome, Edge, Firefox and WebKit:

  ```powershell
  npm run e2e --workspace apps/web -- smoke --project=chrome --project=msedge --project=firefox --project=webkit
  ```

  Then run it by hand on Chrome on the Android device D against `http://<computer LAN address>:3000` (`npm run dev --workspace apps/web -- -H 0.0.0.0`), and in desktop Safari on a Mac if one is available (PF-W9). A browser that fails is removed from the supported list and recorded (D-85 item 16). Web Locks, IndexedDB Blob storage and MediaRecorder results are recorded for PF-W10, PF-W12 and D-W07.
- [ ] 4. **Latency (T-01, D-82).** With `NEXT_PUBLIC_DG_LATENCY=1` in `.env.test.local`:

  ```powershell
  npm run e2e --workspace apps/web -- latency --project=chromium
  ```

  `docs/test-results/web/latency.json` holds 100 values, and their 95th percentile is under 2000 ms.
- [ ] 5. **Rate limits (T-21 client part, PF-W5).** If M3-08 is done: with A offline, enqueue 200 messages through `/dev/queue` ("Enqueue 200"), go online, and confirm all 200 are delivered with no item failed, items that hit DG429 waited without counting attempts, and the 201st enqueue was refused. If M3-08 is not done, record T-21 as blocked.
- [ ] 6. **Secret scan (T-42 web part).**

  ```powershell
  npm run build --workspace apps/web; if ($?) { powershell -File scripts/scan-web-bundle.ps1 }
  ```

  It exits 0, and `/dev` returns 404 in the build.
- [ ] 7. **Vercel settings (D-115, D-W14).** In the Vercel project of M0-09:
  - Root Directory `apps/web`, with "Include files outside the root directory" enabled for the npm workspace
  - Framework Next.js, Install Command `npm install` (run at the repository root by Vercel for workspaces)
  - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY set for Production and Preview, and NEXT_PUBLIC_DG_LATENCY not set

  Assumption: Vercel detects the npm workspace from the root `package.json`; checked by the preview build.
- [ ] 8. **Preview, then production (R-5).** Push the branch and open its Preview deployment. Run the smoke spec against it:

  ```powershell
  $env:E2E_BASE_URL = '<preview URL>'; npm run e2e --workspace apps/web -- smoke --project=chrome; Remove-Item Env:E2E_BASE_URL
  ```

  Merge to `main` with the owner's approval. Vercel deploys production at the `*.vercel.app` address (D-115). Run the smoke spec and the T-01 delivery case against production the same way. Check the response headers with `curl.exe -I <production URL>` (TW-05).
- [ ] 9. **Web test set (M4-07 web part).** Run every web-applicable test of Section 6 against production and record each result. Tests that belong to other plans are listed as such, not as passed.
- [ ] 10. **Rollback (R-5).** If production fails a check, use "Promote to Production" on the previous deployment in the Vercel dashboard, and log it.

**Deliverables:** the security headers, `smoke.spec.ts`, `docs/test-results/web/phase-19.md`, `docs/test-results/web/latency.json`, the production deployment, and the web part of the MVP test log.

**Acceptance criteria**

- [ ] Every cross-cutting check of step 2 passes. (T-40, D-95, 12.8)
- [ ] The smoke spec passes in Chrome, Edge and Firefox, by hand on Chrome on Android, and in Safari or is recorded as unverified. (T-50)
- [ ] The 95th percentile of 100 send-to-receive times is under 2 seconds. (T-01, D-82)
- [ ] No secret value is found in the web build. (T-42 web part)
- [ ] Production responds over HTTPS with the D-W10 headers. (TW-05, D-115)
- [ ] T-21 client part passes or is recorded as blocked by M3-08. (T-21)
- [ ] The web app has no service worker (DevTools Application panel shows none). (D-109 (8))
- [ ] `docs/test-results/web/phase-19.md` records every criterion above as passed, or as blocked with its flag. (M4-07 web part)

**Exit gate:** `$env:E2E_BASE_URL = '<production *.vercel.app URL>'; npm run e2e --workspace apps/web -- smoke --project=chrome` passes against production.

**Risks and fallbacks**

- The CSP blocks a Supabase request (for example, Storage on another host): read the browser console's violation report, add exactly that origin to the matching directive, and log it.
- The T-01 budget fails because of PF-W2 (no Postgres Changes channel): the release gate stays blocked until the owner resolves the gap.
- The Vercel Hobby limits change: Assumption that Hobby stays free for personal, non-commercial use (D-115, Vercel fair use guidelines); checked on the Vercel pricing page at release.

## 6. Cross-phase test plan

Rules from 10.7 apply unchanged:
- RLS, Storage and Realtime checks run through the API with each test user's own session, never in the SQL Editor (D-16).
- A test recorded N/A under a D-85 fallback counts as passed (D-121).
- Environments: H (hosted project), W (browser), D (Android device), API (direct calls with a user session).

The web plan re-runs the web-applicable tests after every phase that touches their area. The whole web set runs again in Phase 19 against production.

### 6.1 Core tests T-01 to T-22

| Test | Web applicability | First web phase | Re-run in | How it runs on web |
|---|---|---|---|---|
| T-01 | Web (W + W for the budget, D + W for delivery) | 13 (delivery), 19 (budget) | 14, 15, 16, 19 | `phase-13-send.spec.ts`; `latency.spec.ts` over 100 messages in two contexts on one clock (D-82). |
| T-02 | Device test; its web form is T-19 | 6 | 13 | Covered on web by T-19. The device run belongs to the Android plan. |
| T-03 | Not web (D-19) | None | None | Android plan. |
| T-04 | Web part (two browsers of one account) | 7 | 10, 15 | Two contexts of A compare list order, history and read status. |
| T-05 | Backend (M1-09); no web UI | None | Phase 0 reads the M1 log; Phase 19 reads the R-4 result | Read only. |
| T-06 | Web | 14 | 19 | `phase-14-actions.spec.ts`: edit and delete visible to B; B's update returns zero rows. |
| T-07 | Not web (device force-stop); web form TW-10 | None | None | Android plan; TW-10 covers LS-9 on web. |
| T-08 | Not web (D-19) | None | None | Android plan. |
| T-09 | Web (automated) | 6 | 13 | `QueueCore.test.ts` drops the response after the insert. |
| T-10 | Web UI re-run | 4 | 9, 19 | `phase-04-auth.spec.ts` plus the manual forced-change and change-password checks. |
| T-11 | Backend, with a client re-run | 17 | 19 | Non-member and deleted-message signed-URL refusals through the API; the lifetime check is TW-07. |
| T-12 | Web | 12 | 19 | `MessageText.test.tsx` and `phase-12-thread.spec.ts`. |
| T-13 | Web form (tab hidden instead of the app backgrounded) | 7 | 12, 19 | `phase-07-sync.spec.ts` with concurrent senders. |
| T-14 | Backend, with a client re-run | 15 | 19 | C's join of `chat:<id>` through the API helper. |
| T-15 | Backend (M1-09) | None | Read only | Read only. |
| T-16 | Backend (M1-09) | None | Read only | Read only. |
| T-17 | Web | 14 | 16 (attachment forward case), 19 | `phase-14-actions.spec.ts`. |
| T-18 | Web | 6 | 13 | Failure injection until 8 attempts. |
| T-19 | Web | 6 | 13, 19 (smoke) | Offline queue in IndexedDB, then online; `countMessages` = 1. |
| T-20 | Web | 16 | 19 | Throttled Chromium upload; text before media. |
| T-21 | Client part (drain a full queue) | 19 | None | Blocked until M3-08 (PF-W5). The API burst half is backend. |
| T-22 | Backend, with a UI part | 11 | 19 | Exact and partial username in New chat. |

### 6.2 Tests T-36 to T-53

| Test | Web applicability | First web phase | Re-run in | How it runs on web |
|---|---|---|---|---|
| T-36 | Web (two browsers of one account) plus API | 10 (order), 18 (full) | 19 | `phase-18-organize.spec.ts`. |
| T-37 | Web | 15 | 19 | Seen within 2 seconds; a non-member's and a forged hint change nothing. |
| T-38 | Client and UI parts | 7 | 11, 19 | Removal clears the cache on foreground; UI create, remove and leave. |
| T-39 | Backend (M3); client refuses the same inputs first | 1 (validation unit tests) | 16 | Validation unit tests mirror the T-39 cases. The API half is backend. |
| T-40 | Web | 2 (contrast), 3 (loading), 8 (breakpoint), 9 (theme) | 19 (full) | Phase 19 step 2. |
| T-41 | Web part (Retry, Discard, 201st item) | 6 | 13 | The Force-toggle and video-deferral half is Android. |
| T-42 | Web bundle part | 0 | 19 | `scripts/scan-web-bundle.ps1`. The three-bundle run is M4-07. |
| T-43 | Not web (admin) | None | None | Admin plan. |
| T-44 | Not web (admin) | None | None | Admin plan. |
| T-45 | Web part (sign-in leads to Change password) | 4 | 19 | Manual check of Phase 4 step 9. |
| T-46 | Not web (admin) | None | None | Admin plan. |
| T-47 | Web part (the banned account's web session) | 19 | None | After the owner bans G in the admin web: G's open web tab gets no new data, a reload shows a denied read as ErrorState, and a new `chat:` join is refused. Logged by hand. |
| T-48 | Not web (admin) | None | None | Admin plan. |
| T-49 | Web part | 6 (background), 9 (sign-out), 12 (separators), 13 (keyboard), 14 (Forward hidden), 16 (paste), 18 (mute) | 19 | Each part runs in the listed phase's spec. The group-title API check is backend. |
| T-50 | Web | 19 | None | `smoke.spec.ts` in Chrome, Edge, Firefox and WebKit, plus Chrome on Android and Safari by hand. |
| T-51 | Web | 15 | 19 | Typing display, throttle and group count. |
| T-52 | Web part (send and open each type) | 16 | 17, 19 | The bucket byte limits through the API are backend. |
| T-53 | Web part (the other member's view) | 19 | None | After the owner deletes a throwaway account in the admin web: A's web client, after foreground, shows "Deleted message" and "Deleted account". Logged by hand. |

T-23 to T-35 (V2 and V3) are out of scope (D-W13).

### 6.3 New tests added by this plan

| ID | Scenario | Pass criteria | Phase | Verifies |
|---|---|---|---|---|
| TW-01 | Run the shared LocalStore contract suite against the IndexedDB adapter | Every contract test passes, including a Blob round-trip and `countUnsent`. | 5 | M2-02, LS-9, LS-10 |
| TW-02 | Open the app in two tabs of one browser | Exactly one tab leads; leadership moves within 2 seconds when it closes; a write in one tab shows in the other within 1 second. | 5 | D-W04, D-93 |
| TW-03 | Load the app with Dark stored, and with System under a dark system theme | The first paint has the dark background; no light frame is visible. | 2 | D-83, 12.10 |
| TW-04 | Run the token sync and contrast tests | Both pass; an edited token without regeneration fails the sync test. | 2 | D-95, D-138 |
| TW-05 | Request the production page headers | The D-W10 headers are present, and the page works with them (smoke spec passes). | 19 | D-W10 |
| TW-06 | Open a dialog or overlay and press the browser back button | The overlay closes and the URL is unchanged; a second back leaves the route. | 3, 8, 17 | 12.6 |
| TW-07 | Inject a 5-second signed URL lifetime and reload a photo after 6 seconds | A new URL is fetched and the photo displays. | 17 | D-113 |
| TW-08 | Sign out offline, with and without unsent items | The warning shows when items exist; afterwards the `dologram` database is gone, `dg.theme` remains and `/sign-in` shows. | 9 | D-109 (5), D-W17 |
| TW-09 | Subscribe the Postgres Changes channel as A with public access disabled | The result (subscribed or refused) is recorded; on refusal the 15-second resync fallback runs. | 7 | 6.4, PF-W2 |
| TW-10 | Reload the tab in the middle of an upload | After the reload the item is retried and delivered once, with one object and one media row. | 16 | LS-9, D-93 |

## Appendix A: New decisions (proposed)

Temporary IDs. Each gets the next free D-nn when merged into Section 9.

| ID | Decision | Reason | Source |
|---|---|---|---|
| D-W01 | The user web talks to Supabase only from the browser through supabase-js, with the session in the SDK's default browser storage. No `@supabase/ssr`, middleware, route handler, server action or server component calls Supabase. Route guards run on the client (12.6). | M2-04 names the SDK's default browser storage; the secret key never belongs in `apps/web` (D-102); no server code means nothing that could hold a key. | M2-04, D-100 |
| D-W02 | IndexedDB is the UI's source of truth. Network results are written into it, and screens read it through `useStoreQuery` (`useSyncExternalStore`). No state-management library is added. | One data path makes offline, sync and multi-tab behavior identical. | 6.1, D-06 |
| D-W03 | The IndexedDB database is `dologram`, version 1, with the stores and indexes of the Phase 5 table, opened through the `idb` wrapper (ISC). | M2-02 requires tables for the queue, the cache and sync_state; the web also needs Blob storage (M3-02). | M2-02, M3-02 |
| D-W04 | One tab per browser runs the delivery worker and the Realtime subscriptions, chosen with the Web Locks API lock `dg-worker`. Other tabs read IndexedDB and get changes over the BroadcastChannel `dg-store`. "Foreground" on web means `document.visibilityState === 'visible'`. | Two workers in two tabs would break the strict per-chat order (D-93) and double the Realtime connections (D-43). | D-43, D-93, D-109 (6) |
| D-W05 | No service worker and no app-shell cache are added. Offline, cached history shows in an open tab and on any load the browser serves from its own cache. A full reload while offline may fail. | D-109 (8) forbids a service worker; F1's offline open is met inside these limits (C-5). | D-109 (8), F1 |
| D-W06 | Uploads above 6,291,456 bytes use `tus-js-client` against Supabase's resumable endpoint with 6 MB chunks and no stored fingerprint, so an interrupted upload restarts from the beginning. | D-29 requires resumable uploads above 6 MB; D-93 requires a restart from the beginning. | D-29, D-93, D-116 |
| D-W07 | Voice notes record with the first supported of `audio/webm;codecs=opus`, `audio/webm` and `audio/mp4`. The declared Content-Type drops the codecs parameter. Recording stops at 15 minutes or 10,485,760 bytes. | D-109 (7) allows audio/webm and audio/mp4; the bucket checks the declared type exactly (D-90); CMP-10 sets 15 minutes on Android. | D-29, D-90, D-109 (7), CMP-10 |
| D-W08 | Web tests use Vitest (D-100) with jsdom, Testing Library and fake-indexeddb for unit tests, and Playwright (Apache-2.0) for browser tests and the T-50 runs. | Free tools that run on Windows; Playwright drives Chromium, Firefox, WebKit, Chrome and Edge. | D-100, Goal 1.1 |
| D-W09 | T-01 latency on web is captured only when NEXT_PUBLIC_DG_LATENCY=1. Two Playwright browser contexts on one computer stand in for "two browser profiles" (D-82). | Separate contexts have separate storage like separate profiles, and share one clock. | M4-04, D-82 |
| D-W10 | The web app sends a Content-Security-Policy limiting connections to the project's https and wss origins, plus Referrer-Policy, X-Content-Type-Options and Permissions-Policy headers. Scripts allow `'unsafe-inline'` for the theme script and Next.js inline scripts. | Defense in depth for a public `*.vercel.app` address; message text never renders as HTML (D-05). | 5.4, D-05, D-115 |
| D-W11 | Source layout of `apps/web/src`: `app` (routes of 12.6), `components` (12.10), `features` (screen logic per flow), `lib` (client, store, worker, media), `theme` (generated tokens). UI strings come only from `packages/shared/src/strings`. | 12.10 fixes the component paths; the strings module is shared (11.6). | 12.10, 11.6, D-35 |
| D-W12 | No list virtualization library and no date library. Lists render 50 rows per window; dates use `Intl.DateTimeFormat` in the browser locale. | 2 to 10 users (D-41); D-109 (12) needs only the locale. | D-41, D-44, D-109 (12) |
| D-W13 | This plan covers MVP screens WEB-01 to WEB-14 only. WEB-15 to WEB-20 (V2 and V3) get their own plan after M4-07. | 3.1: V2 starts only after the MVP is complete. | 3.1, 10.3 |
| D-W14 | Vercel: Root Directory `apps/web` with files outside the root included; NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY set for Production and Preview; branches deploy to Preview; `main` deploys to Production; rollback by promoting the previous deployment. | D-115 fixes production from `main`; R-5 requires a preview first. | D-115, R-5 |
| D-W15 | The browser tab title is `DoloGram`, or `(<n>) DoloGram` where n is the total unread count of non-archived chats, including muted chats. | WEB-03 asks for "the total unread count"; muting is a notification setting only (D-09). See PF-W14. | WEB-03, D-09 |
| D-W16 | The web cache holds the full history of every chat, filled by the M2-05 resync from cursor 0. Screens page the cache 50 rows at a time, and unread counts come from one IndexedDB query. | Resync by cursor needs every row behind the cursor; D-44's single unread query is met locally (C-7). | M2-05, D-40, D-44 |
| D-W17 | Sign out on web uses `signOut({ scope: 'local' })`: it ends only this browser's session, works offline and leaves the user's Android session alone. Then D-109 (5) wipes the queue, cache and sync state; `dg.theme` is kept. | D-109 (5) is about this device's data; a global sign-out would also end the Android session. | D-109 (5), D-83 |
| D-W18 | A rejection that cannot succeed on retry (HTTP 4xx other than 408 and 429, Postgres classes 22, 23 except 23505, 42, and P0001) marks the queue item failed at once with its error text. Network and server errors follow LS-7. | LS-7 defines retries for delivery failures; repeating a rejected insert 8 times cannot change the result, and the item still stays visible with Retry and Discard. | LS-7, D-77, D-93 |
| D-W19 | The per-chat resync reads `H = chats.next_seq` first, fetches rows with cursor < sync_seq <= H, and then sets the cursor to H. | The counter row stays locked until commit (D-40), so every row up to H has committed when H is read; no row is skipped across the three tables. Assumption in PF-W8. | D-40, 6.4 |
| D-W20 | On web, picked, pasted or dropped JPEG, PNG and WebP images are photos; MP4 and WebM videos are videos; only MediaRecorder recordings are voice notes; every other allowed type, including a picked audio file, is a file. | Section 5.5 and D-90 allow any 5.5 type as a file; this keeps the size class predictable. | D-29, D-75, D-90 |
| D-W21 | Self-service sign-up is enabled on web: anyone with the URL creates an account at `/sign-up` with email + password, choosing a username (`^[a-z][a-z0-9_]{4,31}$`, D-89) and a display name (1–64). Email confirmation is OFF for now. A self-created account sets its own password, so it is not forced through Change password (D-78 applies only to admin-created accounts). Supersedes D-04 ("sign-up off"). Requires the M1-03 trigger to read `username`/`display_name` from `raw_user_meta_data` on `auth.signUp` and to propagate a username unique violation atomically; the client cannot pre-check username availability (profiles RLS). | "Normal" sign-up like FB/IG/Reddit, per owner instruction 2026-11-09. | D-04, D-47, D-89, D-116, M0-05, M1-03, WEB-01b |
| D-W22 | Self-service password reset on web ("Forgot your password?") replaces the "Ask the owner" string. The reset email links to `${origin}/reset-password`; the page calls `exchangeCodeForSession` then `updateUser({ password })`. Requires the password-reset email enabled and the web production URL (and `http://localhost:3000` for dev) on the Auth redirect-URL allow-list. | "Normal" forgot-password flow, per owner instruction 2026-11-09. | D-51, M0-05, D-181 |

## Appendix B: New flags

| ID | Where | Gap and effect | Blocked or constrained | Plan handling |
|---|---|---|---|---|
| PF-W1 | Prompt inputs | The Android and Admin implementation plans do not exist yet, so shared packages and components cannot be reused by name. | Phases 1 to 7 | Use the v14 names (M2-01 to M2-05, 12.10, CMP-nn); build missing shared modules once; whichever plan lands first owns a module (C-1). |
| PF-W2 | 6.4, M0-07, M1-05 | It is unverified whether a Postgres Changes channel is accepted with "Allow public access" disabled; M1-05 authorizes only `chat:` topics. | Phase 7; T-01 budget in Phase 19 | TW-09 checks it. On refusal: resync every 15 seconds (data stays correct), and the owner adds a backend authorization outside this plan; the release gate waits. |
| PF-W3 | F1 vs D-109 (8) | Without a service worker, an offline reload cannot load the app, so "opens to cached chat history" holds only in an open tab or from the browser cache. | F1 offline on web | D-W05; recorded, no change. |
| PF-W4 | D-44 | No unread-count function exists in the contract. | Phase 10 | D-W16: counted locally from the full cached history. |
| PF-W5 | M3-08 | The rate limits and DG429 are built in M3, outside the M0 and M1 prerequisites. | T-21 in Phase 19 | DG429 handling is unit tested from Phase 6; T-21 is blocked until M3-08. |
| PF-W6 | 11.3 vs D-109 (6) | 11.3 says the web queue retries "only while the tab is open"; D-109 says only in the foreground. | Phase 6 | Follow D-109: visible tab only (D-W04). |
| PF-W7 | D-70, D-124 | Creating a direct chat takes three inserts with no single function; a failure after the first leaves a one-member direct chat. | Phase 11 | Refresh the list first and open an existing chat; log any leftover id for the owner. |
| PF-W8 | D-W19 | Assumption: members can read `chats.next_seq` through the chats SELECT policy. | Phase 7 | Checked on the first resync; fallback: cursor = the smallest of the three tables' highest fetched sync_seq. |
| PF-W9 | D-109 (9), T-50 | Desktop Safari cannot run on the owner's Windows computer; WebKit is not Safari. | T-50 | WebKit during development; the Safari row needs a Mac or is recorded as unverified (D-85 item 16). |
| PF-W10 | D-W04 | Assumption: the Web Locks API exists in every supported browser. | Phases 5 and 6 | Checked by T-50; fallback a BroadcastChannel heartbeat election. |
| PF-W11 | D-109 (1) | Assumption: PostgREST accepts the string `infinity` for muted_until. | Phase 18 | Checked by the Phase 18 spec; fallback `9999-12-31T23:59:59Z`, recorded for the owner. |
| PF-W12 | M3-02 | Assumption: every supported browser stores a File or Blob in IndexedDB. | Phases 5 and 16 | Checked by TW-01 and T-50; fallback ArrayBuffer plus type and name. |
| PF-W13 | D-W06 | Assumption: Supabase's resumable upload endpoint accepts a user JWT with the publishable key and 6 MB chunks. | Phase 16 | Checked by the Phase 16 spec; fallback the standard upload up to 50 MB. |
| PF-W14 | WEB-03 | The document does not say whether muted chats count toward the tab-title unread total. | Phase 8, Phase 10 | D-W15: they count. The owner may reverse it. |
| PF-W15 | M1-03, D-163 | Assumption: the new-user trigger propagates a username unique violation so `auth.signUp` fails atomically (no orphan `auth.users` row). If it swallows the error, a taken username leaves an authenticated user with no `profiles` row. | Phase 4 | Sign-up maps any 500 to `strings.signUp.usernameTaken`; the residual orphan is a backend fix outside this plan. |

## Appendix C: Assumptions and unverified claims

Each item names where it is checked and its fallback.

| # | Assumption | Checked in | Fallback |
|---|---|---|---|
| A-1 | The Node version recorded at M0-08 has `process.loadEnvFile` (Node 20.12 or later). | Phase 0 | The `dotenv` package. |
| A-2 | `next lint` is the lint entry in the Next.js release pinned at M0-09. | Phase 0 | `eslint .`. |
| A-3 | Supabase secret keys start with `sb_secret_`. | Phase 0 | The value search is authoritative either way. |
| A-4 | next/font downloads Inter and JetBrains Mono at build time on Vercel and locally, and serves them self-hosted. | Phase 2 | `next/font/local` with the release font files. |
| A-5 | The 12.3 Lucide names exist in the pinned lucide-react. | Phase 2 | Correct the name in `icons.ts`. |
| A-6 | supabase-js forwards a refreshed token to Realtime by itself. | Phase 4 | The explicit `realtime.setAuth` call stays. |
| A-7 | `realtime.setAuth()` before subscribing is what private channels need in the pinned supabase-js. | Phase 15 | Record the error; see the Phase 15 fallback. |
| A-8 | The Supabase auth error for a wrong password is code `invalid_credentials` or HTTP 400, and rate limiting is HTTP 429. | Phase 4 | `mapSignInError` maps on status as well as code. |
| A-9 | react-markdown shows raw HTML as text when no rehype-raw plugin is used. | Phase 12 (T-12) | `remarkHtmlAsText` (D-85 item 2). |
| A-10 | `createSignedUrl` supports the `download` option in the pinned supabase-js. | Phase 17 | Fetch the blob and save it through an object URL. |
| A-11 | Vercel detects the npm workspace with Root Directory `apps/web`. | Phase 19 | Set the Install Command to `cd ../.. && npm install` and the Build Command to `npm run build --workspace apps/web`. |
| A-12 | Vercel Hobby stays free for personal, non-commercial use. | Phase 19 | None in this plan; the owner decides. |
| A-13 | `<dialog>` with `showModal()` traps focus in every supported browser. | Phase 19 (T-50) | A `div role="dialog"` with a manual focus trap. |
| A-14 | Plus PF-W2, PF-W8, PF-W10, PF-W11, PF-W12, PF-W13. | As listed in Appendix B | As listed in Appendix B. |

Claims this plan does not verify: the exact behavior of supabase-js, Playwright, react-markdown, tus-js-client and Vercel releases that will be pinned at install time. Every version is pinned and recorded when installed, never named here.

## Appendix D: Traceability

| Document ID | Phase |
|---|---|
| 3.2 1-on-1 & group chat | 7, 11, 13 |
| 3.2 Text formatting | 12 |
| 3.2 Message edit / delete | 14 |
| 3.2 Reply, Forward, Reactions | 14 |
| 3.2 Read receipts, Typing indicators | 15 |
| 3.2 Photos, videos, voice notes, files | 16, 17 |
| 3.2 Saved Messages | 6, 10, 13 |
| 3.2 Folders, archive, mute | 10, 18 |
| 3.2 Dark mode | 2, 9 |
| 3.2 Low Signal Mode (web subset) | 6, 16 |
| 3.4 LS-1, LS-2 | 6, 13 |
| 3.4 LS-3 | 6 |
| 3.4 LS-4 | 6, 16 |
| 3.4 LS-5 (No connection row only, D-19) | 6 |
| 3.4 LS-6 | Not web (D-19) |
| 3.4 LS-7, LS-8 | 6, 13 |
| 3.4 LS-9 | 5, 6, 16 |
| 3.4 LS-10 | 5, 6 |
| 3.5 F1 | 4, 9 |
| 3.5 F2 | 10 |
| 3.5 F3 | 13, 14 |
| 3.5 F4 | 14 |
| 3.5 F5 | 16, 17 |
| 3.5 F6 | 15 |
| 3.5 F7 | 6, 13, 14 |
| 3.5 F8 | 6 (web subset) |
| 3.5 F9 | 9, 18 |
| 3.5 Cross-cutting requirements | 3, 19 |
| 5.1, 5.2, 5.3, 5.4, 5.5 | 4, 6, 12, 16, 17, 19 |
| 6.1, 6.2 local records | 5 |
| 6.3 | 6 |
| 6.4 | 7, 15 |
| 6.5 Next.js | 0, 19 |
| 11.3 WEB-01, WEB-02 | 4 |
| 11.3 WEB-03 | 8 |
| 11.3 WEB-04, WEB-05 | 10, 18 |
| 11.3 WEB-06 | 12, 13, 16 |
| 11.3 WEB-07, WEB-08 | 14 |
| 11.3 WEB-09 | 16 |
| 11.3 WEB-10 | 17 |
| 11.3 WEB-11, WEB-12 | 11, 18 |
| 11.3 WEB-13 | 18 |
| 11.3 WEB-14 | 9 |
| 11.3 WEB-15 to WEB-20 | Out of scope (D-W13) |
| 12.2, 12.3, 12.10 | 2 |
| 12.4 CMP-01 to CMP-03, CMP-05, CMP-06, CMP-15 to CMP-21, CMP-23 | 3 |
| 12.4 CMP-04 | Not built on web (Phase 3 note) |
| 12.4 CMP-07, CMP-22 | 12 |
| 12.4 CMP-08, CMP-10 | 13 |
| 12.4 CMP-09, CMP-13, CMP-14 | 10 |
| 12.4 CMP-11 | 16, 17 |
| 12.4 CMP-12, CMP-34 | 14 |
| 12.4 CMP-32, CMP-33 | 8 |
| 12.4 CMP-24 to CMP-31 | Not web (admin) |
| 12.5 | 4, 8 to 18 |
| 12.6, 12.7 | 3, 8 |
| 12.8 | 3, 12, 13, 19 |
| M2-01 | 1 |
| M2-02 | 5 |
| M2-03 | 6 |
| M2-04 | 4 |
| M2-05 | 7 |
| M2-06 | 12 |
| M2-07 | 11 |
| M2-08 | 10 |
| M2-09 | 13, 14 |
| M2-10 | 14 |
| M2-11 | 15 |
| M2-12 | 13 |
| M2-13 (web part) | 6, 7, 12 to 15 |
| M3-01, M3-02, M3-03 | 16 |
| M3-04 | 14 |
| M3-05 to M3-07 | Not web (D-19) |
| M3-08 (client handling) | 6, 19 |
| M4-01 | 18 |
| M4-02 | 2, 9 |
| M4-03 | 3, 19 |
| M4-04 | 13, 19 |
| M4-07 (web part) | 19 |
| R-5 | 19 |
| D-05, D-30, D-99 | 12 |
| D-10, D-27, D-77, D-93 | 6, 13 |
| D-12, D-19 | 6, 10, 13, 16 |
| D-22, D-31, D-50, D-76, D-133 | 14 |
| D-23, D-57, D-92, D-118 | 15 |
| D-24, D-94 | 10, 18 |
| D-29, D-39, D-75, D-90, D-113, D-116 | 1, 16, 17 |
| D-35, D-95, D-136 | 3, 8, 19 |
| D-40, D-43, D-91 | 7 |
| D-42, D-46, D-58, D-70, D-88, D-124 | 11 |
| D-47, D-51, D-78, D-86 | 4, 9 |
| D-82 | 13, 19 |
| D-83 | 2, 9 |
| D-100 | 0, 1 |
| D-109 | 6, 9, 12, 13, 14, 16, 18, 19 |
| D-114 | 4, 15 |
| D-115 | 0, 19 |
| D-127 to D-131, D-134, D-138, D-144 | 2 |
| D-132, D-143 | 12, 13 |
| D-139 | 3 |
| D-141, D-142, D-145 | 8 |
| T-01 | 13, 19 |
| T-04 | 7, 10, 15 |
| T-06 | 14 |
| T-09, T-18, T-19 | 6, 13 |
| T-10 | 4, 9 |
| T-11 | 17 |
| T-12 | 12 |
| T-13 | 7 |
| T-14 | 15 |
| T-17 | 14 |
| T-20 | 16 |
| T-21 | 19 |
| T-22 | 11 |
| T-36 | 10, 18 |
| T-37, T-51 | 15 |
| T-38 | 7, 11 |
| T-40 | 2, 3, 8, 9, 19 |
| T-41 | 6, 13 |
| T-42 | 0, 19 |
| T-45, T-47, T-53 (web parts) | 4, 19 |
| T-49 | 6, 9, 12, 13, 14, 16, 18 |
| T-50 | 19 |
| T-52 | 16, 17 |
