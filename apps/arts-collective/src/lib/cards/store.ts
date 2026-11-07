import { withOrg } from "@elkdonis/db";
import { CARDS_KEY, cleanCards, type CardsDoc } from "./catalog";

// An org's feed-card design lives in site_config (org_id, 'cards:feed').
// Reads and writes go through withOrg, so the database itself (row-level
// security, migration 227) keeps them to this org's row.

export async function loadCards(orgId: string): Promise<CardsDoc | null> {
  try {
    const rows = await withOrg(orgId, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${CARDS_KEY} LIMIT 1
    `);
    return rows[0] ? cleanCards(rows[0].value) : null;
  } catch (err) {
    console.error("[cards] load:", err);
    return null;
  }
}

export async function saveCards(orgId: string, doc: CardsDoc): Promise<{ ok: boolean; error?: string }> {
  try {
    await withOrg(orgId, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${orgId}, ${CARDS_KEY}, ${sql.json(doc as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
    return { ok: true };
  } catch (err) {
    console.error("[cards] save:", err);
    return { ok: false, error: "Could not save the card design." };
  }
}
