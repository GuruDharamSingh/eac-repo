"use server";
// The hero lead write (design screen 37). The read, HeroLead and getHeroLead are in lib/hero.ts.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";
import type { HeroLead } from "@/lib/hero";

const ORG = siteConfig.orgId;
const LEADS: HeroLead[] = ["film", "map3d", "photos"];
type Row = Record<string, unknown>;

/** Editors only. `null` clears the choice. */
export async function setHeroLeadAction(tourId: string, lead: HeroLead | null): Promise<Result<{ lead: HeroLead | null }>> {
  await requireOrgEditor("/manage");
  if (lead !== null && !LEADS.includes(lead)) return { ok: false, error: "Unknown hero kind." };
  const rows = (await (lead === null
    ? db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) - 'heroLead', updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' RETURNING slug`
    : db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('heroLead', ${lead}::text), updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' RETURNING slug`)) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "That tour is not on this site." };
  revalidatePath(`/tours/${rows[0].slug as string}`);
  return { ok: true, lead };
}

/** A site media path or an https link, nothing that could break out of a url() or an attribute. */
const COVER_URL = /^(?:\/api\/media\/|https:\/\/)[^\s"'()<>\\]{1,480}$/;

/** A focal point (0-100) and a zoom (1-4), or null for centred; anything else is refused. */
function cleanFrame(f: unknown): { fx: number; fy: number; zoom: number } | null | "bad" {
  if (f == null) return null;
  if (typeof f !== "object") return "bad";
  const o = f as Record<string, unknown>;
  const ok = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  if (!ok(o.fx, 0, 100) || !ok(o.fy, 0, 100) || !ok(o.zoom, 1, 4)) return "bad";
  const r = (x: number) => Math.round(x * 10) / 10;
  const out = { fx: r(o.fx as number), fy: r(o.fy as number), zoom: r(o.zoom as number) };
  return out.fx === 50 && out.fy === 50 && out.zoom === 1 ? null : out;
}

/**
 * The tour's cover photo (metadata.coverImageUrl) and how it is framed (metadata.coverFrame), from the phone Tour
 * page media screen (2026-11-17). Editors only. `url: null` clears both, and the tour page then opens on the 3D route;
 * `frame: null` stores none (centred). Merges, so other metadata keys stay.
 */
export async function setTourCoverAction(tourId: string, url: string | null, frame?: unknown): Promise<Result<{ url: string | null }>> {
  const viewer = await requireOrgEditor("/manage");
  const clean = typeof url === "string" ? url.trim() : null;
  if (clean && !COVER_URL.test(clean)) return { ok: false, error: "That picture address is not usable." };
  const f = cleanFrame(frame);
  if (f === "bad") return { ok: false, error: "That framing is not usable." };
  // Owners change any tour; a guide only the tours they wrote (the rule lib/slot-actions.ts keeps).
  const anyTour = viewer.role === "owner";
  const rows = (await (clean
    ? db`UPDATE threads SET metadata = (COALESCE(metadata, '{}'::jsonb) - 'coverFrame') || jsonb_build_object('coverImageUrl', ${clean}::text)
             || CASE WHEN ${f === null}::boolean THEN '{}'::jsonb ELSE jsonb_build_object('coverFrame', ${db.json(f ?? {})}::jsonb) END,
           updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' AND (${anyTour}::boolean OR author_id = ${viewer.userId}) RETURNING slug`
    : db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl' - 'coverFrame', updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' AND (${anyTour}::boolean OR author_id = ${viewer.userId}) RETURNING slug`)) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: anyTour ? "That tour is not on this site." : "That tour is not yours." };
  revalidatePath(`/tours/${rows[0].slug as string}`);
  revalidatePath("/tours");
  revalidatePath("/");
  return { ok: true, url: clean || null };
}
