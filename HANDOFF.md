# Session handoff — Lista de la compra desktop layout

Date of this note: 2026-10-08.
Repo: `https://github.com/Criscode2022/listacompra`
Branch: `main`, tracking `origin/main`.
Last product commit when this file was written: `b15822d` (`Desktop: match the add button and inset settings`).
Working tree was clean before this file. There is no uncommitted product work left from the session.

This is a continuation note, not product documentation. Delete it when the next session no longer needs it.

## How to resume

1. Clone or pull `main`. Both session commits are already on `origin/main`.
2. `npm install` if `node_modules` is missing. The lockfile is committed.
3. Serve on a port that is not 4200. On the machine where this session ran, port 4200 belonged to a different app (`clothes-eshop`). This app was served with:

   ```bash
   npx ng serve --port 4210 --host 127.0.0.1
   ```

4. Open `/lista`, `/despensa`, and `/urgente` at two widths:
   - Desktop shell: viewport at least 1200px wide (checked at 1440×900).
   - Phone: about 390×844. Below 1200px the phone chrome stays (tab bar, settings FAB, add FAB).
5. Read the traps in [Do not redo these mistakes](#do-not-redo-these-mistakes) before editing layout CSS. Several “obvious” margin fixes are wrong for this Ionic version.

There is no browser MCP in this environment. UI checks were done with headless Chrome and the DevTools protocol against the dev server. `window.ng.getComponent` works on `ng serve` and can seed products into that Chrome profile only. It does not write the user’s real SQLite database.

Offline mode loads the shopping app. `OnlineAuthGuard` (`src/app/core/guards/online-auth.guard.ts`) returns true when cloud mode is off. Auth is required only when cloud mode is already on and there is no Neon session.

## Git

| Commit | Subject | What it contains |
| --- | --- | --- |
| `2c06d5c` | Redesign desktop layout with sidebar and shopping rail (#1) | Desktop shell landed. Sidebar, rail, page hero. Mobile and tablet chrome unchanged below 1200px. |
| `9c6b427` | Desktop: empty state centrado con CTA y toggle de modo nube | Empty card centered in the canvas, with icon and add CTA. Sidebar cloud toggle above Configuración. |
| `e91b7df` | Desktop: fit the main pane and drop the extra add button | Rail hidden on Urgente. Pane sized with `left` + `width`. Rail corner artifact fixed. Duplicate add buttons removed. Empty desktop pane no longer scrolls. |
| `b15822d` | Desktop: match the add button and inset settings | Header add button matches the empty-card pill (white icon, smaller shadow). Export outline removed. Settings dialog has bottom room on desktop and the phone sheet can scroll its last section into view. |

`git push origin` over HTTPS failed here with `fatal: unable to get password from user`. `gh` is logged in as `Criscode2022` and its git protocol is SSH. The push that worked was:

```bash
git push git@github.com:Criscode2022/listacompra.git HEAD:main
git fetch git@github.com:Criscode2022/listacompra.git main:refs/remotes/origin/main
```

The second command refreshes the local `origin/main` ref, because pushing to the SSH URL directly does not move the HTTPS remote-tracking branch by itself.

## What the user asked, in order

All of these are done and pushed. Do not reopen them unless a regression shows up.

1. On desktop, Urgente must not show the right “Por comprar” rail. The left nav stays. Despensa still shows the rail. Lista already hid it. Phone layout unchanged.
2. The center empty card was not horizontally centered, and the rail showed a square background in its rounded corners. Both fixed.
3. An extra “Añadir producto / Añadir urgente” button appeared, and the empty desktop pane scrolled. Remove the extra button and the empty scrollbar. A long product list must still scroll. The empty-card pill stays. The phone FAB stays.
4. Commit the layout work first (`e91b7df`), then make the desktop top-right add button match the empty-card pill, and remove the border of the export button.
5. The plus icon on that add button was blue. It must be white, like the empty-card pill.
6. Those button shadows were too big. Make them a bit smaller. Blue and red variants stay matched.
7. Add bottom room to the configuration dialog so it is fully usable on a phone and looks better on desktop.
8. Commit and push all (`b15822d` plus the already local `e91b7df`).

## Behavior that must stay true

Desktop means `min-width: 1200px`. The constant is `DESKTOP_LAYOUT_MIN` in `src/app/core/utils/breakpoints.ts`. `matchesDesktopLayout()` drives `isDesktopLayout` on `TabsPage`. Do not invent a second breakpoint for the shell.

Routes, from `src/app/tabs/tabs-routing.module.ts`:

- `/despensa` pantry
- `/lista` shopping list (default)
- `/urgente` urgent board

Rail visibility is `showListRail` in `src/app/tabs/tabs.page.ts`:

```ts
protected showListRail = computed(() => {
  if (!this.isDesktopLayout()) return false;
  const url = this.currentUrl();
  return !url.includes('/lista') && !url.includes('/urgente');
});
```

So the rail shows only on Despensa at desktop width. Host class `has-rail` is bound to the same computed. The rail title is “Por comprar”. Its products are unchecked and not urgent (`railProducts`). Clicking a rail row calls `dataService.toggleStatus(product.name)`.

Add buttons, after the cleanup:

- Desktop header has one primary CTA: “Añadir producto” on Despensa and Lista, “Añadir urgente” on Urgente (`primaryLabel` on `app-header`, class `desktop-cta-btn`).
- The empty-state card keeps its own pill (`.empty-cta`). That is not a duplicate. It is the center-card action.
- Phone uses the FAB. Desktop hides `ion-fab` and `.settings-fab` at ≥1200px.
- Despensa and Urgente do not have a second desktop add button in the search row. `.desktop-command-bar` was removed and must not come back.
- Lista still has two export controls when products exist: the header “Exportar PDF” (`desktop-export-btn`) and the filter-bar “Exportar PDF” (`desktop-inline-cta`, `fill="outline"`). Both have no border. “Borrar todos” keeps its danger outline.

Settings:

- Desktop (`.sidebar-settings`): modal class `settings-dialog glass-sheet`. No breakpoints. Centered dialog.
- Phone (`.settings-fab`): modal class `settings-sheet glass-sheet`, breakpoints `[0, 0.5, 0.85]`, `initialBreakpoint: 0.5`, handle cycles. See `openSettings` in `tabs.page.ts`.
- Dismiss role `auth` navigates to `/auth`.

Phone chrome below 1200px was not part of this work. Do not restyle the tab bar, the phone header, or the FABs while fixing desktop.

## Desktop shell geometry

All of this lives in the `@media (min-width: 1200px)` block of `src/app/tabs/tabs.page.scss`.

- Page background is `#ececf1` plus two faint radial glows.
- Sidebar: `position: fixed`, width 260px, left 0, top 0, bottom 0, padding `28px 18px 20px`.
- Main pane (`ion-tabs`): `top: 16px`, `left: 276px` (260 + 16 gap), `width: calc(100% - 276px - 16px)`, `height: calc(100% - 32px)`, radius 22px, background `#f7f7fa`, `overflow: hidden`.
- With rail (`:host.has-rail ion-tabs`): `width: calc(100% - 276px - 372px)`. 372 = rail 340 + 16 gap + 16 outer inset.
- Rail: `position: fixed`, `top/right/bottom: 16px`, width 340px, radius 22px, background `rgba(255, 255, 255, 0.78)`, plus `overflow: hidden`, `isolation: isolate`, `background-clip: padding-box`.

Measured at 1440×900 after the pane fix:

- No rail (Lista, Urgente): pane x=276, width=1148, right=1424. Visible column center is 850. The empty card center matches that.
- With rail (Despensa): pane width=792, right=1068, center=672. Rail x=1084, so the gap between pane and rail is 16px.
- Phone 390px: tabs are full width, card center is 195, rail is absent, tab bar is flex.

`app-tabs` is an `ion-page` (`position: absolute`). Ionic’s `ion-tabs` host is also `position: absolute; top/right/bottom/left: 0; width: 100%; height: 100%` and `contain: layout size style`. Because of `contain: size`, width and height must stay explicit. `width: auto` collapses the pane. Margins do not shrink it: a 1440px-wide pane that starts at x=276 used to end at x=1716, off a 1440px viewport. The empty card then centered on the oversized box (center x≈996) and overlapped the rail. The rectangular pane also painted `#f7f7fa` through the rail’s rounded corners.

The fix is `left` + an explicit `width`, not margin. The comment above `:host ion-tabs` in `tabs.page.scss` records that. Keep it.

Rail corners: after the width fix, `overflow: hidden`, `isolation: isolate`, and `background-clip: padding-box` keep the pane from showing inside the curve. A pixel sample showed page gray outside the 22px curve and the rail’s own fill inside it. Do not “fix” the corners by making the rail more opaque. An experiment at `rgba(255,255,255,0.92)` was reverted. The fill stays `0.78`.

Sidebar active-link shadows are `0 8px 20px` at 0.08 opacity (blue, and red for Urgente). Those are not the buttons the user called too big. Leave them.

## Empty pane scroll

The empty scrollbar showed up only after the pane was the correct width. Before that, the scrollbar lived off-screen on the 1440px-wide box.

Causes:

- `.empty-state :host` used `min-height: calc(100dvh - 168px)`, which is taller than the area under the ~108px desktop header.
- A duplicate command bar also added height.

Fix, still in place:

- Desktop empty state (`empty-state.component.scss`, ≥1200): `flex: 1 1 auto; min-height: 0; padding: 1.5rem`. The mobile min-height `min(28rem, calc(100dvh - 240px))` and the bottom padding for the tab bar stay on the base `:host` rule.
- `src/global.scss` inside the 1200px block: `ion-content.is-empty { --overflow: hidden; }`. Ionic’s inner scroll uses `--overflow` (default `auto`). This only applies while the content has the `is-empty` class.
- Each tab binds that class: pantry `!pantryProducts().length`, list `!pendingProducts().length`, urgent `!urgentProducts().length`.

Checked: empty desktop content scroll and document scroll were 0, overflow hidden. Three products: content scroll 0, overflow auto, one visible “Añadir producto”. Twenty-four products: content scroll about 243, overflow auto, still one add button. Mobile empty: header CTA hidden, empty card + settings FAB + add FAB + tab bar, no document scroll.

## Add button style contract

The desktop header CTA must match `.empty-cta` in `empty-state.component.scss`.

Shared look:

- Pill, `border-radius: 9999px`
- Background `#007aff`, or `#ff3b30` when the header has `color="danger"` (Urgente)
- Text `#fff`, size `0.92rem`, weight `650`, letter-spacing `-0.015em`, not uppercase
- Padding 10px 16px, icon 18px, white
- Shadow `0 4px 10px rgba(0, 122, 255, 0.22)`, or the same with `rgba(255, 59, 48, 0.22)`

Measured match at 1440×900 after the radius fix: Lista CTA and pill both radius 9999px, background `rgb(0, 122, 255)`, shadow `rgba(0, 122, 255, 0.22) 0px 4px 10px 0px`, 168×42, `text-transform: none`. Urgente both `rgb(255, 59, 48)`, 159×42, danger shadow. SVG stroke of the plus was `rgb(255, 255, 255)` on both pages.

Why the rules look defensive:

- Material `ion-button` defaults (`button.md.css`): radius 4px, padding 8px / 1.1em, min-height 36px, font-size 0.875rem, weight 500, letter-spacing 0.06em, `text-transform: uppercase`. Solid buttons take their fill from `--ion-color-base` (primary `#007aff` in `src/theme/_liquid-glass.scss`, danger `#ff3b30` in `variables.scss`).
- `ion-buttons` (`buttons.md.css`) forces toolbar shape through shadow `::slotted(*) ion-button:not(.button-round) { --border-radius: 2px }` and tight padding, `min-height: 32px`, `--box-shadow: none`. Light-DOM padding, shadow, and font won. `--border-radius` did not, until `.desktop-actions .desktop-cta-btn { --border-radius: 9999px !important; }`. Computed `--border-radius` was 2px before that. The `!important` and the `.desktop-actions` ancestor are required. A bare `.desktop-cta-btn` rule is not enough.
- `src/global.scss` paints `app-header ion-toolbar ion-icon[slot='start']` with `color: var(--apple-blue, #007aff)` and `opacity: 0.95`. That made the plus blue. `.empty-cta` is `color: #fff`, so its plus is white. The header override is `.desktop-actions .desktop-cta-btn ion-icon { color: #fff; opacity: 1; }`. Specificity (0, 3, 1) beats the global rule (0, 1, 3).

Shadow history: both the header CTA and `.empty-cta` were `0 8px 18px` at 0.28. The user asked for a bit smaller. They are now `0 4px 10px` at 0.22, blue and red. Do not shrink only one of them.

## Export button

The user asked only to remove the border.

- Header export: class `desktop-ghost-btn desktop-export-btn` in `header.component.html`. `.desktop-export-btn` sets `--border-width: 0`, `--border-style: none`, `--box-shadow: none`. It is still `fill="outline"`. It can stay uppercase with the toolbar’s 2px radius. That was not requested.
- Lista filter-bar export: `_text-filter.scss` `.desktop-inline-cta[fill='outline']` clears border width, style, and shadow. This selector is outline-only, so a future solid inline CTA would keep its fill.
- “Borrar todos” is `desktop-ghost-btn` with `fill="outline"` and `color="danger"`. It keeps the 1px outline. Do not fold it into `.desktop-export-btn`.

## Settings dialog

`openSettings` picks the class from `isDesktopLayout()`.

Desktop, `ion-modal.settings-dialog` in `src/global.scss`:

- `--width: min(480px, calc(100vw - 48px))`
- `--height: min(720px, calc(100dvh - 88px))` (was `min(760px, 86vh)`)
- `::part(content)` margin `24px auto 36px` (was `auto`)
- Radius 20px, glass background, blur

Measured at 1440×900: content top 83, height 722, bottom gap 95px, last section about 29px inside the content edge, scroll overflow about 141px. At 1280×700: wrap top 37, bottom 651, gap 49px, last section still inside the dialog after scrolling to the end.

Phone sheet is the part that is easy to break.

Ionic positions a sheet with `transform: translateY(...)` on `.modal-wrapper` (`::part(content)`). The wrapper height stays almost the full screen (`--height: calc(100% - (var(--ion-safe-area-top) + 10px))` in `modal.md.css`), anchored with `bottom: 0`. At breakpoint 0.85 the visible sheet is the top 85%. The bottom 15% of the scrollport hangs below the viewport. `ion-content` scrolls inside that box, so the last rows scroll into the off-screen slice and cannot be seen. Max scroll on an 844px phone was only ~27px before the padding fix, and the Información card still ended ~80px below the screen.

Setting `bottom: 16px` on `::part(content)` does not create a gap. It shifts the layout box, then `translateY` pushes the sheet even further past the screen. Measured on 390×844 with that rule (reverted, do not restore it):

- Breakpoint 0.5: `bottom: 16px`, `top: -8px`, height 834px, `translateY(418px)`, rect top 410, rect bottom 1246. The sheet hung ~400px past an 844px screen.
- Breakpoint 0.85: `translateY(125.4px)`, rect top 117, rect bottom 953.

The fix that works with the gesture:

```scss
ion-modal.settings-sheet ion-content.settings-content {
  --padding-bottom: calc(
    0.15 * (100dvh - var(--ion-safe-area-top, 0px) - 10px) +
      max(28px, env(safe-area-inset-bottom, 0px))
  );
}
```

`0.15` is `1 - 0.85`. The 0.85 is the max breakpoint in `openSettings`. The extra `max(28px, safe-area-inset-bottom)` is the visible gap under the last card, and it clears the home indicator when the inset is non-zero. Most of the padding sits in the off-screen slice, so the open sheet does not show a huge empty well. You see it when you scroll to the end.

The selector needs both `ion-modal.settings-sheet` and `ion-content.settings-content`. Angular’s emulated attribute on `.settings-content` beat a shorter global rule, and the sheet kept the component’s 28px padding. Specificity (0, 2, 2) wins.

`.settings-content` in `settings.component.scss` still sets `--padding-bottom: max(28px, env(safe-area-inset-bottom, 0px))`. That is what the desktop dialog uses. The sheet rule overrides it. Do not put the 15dvh padding on `.settings-content` itself, or the desktop dialog grows a large empty tail.

Measured after the fix, phone 390×844, breakpoint 0.85, scrolled to the end:

- Padding computed to `153.1px` with no safe area (`0.15 * (844 - 10) + 28`).
- Last section top 653, bottom 817, viewport 844. About 27px of sheet background under the card. `fullyIn` was true.
- “Productos guardados” row bottom 811. `elementFromPoint` on its center hit the row. The Apariencia toggle was on screen and toggled.
- Header “Configuración” stayed on screen (top ~151).
- `css bottom` of the wrapper was `0px`. Radius 18px on the top corners only, 0 on the bottom. That is correct for a docked sheet.

If you change the breakpoints, change `0.15` in the same edit. A comment in `global.scss` points at `openSettings`.

## Do not redo these mistakes

- Do not size `ion-tabs` with margin or `right` while `contain: size` and `width: 100%` are in effect. Use `left` and an explicit `width`. `has-rail` must narrow that width by 372px, not by a second margin.
- Do not set `bottom`, `margin-bottom`, or a translate on `ion-modal.settings-sheet ::part(content)` to “lift” the sheet. The gesture math will push it off the bottom of the phone.
- Do not drop `--border-radius: 9999px !important` on `.desktop-actions .desktop-cta-btn`. The toolbar slot will snap it back to 2px.
- Do not rely on the global toolbar icon color for the add button. Start-slot icons are forced to Apple blue at 0.95 opacity unless the CTA sets `color: #fff` and `opacity: 1`.
- Do not add a desktop add button next to search on Despensa or Urgente. The header CTA is the one. The empty card pill stays.
- Do not give the empty state a viewport min-height at ≥1200px. It makes an empty pane scroll.
- Do not hide overflow on every `ion-content`. Only `.is-empty`, and only at ≥1200px. Lists must scroll.
- Do not change the rail fill to hide the corner artifact. Fix the pane width and the rail’s own clipping.
- Do not shrink the sidebar active-link shadows when the user says the add-button shadows are big.
- Do not remove the outline from “Borrar todos” when removing the export border.
- Screenshots taken before the Ionic page transition finishes can be blank (`ion-page-invisible`). Wait about 1.2–1.5s after navigation.

## Files touched in the two session commits

`e91b7df`:

- `src/app/tabs/tabs.page.ts` — `showListRail` also excludes `/urgente`.
- `src/app/tabs/tabs.page.scss` — pane `left`/`width`, `has-rail` width, rail clipping.
- `src/app/tabs/tabs.page.spec.ts` — rail present on `/despensa`, absent on `/urgente` and `/lista`, host class `has-rail` follows.
- `src/global.scss` — `ion-content.is-empty { --overflow: hidden }` at ≥1200px.
- `src/app/layout/empty-state/empty-state.component.scss` — desktop `min-height: 0`.
- `src/app/tabs/tab-pantry/tab-pantry.page.html` and `tab-urgent.page.html` — removed the empty command-bar add button and the search-row add button.
- `src/app/tabs/_text-filter.scss` — `.desktop-command-bar` rules removed.

`b15822d`:

- `src/app/layout/header/header.component.html` — export button gains `desktop-export-btn`.
- `src/app/layout/header/header.component.scss` — pill CTA, white icon, smaller shadow, export border removed.
- `src/app/layout/empty-state/empty-state.component.scss` — `.empty-cta` shadow reduced, blue and red.
- `src/app/tabs/_text-filter.scss` — outline `.desktop-inline-cta` has no border.
- `src/app/settings/settings.component.scss` — content `--padding-bottom` for the dialog and as the sheet fallback.
- `src/global.scss` — sheet scroll padding, shorter desktop dialog, bottom-weighted dialog margin.

## Tests

`tabs.page.spec.ts` covers the rail and the settings css classes. It does not assert pixels. The rail test sets `isDesktopLayout` and writes the protected `currentUrl` signal.

`header.component.spec.ts` asserts `.desktop-cta-btn` text and click. It does not assert radius, shadow, or icon color.

Command used after the rail change:

```bash
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/tabs/tabs.page.spec.ts'
```

Result: 7/7 passed. Karma may warn that ChromeHeadless did not capture within 60s and then pass on retry. No new test was added for the button or settings CSS.

## How verification was done

No browser tool was connected. Checks used headless Chrome:

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  --headless=new
  --remote-debugging-port=<port>
  --user-data-dir=/tmp/chrome-...
```

Node 24’s global `WebSocket` talked to the DevTools HTTP endpoint. Viewports used were 1440×900, 1280×700, and 390×844. `Emulation.setDeviceMetricsOverride` plus a fresh navigation was used so `matchMedia('(min-width: 1200px)')` and `isDesktopLayout` matched the viewport. Open settings with `button.sidebar-settings` on desktop and `button.settings-fab` on the phone.

Useful probes:

- Pane, card, and rail `getBoundingClientRect`.
- `content.shadowRoot.querySelector('.inner-scroll')` for `scrollHeight`, `clientHeight`, `scrollTop`.
- Computed `--border-radius`, background, box-shadow, and SVG stroke on the CTA and `.empty-cta`.
- Modal wrapper `bottom`, `transform`, and rect versus `innerHeight` at breakpoints 0.5 and 0.85 (`modal.setCurrentBreakpoint`).
- After scrolling the settings content to the end, the last `.settings-section` must sit fully above the viewport on the phone, and inside the dialog on desktop.
- `elementFromPoint` on the last settings row.

Seeding products through `ng.getComponent` writes only the temporary Chrome profile, not the user’s SQLite file.

`python3` on that machine had no Pillow. Pixel checks used a small Node PNG decoder.

## Stack, for orientation

- Angular 17, Ionic 7, standalone tab pages, Capacitor 5.
- Desktop shell starts at 1200px. Tablet content max-widths at 768 and 1024 remain in `global.scss` and are overridden at 1200 (`max-width: none`).
- Data is signals in `DataService` plus SQLite (`sql.js`) autosave. Cloud mode is Neon (`@neondatabase/neon-js`) behind `AppModeService`.
- Product tabs: `src/app/tabs/tab-pantry`, `tab-list`, `tab-urgent`.
- Header: `src/app/layout/header`. Empty card: `src/app/layout/empty-state`. Settings body: `src/app/settings`.
- Shared filter styles: `src/app/tabs/_text-filter.scss`, `_category-filter.scss`, `_product-item-shared.scss`.
- Portfolio notes live in `docs/`. They were not updated in this session.

## Left alone on purpose

- Phone tab bar, phone header, FABs, and empty-state mobile min-height.
- Export button uppercase and 2px toolbar radius. Only the border was removed.
- “Borrar todos” outline.
- Sidebar active-link shadows.
- Rail background opacity 0.78.
- Settings breakpoints `[0, 0.5, 0.85]`. The sheet still docks to the bottom of the phone. Usability comes from scroll padding, not from a floating sheet.
- No commit of `HANDOFF.md` was part of the product work. If this file is committed, that commit is only the note.

## If you continue the UI

Likely follow-ups, none of them requested:

- The header export and the Lista filter-bar export still don’t match each other beyond “no border”.
- The sheet’s hidden 15% and the CSS `0.15` can drift if someone edits only `openSettings`.
- A real device with a home indicator was not in the session. The padding formula includes `env(safe-area-inset-bottom)`, but it was measured in desktop Chrome where that inset is 0.
- `ng test` for the whole suite was not re-run after the button and settings CSS. The included tabs spec was green after the rail change only.
