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
  { label: "CV", href: "/cv" },
  { label: "Elkdonis Arts", href: siteConfig.elkdonisArtsUrl, external: true },
  { label: "Manifestos", href: "/manifestos" },
  { label: "Collections", href: "/collections" },
  // Added 2026-09-18: her listed works, each with an enquire / buy link to the
  // marketplace. Not on her old site, which had no way to buy anything.
  { label: "Artworks", href: "/artworks" },
  { label: "Mixed Media", href: "/mixed-media" },
  { label: "Past Exhibitions", href: "/exhibitions" },
  { label: "Vimeo", href: "/vimeo" },
  { label: "Art Archive", href: "/art-archive" },
  { label: "Biography", href: "/biography" },
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

    if (href.startsWith("//")) continue; // protocol-relative: off-site in disguise
    if (href.startsWith("/")) {
      out.push({ label, href });
      continue;
    }
    try {
      const url = new URL(href);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      out.push({ label, href, external: true });
    } catch {
      // Not a path and not a URL.
    }
  }
  return out;
}
