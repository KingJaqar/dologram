# Phase 3 — Base components, navigation shell and Markdown spike
**Date:** 2026-11-09  
**Device:** emulator-5560 (SM-S908B / Samsung Galaxy S22, Android 12)  
**Metro port:** 8200 (via `adb -s emulator-5560 reverse tcp:8200 tcp:8200`)  
**Bundle:** 3595 modules, loaded in 12369ms (initial), 4600ms (incremental)

---

## Steps completed

| Step | Description | Status |
|------|-------------|--------|
| 1 | Route files — 16 routes as per 12.6 Android map | ✅ |
| 2 | Base components — Button, IconButton, TextField, SearchField, SwitchRow, Avatar, Badge, BottomSheet, Dialog, Toast/ToastProvider, Skeleton, EmptyState, ErrorState, TopBar, DateSeparator, UnreadDivider, JumpToBottom, TabBar | ✅ |
| 3 | Android back button rules — BackHandler in tabs layout | ✅ |
| 4 | `MessageText.tsx` — react-native-markdown-display with XSS protection | ✅ |
| 5 | `app/dev/markdown.tsx` — spike route | ✅ |
| 6 | Jest setup + render tests (MessageText + a11yLabels) | ✅ |

---

## Checks run

| Check | Command | Result |
|-------|---------|--------|
| Mobile tests | `npm --workspace @dologram/mobile run test` | ✅ 19/19 pass |
| Typecheck | `npm run typecheck --workspaces --if-present` | ✅ Exit 0 |
| Lint | `npm --workspace @dologram/mobile run lint` | ✅ Exit 0 |
| Shared tests | `npm --workspace @dologram/shared run test` | ✅ 66/66 pass |

---

## Device verification

### Chat list with tab bar
- App loaded: `shared: true`, `netinfo: wifi`, `maxChars: 4096`, `env: present`
- Tab bar visible: Chats (message-circle, teal active), New (+, center), Profile (Avatar "M")
- Tab bar hidden on pushed screens (chat, new-chat, etc.) ✅
- Screenshots: `phase3_screen.png`, `phase3_tabbar.png`

### Settings via Profile tab
- Tapped Profile/Settings avatar (bottom-right, x=810, y=1820)
- Settings screen shows "Settings" TopBar, "Settings — Phase 15" placeholder ✅
- Profile tab shows teal ring indicating active state ✅
- Screenshot: `phase3_settings.png`

### Back button: Settings → Chats
- Pressed KEYCODE_BACK from Settings
- Returned to Chats tab (DoloGram wordmark, no Settings screen) ✅
- Screenshot: `phase3_back_from_settings.png`

### New sheet
- Tapped "+" tab (bottom-center, x=410, y=1820)
- Scrim overlay applied (background dimmed) ✅
- Sheet slides up from bottom with rounded top corners ✅
- "New chat" row with User icon ✅
- "New group" row with Users icon ✅
- New tab does NOT become active tab ✅
- Pressed KEYCODE_BACK → sheet closes, returns to Chats ✅
- Screenshots: `phase3_newsheet_fixed.png`, `phase3_sheet_closed.png`

### Markdown spike — XSS and format tests
Navigated to `dologram://dev/markdown`:

| Input | Expected | Actual | Status |
|-------|----------|--------|--------|
| `<script>alert(1)</script>` | Literal text | `<script>alert(1)</script>` | ✅ |
| `<b>x</b>` | Literal text | `<b>x</b>` | ✅ |
| `**unclosed` | No crash, literal | `**unclosed` | ✅ |
| `[a](b` | No crash, literal | `[a](b` | ✅ |
| `# Heading` | Plain text "Heading" | `Heading` | ✅ |
| `![alt text](https://example.com/x.png)` | Alt text only, no image | `alt text` | ✅ |
| Table (Col A, Col B, 1, 2) | Plain text | `Col ACol B12` | ✅ |
| `**bold** and _italic_` | Bold + italic rendered | Bold + italic correct | ✅ |
| `` `console.log()` `` | Inline code with mono font | Mono with bg highlight | ✅ |
| Fenced code block | JetBrains Mono block | Correct mono block | ✅ |

Screenshots: `phase3_markdown.png`, `phase3_markdown2.png`, `phase3_markdown3.png`  
**Library used:** `react-native-markdown-display` (A-08 holds, no fallback needed)  
**No errors thrown**, no images loaded ✅

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Tab bar shows Chats, New and Profile on chat list and Settings; hidden on pushed placeholder screens (D-142) | ✅ Met |
| New opens a sheet with "New chat" and "New group" and never becomes the active tab (CMP-32) | ✅ Met |
| Android back button closes open sheet first; returns from Settings to Chats (11.2) | ✅ Met |
| Every step 5 input renders literally, no image loads and no error thrown (M2-06, D-99; Android half of T-12) | ✅ Met |
| `npm --workspace @dologram/mobile run test` passes (D-155) | ✅ Met — 19/19 |
| Spike result recorded (M2-06) | ✅ Met — this document |
| T-12 (Android part), T-40 (label check part) | ✅ Met |

---

## Bugs fixed during phase

1. **`nav.folder` icon missing** — `Folder` Lucide component was not imported in `Icon.tsx`. Added import and registry entry. Fixed during Phase 2 token preview verification (2026-11-09).
2. **BottomSheet inner Pressable `flex: 1`** — removed `style={{ flex: 1 }}` from the content wrapper Pressable and updated to use `stopPropagation` pattern instead. Fixed during New sheet testing (2026-11-09).

---

## Deviations and notes

- CMP-23 is N/A on Android per 12.10 (confirmed, no web-only component needed).
- The Linking URI scheme warning is pre-existing from Phase 0, not an app error.
- Metro operated on port 8200 (not 8082) due to port occupation by other processes. ADB reverse tunnel was set per-session: `adb -s emulator-5560 reverse tcp:8200 tcp:8200`.
- Device serial changed from `127.0.0.1:7555` to `emulator-5560` during the session (ADB WiFi reconnect); same physical device (SM-S908B, Android 12).

---

## Exit gate

`npm --workspace @dologram/mobile run test` exits with code 0 ✅  
Device shows tab shell and Markdown spike screen ✅  
New sheet opens with "New chat" and "New group" ✅  
Android back closes sheet and returns to Chats ✅

---

## Phase status: **Complete**

All acceptance criteria met. No blockers. Phase 4 is ready to start (depends on Phase 3 ✅ and all Section 3.1 backend prerequisites).
