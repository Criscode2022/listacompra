---
name: tailwind-angular
description: >-
  Add Tailwind CSS 4 to this Angular project and style with it, using the
  project's design tokens as Tailwind theme values. Use when the user asks for
  Tailwind or utility classes, or when package.json already has tailwindcss.
  Covers ng add tailwindcss, registering the tokens with @theme, what Preflight
  changes, writing classes in Angular templates, accessibility, and Tailwind
  with Ionic, Angular Material, or Angular Native.
---

# Tailwind CSS

Use Tailwind when the user asks for it or the project already has it. Otherwise, style with component SCSS and the tokens in `src/styles.scss`. Angular's official skill covers the setup (`angular-developer`, `references/tailwind-css.md`): follow its Tailwind 4 rules, with no `tailwind.config.js` and no `@tailwind` directives.

## This repository already has Tailwind, for Spartan

`src/tailwind.css` is the Spartan layers file: Tailwind's theme, Preflight, and utilities, then `@spartan-ng/brain/hlm-tailwind-preset.css`, then the brand aliases. Do not replace that file with `@import 'tailwindcss'`. `angular.json` lists `src/tailwind.css` before `src/styles.scss`.

Spartan's preset already defines `bg-primary`, `bg-accent`, `border-border`, and the other semantic utilities. In this project those read the tokens in `src/styles.scss` through the aliases in `src/tailwind.css`. The brand fill is `bg-primary` (`--primary` is `--color-accent`). Spartan's `bg-accent` is the hover surface (`--accent` is `--color-hover`). Do not register `--color-accent` in the `@theme` block. That name in `src/styles.scss` is the brand, and a second registration replaces Spartan's hover utility.

Register only template tokens that Spartan does not already own, with `@theme inline reference`, as the block in `src/tailwind.css` does (`bg-canvas`, `text-text-muted`, `rounded-panel`, and the rest).

## Set it up

Skip this when `src/tailwind.css` already imports the Spartan preset. That file is described above.

1. Run `ng add tailwindcss`. In this SCSS project it creates `src/tailwind.css` (`@import 'tailwindcss';`) and `.postcssrc.json`, and lists `src/tailwind.css` before `src/styles.scss` in `angular.json`. Keep Tailwind in that plain CSS file: Tailwind 4 isn't built to run through Sass.
2. Register the tokens as Tailwind theme values. They stay defined in `src/styles.scss`, dark mode included; `src/tailwind.css` only points at them. Leave out `--color-accent`. Spartan owns `bg-accent` as the hover surface, and the brand fill is `bg-primary`.

   ```css
   @import 'tailwindcss';

   /* The tokens live in src/styles.scss. This makes them Tailwind theme values without redefining them. */
   @theme inline reference {
     --color-canvas: var(--color-canvas);
     --color-surface: var(--color-surface);
     --color-text: var(--color-text);
     --color-text-muted: var(--color-text-muted);
     --color-on-accent: var(--color-on-accent);
     --color-border: var(--color-border);
     --color-field-border: var(--color-field-border);
     --color-danger: var(--color-danger);
     --font-body: var(--font-body);
     --font-code: var(--font-code);
     --radius-control: var(--radius-control);
     --radius-panel: var(--radius-panel);
   }
   ```

   That gives utilities such as `bg-canvas`, `text-on-accent`, `border-field-border`, `rounded-control`, and `font-body`. They read the same CSS variables as the SCSS, so they follow dark mode. Keep both keywords: with plain `@theme`, Tailwind declares each variable a second time, and with `inline` alone it writes `--color-canvas: var(--color-canvas)`, which works only while `src/styles.scss` loads after it.

3. Spacing already matches. Tailwind's step is 0.25rem, so `p-4` equals `var(--space-4)` (1rem) and `gap-6` equals `var(--space-6)`. Font sizes don't: Tailwind's `text-lg` and `text-xl` are smaller than the project's `--text-lg` and `--text-xl`. Register the `--text-*` tokens the same way before using `text-*` sizes.

## Preflight changes the page

Tailwind's base styles, Preflight, remove browser defaults that the template's pages rely on. Adding Tailwind to this template took the bold weight off the `h2` and `h3` headings and the underlines off the links in the footer. Compare screenshots before and after, and restore what the design needs in `src/styles.scss`, at least the underline on links inside text (WCAG 1.4.1) and the heading weights.

## Write classes

- Bind conditional classes with `[class.bg-primary]="isActive()"` or `[class]`, never `ngClass`.
- Keep focus visible, for example `focus-visible:outline-3 focus-visible:outline-primary`. Never remove an outline without a replacement. `outline-accent` is the hover surface, which is a poor focus color.
- Put animations behind `motion-safe:`, or turn them off with `motion-reduce:`.
- `sr-only` hides text visually and keeps it for screen readers, like the template's `.visually-hidden`.
- A repeated list of classes is a component waiting to be made. Use `@apply` rarely: in a component's styles, start with `@reference` and the relative path to `src/tailwind.css`, such as `@reference '../../../tailwind.css';` from `src/app/pages/home/`.
- An arbitrary value such as `p-[13px]` means a token is missing. Add it to `src/styles.scss` and register it instead.

## With other libraries and app types

- Spartan: components come from the `spartan` skill. Utilities are for layout around them. Do not restyle a Helm component by fighting the `classes()` helper with a `[class]` binding.
- Ionic: keep Ionic's components for controls and navigation, and use utilities for layout around them. Compare screenshots in both of Ionic's modes after adding Tailwind.
- Angular Material: theme Material through its tokens (`angular-material`), and use utilities for layout around its components.
- Angular Native: use `@ng-native/tailwind` instead of this setup. See [Tailwind for Angular Native](https://ng-native.com/packages/tailwind.md).

## Check the result

`ng build` (the CSS holds only the classes the templates use), axe in light and dark mode, the page used with the keyboard alone, and `ng test`.

## References

[Angular's Tailwind guide](https://angular.dev/guide/tailwind) and Tailwind's docs: [Theme variables](https://tailwindcss.com/docs/theme), [Preflight](https://tailwindcss.com/docs/preflight), [Dark mode](https://tailwindcss.com/docs/dark-mode), and [Functions and directives](https://tailwindcss.com/docs/functions-and-directives).
