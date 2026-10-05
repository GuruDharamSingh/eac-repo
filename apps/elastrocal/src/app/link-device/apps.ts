/**
 * The apps that may be linked, and the only places a token is ever sent.
 * A token goes to the app's own URL scheme, never to a URL taken from the
 * request, so this page cannot be used to send a token somewhere else.
 */
export const LINK_APPS: Record<string, { name: string; returnUrl: string }> = {
  jerusalem: { name: "Jerusalem", returnUrl: "jerusalem://linked" },
};

export const cleanLabel = (s?: string) => (s ?? "").replace(/[^\p{L}\p{N} +()'._-]/gu, "").slice(0, 60);
export const cleanState = (s?: string) => (s ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
