// ============================================================================
// The site's navigation — the DATA half, client-safe.
//
// Her nav was an array in site-header.tsx. That is fine for a site somebody
// writes in a code editor and useless for one somebody builds in Puck: you
// publish a page and nothing links to it, and there is no way to say so
// without opening the repository.
//
// Kept separate from ./navigation-store for the reason the palette had to be:
// the editor is a client component, and a module that also reaches for
// @elkdonis/db drags postgres into the browser bundle.
// ============================================================================

import { siteConfig } from "@/config/site";

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

/**
 * What the sidebar shows when nobody has arranged it yet.
 *
 * Her real nav, exactly as the site shipped with. A site with an empty stored
 * nav shows this rather than nothing — an editor who has never opened the
 * navigation screen should not be punished with a site nobody can move around.
 */
export const DEFAULT_NAV: NavItem[] = [
  { label: "Current & Upcoming", href: "/current" },
  // 2026-09-25: CV, exhibitions, biography and manifestos grouped under About
  // to shorten the sidebar; Vimeo taken off the menu (the page still exists).
  { label: "About", href: "/about" },
  { label: "CV", href: "/cv", sub: true },
  { label: "Past Exhibitions", href: "/exhibitions", sub: true },
  { label: "Biography", href: "/biography", sub: true },
  { label: "Manifestos", href: "/manifestos", sub: true },
  { label: "Elkdonis Arts", href: siteConfig.elkdonisArtsUrl, external: true },
  { label: "Collections", href: "/collections" },
  // Added 2026-09-18: her listed works, each with an enquire / buy link to the
  // marketplace. Not on her old site, which had no way to buy anything.
  { label: "Artworks", href: "/artworks" },
  { label: "Mixed Media", href: "/mixed-media" },
  { label: "Art Archive", href: "/art-archive" },
  { label: "Writing", href: "/blog" },
  { label: "Contact", href: "/contact" },
  {
    label: "IFAC / Art Collectors",
    href: `${siteConfig.ifacUrl}${siteConfig.ifacProfilePath}`,
    external: true,
  },
  { label: "Partial Gallery", href: "/gallery" },
  { label: "Commission Inquiries", href: "/commissions" },
];

const MAX_ITEMS = 40;

/**
 * Only what can be stored and rendered.
 *
 * Two shapes of href are allowed and nothing else: a site-relative path, or an
 * absolute http/https URL. Her real nav has both — two of its items point at
 * other sites in this network — so refusing off-site links outright would have
 * lost them.
 *
 * Everything else is dropped rather than escaped. A stored `javascript:` or a
 * protocol-relative `//evil.example` would be a link THE SITE ITSELF offers,
 * and "it came from the database" is not a defence. `external` is computed
 * here rather than read from the stored object, so the flag can never
 * contradict the address it describes.
 */
export function cleanNav(raw: unknown): NavItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NavItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS)) {
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
