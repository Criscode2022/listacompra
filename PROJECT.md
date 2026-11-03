# Project rules

These rules add to Angular's official rules in [AGENTS.md](AGENTS.md). Follow both. Where this file is more specific, it wins.

This file comes from the template, and `npm run update-from-template` brings its newer versions into each app. Rules for this app alone live in [APP.md](APP.md). Read it too, and follow it where it differs from this file, except that it can't loosen the rules on secrets and Neon. When the user settles something lasting about the app, such as what it's for, its design direction, or a convention, write it in APP.md.

## App type: check it before you build

This template can become one of four types of app. `preferences.json` stores the user's choice as `appType`. `npm run onboarding` writes it, and `npm start` and `npm run build` ask for it until it's set.

| `appType`        | The app                                                             | Set it up with                                      | Skill               |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------- | ------------------- |
| `spa`            | A classic Angular single-page app. The template already is one.     | Nothing                                             | `angular-developer` |
| `ssr`            | A modern app rendered on a server, then hydrated in the browser     | `ng add @angular/ssr`                               | `angular-ssr`       |
| `ionic-pwa`      | A PWA with Ionic's mobile UI, installable and working offline       | `ng add @ionic/angular`, then `ng add @angular/pwa` | `ionic-pwa`         |
| `angular-native` | A native iOS and Android app with Angular Native, opened in Expo Go | `ng add @ng-native/schematics`                      | `angular-native`    |

Before you build the app or add to it:

1. **The prompt names a type:** use it. A hint that fits two types, such as "a mobile app", doesn't count.
2. **Otherwise, read `preferences.json`** and use its `appType`.
3. **Neither gives a type:** stop before writing code, and never choose one yourself. Ask the user explicitly, and say that this repository includes four options: "This repository can set up four types of app: a classic Angular SPA, a modern SSR app, a PWA with Ionic, or a native iOS and Android app with Angular Native and Expo Go. Which one do you want?"
4. **Save the type** in `preferences.json` when it's new or different, so nobody has to answer again.
5. **Set the type up once,** following its skill, when `package.json` doesn't have its packages yet (`@angular/ssr`, `@ionic/angular`, or `@ng-native/schematics`). Moving an app that is already set up to another type rewrites much of it: confirm with the user first.

## Skills: load one before you start

The skills live in `.agents/skills/`. Claude Code reaches the same folders through the links in `.claude/skills/`.

- **Angular code:** `angular-developer`. Only when creating a new app: `angular-new-app`.
- **The app type:** `angular-ssr`, `ionic-pwa`, or `angular-native`, as the section above says.
- **UI:** Load `frontend-design`, then `impeccable`, and follow both. Do not ask whether to use them. Impeccable chooses the layout and builds it. Do not ask the user to choose among layouts, directions, or comps unless the user explicitly asks to see options or to pick one. No generic AI styling: no decorative gradients, no identical card grids, no all-caps eyebrow labels, no motion nobody asked for.
- **UI libraries:** Spartan UI and Tailwind CSS are already installed. Load `spartan` for components and `tailwind-angular` for utilities. Theme both from the tokens in `src/styles.scss`. The brand fill is `bg-primary`. Spartan's `bg-accent` is a hover surface, not the brand. Load `ai-elements` for conversation UI (messages, a prompt, reasoning, tool calls, sources). Load `angular-material` only when the user asks for Angular Material or `package.json` already has `@angular/material`. Ionic and Angular Native keep the component rules in their own skills.
- **Every code change:** `clean-code`.
- **Neon data and access rules:** `neon-data-api-rls` for tables, RLS policies, roles, and Data API calls from Angular. `neon-auth`, Neon's official skill, for the login flow.
- **Designs in pen.dev:** `pen-dev-angular` for anything on the pen.dev canvas or in a `.pen` file, together with `frontend-design` and `impeccable`. It loads pen.dev's own instructions through the `pencil` MCP server.

## MCP: how you act

Skills are instructions. The MCP servers are the action layer.

1. Before writing Angular code, call `get_best_practices` with this workspace's path, so the rules match the installed `@angular/core` (see `package.json`). Do not rely on memory of an older Angular version.
2. Look up APIs with `search_documentation`. Read the workspace with `list_projects`.
3. Build and test with `run_target` (`build`, `test`). For a live preview, use `devserver.start`, `devserver.wait_for_build`, and `devserver.stop`. `@angular/cli` 22.2 registers those three as `devserver_start`, `devserver_wait_for_build`, and `devserver_stop`.
4. For change detection work, follow `onpush_zoneless_migration` one step at a time.
5. Call `ai_tutor` only when the user asks for the tutor (see below).

## Code map

