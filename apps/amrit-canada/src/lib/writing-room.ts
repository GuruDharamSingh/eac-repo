/**
 * The writing room (/write): shared names for the page, its actions and the
 * landing-page redirect.
 *
 * Set by /write/leave. A session cookie, so a writer who chose "View site"
 * sees the landing page until the browser closes, and lands in the room again
 * on the next visit.
 */
export const SITE_VIEW_COOKIE = "amrit_site_view";
