// CONTRACT: experience page layout loader/saver (server only): metadata.page, else site_config puck:experience-detail, else the default.
import { db } from "@elkdonis/db";
import {
  DEFAULT_EXPERIENCE_LAYOUT,
  EXPERIENCE_LAYOUT_KEY,
  readExperienceLayout,
  type ExperienceLayoutData,
} from "@/blocks/experience/layout-data";
import { siteConfig } from "@/config/site";

/** The site default experience layout (site_config puck:experience-detail), or the built-in one. */
export async function loadExperienceLayout(): Promise<ExperienceLayoutData> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${EXPERIENCE_LAYOUT_KEY} LIMIT 1
    `) as unknown as { value: unknown }[];
    return readExperienceLayout(row?.value) ?? DEFAULT_EXPERIENCE_LAYOUT;
  } catch (err) {
    console.error("[elktours] loadExperienceLayout:", err);
    return DEFAULT_EXPERIENCE_LAYOUT;
  }
}

/** The layout for one experience: its own metadata.page when valid, else the site default. */
export async function resolveExperienceLayout(page: unknown | null): Promise<ExperienceLayoutData> {
  return readExperienceLayout(page) ?? (await loadExperienceLayout());
}

/** Write the site default (editor-checked by the caller). Null removes it. */
export async function saveExperienceLayout(value: ExperienceLayoutData | null): Promise<void> {
  if (value === null) {
    await db`DELETE FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${EXPERIENCE_LAYOUT_KEY}`;
    return;
  }
  const clean = readExperienceLayout(value);
  if (!clean) throw new Error("That is not an experience layout.");
  await db`
    INSERT INTO site_config (org_id, key, value) VALUES (${siteConfig.orgId}, ${EXPERIENCE_LAYOUT_KEY}, ${db.json(clean as never)})
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value
  `;
}
