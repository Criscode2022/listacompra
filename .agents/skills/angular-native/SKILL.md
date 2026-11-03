---
name: angular-native
description: >-
  Build a native iOS and Android app with Angular Native (ng-native.com) and run
  it on a phone with Expo Go. Use when preferences.json says "angular-native",
  or when the user asks for a native, iOS, Android, Expo, or React Native app
  written in Angular. Covers adding the app to this workspace with ng add
  @ng-native/schematics, where Angular Native's official rules for agents live,
  Expo Go, commands, tests, what carries over from the web app, and checks.
---

# Angular Native

Angular Native renders Angular components as real iOS and Android views, on React Native's Fabric renderer, inside an Expo app. There is no DOM: templates use native elements such as `<view>`, `<text>`, and `<pressable>` from `@ng-native/components`. It's in alpha (0.3 when this skill was written), so check [Known limitations](https://ng-native.com/guide/limitations.md) before promising a feature.

## Set it up

1. Ask the user for the app's bundle identifier, such as `com.example.notes`. It can't change once the app is in a store. Then run `ng add @ng-native/schematics --bundleIdentifier com.example.notes`. Without the option, this workspace gets `com.appnative`.
2. The web app in `src/` stays as it is. The native app is a second project in `projects/native`, with its own `AGENTS.md` and `CLAUDE.md`: Angular Native's official rules for agents.
3. Its dependencies (Expo, React Native, `@ng-native/*`) go into the root `package.json`. Never run `npm install` inside `projects/native`, and say no when Expo offers to install `react` or `react-native` there: that would add a second copy of React Native.

## Rules

- Read `projects/native/AGENTS.md` before changing anything in `projects/native`, and follow it there. Where it differs from this repository's web rules, it wins inside `projects/native`: there is no DOM, no `NgOptimizedImage`, and no axe, and accessibility is set with props such as `accessibilityRole` and `accessibilityLabel`.
- The rest of Angular stays the same: signals and `computed()`, Signal Forms (`[formField]` on `<text-input>` and `<switch>`), `@angular/router` on native stacks and tabs, dependency injection, and `HttpClient` through `provideNativeHttpClient()`.
- Share services, models, and validation with the web app. Write screens again with native elements: components that render HTML don't render on native.
- `src/styles.scss` doesn't load in the native app. Copy the tokens a native screen needs into its styles (custom properties work), or use `@ng-native/tailwind` ([Theming and Tailwind](https://ng-native.com/guide/theming.md)).
- Neon: the Data API and RLS rules in `neon-data-api-rls` still apply, and no connection string ever goes into the app. That skill's Angular client was written and tested for the browser. Before using it on native, check that its packages run on React Native, and ask the user if they don't.

## Run it in Expo Go

1. Install [Expo Go](https://expo.dev/go) on the phone. The phone and the computer must be on the same network.
2. Run `ng serve native`. It starts Metro and shows a QR code. Scan it with the iPhone's Camera app, or with Expo Go on Android. Press `i` or `a` to open a simulator instead.
3. Saving a template or a style updates the app and keeps its state. Changing a selector, an input, a method, or `imports` needs a reload: press `r`.

Expo Go includes only Expo's own native modules. An app that needs any other native module runs in a development build instead (`ng run native:run-ios` or `ng run native:run-android`), not in Expo Go.

## Commands

| Command                                                  | What it does                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ng serve native`                                        | Starts Metro, for Expo Go or a simulator                                                           |
| `ng test native`                                         | Runs the native tests in Node, with no simulator. A plain `ng test` runs the web and native tests. |
| `ng build native`                                        | Exports the iOS and Android bundles to `dist/native`                                               |
| `ng run native:run-ios`, `ng run native:run-android`     | Makes a development build on a simulator or device                                                 |
| `ng generate component <name>`, run in `projects/native` | Writes a native component and its test                                                             |

A plain `ng serve` or `ng build` still means the web app. From the workspace root, generate with `ng generate @ng-native/schematics:component <name> --project native`.

## Check the result

1. `ng test native` passes, with a test for each behavior you added: render it, query by role or text, and press or type with `@ng-native/testing`.
2. `ng build native` bundles both platforms without errors.
3. The screen works in Expo Go on a real phone, and with the screen reader on (VoiceOver or TalkBack) for anything new.

## References

- Angular Native's docs as Markdown: [llms.txt](https://ng-native.com/llms.txt) lists every page, [llms-full.txt](https://ng-native.com/llms-full.txt) has all of them in one file, and any docs URL works with `.md` added.
- Start with [Getting started](https://ng-native.com/guide/getting-started.md), [Angular CLI](https://ng-native.com/packages/schematics.md), [Components](https://ng-native.com/packages/components.md), [Router](https://ng-native.com/packages/router.md), [Testing](https://ng-native.com/packages/testing.md), [Deployment](https://ng-native.com/guide/deployment.md), and [Updating an app](https://ng-native.com/guide/updating.md).
- The official rules for agents: [agents.md](https://ng-native.com/agents.md), the same text `ng add` writes to `projects/native/AGENTS.md`.
