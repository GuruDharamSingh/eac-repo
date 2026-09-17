import { db } from "@elkdonis/db";
import { listPages } from "@elkdonis/page-builder/server";
import { currentOrgId } from "@/lib/site-org";
import { cleanNav, DEFAULT_NAV, type NavItem } from "./navigation";

// ============================================================================
// Reading and writing the navigation. Server only.
// ============================================================================

const KEY = "nav:main";

export async function loadNav(): Promise<NavItem[]> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config
      WHERE org_id = ${currentOrgId()} AND key = ${KEY}
      LIMIT 1
    `;
    const stored = cleanNav(row?.value);
    // An empty stored nav means "never arranged", not "deliberately empty" —
    // a site with no navigation at all is never what somebody meant.
    return stored.length > 0 ? stored : DEFAULT_NAV;
  } catch (err) {
    console.error("[danamccool] loadNav:", err);
    return DEFAULT_NAV;
  }
}

export async function saveNav(items: NavItem[]): Promise<{ ok: boolean; error?: string }> {
  const clean = cleanNav(items);
  try {
    await db`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${currentOrgId()}, ${KEY}, ${db.json(clean as never)}, NOW())
      ON CONFLICT (org_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error("[danamccool] saveNav:", err);
    return { ok: false, error: "Could not save the navigation." };
  }
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
  return pages.map((p) => ({
    label: p.slug.split("/").pop()!.replace(/-/g, " "),
    href: `/${p.slug}`,
  }));
}
