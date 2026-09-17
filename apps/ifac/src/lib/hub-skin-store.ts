import { db } from "@elkdonis/db";
import { DEFAULT_HUB_SKIN, isHubSkin, type HubSkin } from "./hub-skin";

// ============================================================================
// Reading and writing the org's chosen skin. SERVER ONLY — it imports the
// database client. The list of skins is in ./hub-skin, which a client
// component may import; this file is what must not be.
//
// One `site_config` row, the same key/value store that already holds the
// whiteboard scene, org documents and Puck pages. `site_config` has no
// generic accessor in @elkdonis/services yet — four call sites hand-roll this
// same pair of queries — which is worth lifting when a second app wants
// skins. Kept local until then rather than rebuilding the services dist.
// ============================================================================

const CONFIG_KEY = "hub:skin";

/**
 * The org's chosen skin.
 *
 * Never throws: a hub that cannot read its own preference should render in the
 * default look, not fail. The value is validated rather than trusted, so a row
 * naming a skin that no longer exists falls back instead of emitting a
 * `data-hub-skin` nothing styles.
 */
export async function getHubSkin(orgId: string): Promise<HubSkin> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config
      WHERE org_id = ${orgId} AND key = ${CONFIG_KEY}
      LIMIT 1
    `;
    // Stored as a JSON object rather than a bare string: `value` is jsonb and
    // a future skin will want options (a density, a hero on/off) beside it.
    const skin = (row?.value as { skin?: unknown } | undefined)?.skin;
    return isHubSkin(skin) ? skin : DEFAULT_HUB_SKIN;
  } catch (error) {
    console.error("[ifac] getHubSkin:", error);
    return DEFAULT_HUB_SKIN;
  }
}

export async function setHubSkin(orgId: string, skin: HubSkin): Promise<void> {
  if (!isHubSkin(skin)) throw new Error(`Unknown hub skin: ${skin}`);
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${orgId}, ${CONFIG_KEY}, ${db.json({ skin })}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
  `;
}
