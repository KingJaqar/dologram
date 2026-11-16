# Admin web Phase 0 context and acceptance

Executed 2026-11-14, Asia/Manila. Scope: Phase 0 only. Status: **Complete**, 9/9 numbered steps (100%). Overall admin plan: 9/137 numbered steps (7%, rounded). This is not an aggregate DoloGram release percentage. Phase 1 is ready, but has not started in this execution.

## Checklist and baseline ownership

- [x] Scope: admin scaffold, server-only core, lazy environment validation, loopback launch and documentation. No theme generator, components, authentication, backend client, schema or account operation.
- [x] Prerequisites: shared validators/config/exports inspected in actual source; shared typecheck and 215 tests pass. No previous admin phase exists. M1/security/owner/target contracts remain later integration gates.
- [x] Context: root instructions and all ancestor instruction locations checked; root and Supabase AGENTS read. Mobile AGENTS read for regression context. No applicable CLAUDE file found. No Expo/RN API/source is changed, so Expo implementation docs are not a Phase 0 input.
- [x] Baseline: recoverable relevant working-copy copies/patch, complete Git status and hashes captured before source edits. Baseline checks and diagnostics retained.
- [x] Acceptance: production launch, exclusive IPv4 loopback listener, HTTP 200/title, missing secret without values, actual client-import compiler rejection, ignored local environment, unit/CLI/type/lint checks.

Baseline HEAD: `d906bff38ea932c1cab6410b13c6d102e9069067`. Existing extensive changes, including the admin plan/context index and lockfile, are user-owned. They were preserved. Recoverable baseline material is under `supabase/repomix/admin-phase-00-20261114/baseline/`: relevant.patch, status.txt and source copies. Sensitive inputs were not read or copied. The new ignored admin `.env.local` contains only the empty example; tests use synthetic process settings.

Concurrent `apps/web` scaffolding appeared during this execution and another dependency installation overlapped package extraction. It is outside this task's ownership. Preserve its files and lock entries. Early admin tooling checks encountered incompletely extracted Next files; they passed after installation completed. Root typecheck includes the concurrent web workspace and passed at the recorded execution time. Do not attribute the entire lockfile diff to this task.

## Workflow and reusable context

Followed **Git baseline → ripgrep discovery → Reader validation → scoped Repomix → Reader XML analysis → original-source verification**. Reader means bounded XML/source extraction in PowerShell here; no dedicated Reader or Repowise tool is available. Repowise was optional and unused.

Discovery covered workspace manifests, lockfile pins/diff, shared account validators, text/config dependencies, exports and TypeScript/test configuration. The selected phase and overall plan Sections 0–4 were read directly; unrelated phase bodies were excluded from packet scope. Initial overlarge discovery output was replaced by explicit bounded reads of required ranges, including complete Phase 0 lines 243–326 and continuation of Section 0.6. No required phase context remains truncated.

Repomix: cached installed **1.18.1**, run from repository root with its existing config/security checks. Packet/logs/selectors/hashes are under `supabase/repomix/admin-phase-00-20261114/`:

| Artifact | Identity / analysis |
|---|---|
| `packet-scope.txt`, `context.xml`, `repomix.log` | Exact 10 intended files included; no omissions or suspicious files. Uncompressed, parsable XML. Packet SHA-256 `3010C1AC4D3A0770C854C8791F813F50C7DDFE9AD9AE23E546D43CA7F98E9D13`. Reported estimate 3,692 tokens / 12,977 characters; not measured model usage or savings. |
| `source-identities.json` | Baseline paths, SHA-256 and sizes. Seven overlapping prior polish identities unchanged; shared tsconfig/text/config are newly validated entries. Hashes establish identity, not correctness. |
| XML extraction 1 | Nine complete entries: root/Supabase AGENTS, Repomix/root/shared manifests and tsconfigs, account/text validation. Entries printed with explicit line boundaries; about 4,100 source characters, below 12,000. Continuation explicitly names config/index.ts. |
| XML extraction 2 | Remaining config/index.ts entry, all 188 lines / 4,483 characters. Fully read. Includes profile/password limits and dependent helpers. |
| Original-source verification | All ten entries match current source after newline normalization at baseline. Account/text/config implementations and shared export list read directly. No compression gaps. |
| `final-source-identities.json` | Final identities of owned implementation/evidence and retained prerequisite files; root package.json intentionally supersedes its baseline packet entry. The baseline XML remains historical, not falsely presented as current root configuration. |

