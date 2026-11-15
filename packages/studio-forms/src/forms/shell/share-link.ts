// ============================================================================
// The link a person copies after publishing (2026-11-14): the page's own absolute
// address. A host's `viewHref` may return a sign-in hand-off
// (`/api/auth/handoff?to=<site>&next=<path>`) so that "View on site" carries the
// session to another site. That is the right thing to OPEN, but the wrong thing to
// give anyone: it is relative, and it names the network host's sign-in route.
// So the copy field shows where the hand-off ends: `to`'s origin plus `next`.
// Anything else relative is made absolute against this page; an absolute link is
// left as it is. Pure apart from reading `window.location` when no base is given.
// ============================================================================

const HANDOFF = /\/api\/auth\/handoff\/?$/;

/** A same-site path for `next`: starts with one slash, not two, and no backslash trick. */
const safePath = (p: string | null): string | null => (p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : null);

export function shareableLink(href: string, base?: string): string {
  const origin = base ?? (typeof window !== "undefined" ? window.location.origin : null);
  let url: URL;
  try {
    url = origin ? new URL(href, origin) : new URL(href);
  } catch {
    return href; // relative with no page to resolve it against (server render): leave it
  }
  if (HANDOFF.test(url.pathname)) {
    const to = url.searchParams.get("to");
    if (to) {
      try {
        const dest = new URL(to);
        if (dest.protocol === "https:" || dest.protocol === "http:") {
          const path = safePath(url.searchParams.get("next")) ?? `${dest.pathname}${dest.search}`;
          return new URL(path, dest.origin).toString();
        }
      } catch {
        /* not a hand-off we can read: fall through */
      }
    }
  }
  return url.toString();
}
