import { withOrg } from "@elkdonis/db";
import { getThemeOverrides, saveSiteTheme } from "@elkdonis/services";
import { cleanSiteStyle, type SiteStyle } from "@elkdonis/direct-edit/site";
import { siteConfig } from "@/config/site";
import { SITE_STYLE } from "./site-style-schema";

// The site's style (2026-11-06): theme values in site_themes (page_key ''), the
// header and footer looks in site_config 'site-style:chrome'. Both are cleaned
// against SITE_STYLE on the way in and on the way out. Server only.

const CHROME_KEY = "site-style:chrome";
const ORG = siteConfig.orgId;

export async function loadSiteStyle(): Promise<SiteStyle | null> {
  const [theme, rows] = await Promise.all([
    getThemeOverrides({ orgId: ORG }).catch(() => ({})),
    withOrg(ORG, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${CHROME_KEY} LIMIT 1
    `).catch((err) => { console.error("[site-style] load:", err); return []; }),
  ]);
  return cleanSiteStyle({ theme, chrome: rows[0]?.value }, SITE_STYLE);
}

/** The caller has already checked the editor's role. */
export async function saveSiteStyle(raw: unknown, userId: string): Promise<{ ok: boolean; error?: string }> {
  const clean = cleanSiteStyle(raw, SITE_STYLE);
  const theme = await saveSiteTheme(ORG, "", clean?.theme ?? {}, userId);
  if (!theme.ok) return theme;
  try {
    await withOrg(ORG, (sql) => clean?.chrome
      ? sql`
          INSERT INTO site_config (org_id, key, value)
          VALUES (${ORG}, ${CHROME_KEY}, ${sql.json(clean.chrome as never)})
          ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `
      : sql`DELETE FROM site_config WHERE org_id = ${ORG} AND key = ${CHROME_KEY}`);
    return { ok: true };
  } catch (err) {
    console.error("[site-style] save:", err);
    return { ok: false, error: "Could not save the header and footer." };
  }
}
