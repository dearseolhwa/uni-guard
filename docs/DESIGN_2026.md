# UniGuard: the October 2026 design

Date: 28 October 2026 · Brings the look of the React app (`UNIGUARD-TRIAL--ui-responsive-pwa`) to this app.

Before-and-after screenshots are in `docs/design-2026/`.

## What changes for people

The app moves from one dark navy look to **light screens with a colour per role**, as in the React app:

| Who | Colour | Matches React |
|---|---|---|
| Sign-in and sign-up | pink-tinted page, red Sign In button | `UnifiedAuthPortal` |
| Residents | crimson on blush | `resident` |
| Barangay officials | navy blue | `barangay` |
| LDRRMO staff | charcoal on cool grey | `command` |
| Super Admin | gold | `admin` / `.ug-admin-ops` |
| Dispatch teams | warm orange | `DispatchPortal` |

Also from the React app:

- **Logo:** the **Triad Shield emblem** replaces the shield icon, recoloured for each role.
- **Font:** the **Plus Jakarta Sans** typeface.
- **Shapes:** large rounded cards, **pill-shaped buttons**, light input fields with a soft focus ring, and gradient primary buttons.
- **Desktop consoles** sit in a **rounded frame** on the role's colour. Phones stay edge to edge.
- **Phone status bar:** it takes the role's colour.

**What stays the same:**
- Every screen's layout, wording and behaviour. For example, the LDRRMO console keeps its left sidebar where the React app has a top bar. Matching layouts would mean rebuilding screens one by one.
- Map markers and legend colours, so a red marker means the same in both designs.

## Readability

Hazard, severity and status colours come from `js/theme.js`, the single source for the map, badges, legend and charts. The colours it uses for text were pale tints made for dark backgrounds, and they fade on white. For the light design they get darker shades of the same hues:

- **Badges** (Critical, High, Verified, Open…): every one is **5.07:1 or better** against its own tinted background, checked on white and on the resident, barangay and dispatch backgrounds. The accessibility minimum is 4.5:1.
- **Text in a warning or status colour** (stat tiles, chips, notices): **4.5:1 or better** on all six roles' backgrounds. The bright yellow had been about 1.5:1 on white.

## Switching back

The design is one file, `css/design.css`. In `index.html`, three marked lines load the font and that file. **Delete those three lines and the previous dark design returns unchanged.** This was tested by screenshot comparison against the original code: every screen matched pixel for pixel, apart from the "NaN" fix below.

The rest of the stylesheets and scripts were converted so each dark-only colour reads from a setting, with its original value as a fallback. For example, `rgba(255,255,255,.05)` became `rgba(var(--ug-tint, 255,255,255),.05)`. That conversion on its own was also checked: it is pixel-identical to the original on every tested screen.

## The font

Plus Jakarta Sans loads from Google Fonts, as in the React app. With no signal, phones use their own system font. Everything still works; only the letter shapes differ.

**To make it work offline too:**

1. Download Plus Jakarta Sans as `.woff2` (for example from Google Fonts or fontsource) and save it as `fonts/plusjakartasans-var.woff2`.
2. Add this to `css/fonts.css`:
   ```css
   @font-face {
     font-family: 'Plus Jakarta Sans';
     font-style: normal;
     font-weight: 400 800;
     font-display: swap;
     src: url('../fonts/plusjakartasans-var.woff2') format('woff2');
   }
   ```
3. In `index.html`, delete the two Google Fonts lines (`preconnect` and the `fonts.googleapis.com` stylesheet).
4. In `sw.js`, add `'./fonts/plusjakartasans-var.woff2',` to the list of saved files and raise `VERSION`.

## Fixed along the way

The light background showed up some problems the dark design hid:

- **Black lines between report rows** (resident home, report lists). The rows are buttons, and the browser drew its default bottom border, invisible on dark.
- **Unreadable selected alert level in the advisory composer.** The code set `background:undefined`, because the severity list it read has no tint field. It now takes the tint from `theme.js` and shows the level's own colour in both designs.
- **Pale green and red trend arrows** on stat tiles, and **two counter badges** with dark text on orange.

Two bugs that were already there:

- **"…overview for NaN."** on the dashboard subtitle. A doubled `+` in `js/screens.js` turned the city name into a number. It now reads "Lingayen, Pangasinan".
- **The new stylesheet is saved for offline use.** `sw.js` lists every file a phone keeps. `css/design.css` is on that list, and `VERSION` is now `uniguard-v20`, so installed phones pick up the new design.

## Files

- **New:**
  - `css/design.css`: the whole new look, scoped to `html[data-portal]`.
  - `docs/DESIGN_2026.md` (this file).
  - `docs/design-2026/`: screenshots.
- **Converted to switchable colours** (no visual change on their own):
  - `css/app.css`, `css/screens.css`, `css/screens-additions.css`, `css/dispatch.css`, `css/base.css`
  - `js/relief.js`, `js/screens.admin.js`, `js/screens.auth.js`, `js/screens.web.js`
- **Changed:**
  - `js/app.js`: sets `<html data-portal="…">` from the signed-in role, and the phone status-bar colour. It does this only when `css/design.css` is linked.
  - `js/theme.js`: darker text shades and tones for the light design, alongside the original values.
  - `js/screens.js`: the emblem, the alert-level fix and the "NaN" fix, plus the colour conversion.
  - `index.html`: the three design lines and the light status-bar colour.
  - `sw.js`: saves `css/design.css`; version v20.

## How it was tested

The app ran in Chromium in preview mode with sample data. I took screenshots of:

- sign-in
- resident home, report form and relief
- the barangay dashboard and evacuation centers
- the LDRRMO staff dashboard, reports and advisory composer
- the Super Admin dashboard
- the dispatch console and Equipment & Readiness, on desktop and phone

All screens showed no new errors. One map error on the resident report form also happens on the original code; it appears to come from the offline test setup. Every script passes a syntax check.

**Not covered:**
- I had no internet, so the screenshots use the fallback font, not Plus Jakarta Sans.
- Screens I didn't open may still have a hard-coded colour that reads poorly on white. The conversion caught every colour that only works on dark across all stylesheets and the main scripts, but please look through the app once. The likeliest spots are rarely used dialogs.

## What you need to do

1. **Deploy as usual.** No database changes.
2. **Look through each role once on a phone and a computer.** Report anything hard to read with a screenshot; most fixes are one line in `css/design.css`.
3. **Optional:** make the font work offline (above).
