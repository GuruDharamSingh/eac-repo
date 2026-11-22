/**
 * The phone-layout documents (G2, 2026-11-15). Each is a site_config row `puck:<key>`, separate from the desktop
 * document of the same screen, so editing one layout never changes the other. No imports: reserved.ts, the studio
 * route and the save action all read it.
 */
export const MOBILE_KEYS = [
  "m-discover",
  "m-tours",
  "m-experiences",
  "m-about",
  "m-places",
  "m-people",
  "m-feed",
  "m-tour-detail",
  "m-experience-detail",
] as const;

export type MobileKey = (typeof MOBILE_KEYS)[number];

export const isMobileKey = (s: string): s is MobileKey => (MOBILE_KEYS as readonly string[]).includes(s);

/** The public path each phone document draws on, so a save can refresh it. */
export const MOBILE_PATH: Record<MobileKey, string> = {
  "m-discover": "/",
  "m-tours": "/tours",
  "m-experiences": "/experiences",
  "m-about": "/about",
  "m-places": "/places",
  "m-people": "/people",
  "m-feed": "/feed",
  "m-tour-detail": "/tours",
  "m-experience-detail": "/experiences",
};

/** The phone canvas: the design's frame width. */
export const PHONE_WIDTH = 390;
