# From pen.dev to Angular

pen.dev's `guide/code.md` decides the order of work: list the components a frame uses, build and check one at a time, then assemble the frame. This file decides what each piece becomes in this project. The project's own rules (AGENTS.md, PROJECT.md, and the `angular-developer` skill) still apply to every line. The tables use HTML elements and component SCSS. In an Ionic, Angular Native, Angular Material, or Tailwind project, use that library's equivalent from its skill, and keep the structure rules.

Read exact values from the document instead of guessing: `Print(Get(id, {depth: 5}))` for structure, `Print(GetVariables())` for tokens. `Export([id], "html-css", "/tmp/frame.html")` can show computed values. Export outside the repository, and translate what you read: never paste exported HTML into a component.

## Structure

| pen.dev                                           | Angular                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Top-level screen frame                            | A routed page, lazy-loaded from the routes                                                                                            |
| Reusable component (`reusable: true`)             | A component created with `ng generate component`, in the feature folder that owns it, or a shared folder when several features use it |
| Instance overrides (`descendants`)                | Inputs: `input()`, or `input.required()` when every instance sets it                                                                  |
| An action in the design (button, link, row click) | `output()` for the event; `model()` for a value the parent and child both change                                                      |
| Nested component every instance keeps             | Always rendered                                                                                                                       |
| Nested component some instances remove            | `@if` on an input                                                                                                                     |
| Repeated instances or rows                        | `@for (item of items(); track item.id)`                                                                                               |
| `slot` frame                                      | `<ng-content>`, with `select` when there are several slots                                                                            |
| Desktop and mobile frames of the same screen      | One responsive component with media queries, mobile first                                                                             |

## Layout

| pen.dev                                        | Component SCSS                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `layout: "vertical"` / `"horizontal"`          | `display: flex; flex-direction: column` / `row`                                                                                |
| `layout: "none"` with `x`, `y`                 | `position: relative` on the parent, `position: absolute` on the children. Rebuild it with flex or grid when the layout allows. |
| `gap`, `padding`                               | `gap`, `padding`, using `var(--space-*)`                                                                                       |
| `justifyContent`, `alignItems`                 | `justify-content`, `align-items` (`space_between` becomes `space-between`)                                                     |
| `fill_container` along the parent's direction  | `flex: 1 1 0` plus `min-width: 0` (row) or `min-height: 0` (column)                                                            |
| `fill_container` across the parent's direction | `align-self: stretch`                                                                                                          |
| `fit_content`                                  | No size: let the content decide                                                                                                |
| A fixed pixel size                             | Keep it only when it's a real constraint (an avatar, a control height), in `rem`; otherwise let the layout size it             |
| `clip: true`                                   | `overflow: hidden`, but never on an element whose focus ring would be cut off                                                  |
| Row frames that form a grid                    | CSS grid                                                                                                                       |

## Appearance

| pen.dev                                       | Angular                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `$variable` in a fill, stroke, gap, or radius | `var(--variable)` from `src/styles.scss`. No hex values or pixel colors in component styles. |
| A raw value with no variable                  | Add a token first ([tokens.md](tokens.md)), unless it's a one-off with no meaning elsewhere  |
| `cornerRadius`                                | `border-radius`, using `var(--radius-*)`                                                     |
| `stroke`                                      | `border` (or `outline` when it must not affect layout)                                       |
| `effect` shadows and blurs                    | `box-shadow`, `filter`, `backdrop-filter`                                                    |
| Animation or motion shown in the design       | CSS transitions, with a `prefers-reduced-motion` fallback                                    |

## Text, icons, and images

| pen.dev                                    | Angular                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text that titles a section                 | `h1` to `h6`, in document order, one `h1` per page                                                                                                                                |
| Body text (`textGrowth: "fixed-width"`)    | `p` or the element that fits; normal wrapping                                                                                                                                     |
| Labels (`textGrowth: "auto"`)              | Text inside the `button`, `a`, or `label`; add `white-space: nowrap` only if the design truncates                                                                                 |
| `fontSize`, `lineHeight` (a ratio)         | `font-size` with `var(--text-*)`; unitless `line-height`                                                                                                                          |
| A frame styled as a button, link, or field | A real `button`, `a routerLink`, or `input` with a `label`. Forms use Signal Forms.                                                                                               |
| `icon` node                                | Inline SVG from the same icon family. Decorative icons next to text get `aria-hidden="true"`; an icon-only button gets an `aria-label`. Don't add an icon package without asking. |
| Image fill                                 | `<img ngSrc>` (`NgOptimizedImage`) with `width`, `height`, and `alt` (`alt=""` when decorative)                                                                                   |
| Copy in the design                         | The same words, letter for letter. Ask before changing copy.                                                                                                                      |

The design shows one state per frame. The code needs all of them: hover, keyboard focus (visible `:focus-visible`), disabled, loading, empty, and error.

## Check the result

1. **Look:** `TakeScreenshot([frameId])` in pen.dev, next to the running app at the same width. Start the app with the Angular CLI MCP `devserver.start` tool (http://localhost:4200). Compare spacing, color, type, and alignment section by section.
2. **Count:** every component instance in the frame exists in the template, with the same text and icons.
3. **Tokens:** no hex colors in component styles. Search `src/app` for `#` followed by hex digits in `.scss` files.
4. **Accessibility:** axe passes in light and dark mode, the page works with the keyboard alone, and contrast meets WCAG AA.
5. **Build:** `ng build` stays inside the budgets, and `ng test` passes, with tests for any behavior you added.
