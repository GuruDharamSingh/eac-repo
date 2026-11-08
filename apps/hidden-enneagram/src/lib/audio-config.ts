import { withOrg } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { AUDIO_KEY, cleanAudioConfig, DEFAULT_AUDIO, type AudioConfig } from "./audio-config-schema";

// ============================================================================
// Load and save Ario's sound settings (site_config `he-audio`, this org only).
// The caller of saveAudioConfig has already checked the editor's role
// (lib/audio-config-actions.ts). Schema and cleaning: audio-config-schema.ts.
// ============================================================================

const ORG = siteConfig.orgId;

export async function loadAudioConfig(): Promise<AudioConfig> {
  try {
    const rows = await withOrg(ORG, (sql) => sql<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${AUDIO_KEY} LIMIT 1
    `);
    return rows[0] ? cleanAudioConfig(rows[0].value) : DEFAULT_AUDIO;
  } catch (err) {
    console.error("[hidden-enneagram] audio config load:", err);
    return DEFAULT_AUDIO;
  }
}

export async function saveAudioConfig(raw: unknown): Promise<{ ok: boolean; error?: string; config?: AudioConfig }> {
  const clean = cleanAudioConfig(raw);
  try {
    await withOrg(ORG, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${ORG}, ${AUDIO_KEY}, ${sql.json(clean as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
    return { ok: true, config: clean };
  } catch (err) {
    console.error("[hidden-enneagram] audio config save:", err);
    return { ok: false, error: "Could not save the music settings." };
  }
}
