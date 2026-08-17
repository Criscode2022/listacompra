import { DESKTOP_LAYOUT_MQ, DESKTOP_LAYOUT_MIN, matchesDesktopLayout } from './breakpoints';

describe('breakpoints', () => {
  it('uses 1200px as the desktop layout cutoff', () => {
    expect(DESKTOP_LAYOUT_MIN).toBe(1200);
    expect(DESKTOP_LAYOUT_MQ).toBe('(min-width: 1200px)');
  });

  it('matchesDesktopLayout reads the current viewport query', () => {
    const media = {
      matchMedia: (query: string) =>
        ({
          matches: query === DESKTOP_LAYOUT_MQ,
        }) as MediaQueryList,
    };

    expect(matchesDesktopLayout(media)).toBeTrue();
    expect(
      matchesDesktopLayout({
        matchMedia: () => ({ matches: false }) as MediaQueryList,
      }),
    ).toBeFalse();
  });
});
