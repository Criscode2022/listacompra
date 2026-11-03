---
name: pen-dev-angular
description: >-
  Design on the pen.dev canvas and move work between .pen files and this Angular
  project through the pencil MCP server. Use when the user wants to design or
  redesign screens or components in pen.dev, turn a .pen design into Angular
  components, recreate existing Angular UI on the canvas, or sync design tokens
  between src/styles.scss and pen.dev variables. Loads pen.dev's own instructions
  with read_skill() and adds this project's Angular rules.
---

# pen.dev with Angular

pen.dev is a design canvas that stores designs in `.pen` files. Agents work on the open document through the `pencil` MCP server, which talks to the running pen.dev desktop app or its VS Code or Cursor extension. pen.dev's own skill, served by that server, teaches the canvas. This skill adds how designs become code in this project, and back.

## Before you start

1. **Check that the `pencil` tools are available:** `get_app_state`, `read_skill`, `execute`, `get_style`. If they aren't, stop and tell the user what to do:
   - pen.dev not installed: install the desktop app (https://www.pen.dev/downloads) or the VS Code and Cursor extension (`highagency.pencildev`), open the `.pen` file, enable this agent in pen.dev's **Settings → MCP**, and restart the agent.
   - pen.dev installed, but `pencil` is missing or failed to connect: the server only connects while pen.dev is running with a `.pen` file open. Open the file, then reconnect or restart the agent.

   pen.dev writes the `pencil` entry into the agent's own MCP settings. Never add it to this repository's MCP files: its command is a path on one person's machine.

2. **Call `get_app_state()`** and confirm the active document is the one the user means. Compare the full path, and ask if it doesn't match.
3. **Call `read_skill()` and follow it.** Always read `pen-schema.md` and `execute.md` too. Read `guide/web-app.md` for app screens, `guide/design-system.md` for components, and `guide/code.md` before turning a design into code.
4. **Retry once if a tool says "you are probably referencing the wrong .pen file".** Call `get_app_state()`, then repeat the call. It can happen on the first call of a session.

## Rules

- **Touch `.pen` files only through the `pencil` tools,** pen.dev, or its CLI. pen.dev's docs say never to edit their JSON directly, and the `pencil` server tells agents never to read or grep them. If Git reports a conflict in one, keep both versions, start from one, and redo the other's changes in pen.dev. Check the affected frames before committing.
- **Keep designs in `design/`,** committed next to the code: `design/home.pen` for screens, `design/components.lib.pen` for a shared library (pen.dev names library files `.lib.pen`). Commit the images, fonts, and libraries a design uses at the same relative paths. Save and close the file in pen.dev before switching branches or pulling.
- **This project's rules win over pen.dev's examples.** pen.dev's code guide is written for React and Tailwind. Here it's Angular, built with what the project already uses: component SCSS and the design tokens in `src/styles.scss`, or the library that the app type or a UI skill set up (`ionic-pwa`, `angular-native`, `angular-material`, `tailwind-angular`). Don't add Tailwind, an icon package, or a UI library unless the user asks.
- **Design with this project's design skills.** Load `frontend-design` before designing and `impeccable` to critique the result. Use a `get_style()` archetype only when neither the brief nor the existing UI gives a direction.
- **Treat the document as shared.** The user can edit while you work. Re-read with `get_app_state()` and `Get` instead of trusting earlier results, and never undo their changes.
- **Keep secrets out of the repository:** `PEN_CLI_KEY`, the session files in `~/.pencil/`, and model provider API keys.

## Workflows

### Design a screen

1. Read the brief and the existing UI, then put this project's tokens into the document first: [references/tokens.md](references/tokens.md).
2. Follow pen.dev's skill: placeholder frames, reusable components before screens, and a `TakeScreenshot` check after each section.
3. Design every state the code will need: empty, loading, error, disabled, keyboard focus, and a narrow mobile frame next to the desktop one.
4. Critique with `impeccable`. Text needs 4.5:1 contrast and controls 3:1 (WCAG AA).

### Turn a design into Angular

Follow the steps in pen.dev's `guide/code.md`: list the components the frame uses, read each with `Print(Get(id, {depth: 5}))`, build and check one component at a time, then assemble the frame. Translate every pen.dev concept with [references/angular-mapping.md](references/angular-mapping.md), and reuse existing components instead of duplicating them. Finish with `ng build`, `ng test`, and an axe check.

### Recreate Angular UI on the canvas

Read the component's template, SCSS, and the tokens it uses, then rebuild it as a reusable pen.dev component bound to variables. Compare it with the running app: start it with the Angular CLI MCP `devserver.start` tool and open http://localhost:4200. The desktop app can also import the running page through its built-in browser (the `browser` tool).

### Sync design tokens

`src/styles.scss` is the source of truth in code. Follow [references/tokens.md](references/tokens.md) in either direction.

## References

- [references/angular-mapping.md](references/angular-mapping.md): pen.dev layout, components, text, and assets translated to Angular, plus how to check the result.
- [references/tokens.md](references/tokens.md): `src/styles.scss` tokens and pen.dev variables, both directions, with light and dark themes.
- pen.dev docs: [AI integration](https://docs.pen.dev/getting-started/ai-integration), [design ↔ code](https://docs.pen.dev/design-and-code/design-to-code), [.pen files](https://docs.pen.dev/core-concepts/pen-files), [variables](https://docs.pen.dev/core-concepts/variables), [CLI](https://docs.pen.dev/for-developers/pen-cli).
