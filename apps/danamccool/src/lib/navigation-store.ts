import { loadSiteNav, saveSiteNav } from "@elkdonis/services";
import { listPages } from "@elkdonis/page-builder/server";
import { currentOrgId } from "@/lib/site-org";
import { DEFAULT_NAV, type NavItem } from "./navigation";

// ============================================================================
// Reading and writing the navigation. Server only.
// ============================================================================

const KEY = "nav:main";

/** The stored menu (shared services store, her key); DEFAULT_NAV until it is arranged. */
export async function loadNav(): Promise<NavItem[]> {
  return loadSiteNav(currentOrgId(), { key: KEY, fallback: DEFAULT_NAV });
}

export async function saveNav(items: NavItem[]): Promise<{ ok: boolean; error?: string }> {
  return saveSiteNav(currentOrgId(), items, { key: KEY });
}

/**
 * Pages built in the editor, as candidates for the nav.
 *
 * Offered rather than added: publishing a page and having it appear in the
 * navigation unasked is how a site ends up with a link to something
 * half-finished.
 */
export async function editorPages(): Promise<Array<{ label: string; href: string }>> {
  const pages = await listPages(currentOrgId());
  return pages.map((p) =>
    // The landing page is stored as `home` but lives at "/".
    p.slug === "home"
      ? { label: "Home", href: "/" }
      : { label: p.slug.split("/").pop()!.replace(/-/g, " "), href: `/${p.slug}` }
  );
}
