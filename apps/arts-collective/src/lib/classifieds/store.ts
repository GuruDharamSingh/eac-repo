import { withOrg } from "@elkdonis/db";
import { CLASSIFIEDS_KEY, cleanDoc, type ClassifiedsDoc } from "./catalog";

// An org's classifieds page lives in site_config (org_id, 'classifieds:page').
// Reads and writes go through withOrg, so the database itself (row-level
// security, migration 227) keeps them to this org's row.

export async function loadClassifieds(orgId: string): Promise<ClassifiedsDoc | null> {
  try {
    const rows = await withOrg(orgId, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${CLASSIFIEDS_KEY} LIMIT 1
    `);
    return rows[0] ? cleanDoc(rows[0].value) : null;
  } catch (err) {
    console.error("[classifieds] load:", err);
    return null;
  }
}

export async function saveClassifieds(orgId: string, doc: ClassifiedsDoc): Promise<{ ok: boolean; error?: string }> {
  try {
    await withOrg(orgId, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${orgId}, ${CLASSIFIEDS_KEY}, ${sql.json(doc as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
    return { ok: true };
  } catch (err) {
    console.error("[classifieds] save:", err);
    return { ok: false, error: "Could not save the page." };
  }
}
