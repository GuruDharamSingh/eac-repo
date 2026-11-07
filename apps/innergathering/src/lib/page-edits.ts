import { withOrg } from "@elkdonis/db";
import { cleanPatches, emptyPatches, type PagePatches } from "@elkdonis/direct-edit/block";
import { siteConfig } from "@/config/site";

// Owners' visual edits to a page live in site_config (org_id, 'page-edits:<page>').
// Reads and writes go through withOrg, so row-level security (migration 227)
// keeps them to this org's row. Each read is validated again: patchCss trusts nothing.

const keyFor = (page: string) => `page-edits:${page}`;

export async function loadPageEdits(page: string): Promise<PagePatches> {
  try {
    const rows = await withOrg(siteConfig.orgId, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${keyFor(page)} LIMIT 1
    `);
    return rows[0] ? cleanPatches(rows[0].value) : emptyPatches();
  } catch (err) {
    // The page draws without the edits rather than failing.
    console.error("[page-edits] load:", err);
    return emptyPatches();
  }
}

export async function savePageEdits(page: string, doc: PagePatches): Promise<{ ok: boolean; error?: string }> {
  try {
    await withOrg(siteConfig.orgId, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${siteConfig.orgId}, ${keyFor(page)}, ${sql.json(doc as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
    return { ok: true };
  } catch (err) {
    console.error("[page-edits] save:", err);
    return { ok: false, error: "The changes could not be saved." };
  }
}
