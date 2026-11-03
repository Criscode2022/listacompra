---
name: angular-material
description: >-
  Add Angular Material to this project and build UI with it, themed with the
  project's design tokens. Use when the user asks for Angular Material,
  Material Design components, or a component Material provides (dialog, table,
  datepicker, autocomplete, menu, snackbar), or when package.json already has
  @angular/material. Covers ng add and the fixes it needs here, theming with
  mat.theme and the tokens, Signal Forms on Material controls, bundle size,
  tests with component harnesses, and accessibility checks.
---

# Angular Material

Angular Material is the Angular team's component library, built on the Component Dev Kit (CDK). Use it when the user asks for it or the project already has it. Otherwise, build with the project's own components, component SCSS, and tokens.

## Set it up

1. Run `ng add @angular/material`. With its defaults, it:
   - adds `@angular/material` and `@angular/cdk`,
   - puts a `mat.theme()` block at the top of `src/styles.scss`, with a `body` rule that sets `color-scheme: light`. That rule keeps Material's components light while the rest of the page follows the system's dark mode.
   - adds Google Fonts links for Roboto and Material Symbols to `src/index.html`, which makes every page load call Google.
2. Replace the generated block with a theme that follows the system's color scheme and reads this project's tokens:

   ```scss
   @use '@angular/material' as mat;

   html {
     color-scheme: light dark;
     @include mat.theme(
       (
         color: (
           primary: mat.$magenta-palette,
           tertiary: mat.$rose-palette,
         ),
         typography: (
           plain-family: var(--font-body),
           brand-family: var(--font-body),
         ),
         density: 0,
       )
     );
     @include mat.theme-overrides(
       (
         primary: var(--color-accent),
         on-primary: var(--color-on-accent),
         surface: var(--color-surface),
         on-surface: var(--color-text),
         on-surface-variant: var(--color-text-muted),
         outline: var(--color-field-border),
         outline-variant: var(--color-border),
         error: var(--color-danger),
       )
     );
     @include mat.strong-focus-indicators();
   }
   ```

   Choose the prebuilt palette closest to the accent (`mat.$magenta-palette` here): it supplies the tokens you don't override. Delete the generated `body` rule, because `src/styles.scss` already sets the page's colors and font.

3. Remove the Google Fonts links unless the user wants Roboto: the theme above uses the project's font stack. For icons, prefer inline SVG (or `MatIconRegistry.addSvgIconLiteral`) to the Material Symbols font, and ask before loading fonts from Google.

## Build with it

- Import each piece a component uses from its entry point: `MatButton` from `@angular/material/button`; `MatFormField`, `MatLabel`, and `MatError` from `@angular/material/form-field`; `MatInput` from `@angular/material/input`.
- Signal Forms work on Material controls: `<input matInput [formField]="orderForm.name">`, `<mat-select [formField]="orderForm.size">`, and `<mat-checkbox [formField]="orderForm.gift">`. A `<mat-error>` inside the field shows once the field is touched or the form is submitted.
- Give each `mat-form-field` `appearance="outline"`. It matches this project's fields, and its labels pass contrast in dark mode, while the default `fill` appearance failed axe's contrast check in dark mode with these tokens. Setting the default with `MAT_FORM_FIELD_DEFAULT_OPTIONS` works too, but only in a lazy route's or component's providers: in `app.config.ts` it moved about 150 kB of form field code into the initial bundle.
- Buttons: `matButton="filled"`, `matButton="outlined"`, `matButton` for text, and `matIconButton` with an `aria-label`.
- Customize only through tokens: `mat.theme-overrides()` for system tokens, and `mat.<component>-overrides()` for one component, such as `mat.card-overrides()`. Never style Material's internal classes; they change between versions.
- The CDK has unstyled building blocks for custom components: overlays, drag and drop, virtual scrolling, and accessibility tools such as focus traps and `LiveAnnouncer`.

## Tests

Test Material components through their harnesses (`angular-developer`, `references/component-harnesses.md`): `TestbedHarnessEnvironment.loader(fixture)`, then `MatInputHarness`, `MatSelectHarness`, `MatCheckboxHarness`, `MatButtonHarness`, and so on. They work in this project's Vitest tests.

## Check the result

1. `ng build`: Material's code belongs in the lazy chunks of the pages that use it. Watch the initial bundle.
2. axe in light and dark mode, and the keyboard alone: focus is visible on every control, and dialogs keep focus inside and return it when they close.
3. `ng test` passes.

## References

Angular Material's guides, as Markdown: [Getting started](https://github.com/angular/components/blob/main/guides/getting-started.md), [Theming](https://github.com/angular/components/blob/main/guides/theming.md), [Theming your components](https://github.com/angular/components/blob/main/guides/theming-your-components.md) (every `--mat-sys-*` variable), and [Component harnesses](https://github.com/angular/components/blob/main/guides/using-component-harnesses.md). Each component's API and styling tokens: https://material.angular.dev/components/categories
