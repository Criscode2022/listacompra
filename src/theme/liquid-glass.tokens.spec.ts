/**
 * Structural unit tests for the shipped liquid-glass design tokens.
 * Reads the real theme partial so regressions in glass tokens fail CI.
 */
describe('liquid-glass design tokens (shipped source)', () => {
  // Inline critical token names that must remain in theme/_liquid-glass.scss.
  // Values are asserted against the real file content loaded at build/test time
  // via a minimal fetch of the stylesheet text through XHR is not reliable in Karma
  // without assets config — instead we re-export token contracts here that mirror
  // the source of truth and verify the source file was bundled into styles.

  const REQUIRED_CSS_VARS = [
    '--glass-bg',
    '--glass-blur',
    '--glass-blur-strong',
    '--glass-border',
    '--glass-shadow',
    '--surface-card',
    '--surface-radius',
    '--apple-blue',
    '--apple-grouped-bg',
    '--ease-spring',
  ];

  it('defines liquid-glass CSS custom properties on :root after theme load', () => {
    // Theme styles are loaded globally via angular.json styles entry.
    // Probe computed styles on documentElement for presence of tokens.
    const styles = getComputedStyle(document.documentElement);
    const present = REQUIRED_CSS_VARS.filter((name) => {
      const value = styles.getPropertyValue(name).trim();
      return value.length > 0;
    });

    // At least the core glass tokens must resolve (build injects variables.scss).
    expect(present.length)
      .withContext(
        `Expected glass tokens on :root, found: ${present.join(', ') || '(none)'}`,
      )
      .toBeGreaterThanOrEqual(6);

    REQUIRED_CSS_VARS.forEach((name) => {
      const value = styles.getPropertyValue(name).trim();
      expect(value.length)
        .withContext(`Token ${name} must be non-empty on :root`)
        .toBeGreaterThan(0);
    });
  });

  it('uses Apple system blue as primary accent token', () => {
    const styles = getComputedStyle(document.documentElement);
    const blue = styles.getPropertyValue('--apple-blue').trim();
    const primary = styles.getPropertyValue('--ion-color-primary').trim();
    expect(blue.toLowerCase()).toBe('#007aff');
    expect(primary.toLowerCase()).toBe('#007aff');
  });

  it('exposes backdrop-capable glass blur tokens', () => {
    const styles = getComputedStyle(document.documentElement);
    const blur = styles.getPropertyValue('--glass-blur').trim();
    const blurStrong = styles.getPropertyValue('--glass-blur-strong').trim();
    expect(blur).toContain('blur(');
    expect(blurStrong).toContain('blur(');
  });
});
