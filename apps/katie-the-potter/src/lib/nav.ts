import { loadSiteNav, type NavItem } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { DEFAULT_NAV } from "./nav-default";

/** The site menu: the stored `nav:main` row, else DEFAULT_NAV. Server only. */
export function loadNav(): Promise<NavItem[]> {
  return loadSiteNav(siteConfig.orgId, { fallback: DEFAULT_NAV });
}