Excluded: environment values, legacy provisioning bodies, backups/content, generated native/build files, node_modules and unrelated application sources. No credential value was copied into context. Original-source review after implementation covered new env.ts lines 1–149, root script diff, package/config/test exports, bootstrap/layout and environment example. No repeated packet generation was necessary.

## Requirement classification and implementation

| Step | Before | Completed behavior / evidence |
|---|---|---|
| 0.1 | Partially done | Historical context existed; current source/tool/Git baseline now verified. Node 24.13.1, npm 11.8.0, Git 2.56.0.windows.2; Supabase CLI absent on PATH and Docker runtime not queried because neither is required for scaffold acceptance. No privileged operation attempted. |
| 0.2 | Not started | Pinned create-next-app/Next/eslint-config-next 16.4.6. Official major-version docs and exact scaffold help read before creation; Node/React peer compatibility checked with registry metadata. Exact flags are in README and scaffold-help.log/scaffold.log. React 19.3 generated defaults were corrected to repository 19.2.3 before install. |
| 0.3 | Partially done | Existing workspace globs reused; @dologram/admin scripts plus exactly two root launch scripts added. Production build/start proved by admin-launch-host.log. Socket/HTTP gates map here and to 0.8. |
| 0.4 | Not started | @dologram/admin-core declares required server-only/Zod/Supabase/Postgres dependencies. Root and /env have guarded exports; unexported source paths refused. Real Node subprocess tests exercise allowed react-server imports and denied default imports; negative Next build rejects both public paths. |
| 0.5 | Not started | Independent getPasscodeEnv/getAdminEnv/getAdminConfigStatus, all lazy. Hash cost/format, UUID, absolute backup path, hosted HTTPS/API/project/database alignment, shared/direct poolers and explicitly confirmed isolated loopback identities validated. Query overrides cannot bypass database target checks. Errors/status return names only. Synthetic missing/hash-only/backend-only/invalid/isolated tests pass. |
| 0.6 | Partially done | Existing root ignore already covers .env.local. Eight documented empty fields in .env.local.example; scaffold's local ignore amended to expose that example. Empty .env.local copied only when absent, remains ignored. No Phase 4 helper dependency. |
| 0.7 | Partially done | Shared identity/exports existed. Next transpiles both workspace packages, disables powered-by, and uses exact workspace dependencies. TypeScript config inherits strict base and permits .ts imports for native Node CLI compatibility. |
| 0.8 | Not started | Dynamic server bootstrap calls connection before status. Root layout does not parse credentials. Title/heading/missing/invalid/empty-status states implemented; no backend connection, demo assets or Google font request. Native browser color-scheme only; Phase 1 owns token styling. Live response shows only missing SUPABASE_SECRET_KEY while configured synthetic values are absent. |
| 0.9 | Not started | README covers Run, Environment, Pinned versions, Never deployed, dependency purpose, CLI contract and limitations. |

Necessary new workspace dependencies are exactly the plan's framework/core/test/lint/type tooling; versions/purposes are in apps/admin/README.md. No mobile/shared source or manifest changed by this execution. Compared with baseline, existing mobile/React/RN/Expo/Supabase runtime versions are unchanged. Ten TypeScript ESLint transitive packages resolved from 8.72.1 to 8.72.2 during overlapping installs; final mobile lint diagnostics are byte-for-byte identical to baseline. No override or runtime dependency upgrade was introduced to force compatibility.

## Verification results

All logs below are in `supabase/repomix/admin-phase-00-20261114/`.

