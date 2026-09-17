import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { cleanPalette, type Palette } from "./theme";

// ============================================================================
// Reading and writing the palette.
//
// Server only — importing this pulls @elkdonis/db, and therefore postgres, in.
// Everything a client component needs is in ./theme.
// ============================================================================

const KEY = "theme:palette";

export async function loadPalette(): Promise<Palette> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config
      WHERE org_id = ${siteConfig.orgId} AND key = ${KEY}
      LIMIT 1
    `;
    return cleanPalette(row?.value);
  } catch (err) {
    console.error("[danamccool] loadPalette:", err);
    return {};
  }
}

export async function savePalette(palette: Palette): Promise<{ ok: boolean; error?: string }> {
  const clean = cleanPalette(palette);
  try {
    await db`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${siteConfig.orgId}, ${KEY}, ${db.json(clean as never)}, NOW())
      ON CONFLICT (org_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error("[danamccool] savePalette:", err);
    return { ok: false, error: "Could not save the palette." };
  }
}
