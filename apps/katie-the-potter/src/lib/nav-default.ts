import type { NavItem } from "@elkdonis/services/nav-core";

/**
 * Sunjay's header shape in this site's own CSS: two links.
 * What the header shows until an editor arranges the menu (Menu tab in the
 * page editor): then the stored `nav:main` row replaces it. Client-safe.
 */
export const DEFAULT_NAV: NavItem[] = [
  { label: "Pieces", href: "/#pieces" },
  { label: "About", href: "/about" },
];
