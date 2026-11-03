# Design tokens: src/styles.scss and pen.dev variables

`src/styles.scss` holds the tokens the app uses. A `.pen` document holds the same tokens as variables. Keep the names identical so a design and its code read the same way. In a Tailwind project, `src/tailwind.css` also registers each token (`tailwind-angular`): add new tokens there too.

## How they correspond

| CSS in `src/styles.scss`                             | pen.dev variable                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-accent`                                     | `color-accent`: drop the `--`. Variable names never start with `$`; `$` only appears where a property uses one (`fill: "$color-accent"`). |
| A color                                              | `type: "color"`, with a hex value                                                                                                         |
| A `rem` size                                         | `type: "number"`, in pixels (1rem = 16px)                                                                                                 |
| A font stack (`--font-body`)                         | `type: "string"` with one concrete family. pen.dev needs a real font, while the CSS keeps its fallback stack.                             |
| Light values in `:root`                              | Theme axis `mode`, value `light`. List it first so it's the document default.                                                             |
| Dark values in `@media (prefers-color-scheme: dark)` | Theme axis `mode`, value `dark`                                                                                                           |
| A fluid `clamp()` size                               | A second theme axis `device`, with the largest value for `desktop` and the smallest for `phone`. Or leave it in code only.                |
| `ch` and other text-relative units                   | No equivalent. Leave them in code only.                                                                                                   |

## From code to the design

1. Read the current variables, so nothing a designer made is overwritten: `Print(GetVariables())`.
2. Read `src/styles.scss` and write the tokens with `SetVariables`. It merges by default; never pass `replace: true`.
3. Bind fills, strokes, gaps, padding, and radii to the variables instead of raw values.

Take the values from `src/styles.scss` at the time you sync. The shape looks like this:

```js
SetVariables({
  'color-accent': {
    type: 'color',
    value: [
      { value: '#a3165a', theme: { mode: 'light' } },
      { value: '#ff8fc7', theme: { mode: 'dark' } },
    ],
  },
  'space-4': { type: 'number', value: 16 },
  'radius-control': { type: 'number', value: 6 },
});
```

## From the design to code

1. Read the variables: `Print(GetVariables())`.
2. Update `src/styles.scss`: the `:root` value for `light` and the dark-mode block for `dark`. Keep the names. Add a new token to both blocks.
3. Check contrast again in both themes: 4.5:1 for text, 3:1 for borders, focus rings, and other control parts (WCAG AA). Run axe in light and dark mode.
4. Leave the CSS font stacks alone unless the user chose a brand typeface. If they did, load it in the app (self-hosted, or with a stylesheet link) and put it first in `--font-body`.
