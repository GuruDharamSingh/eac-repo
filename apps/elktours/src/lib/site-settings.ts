import { withOrg } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";
import { PREVIEW_REFUSAL, fixturesOn } from "@/lib/tour-slot-fixtures";
import { siteConfig } from "@/config/site";

/**
 * Site-wide settings of elktours, one `site_config` row (key `elktours:settings`,
 * migration 045). Read by anyone on the server; saved by an owner only.
 *
 *   belowMinimumRule  what happens to a departure that closes below its
 *                     minimum: the guide decides (default) or it is cancelled
 *                     and refunded automatically.
 *   holdGuidePosts    guides' feed posts wait for the office before they go
 *                     public (default true).
 *
 * Server only. Not a "use server" file: call `saveSiteSettings` from a server
 * action that has already decided it is the right moment to save.
 */

export type BelowMinimumRuleSetting = "guide_decides" | "auto_cancel";

export interface SiteSettings {
  belowMinimumRule: BelowMinimumRuleSetting;
  holdGuidePosts: boolean;
}

const KEY = "elktours:settings";
const ORG = siteConfig.orgId;

const DEFAULTS: SiteSettings = { belowMinimumRule: "guide_decides", holdGuidePosts: true };

/** Anything stored is cleaned against the defaults, so a hand-edited row cannot break a page. */
function clean(raw: unknown): SiteSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    belowMinimumRule: r.belowMinimumRule === "auto_cancel" ? "auto_cancel" : DEFAULTS.belowMinimumRule,
    holdGuidePosts: typeof r.holdGuidePosts === "boolean" ? r.holdGuidePosts : DEFAULTS.holdGuidePosts,
  };
}

/** The site's settings; the defaults when nothing is saved or the read fails. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const rows = await withOrg(ORG, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${KEY} LIMIT 1
    `);
    return clean(rows[0]?.value);
  } catch (err) {
    console.error("[elktours] getSiteSettings:", err);
    return { ...DEFAULTS };
  }
}

/** Merge `patch` over the saved settings. Owner only; guides get a sentence. */
export async function saveSiteSettings(
  patch: Partial<SiteSettings>
): Promise<{ ok: true; settings: SiteSettings } | { ok: false; error: string }> {
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const viewer = await getViewer().catch(() => null);
  if (!viewer || viewer.role !== "owner") return { ok: false, error: "Only an owner can change the site settings." };
  if (patch.belowMinimumRule !== undefined && patch.belowMinimumRule !== "guide_decides" && patch.belowMinimumRule !== "auto_cancel") {
    return { ok: false, error: "Choose who decides when a slot is below its minimum." };
  }
  if (patch.holdGuidePosts !== undefined && typeof patch.holdGuidePosts !== "boolean") {
    return { ok: false, error: "Holding guide posts is on or off." };
  }
  const next = clean({ ...(await getSiteSettings()), ...patch });
  try {
    await withOrg(ORG, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${ORG}, ${KEY}, ${sql.json(next as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
    return { ok: true, settings: next };
  } catch (err) {
    console.error("[elktours] saveSiteSettings:", err);
    return { ok: false, error: "Could not save the settings." };
  }
}
