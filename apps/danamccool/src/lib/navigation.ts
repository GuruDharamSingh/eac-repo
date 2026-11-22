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
// The model and its rules (NavItem, groupNav, cleanNav) are the platform's now:
// @elkdonis/services/nav-core, shared with every site (2026-11-20).
import type { NavItem } from "@elkdonis/services/nav-core";

export { cleanNav, groupNav } from "@elkdonis/services/nav-core";
export type { NavItem, NavGroup } from "@elkdonis/services/nav-core";

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
