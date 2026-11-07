// ============================================================================
// "Opens" (2026-11-06, docs/open/COMPONENT_CONNECTIONS_2026-11-06.md): where a
// block's link goes, as a reference the host reads per request. A page stores
// only `opens` (e.g. `popup:reviews:tour:<id>`); the host's resolver returns
// `opened` and the block draws an ordinary link to `opened.href` — the record's
// own page, which is what a visitor without scripts or a search engine follows.
// When the host can open the popup over the page, it reads `data-opens`.
// This package knows no records; a host without a resolver never fills `opened`.
// ============================================================================

/** What a host's resolver fills in for an `opens` reference. Draw-only. */
export interface Opened {
  /** The page the link goes to without scripts: the record's own page, or the chosen page. */
  href: string;
  /** Words for the editor: what this opens. */
  label?: string;
  /** The popup the host opens over the page instead, when it can. */
  popup?: { key: string; title?: string; kind?: string; size?: string; props?: Record<string, unknown> } | null;
}

/** Declared on every block that can open something. Typed links stay where they were; Opens, when chosen, replaces them. */
export const OPENS_PROP = {
  name: "opens",
  kind: "string",
  binds: "opens",
  label: "Opens",
  description: "A page of this site, or a popup (a tour, reviews, a person). When chosen it replaces the typed link.",
  default: "",
} as const;

const SAFE_HREF = /^(\/(?!\/)[^\s"<>]*|https:\/\/[^\s"<>]+)$/;

/** The link's attributes for a resolved Opens, or null when there is nothing safe to draw. */
export function openedAttrs(o: Opened | null | undefined): { href: string; "data-opens"?: string } | null {
  if (!o || typeof o.href !== "string" || !SAFE_HREF.test(o.href)) return null;
  const popup = o.popup && typeof o.popup.key === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(o.popup.key) ? o.popup : null;
  return popup ? { href: o.href, "data-opens": JSON.stringify(popup) } : { href: o.href };
}
