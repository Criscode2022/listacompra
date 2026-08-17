/** Viewport width where the desktop shell replaces mobile/tablet chrome. */
export const DESKTOP_LAYOUT_MIN = 1200;

export const DESKTOP_LAYOUT_MQ = `(min-width: ${DESKTOP_LAYOUT_MIN}px)`;

export function matchesDesktopLayout(
  media: Pick<Window, 'matchMedia'> | null | undefined = typeof window ===
  'undefined'
    ? undefined
    : window,
): boolean {
  return Boolean(media?.matchMedia(DESKTOP_LAYOUT_MQ).matches);
}
