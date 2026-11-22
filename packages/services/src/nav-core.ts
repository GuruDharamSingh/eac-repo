// ============================================================================
// The site menu's DATA shape and rules — pure, client-safe (no database).
//
// Lifted from danamccool's lib/navigation.ts (2026-11-20) so every site shares
// one menu model. Her stored `nav:main` row is read exactly as it is.
// Import from "@elkdonis/services/nav-core" in client code; the database half
// is ./nav.
// ============================================================================

export interface NavItem {
  label: string;
  /** A site-relative path — "/about" — or a full https:// address. */
  href: string;
  /** True for an off-site link. Derived on the way in, never trusted from the
   *  stored value, so it cannot disagree with the href it describes. */
  external?: boolean;
  /** Listed under the nearest link above that is not itself `sub`. Stored flat
   *  so the editor can reorder with the same up/down buttons; groupNav() turns
   *  the run into a submenu. One level only. */
  sub?: boolean;
}

export interface NavGroup {
  item: NavItem;
  children: NavItem[];
}

/** Folds each run of `sub` links under the top-level link before it. */
export function groupNav(items: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of items) {
    const parent = groups[groups.length - 1];
    if (item.sub && parent) parent.children.push(item);
    else groups.push({ item: { ...item, sub: undefined }, children: [] });
  }
  return groups;
}

export const NAV_MAX_ITEMS = 40;

/**
 * Only what can be stored and rendered.
 *
 * Two shapes of href are allowed and nothing else: a site-relative path, or an
 * absolute http/https URL. Everything else (`javascript:`, protocol-relative
 * `//evil.example`) is dropped rather than escaped: a stored link is one THE
 * SITE ITSELF offers. `external` is computed here, never read from storage.
 */
export function cleanNav(raw: unknown): NavItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NavItem[] = [];
  for (const entry of raw.slice(0, NAV_MAX_ITEMS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const label = String((entry as NavItem).label ?? "").trim().slice(0, 60);
    const href = String((entry as NavItem).href ?? "").trim().slice(0, 200);
    if (!label || !href) continue;
    // A sub-link needs a parent above it; the first link cannot be one.
    const sub = (entry as NavItem).sub === true && out.length > 0 ? { sub: true } : {};

    if (href.startsWith("//")) continue; // protocol-relative: off-site in disguise
    if (href.startsWith("/")) {
      out.push({ label, href, ...sub });
      continue;
    }
    try {
      const url = new URL(href);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      out.push({ label, href, external: true, ...sub });
    } catch {
      // Not a path and not a URL.
    }
  }
  return out;
}
