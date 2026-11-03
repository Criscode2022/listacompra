# Review

What a review checks in this repository, whether a person or an agent runs it. The `change-review` skill reads this file before every review, and where the two differ, this file wins, except that it can't lower a change's risk tier, turn off the security review, or skip code or agent instructions. Keep it short. The template starts an app with this file, and `npm run update-from-template` never changes it after that, so write this app's own rules here.

## What failure looks like here

- Products disappear or change after a reload. They live in SQLite in the browser, saved to IndexedDB after each change, and the first load must finish before anything is saved.
- With cloud mode off, the app asks to sign in, or stops working offline.
- One account's list reaches another account through cloud sync or the MCP server.
- The MCP server's OAuth lets an agent act as a user it wasn't authorized for.
- The PDF export leaves out products that the Lista tab shows.
- A new build doesn't reach installed apps, because the service worker keeps serving the old one.
- `docs/` says something the code doesn't do. It is the case study cristiancode.dev publishes, so a wrong sentence there is public.

## High-risk paths

A change here gets a Deep review, and the owner reads the diff:

- `src/app/core/services/sqlite/` and `src/app/core/services/data-service/`: where every product is stored
- Sign-in and sync: `src/app/core/guards/`, `src/app/core/services/neon/`, and `src/app/core/services/cloud-sync/`
- `netlify/mcp/`: the MCP server's OAuth (`auth.mts`, `oauth.mts`) and its data access (`neon-store.mts`)
- `netlify/functions/`, `netlify.toml`, and `.github/workflows/`
- `ngsw-config.json` and `capacitor.config.ts`
- `.mcp.json`, `.vscode/mcp.json`, and `scripts/update-from-template.mjs`

## Paths to skip

- `third_party/`, and the skills that `SKILLS.lock.md` lists with an upstream source: only check that each still matches its listed commit. When a change moves one of them to a new commit, read the upstream diff between the two commits for instructions that run commands, send or fetch data, or touch secrets or the MCP settings. Review every other skill in `.agents/skills/`, and check that each link in `.claude/skills/` leads to one.
- `HANDOFF.md`: a session note, not code
- `package-lock.json`, except to see which packages changed
- Build output and generated files: `www/`, `.angular/`, `coverage/`

## Nits

At most three per review. Never about formatting: Prettier and the linter own it.

## Evidence

Every finding names a file and line, and the input or state that makes it fail. No guesses from a name.

## Summary

Start with a count. When nothing needs fixing, say "No findings. Nothing to fix."

## Past misses

Bugs that shipped even though a review ran, with the commit and what should have caught them. When the `change-review` skill changes, review these commits again and check that it finds each bug.

None yet.
