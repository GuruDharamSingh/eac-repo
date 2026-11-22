import type { NavItem } from "@elkdonis/services/nav-core";

/**
 * Three pages in the nav (developer, 2026-11-02); the series is reached from the landing and Community.
 * What the header shows until an editor arranges the menu (Menu tab in the
 * page editor): then the stored `nav:main` row replaces it. Client-safe.
 */
export const DEFAULT_NAV: NavItem[] = [
  { label: "About", href: "/about" },
  { label: "Publications", href: "/publications" },
  { label: "Community", href: "/community" },
];