- `src/app/layout/shell.*`: the layout. It owns the skip link, the `main` landmark, and moving focus after navigation.
- `src/app/pages/home/` and `src/app/pages/assistant/`: the routed pages, loaded lazily from `app.routes.ts`. Assistant is the conversation UI. It keeps messages in memory and does not call a model.
- `src/app/ui/helm/`: Spartan components copied in by `@spartan-ng/cli`. Add more with `ng g @spartan-ng/cli:ui --name=<component>`. Leave generated files alone except to fix a break.
- `src/app/ui/ai-elements/`: Angular conversation components built on Spartan. Use these instead of the React AI Elements package.
- `src/app/features/notes/`: placeholder data. Components inject `NotesRepository`. Its factory returns `InMemoryNotesRepository` until Neon is connected.
- `templates/webmcp.example.ts`: the WebMCP template. Do not register WebMCP tools in `src/` unless the user asks.
- `design/`: pen.dev design files (`.pen`), once the project has any. Change them only in pen.dev or through its `pencil` MCP tools, never as text.
- `preferences.json`: the app type (see above). `scripts/onboarding.mjs` asks for it.
- `scripts/update-from-template.mjs`: brings the template's updates into an app. `TEMPLATE_PATHS` at its top lists the files the template owns. In an app, change those only when the change belongs in the template too; the app's own rules go in APP.md.

## On top of AGENTS.md

- TypeScript 6 and Angular 22 turn strict checks on by default, so `tsconfig.json` has no `strict` flag. Never turn them off.
- Signal Forms in Angular 22: `form()`, `FormField` (`[formField]`), `FormRoot` (`form[formRoot]`), and `submit()`.
- Use `linkedSignal()` when derived state must stay writable.

## Neon

- Schema changes and queries go through the Neon MCP server, and only after the user has authorized it in the browser (OAuth). This template never uses a Neon API key.
- Never invent a connection string. Never write one into a tracked file. If the user wants one in a local `.env` (gitignored), ask first.
- No destructive SQL (`DROP`, `TRUNCATE`, `DELETE` or `UPDATE` without a `WHERE`, dropping columns) and no branch or project deletion unless the user explicitly asks in this conversation.
- Prefer Neon's migration tools (`prepare_database_migration`, then `complete_database_migration`). They test a change on a temporary branch first.
- Neon recommends MCP for development and testing only. Do not point it at production or personal data.
- The browser reaches Neon only through the Data API, with the signed-in user's Neon Auth token, and RLS policies decide what each user sees. Follow every rule in `neon-data-api-rls`. Never put a connection string in browser code.
- Neon's own skills prefer Neon Functions to the Data API for new apps. This project uses the Data API by choice. Put anything a policy can't express (payments, emails, third-party APIs) behind a Neon Function or your own server.
- To connect the notes feature, implement `NotesRepository` against the Data API and return the new class from the repository factory.
- The persona test in `neon-data-api-rls` may run on a test branch even though it contains an `UPDATE` without a `WHERE`: it runs as a test user, RLS limits it to that user's test rows, and it must be rejected.

## Secrets and LLM features

- Never put an API key in `environments.ts` or any file that ships to the client.
- Client-side Google models go through Firebase AI Logic. Other providers go through a server proxy.
- Server secrets live in environment variables or a secrets manager. `.env` and `.env.*` are gitignored. Keep it that way.
- An LLM call whose result the user would act on needs a human in the loop or a schema-constrained response.
- Every LLM call needs a graceful fallback when the provider is down: keep the user's input, say what failed, and offer a retry.

## Angular AI tutor

The tutor is opt-in. Start it only when the user says "launch the Angular AI tutor". It builds a Smart Recipe Box app, which is not the product of this template.

## Files copied from official sources

Do not edit these by hand: Angular's text in `AGENTS.md` (everything above its project section), the skills in `.agents/skills/` except the ones `SKILLS.lock.md` lists as written for this repository, and `third_party/`. `GEMINI.md` and the folders in `.claude/skills/` are links, not copies. Update everything with `sh scripts/update-agent-files.sh`, which also rewrites `SKILLS.lock.md`. That script puts the "Use it, and choose the layout" section back into `.agents/skills/impeccable/SKILL.md` after the upstream skill is replaced.

`/impeccable init` writes `PRODUCT.md`, and `/impeccable document` writes `DESIGN.md`. Those are Impeccable's files, separate from this one.

## Done means

- `ng build` passes (`run_target` with `build`).
- `ng test` passes (`run_target` with `test`), with tests for any behavior you changed.
- For an `ssr`, `ionic-pwa`, or `angular-native` app, the checks at the end of that type's skill pass too.
- `npm run test:scripts` passes if you changed anything in `scripts/`.
- No secrets, connection strings, or tokens in tracked files.
