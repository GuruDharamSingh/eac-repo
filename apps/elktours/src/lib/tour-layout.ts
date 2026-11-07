import { db } from "@elkdonis/db";
import { DEFAULT_TOUR_LAYOUT, readTourLayout, type TourLayoutData } from "@/blocks/tour/layout-data";
import { siteConfig } from "@/config/site";

/**
 * Store for the tour page layout: one Puck document per site in
 * `site_config(org_id, key, value)` under `puck:tour-detail`, the key and
 * table @elkdonis/page-builder's store uses for org pages (packages/page-builder/src/store.ts),
 * so its loadPage/savePage can take over when the editor is mounted.
 * No row, or a malformed one, draws the default layout.
 */
export const TOUR_LAYOUT_KEY = "puck:tour-detail";

export async function loadTourLayout(): Promise<TourLayoutData> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${TOUR_LAYOUT_KEY} LIMIT 1
    `) as unknown as { value: unknown }[];
    return readTourLayout(row?.value) ?? DEFAULT_TOUR_LAYOUT;
  } catch (err) {
    console.error("[elktours] loadTourLayout:", err);
    return DEFAULT_TOUR_LAYOUT;
  }
}
