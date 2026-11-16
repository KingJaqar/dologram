# DoloGram Admin

Run from the repository root:

```powershell
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run admin
```

Open [DoloGram Admin](http://127.0.0.1:3100/sign-in). Sign in with an existing DoloGram email/password. Only accounts currently authorized by `public.profiles.roles = 'admin'` enter. The authenticated shell provides the sidebar navigation and the eight admin routes: `/`, `/accounts`, `/accounts/new`, `/accounts/import`, `/accounts/[userId]`, `/maintenance`, `/audit` and `/settings-check`. Sign out is the header action. `/accounts` lists and filters accounts (ADM-03) and `/audit` shows the audit trail (ADM-07). The Overview body still shows the authenticated account UUID and configuration status. The single-account form enables creation/recovery only after its live migration-043 contract passes; the detail, settings and maintenance bodies belong to later phases.

`npm run admin` builds and starts Next on IPv4 loopback only. `npm run admin:dev` uses the same address. Stop with Ctrl+C. Only one process may use port 3100; preserve an existing service unless its owner authorizes replacement. Never deploy or expose this app to the network.

## Accounts list (ADM-03)

`/accounts` reads `auth.users` left-joined to `public.profiles` over `SUPABASE_DB_URL`. It selects only the identity fields of 12.9 (username, display name, email, created, last sign-in, status, premium) and never chats, messages or files. Search matches username or email partially and case-insensitively with escaped LIKE metacharacters, the chips map to Banned, Must change password and Active in that precedence order, and pages hold 50 rows ordered by `created_at desc, id desc`. A row opens `/accounts/<user_id>`. The Admin pill comes from the current database role; the Owner pill and any environment owner UUID are retired.

Account creation has a separate live `getCreationCapability()` probe for migration 043's clearing/mirroring triggers, restrictive RLS and guarded client RPCs. A missing, incomplete or unreachable contract keeps creation and recovery disabled. Password reset and ban retain the closed legacy capability; Phase 8 does not enable them. Account status reads current Auth metadata. No `initial_passwords` fallback is assumed.

## Single-account creation (ADM-04, Phase 8)

`/accounts/new` uses shared validation and a server-generated, session-bound password draft. Passwords remain in transient page state and are never accepted as creation input. Creation and recovery require the database's verified denial/clearing contract on each request. The CSV web workflow belongs to Phase 9.

When enabled, an uncertain response or partial initialization offers **Recover account creation**. It reconciles the original operation instead of creating another account or rotating the password. Recovery is bound to the original admin and local session, verifies a normal-user profile and Saved Messages, and retries the audit with the original event ID. If initialization is incomplete and the account remains denied, it invokes the existing profile/Saved Messages trigger using unchanged Auth user metadata. It preserves application roles. A list-refresh error preserves the successful result and asks for a list reload.

Provisioning entry points remain `npm run create-user -- --email <email> --username <username> --display-name "<name>"` and `npm run create-accounts -- --csv <path>` (also `scripts/create-accounts.ps1 -Csv <path>`). Password delivery requires an interactive terminal without redirection or transcription. Partial/unknown results show a nonsecret recovery operation ID and the original generated password once; keep it transiently and distribute it only after recovery confirms the account. Use `npm run create-user -- --recover <operation UUID>` to reconcile a script operation or retry its audit. Recovery returns no password and accepts redirected output. A page exit/process restart drops transient password state; no automatic retry, persistent password store or password rotation is added.

Migration 043 denies ordinary data access until the initial password changes and, for marked admin creations, profile/Saved Messages initialization and the creation audit are complete. Shared Edge authentication checks fresh Auth metadata plus a service-only database gate before service-role access. Reusing the initial password does not clear the flag. Hosted rollout requires a separate authorized release: compare migration history, deploy the updated shared Edge consumers, then apply the migration and verify the hosted matrix. Nothing is applied or deployed by preparing these files.

## Local configuration

Copy `.env.local.example` to ignored `.env.local` only if absent. Preserve the six settings: `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `BACKUP_DIR`. Values stay server-side. No public variables or browser Supabase client are used. Restart after configuration changes. Builds and the sign-in form need no backend connection; actual sign-in requires valid configuration and reachable Auth/SQL.

Sign in with a username or email and the account password. Usernames resolve to the Auth email on the server; both paths require the current database role to be `admin`. Hosted database connections trust the bundled Supabase Root 2021 CA and verify the server hostname. In `SUPABASE_DB_URL`, replace the entire `[YOUR-PASSWORD]` placeholder, including its brackets, with the URL-encoded database password. A valid configuration format alone does not confirm connectivity or credentials.

Hosted API must use HTTPS at the matching project reference. SQL accepts that project's direct connection or shared pooler. The driver uses certificate-verified TLS, `prepare: false`, two connections, bounded connect/queue/query/statement timeouts and idle cleanup. BACKUP_DIR must be absolute. Config status reveals names only, never values. Loopback backend tests require explicit `ConfigOptions.isolatedTarget` confirmation; listening locally does not enable this mode.

## Trusted promotion and demotion

Migration `041_add_profile_roles.sql` is already applied on the linked project. Do not reapply or edit it. A profile has exactly one `roles` value, default `user`. Admin permission extends the same normal account: UUID, password, profile fields, Saved Messages, chats, memos and normal mobile/user-web access remain intact. There is no separate admin signup or role-management UI.

Only a trusted database operator may change roles. Before touching a real account, obtain its intended UUID and explicit authorization; this implementation did not promote a real account. In trusted SQL, first locate the existing identity:

```sql
select p.user_id, p.username, p.email, u.email as auth_email, p.roles
from public.profiles p join auth.users u on u.id = p.user_id
where p.user_id = '<verified-existing-uuid>'::uuid;
```

After verifying exactly one intended row, promote only that row in a transaction:

```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
select user_id, roles from public.profiles
where user_id = '<verified-existing-uuid>'::uuid for update;
update public.profiles set roles = 'admin'
where user_id = '<verified-existing-uuid>'::uuid and roles = 'user'
returning user_id, roles;
-- Commit only after confirming the returned UUID and expected one-row change.
commit;
```

To revoke additional admin access, use the same verified transaction with `set roles = 'user'` and `and roles = 'admin'`. Subsequent privileged requests are denied, including live local sessions. Never change `auth.users.role`, credentials, metadata or memberships to grant admin. The invoker trigger rejects ordinary authenticated clients, including application admins, attempting role changes. A future Ban/Delete implementation must check current target roles and refuse every currently-admin target; no environment owner UUID exists.

## Session and security behavior

Auth sign-in uses a separate nonpersistent SDK client. The local cookie contains only 32 random bytes, HttpOnly, SameSite=Strict, browser-session lifetime and Path=/. Loopback HTTP intentionally uses Secure=false. Auth tokens never reach browser-readable state. Every privileged page, API and registered action verifies Auth identity and reads the current protected role, Auth session existence/deadline and account ban/deletion state. Actor identity is the verified account UUID. Proxy is supplementary; unknown actions fail closed.

Local sessions expire after eight idle hours **or earlier when their Auth access token expires**. This implementation deliberately retains no refresh token and performs no background refresh; sign in again at Auth expiry. Explicit document navigation and authorized actions extend idle activity; API polling, RSC and prefetch do not. State is bounded to 32 sessions. Sign-in allows five attempts per normalized email per fixed five-minute window, with four concurrent requests and 256 bounded limiter entries. There is no process-wide account lockout. A restart ends local sessions. The upgraded cookie/store identity rejects old anonymous sessions.

Sign out clears/revokes local state even during a backend outage. It does not sign the same account out of mobile/user-web or perform privileged business work. The unretained Auth token remains governed by its own expiry/revocation. Unavailable identity/role sources deny privileged work with a safe message. Exact Host `127.0.0.1:3100` and mutation Origin `http://127.0.0.1:3100` are required, including sign-in/sign-out; forwarded headers cannot override them. `/unlock` is a compatibility redirect to `/sign-in`.

## Versions and verification

Existing pinned tooling: Node 24.13.1 / npm 11.8.0; Next 16.4.6; React/DOM 19.2.3; TypeScript 6.0.3; Supabase JS 2.119.0; postgres 4.1.1; Zod 4.6.7; Vitest 5.1.0; Playwright 1.65.1. No new dependencies were added for account authorization. Obsolete bcrypt-only dependencies/helper were removed; existing tsx is retained for other repository callers.

```powershell
npm run lint --workspace apps/admin
npm run lint:css --workspace apps/admin
npm run typecheck --workspace apps/admin
npm run typecheck --workspace packages/admin-core
npm run test --workspace apps/admin
npm run test --workspace packages/admin-core
npm run build --workspace apps/admin
```

The server-only core exports only its root and `/env`; unmarked client/Node imports fail. Shared tokens, local licensed Inter/JetBrains Mono fonts and existing accessible components support both system themes, with no theme selector. Run `npm run tokens` after changing shared token sources.

The browser suite (`tests/e2e/access.spec.ts` for account access, `tests/e2e/navigation.spec.ts` for the shell, `tests/e2e/audit.spec.ts` for ADM-07 and `tests/e2e/accounts.spec.ts` for ADM-03) uses disposable PostgreSQL 17.6, GoTrue 2.197.0 and PostgREST 14.5 fixtures. Test harness code stays outside application routes. It uses ports 3120–3123 for its backend, 3114/3115 for transport/production runtime, and retains the exact logical Host/Origin at port 3100 without touching the owner's service. No existing-server reuse, traces, screenshots, video or credential payload logs are enabled. Setup and actual verification results are recorded in `Plans/context/DoloGram_Admin_Web_Phase_04_Context_Index.md` and `supabase/repomix/admin-phase-04-account-20261115/`; tests never use hosted credentials.

After the production build, run from the repository root with Docker Desktop and desktop Chrome available:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/admin/tests/harness/run.ps1
```

The runner refuses occupied test names/ports, initializes only its own backend, runs the browser suite once, and removes its labelled containers/network in `finally`. Its SQL fixture projects the actual profile/Auth migrations with minimal chat dependencies; the existing standalone role-permission suite is recorded separately. A test failure must be diagnosed before another run.

References: bundled Next 16.4.6 documentation under `node_modules/next/dist/docs`; [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [verified getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Auth sessions/revocation](https://supabase.com/docs/guides/auth/sessions). SDK behavior is additionally checked against the installed release source.
