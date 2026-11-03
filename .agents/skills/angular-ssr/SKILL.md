---
name: angular-ssr
description: >-
  Set up server-side rendering (SSR) with hydration in this Angular project, and
  write code that runs on both the server and the browser. Use when
  preferences.json says "ssr", when the user asks for SSR, prerendering, SEO, or
  a faster first paint, or when a component breaks only on the server. Covers ng
  add @angular/ssr, render modes per route, browser-only code, the allowed hosts
  a production server needs, Neon data, and how to check the result.
---

# Angular SSR

With SSR, a Node server renders each page to HTML, and the browser then hydrates it: Angular reuses the server's DOM instead of rendering the page again. Angular's official skill explains the rendering strategies (`angular-developer`, `references/rendering-strategies.md`). This skill sets SSR up in this project and lists the rules that keep it working.

## Set it up

1. Run `ng add @angular/ssr`. It adds `src/server.ts` (an Express server), `src/main.server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, `provideClientHydration()` in `src/app/app.config.ts`, and `"outputMode": "server"` in `angular.json`.
2. Keep `provideClientHydration()` without features. In Angular 22 it already turns on incremental hydration, event replay, and the HTTP transfer cache.
3. Give each route a render mode in `src/app/app.routes.server.ts`. The schematic prerenders everything (`path: '**'`); list specific routes above that entry:

   | The route shows                                                    | Render mode            |
   | ------------------------------------------------------------------ | ---------------------- |
   | The same content to everyone (home, docs, marketing)               | `RenderMode.Prerender` |
   | Content that changes per request, not per user (search, a product) | `RenderMode.Server`    |
   | Content for the signed-in user (anything read from Neon)           | `RenderMode.Client`    |

   A prerendered route with parameters, such as `product/:id`, needs `getPrerenderParams`. Otherwise use `RenderMode.Server` for it.

4. List the hosts the server answers to. Angular checks every request's `Host` header against `security.allowedHosts` in `angular.json` and answers `400 Bad Request` to the rest. `ng add` leaves the list empty, so a production build refuses even `localhost`. Add the production domains to `allowedHosts` (`*.example.com` covers subdomains), and run locally with `NG_ALLOWED_HOSTS=localhost`. Never use `*`: it opens the server to host header injection and server-side request forgery.

## Code that runs on the server

Every component runs twice: on the server, which has no `window`, `document`, `localStorage`, or `navigator`, and then in the browser.

- Touch browser APIs only inside `afterNextRender()` or `afterEveryRender()`. They run only in the browser.
- The server's HTML must match the browser's first render. Values that differ between the two (the current time, random IDs, the window size, anything stored in the browser) cause hydration errors: set them after render.
- Load data with `HttpClient` or `httpResource()`. The transfer cache sends the server's responses along with the page, so the browser doesn't request them again.
- Defer heavy parts below the fold with `@defer (hydrate on viewport)`: they stay as server HTML until they're needed.
- Secrets belong in `src/server.ts` and in environment variables. Component code ships to the browser.

## Neon

The Data API needs the signed-in user's Neon Auth token, which the server doesn't have. Render pages that read Neon with `RenderMode.Client`, and keep following `neon-data-api-rls`. An API route in `src/server.ts` may read a Postgres connection string from an environment variable, but never import server code into a component.

## Check the result

1. `ng build` writes `dist/<project>/browser` and `dist/<project>/server`, and lists the prerendered routes.
2. Start the server with `NG_ALLOWED_HOSTS=localhost node dist/<project>/server/server.mjs` (port 4000, or set `PORT`). `curl http://localhost:4000/` must return the page's content, not an empty `<app-root>`.
3. In the browser, the console shows no hydration errors (`NG05xx`), and forms and buttons respond right away.
4. `ng test` passes, and axe passes in light and dark mode. `ng serve` renders on the server in development too.
5. Deploy to a host that runs Node. A static host can serve only the prerendered routes.

## References

Angular docs: [Server-side and hybrid rendering](https://angular.dev/guide/ssr), [Hydration](https://angular.dev/guide/hydration), [Incremental hydration](https://angular.dev/guide/incremental-hydration), and [Preventing server-side request forgery](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf).
