/**
 * The path prefix this app is served under — "" normally, "/astro" when it is
 * surfaced inside another site (arts-collective.com/astro).
 *
 * next/link and the client router prefix basePath themselves. Everything
 * else that builds a URL by hand — fetch(), window.location, history.replaceState,
 * redirect() — must go through withBase().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
