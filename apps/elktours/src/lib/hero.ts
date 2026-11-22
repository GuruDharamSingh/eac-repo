// Reads only (a plain server module). The write is lib/hero-actions.ts.
// CONTRACT: the guide's chosen opening kind for a tour page hero (design screens 03 and 37).
// Stored top-level at threads.metadata.heroLead, like metadata.film; no migration.
// If the lead is not available on the page, the reader falls back to the first available
// kind (film, then 3D route, then photos): that rule lives in the hero block, not here.

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;
export type HeroLead = "film" | "map3d" | "photos";
const LEADS: HeroLead[] = ["film", "map3d", "photos"];
type Row = Record<string, unknown>;

/** The stored lead for a tour, or null when the guide has not chosen one. Public. */
export async function getHeroLead(tour: { id: string } | string): Promise<HeroLead | null> {
  const id = typeof tour === "string" ? tour : tour.id;
  try {
    const [r] = (await db`
      SELECT metadata->>'heroLead' AS lead FROM threads WHERE id = ${id} AND org_id = ${ORG} AND kind = 'tour' LIMIT 1
    `) as unknown as Row[];
    const v = r?.lead as string | undefined;
    return LEADS.includes(v as HeroLead) ? (v as HeroLead) : null;
  } catch (err) {
    console.error(`[elktours] getHeroLead(${id}):`, err);
    return null;
  }
}
