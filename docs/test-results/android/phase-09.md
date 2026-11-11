# Android Phase 9 test record

Date: 2026-11-10 (Asia/Manila)

Scope: M2-09 text-send/base chat screen, M2-11 typing/read receipts, M2-12 Saved Messages, F3, F6, F7, AND-05, CMP-07, CMP-08, CMP-10, CMP-22, D-57, D-92, D-118, D-143.

## Baseline before editing

- `npm run typecheck`: passed (mobile and shared workspaces).
- `npm --workspace @dologram/shared run test`: passed, 125/125.
- `npm --workspace @dologram/mobile run lint`: pre-existing `app/sign-up.tsx` 2 errors and 1 warning.
- Full mobile Jest command was stopped after no output for approximately 60 seconds; this was the same runner stall recorded by Phase 8.

## Automated verification after editing

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass; both workspaces exit 0. |
| `npm --workspace @dologram/shared run test` | Pass; 16 files, 126/126 tests. The existing Vite config warning remains. |
| `npx --no-install jest src/components/__tests__/MessageText.test.tsx --runInBand --forceExit` from `apps/mobile` | Pass; 1 suite, 14/14 tests. Jest reports the existing Node `punycode` deprecation and force-exit open-handle notice. |
| `npm --workspace @dologram/mobile run lint` | No Phase 9 findings. Overall exit remains non-zero only for the existing `app/sign-up.tsx` 2 errors and 1 warning. |
| `npx expo export --platform android` | Pending environment verification; Metro started but made no further progress for 60 seconds and the command was stopped. No export result is claimed. |

## Source-verified acceptance checks

- Cached message history is read in sequence order with a 50-row initial page and older-page loading.
- Local queue items are merged after delivered rows and render queued/sending/failed states before server delivery.
- The composer trims and validates text, keeps the input available offline, shows the counter from 3,900 code points and refuses text beyond 4,096.
- A private `chat:<chat_id>` channel carries only the shared `typing` and `read` Broadcast events while the route is mounted.
- Typing is online-only, throttled to 3 seconds, and removed after 5 seconds without an event.
- Read updates are stored in `pending_read_states` while offline, flushed when connected, and accompanied by a shared read hint.
- Saved Messages is identified by the one-member direct key and uses the shared title.

## Optional, pending manual verification

The MuMu/ADB check could not start because `adb.exe` failed to start its daemon in this session. When the authorized test emulator is available:

1. Start the existing Phase 8 development client/Metro setup and open a direct fixture chat.
2. T-01: send text on a good connection; observe queued, sending and sent/seen states and measure the Android share of the delivery latency.
3. T-37: have the other fixture account read the message; verify Seen appears without manual refresh, and verify the forged/non-member read-hint cases through the hosted RLS setup.
4. T-51: type for 10 seconds in a direct chat and in the fixture group; verify the 3-second throttle, the 5-second expiry, and the one-name/multiple-typist wording.
5. Open Saved Messages, send a note offline, then reconnect and verify it is delivered once.

No later-phase work was started: message focus actions/reactions/edit/delete/forward remain Phase 10; attachment/media behavior remains Phases 11–12.
