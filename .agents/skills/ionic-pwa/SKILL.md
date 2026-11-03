---
name: ionic-pwa
description: >-
  Turn this Angular project into an installable progressive web app (PWA) built
  with Ionic 9, and build its screens with Ionic components. Use when
  preferences.json says "ionic-pwa", or when the user asks for Ionic, a
  mobile-style web app, an installable app, offline support, or a service
  worker. Covers ng add @ionic/angular and @angular/pwa with the cleanup this
  project needs, the Ionic app shell, Angular 22 rules with Ionic (signals,
  Signal Forms), theming Ionic with the project's tokens, tests, and checks.
---

# Ionic PWA

Ionic provides mobile-style components (`ion-*`) that look native on iOS and Android. The PWA part adds a web app manifest and a service worker, so the app installs to a home screen and opens offline. For any component's API, read its page in Ionic's docs before using it ([References](#references)).

## Set it up

1. Run `ng add @ionic/angular`, then remove what it adds for older Ionic projects:
   - In `angular.json`, delete the `ionic-cordova-serve` and `ionic-cordova-build` targets, `cli.schematicCollections`, and the `@ionic/angular-toolkit` entries under `schematics`. While they're there, `ng generate component` writes Ionic's older file names (`name.component.ts`) instead of Angular's.
   - Run `npm uninstall @ionic/angular-toolkit`. Nothing needs it after that, and `ng add` added it with the version `latest`.
   - In the `styles` array in `angular.json`, move `src/styles.scss` after Ionic's CSS files and `src/theme/variables.css`, so this project's base styles and tokens come last.
2. Run `ng add @angular/pwa`. It adds `@angular/service-worker`, `provideServiceWorker()` in `src/app/app.config.ts` (on in production builds only), `ngsw-config.json`, `public/manifest.webmanifest`, and Angular logo icons in `public/icons/`. Replace the icons with the app's own, and set the manifest's `name`, `short_name`, `theme_color`, and `background_color`.
3. The initial bundle grows by about 360 kB, past the default 500 kB warning budget. Raise the `initial` warning in `angular.json` to fit (for example to 750 kB), and leave the error limit.

## The app shell

An Ionic app renders its pages in `ion-app` and `ion-router-outlet`, which add page transitions and keep visited pages in a stack:

```ts
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: '<ion-app><ion-router-outlet /></ion-app>',
})
export class App {}
```

- A routed page is an `ion-header` (with `ion-toolbar` and `ion-title`) followed by `ion-content`. Ionic gives them the `banner` and `main` landmarks. They replace the template's `Shell` layout. Keep one `h1` per page.
- Never give a routed page's `:host` its own `display`. Ionic lays out the page host as a flex column (`.ion-page`), and a `:host { display: grid }` collapses the content to a sliver on phones. Put the layout on an element inside `ion-content`.
- Import Ionic components from `@ionic/angular`. Ionic 9 made the standalone components its default; `@ionic/angular/standalone` is the old path from Ionic 7 and 8. Register each `ionicons` icon with `addIcons()` in the constructor of the component that shows it.
- Ionic keeps visited pages alive, so `ngOnInit` runs once per page. Reload data that must be fresh in `ionViewWillEnter`, and move focus to the page's heading in `ionViewDidEnter`.
- Navigate with `routerLink` (plus `routerDirection` for the transition) or with `NavController`.

## Angular 22 with Ionic

Ionic 9 supports Angular 22's zoneless and `OnPush` defaults when state lives in signals.

- Keep page state in signals. A plain field set after an overlay closes (`await modal.onWillDismiss()`), after a `Platform` event, or in a timer doesn't update the view.
- Signal Forms work on Ionic inputs: `<ion-input label="Title" labelPlacement="stacked" [formField]="noteForm.title" [errorText]="titleError()?.message ?? ''" />`. Ionic shows `errorText` only while the input has the `ion-invalid` and `ion-touched` classes, so bind both from the field's state (`[class.ion-invalid]`, `[class.ion-touched]`).
- `ion-button type="submit"` submits its form.
- `fill="outline"` and `fill="solid"` are Material Design styles: iOS mode ignores them unless the input also has `mode="md"`. Otherwise put inputs in an `ion-list` of `ion-item`s, which draws their edges on both platforms. Don't put an input with `fill` inside an `ion-item`.

## Theme Ionic with the project's tokens

Ionic reads `--ion-*` variables. Point them at the tokens in `src/styles.scss`. Ionic's dark palette, imported by `src/theme/variables.css`, sets some of them on `:root.ios` and `:root.md`, so use the same selectors:

```scss
:root,
:root.ios,
:root.md {
  --ion-font-family: var(--font-body);
  --ion-background-color: var(--color-canvas);
  --ion-text-color: var(--color-text);
  --ion-toolbar-background: var(--color-surface);
  --ion-item-background: var(--color-surface);
  --ion-color-primary: var(--color-accent);
  --ion-color-primary-rgb: 163, 22, 90; // the light --color-accent, as red, green, blue
  --ion-color-primary-contrast: var(--color-on-accent);
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: color-mix(in srgb, var(--color-accent), black 12%);
  --ion-color-primary-tint: color-mix(in srgb, var(--color-accent), white 10%);
  --ion-color-danger: var(--color-danger);
}

@media (prefers-color-scheme: dark) {
  :root,
  :root.ios,
  :root.md {
    --ion-color-primary-rgb: 255, 143, 199; // the dark --color-accent
    --ion-color-primary-contrast-rgb: 43, 7, 24;
  }
}
```

The `-rgb` variables can't refer to a token, so update them whenever an accent color changes.

## Tests

Ionic components render in this project's Vitest tests (jsdom). Add `provideIonicAngular({})` to the test's providers. To type into an `ion-input`, set its `value` and dispatch an `ionInput` event on it; the form model then holds the new value.

## Check the result

1. `ng build`, then serve `dist/<project>/browser` from `localhost` or over HTTPS: service workers need a secure context.
2. In Chrome's DevTools, the service worker is active, the manifest shows no warnings, and the app reloads with the network offline.
3. Check both of Ionic's modes: an iPhone in Chrome's device toolbar (iOS mode) and a desktop window (Material Design mode). In each, check the layout, keyboard focus, and axe in light and dark mode.
4. `ng test` passes.

## References

Ionic publishes its docs as Markdown for agents: [llms.txt](https://ionicframework.com/docs/llms.txt) lists every page, and any docs URL works with `.md` added. Start with [Add to an existing Angular project](https://ionicframework.com/docs/angular/add-to-existing.md), [Zoneless change detection](https://ionicframework.com/docs/angular/zoneless.md), [Navigation](https://ionicframework.com/docs/angular/navigation.md), [Page lifecycle](https://ionicframework.com/docs/angular/lifecycle.md), [Theming](https://ionicframework.com/docs/theming/basics.md), and each component's page, such as [ion-input](https://ionicframework.com/docs/api/input.md). For the service worker: [Angular service workers](https://angular.dev/ecosystem/service-workers).

Ionic builds native iOS and Android apps with Capacitor. Ask the user before adding it: this app type is a PWA.
