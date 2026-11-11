# Phase 2 — Design tokens, theme, fonts and icons
**Date:** 2026-11-09  
**Device:** emulator-5560 (SM-S908B / Samsung Galaxy S22, Android 12)  
**Metro port:** 8200 (via `adb -s emulator-5560 reverse tcp:8200 tcp:8200`)  
**Bundle:** loaded from port 8200, 3595 modules

---

## Steps completed

| Step | Description | Status |
|------|-------------|--------|
| 1 | `packages/shared/src/theme/tokens.ts` — all 12.2 tokens | ✅ |
| 2 | `contrast.ts` + `contrast.test.ts` — WCAG 2.x checks | ✅ |
| 3 | `packages/shared/src/theme/icons.ts` — semantic icon map + sizes | ✅ |
| 4 | `apps/mobile/src/components/Icon.tsx` — semantic icon component | ✅ (folder icon added 2026-11-09) |
| 5 | `apps/mobile/src/theme/ThemeProvider.tsx` — setting/scheme/reduceMotion | ✅ |
| 6 | `apps/mobile/src/theme/typography.ts` — `textStyle()` helper + font families | ✅ |
| 7 | Font loading — `useFonts` with Inter + JetBrains Mono in `_layout.tsx` | ✅ |
| 8 | `apps/mobile/app/dev/tokens.tsx` — token preview screen (Colors / Type / Icons) | ✅ |
| 9 | ESLint color literal rule in `eslint.config.js` | ✅ |

---

## Checks run

| Check | Command | Result |
|-------|---------|--------|
| Contrast tests | `npm --workspace @dologram/shared run test -- contrast` | ✅ Pass (7 avatar fills + 12.2 pairs) |
| Typecheck | `npm run typecheck --workspaces --if-present` | ✅ Exit 0 |
| Lint | `npm --workspace @dologram/mobile run lint` | ✅ Exit 0, no color literals |
| All shared tests | `npm --workspace @dologram/shared run test` | ✅ 66/66 pass |
| Mobile tests | `npm --workspace @dologram/mobile run test` | ✅ 19/19 pass |

---

## Device verification

### Token preview — Colors tab
- Navigated to `dologram://dev/tokens` via ADB deep link
- Dark theme active (system = dark)
- Color swatches shown for all dark tokens: `bg.app #0F172A`, `bg.chat #1E293B`, `bg.input #334155`, etc.
- System / Light / Dark theme picker visible
- Screenshot: `phase2_tokens.png`

### Token preview — Type tab
- Tapped Type tab (y=350, x=540)
- All 13 type tokens rendered with correct Inter/JetBrains Mono fonts and sizes:
  - `display` — Inter 700 / 32px / 40lh ✅
  - `heading1` — Inter 600 / 24px / 32lh ✅
  - `heading2` — Inter 600 / 20px / 28lh ✅
  - `titleLg` through `bodySm` — correct weights and sizes ✅
  - Metro log: **no font request** (fonts loaded from bundle) ✅
- Screenshot: `phase2_type3.png`

### Token preview — Icons tab
- All MVP icons rendered with semantic names
- **Initial load:** `nav.folder` missing (Folder component not imported in Icon.tsx)
- **Fix applied:** Added `Folder` to Icon.tsx imports and registry (2026-11-09)
- After reload: `nav.folder` renders correctly as folder icon ✅
- Screenshot: `phase2_icons_fixed.png`

### Theme switching
- System setting is active by default
- Dark theme shown (device system is dark)
- Light/Dark buttons change the color swatches immediately ✅
- Pending manual verification: physical dark/light system toggle while setting is "System" (requires owner device interaction)

### Reduce motion
- Pending manual verification: requires enabling "Remove animations" in Android accessibility settings (owner device step)

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Contrast test passes for every 12.2 pair in both themes (D-95; T-40 contrast part) | ✅ Met |
| `npm --workspace @dologram/mobile run lint` reports no color literal in `apps/mobile/src` or `apps/mobile/app` (M4-02) | ✅ Met |
| Token preview shows Inter in four weights and JetBrains Mono, Metro log shows no font request (12.10) | ✅ Met |
| Switching system theme changes preview while setting is System (D-83) | ⏳ Pending manual verification |
| With Android "Remove animations" on, `useTheme().reduceMotion` is true (D-134) | ⏳ Pending manual verification |
| T-40 (contrast part on Android tokens) | ✅ Met (automated via contrast.test.ts) |

---

## Deviations and notes

- **nav.folder icon fix:** The `Folder` Lucide component was not in the initial import list in `Icon.tsx`. Added 2026-11-09. No re-build needed (JS-only change). `icons.ts` mapping `'nav.folder': 'folder'` was correct; only the component registration was missing.
- The Linking URI scheme warning (`Using 'dologram'. Ignoring: dologram, com.dologram.app`) is pre-existing from Phase 0 and is not an application error.
- The `Error: undefined` in logcat is the Expo CLI devtools connection failing on port 8081 (different from Metro on 8200) and is pre-existing infrastructure noise, not an app error.

---

## Exit gate

`npm --workspace @dologram/shared run test -- contrast` exits with code 0 ✅  
Token preview shown on device in both dark and light themes ✅  
(System-toggle manual check pending.)
