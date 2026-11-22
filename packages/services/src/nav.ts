import { db } from "@elkdonis/db";
import { cleanNav, type NavItem } from "./nav-core";

// ============================================================================
// Reading and writing a site's menu. Server only; plain functions.
//
// The caller gates who may save (requireOrgEditor / canEdit) and revalidates
// (revalidatePath("/", "layout") — the menu is in the root layout).
// Stored in site_config as (org_id, key = "nav:main") -> a JSON array of
// NavItem, the shape danamccool's Menu tab has always written.
// ============================================================================

export const DEFAULT_NAV_KEY = "nav:main";

/**
 * The stored menu, or `fallback` when nothing usable is stored. An empty stored
 * nav means "never arranged", not "deliberately empty": a site with no menu at
 * all is never what somebody meant.
 */
export async function loadSiteNav(
  orgId: string,
  opts: { key?: string; fallback?: NavItem[] } = {}
): Promise<NavItem[]> {
  const key = opts.key ?? DEFAULT_NAV_KEY;
  const fallback = opts.fallback ?? [];
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config
      WHERE org_id = ${orgId} AND key = ${key}
      LIMIT 1
    `;
    const stored = cleanNav(row?.value);
    return stored.length > 0 ? stored : fallback;
  } catch (err) {
    console.error("[nav] loadSiteNav:", err);
    return fallback;
  }
}

export async function saveSiteNav(
  orgId: string,
  items: NavItem[],
  opts: { key?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const key = opts.key ?? DEFAULT_NAV_KEY;
  const clean = cleanNav(items);
  try {
    await db`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${orgId}, ${key}, ${db.json(clean as never)}, NOW())
      ON CONFLICT (org_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error("[nav] saveSiteNav:", err);
    return { ok: false, error: "Could not save the navigation." };
  }
}
