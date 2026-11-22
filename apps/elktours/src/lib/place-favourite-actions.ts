"use server";
// A guide stars a catalogue place (design screens 12, 38). Starred places feature on Discover and on that guide's profile.
// Writes place_favourites (migrations-draft/place_favourites.sql); until it exists these return
// { ok:false, error:"available after migration" }. Reads: lib/places-public.ts.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

async function gate(placeId: string): Promise<{ userId: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only guides and the office can star places." };
  if (!UUID.test(placeId)) return { ok: false, error: "Not found." };
  const [t] = (await db`SELECT to_regclass('public.place_favourites') AS t`) as unknown as Row[];
  if (!t?.t) return { ok: false, error: "available after migration" };
  const [p] = (await db`SELECT id FROM places WHERE id = ${placeId} AND org_id = ${ORG} AND archived_at IS NULL`) as unknown as Row[];
  if (!p) return { ok: false, error: "That place is not in the catalogue." };
  return { userId: viewer.userId };
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath("/manage/places");
}

/** Star (on) or unstar (off) a place as the signed-in guide. Starring also features it on Discover. */
export async function toggleFavouritePlaceAction(placeId: string, on: boolean): Promise<Result<{ favourite: boolean; featured: boolean }>> {
  const g = await gate(placeId);
  if ("ok" in g) return g;
  if (on) {
    await db`
      INSERT INTO place_favourites (org_id, place_id, user_id, featured) VALUES (${ORG}, ${placeId}, ${g.userId}, TRUE)
      ON CONFLICT (place_id, user_id) DO UPDATE SET featured = TRUE
    `;
  } else {
    await db`DELETE FROM place_favourites WHERE place_id = ${placeId} AND user_id = ${g.userId} AND org_id = ${ORG}`;
  }
  revalidate();
  return { ok: true, favourite: on, featured: on };
}

/**
 * Feature or un-feature a starred place on Discover without un-starring it (the "Feature on Discover" switch on the
 * place edit page). Creates the guide's row if there is none. Applies to the signed-in guide's own star.
 */
export async function setFeaturedPlaceAction(placeId: string, featured: boolean): Promise<Result<{ featured: boolean }>> {
  const g = await gate(placeId);
  if ("ok" in g) return g;
  await db`
    INSERT INTO place_favourites (org_id, place_id, user_id, featured) VALUES (${ORG}, ${placeId}, ${g.userId}, ${featured})
    ON CONFLICT (place_id, user_id) DO UPDATE SET featured = EXCLUDED.featured
  `;
  revalidate();
  return { ok: true, featured };
}
