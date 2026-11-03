# This app

Rules and context for this app only. Agents read this file after [PROJECT.md](PROJECT.md), and where the two differ, this file wins, except that it can't loosen the rules on secrets and Neon. PROJECT.md comes from the template, and `npm run update-from-template` brings in its newer versions. That update never changes this file, so keep everything specific to this app here.

## What the app is

Lista de la compra is a shopping list, in Spanish, with three tabs: Despensa (every product), Lista (what is left to buy, exportable to PDF) and Urgente (high-priority products). Products are stored on the device with Ionic Storage. An optional cloud mode syncs through Neon; sign-in is only required once cloud mode is on. `netlify/mcp/` is an MCP server that lets agents manage users and shopping tasks.

## Decisions

- The app type is `ionic-pwa`: the Angular service worker (`ngsw-config.json`) and a manifest. It is also an Android app through Capacitor 5; keep Capacitor.
- The app is on Angular 17, Ionic 7, Angular Material 17 and Tailwind 3. AGENTS.md and PROJECT.md describe Angular 20 and later: use only the APIs Angular 17 has (for example no Signal Forms and no `linkedSignal()`), and don't upgrade unless the user asks.
- Screens use Ionic components and Tailwind; Angular Material is there for snackbars. Spartan UI and `ai-elements` are not installed, so PROJECT.md's rules for them don't apply here.
- `DataService` holds the products as a signal, and an effect persists every change to Ionic Storage. Keep the app usable offline with cloud mode off.

## Rules

- Checks, as CI runs them: `npm run lint`, `npm run test:ci`, `npm run build`. The MCP server has its own tests: `npm run test:mcp`.
- While `HANDOFF.md` exists, read its traps before editing layout CSS: several margin fixes that look right are wrong for this Ionic version.
- `docs/` is the case study that cristiancode.dev publishes: a push to `main` that changes it rebuilds the portfolio. Keep secrets, connection strings and private notes out of it.
