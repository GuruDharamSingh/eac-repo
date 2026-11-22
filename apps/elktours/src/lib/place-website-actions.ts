"use server";
// The place's website (design screen 38). savePlaceAction has no website field; the website lives in place_links
// (kind 'website', source 'manual'), which the public place reads already prefer over scripted ones. Editors only.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

/** Set the website (adds https:// when missing). An empty address removes the hand-set one. */
export async function setPlaceWebsiteAction(placeId: string, url: string): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(placeId)) return { ok: false, error: "Not found." };
  const [p] = (await db`SELECT id FROM places WHERE id = ${placeId} AND org_id = ${ORG}`) as unknown as Row[];
  if (!p) return { ok: false, error: "Not found." };
  const raw = (url ?? "").trim();
  if (!raw) {
    await db`UPDATE place_links SET confident = false, rejected_at = NOW(), updated_at = NOW() WHERE place_id = ${placeId} AND kind = 'website' AND source = 'manual'`;
  } else {
    let full = raw.includes("://") ? raw : `https://${raw}`;
    try {
      const u = new URL(full);
      if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) throw new Error("bad");
      full = u.toString();
    } catch {
      return { ok: false, error: "That does not look like a web address." };
    }
    await db`
      INSERT INTO place_links (place_id, kind, url, source, source_ref, confident, evidence)
      VALUES (${placeId}, 'website', ${full}, 'manual', ${null}, true, ${db.json({ setBy: "place edit" } as never)})
      ON CONFLICT (place_id, kind, source) DO UPDATE SET url = EXCLUDED.url, confident = true, rejected_at = NULL, updated_at = NOW()
    `;
  }
  revalidatePath("/manage/places");
  revalidatePath(`/manage/places/${placeId}`);
  revalidatePath("/places");
  return { ok: true };
}
