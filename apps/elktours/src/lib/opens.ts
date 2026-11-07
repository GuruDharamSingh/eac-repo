// ============================================================================
// The "Opens" grammar on this site (2026-11-06, docs/open/COMPONENT_CONNECTIONS_2026-11-06.md). Pure: the editor and
// the server read it alike. A page stores one string:
//
//   page:/walking-notes                       a page of this site
//   popup:tour:<threadId>                     the tour popup
//   popup:experience:<threadId>               the experience popup
//   popup:reviews:<tour|experience|place>:<id>   the reviews popup
//   popup:person:<userId>                     the person popup
//
// A reviews or person popup may add one onward step, `>page:/path`: a button at its foot.
// ============================================================================

export type OpensPopup =
  | { kind: "tour" | "experience"; id: string }
  | { kind: "reviews"; target: "tour" | "experience" | "place"; id: string }
  | { kind: "person"; userId: string };

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
  if ((parts[0] === "tour" || parts[0] === "experience") && parts.length === 2 && THREAD_ID.test(parts[1])) popup = { kind: parts[0], id: parts[1] };
  else if (parts[0] === "reviews" && parts.length === 3 && (parts[1] === "tour" || parts[1] === "experience" || parts[1] === "place")) {
    const ok = parts[1] === "place" ? UUID.test(parts[2]) : THREAD_ID.test(parts[2]);
    if (ok) popup = { kind: "reviews", target: parts[1], id: parts[2] };
  } else if (parts[0] === "person" && parts.length === 2 && UUID.test(parts[1])) popup = { kind: "person", userId: parts[1].toLowerCase() };
  if (!popup) return null;
  if (thenPart === undefined) return { popup };
  // Only the two new popups draw a Then button; the tour and experience popups have their own.
  if (popup.kind !== "reviews" && popup.kind !== "person") return null;
  const then = thenPart.startsWith("page:") ? parsePage(thenPart.slice(5)) : null;
  return then ? { popup, then } : null;
}

/** The button's words for an onward page, from where it goes. */
export function thenLabel(path: string): string {
  if (path.startsWith("/tours/")) return "See the tour and book";
  if (path.startsWith("/experiences/")) return "See the experience";
  if (path.startsWith("/about/")) return "Their page";
  return "Continue";
}
