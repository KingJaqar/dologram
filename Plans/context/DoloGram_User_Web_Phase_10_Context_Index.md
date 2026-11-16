# DoloGram user web — Phase 10 context index (2026-11-16, Asia/Manila)

Scope: Phase 10 only (W-P10-S01–S09, G-W10). Phase 11 was not started. Status here is execution evidence for this phase; the plan remains the authority.

## Checklist

- Scope: chat list and archive view (WEB-04, WEB-05) on the existing shell.
- Prerequisites verified in code: Phase 5 store/query, Phase 6 queue statuses, Phase 7 sync catch-up, Phase 8 shell/breakpoint/document title, Phase 9 TopBar/Menu/feedback/state components.
- Context inputs: shared chatList/queue/read-status contracts, web store/sync/queue adapters, shell components, shared strings, generated theme tokens.
- Baseline: web typecheck/lint/tests exit 0 (127/127) before edits; HEAD `d906bff38ea932c1cab6410b13c6d102e9069067`.
- Acceptance gates: web typecheck/lint/unit, Phase 10 Chromium spec, Phase 4–9 regression, production build, bundle scan, shared tests, mobile typecheck.

## Git baseline and ownership

- `supabase/repomix/user-web-phase-10-20261116/baseline/` holds `status.txt`, `diffstat.txt`, `head.txt` captured before any edit.
- Pre-existing user work (mobile, shared, `apps/admin`, backend migrations, plans, other evidence) was preserved untouched. `apps/web` is untracked as a tree, so its paths report `??`.
- Owned diff: only the files listed in `final-identities.txt` plus this index, the phase report and the plan's Phase 10/status text.

## Discovery and packet

- `code_search`/ripgrep located the list contracts and consumers; earlier phase reports were treated as dated evidence, not proof, and each prerequisite was re-verified in source.
- Packet `context.xml` (Repomix from the root with `repomix.config.json`): 30 entries, all intended, security scan clean, no env/credential input. Identity: `packet.sha256`; entry list: `packet-files.txt`; source hashes: `final-identities.txt`; log: `generation.log`.
- Original sources were read for every consumed contract, including installed `postgrest-js` `.maybeSingle()` behaviour and the app's embedded `dg-supabase-url` meta.

## Verified findings

| Finding | Source | Consequence |
|---|---|---|
| `buildChatList` derives order from `lastMessage.created_at` or `chats.created_at` and returns `'sent' | 'seen' | null` for own status | `packages/shared/src/chatList/{build,types}.ts` | Pending enqueue time and LS-2 status are applied by a web adapter; shared contract untouched. |
| Preview and time helpers already implement AND-03/D-109 wording | `chatList/preview.ts`, `chatList/format.ts` | Reused unchanged; no duplicate formatter. |
| Cache tables hold chats, members, messages, media, profiles, folders, folder_chats and queue per owner | `apps/web/src/lib/store/IndexedDbStore.ts` | One read assembles the list rows; unread is a single pass. |
| Reconnect/foreground triggers `resyncAll` and the delivery merges rows | `apps/web/src/lib/sync/host.ts`, `packages/shared/src/sync/engine.ts` | Browser spec proves a peer row reorders the list without a reload within 2 s. |
| `ChatMemberRow.joined_at` monotonic merge and `sync_state` cursors bound catch-up | same | No cursor change was needed for this phase. |
| Strings lack "Former member" and a staged leave reason | `packages/shared/src/strings/index.ts` | Two additive keys added. |
| `.maybeSingle()` sends no `vnd.pgrst.object` header | installed `postgrest-js` | Fixture returns arrays unless the single-object header is present. |
| A second `next dev` cannot start while the user-owned server holds the project dev lock | dev-server output; port 3000 listener PID 11820 | Gate ran on a task-owned production artifact with the isolated public target on port 3110. |

## Reads and reuse

- Fully read: shared chatList module (build/types/preview/format), queue types, read status, chats/members/profiles/media/reactions repositories, sync engine and Supabase delivery/source, theme tokens/icons, strings sections, web store/query/provider, sync host/metadata/source, worker lease, shell layout/panes/title, TopBar/Menu/Avatar/Badge/Skeleton/Toast/ErrorState/EmptyState/IconButton, session controller and route guard.
- Reused without re-derivation: Phase 8 shell findings (breakpoints, dialog history), Phase 9 component behaviour, Phase 7 sync semantics.

## Verification

- Web typecheck, lint and 132/132 unit tests pass; Phase 10 spec 2/2; Phase 8 7/7; Phase 4–9 37 pass/1 skipped/0 fail; production build passes and prerenders `/` and `/archive`; bundle scan passes over 380 files; shared 303/303; mobile typecheck passes.
- Pre-existing failure recorded separately: shared typecheck reports `Cannot find name 'AbortSignal'` in the user-modified `packages/shared/src/db/repositories/messages.ts`.
- Optional isolated/manual observations (D-W26) were not elected and are not claimed.

## Unresolved

- None for Phase 10's required scope. `PF-W2`/`PF-W5`/`PF-W16` (live Realtime privacy, backend limits/enforcement) remain unrelated target evidence; the list works on the cached, RLS-scoped data either way.

## Cleanup

Task-owned server on port 3110 stopped; the user-owned dev server was not touched. No remote mutation, commit, push or deployment.