| Check | Actual result |
|---|---|
| Baseline shared typecheck/test | PASS; 25 files, 215 tests. Existing shared Vitest CommonJS config warning and experimental SQLite warning retained. |
| Baseline mobile typecheck | PASS. |
| Baseline mobile lint / final mobile lint | PRE-EXISTING FAILURE; both 14 errors, 4 warnings; full output identical. |
| Baseline mobile tests | Initial run blocked by temp-cache EPERM; diagnosed and rerun using a workspace cache. 87 suites pass, 5 fail; 563 tests pass, 16 fail. Failures: SearchScreen, ChatOrganizationActions, actionScreens, PeopleRows, a11yPressableSource. Not repaired or retried unchanged. No mobile runtime dependency/source changed afterward, so no redundant full mobile test run. |
| Admin lint | PASS, no warnings (`admin-lint-2.log`). Initial missing-module result was incomplete installation, not suppressed lint. |
| Root typecheck | PASS across admin/mobile/concurrent web/core/shared (`root-typecheck.log`). Includes final environment implementation. |
| Admin tests | PASS, 2 bootstrap tests (`admin-test.log`); no warnings. |
| Core tests | PASS, 38 tests (`core-test-verified.log`); no warnings. Parser units mock only the RSC marker; real subprocess and compiler barrier checks remain independent. Vitest condition-only attempts did not select the native dependency branch; after source/docs review the parser units adopted this test-only marker mock. |
| Production build with empty env | PASS (`build.log`); `/` dynamic, no credential requirement or warnings. |
| Negative production build | EXPECTED REJECTION (`client-boundary-negative-build.log`): explicit server-only errors in both index.ts and env.ts from a use-client route. Temporary probe removed in finally. |
| Root npm run admin | PASS (`admin-launch-host.log`), production build then start. Sandbox-launched service was inaccessible due to sandbox networking; diagnosed with direct HTTP EACCES/timeout and relaunched on host. |
| Runtime acceptance | PASS (`runtime-acceptance.json`): only 127.0.0.1:3100; HTTP 200; correct title/heading; missing SUPABASE_SECRET_KEY; no configured synthetic values; no powered-by header; no-store response. No backend calls are made by the bootstrap. Server log has no runtime errors/warnings. |
| Environment Git exclusion | PASS: check-ignore matches .env.local; status has no local environment file and includes the example. |

No real credentials, backend mutations, migrations, commits, pushes, deployment or external configuration change. Browser interaction/accessibility and real backend verification are not Phase 0 gates and are not claimed here. `cleanup.json` proves the owned host server was stopped and port 3100 released. Stopping the owned process intentionally causes npm to append a nonzero start termination to the launch log; this is cleanup, not an application runtime failure. `final-review.json` verifies that only the Phase 0 plan body changed, all 14 work/acceptance boxes are checked, Phase 1 is untouched, prerequisites match baseline, the probe is removed and local environment values are excluded from final identities. `diff-check.log` records a passing tracked diff check. Cleanup and final diff/identity checks are also recorded in the dated Phase 0 plan note.

## Discrepancies, remaining work and handoff

- Repository Repomix placement rules win; all packets and generation logs are under supabase/repomix. No applicable instruction conflict affects Phase 0. Historical mobile build-policy conflicts are irrelevant to this scaffold and no mobile build occurred.
- Section 0's absent apps/admin/core finding is historical and superseded by this phase. Its absent apps/web finding also changed concurrently; this task claims no web acceptance.
- Plan step 0.6 calls for manual real credentials. Scaffold acceptance intentionally uses the prescribed safe missing-hash/synthetic mode; populating real values and confirming owner/backend identity remains AB-06 before privileged integration, not an unmet scaffold gate.
- Native Node 24 TypeScript execution plus react-server conditions provides the tested CLI entry without adding tsx now. Later scripts targeting another runtime must revalidate that contract. No browser-safe export bypass exists.
- AB-02/03/05/06/07 remain later backend/backup/owner gates. Existing mobile lint/test failures are out of scope. Phase 1 owns CSS projection and theme components; none were started here.
