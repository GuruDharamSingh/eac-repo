// ============================================================================
// The "Opens" grammar on Para Theater (2026-11-07; elktours' model, docs/open/COMPONENT_CONNECTIONS_2026-11-06.md).
// Pure: the editor and the server read it alike. A page stores one string:
//
//   page:/writing                  a page of this site
//   popup:thread:<threadId>        a gathering, series or piece of writing, in the site's own thread popup
//   popup:person:<userId>          the person popup
//
// The person popup may add one onward step, `>page:/path`: a button at its foot. The thread popup has its own.
// ============================================================================

export type OpensPopup = { kind: "thread"; id: string } | { kind: "person"; userId: string };

export type OpensRef = { page: string; then?: undefined } | { popup: OpensPopup; then?: string };

const THREAD_ID = /^[A-Za-z0-9_-]{1,21}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A path on this site: one or more segments, no scheme, no `//`, no quotes or spaces. */
const PATH = /^\/(?!\/)[A-Za-z0-9._~%/-]{0,200}(#[A-Za-z0-9_-]{1,60})?$/;

export function parsePage(v: string): string | null {
  return PATH.test(v) && !v.includes("..") ? v : null;
}

export function parseOpens(raw: unknown): OpensRef | null {
  if (typeof raw !== "string") return null;
  const [head, thenPart, extra] = raw.trim().split(">");
  if (extra !== undefined || !head) return null;
  if (head.startsWith("page:")) {
    if (thenPart !== undefined) return null;
    const page = parsePage(head.slice(5));
    return page ? { page } : null;
  }
  if (!head.startsWith("popup:")) return null;
  const parts = head.slice(6).split(":");
  let popup: OpensPopup | null = null;
  if (parts[0] === "thread" && parts.length === 2 && THREAD_ID.test(parts[1]!)) popup = { kind: "thread", id: parts[1]! };
  else if (parts[0] === "person" && parts.length === 2 && UUID.test(parts[1]!)) popup = { kind: "person", userId: parts[1]!.toLowerCase() };
  if (!popup) return null;
  if (thenPart === undefined) return { popup };
  if (popup.kind !== "person") return null;
  const then = thenPart.startsWith("page:") ? parsePage(thenPart.slice(5)) : null;
  return then ? { popup, then } : null;
}

/** The button's words for an onward page, from where it goes. */
export function thenLabel(path: string): string {
  if (path.startsWith("/series/")) return "See the series";
  if (path.startsWith("/gatherings/")) return "See the gathering";
  if (path.startsWith("/writing/")) return "Read it";
  if (path.startsWith("/about/")) return "Their page";
  return "Continue";
}
