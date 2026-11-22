"use server";
// Personal takes (hub card, 2026-11-19): an owner or guide writes their own notes on a tour and on each of its
// stops (tour_guide_takes). Each person edits only their own. Shown on the tour page with that guide's runs
// (lib/guide-takes.ts publicTakesFor).

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { listTourStops } from "@elkdonis/commerce/server";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { getTourById, listTours } from "@/lib/tours";
import { mapTake, type GuideTake } from "@/lib/guide-takes";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

export interface TakesSheet {
  tours: Array<{ id: string; title: string; status: string }>;
  tour: { id: string; title: string; slug: string } | null;
  stops: Array<{ id: string; title: string; body: string | null }>;
  /** The viewer's takes on this tour, by stop id ("" = the whole tour). */
  mine: Record<string, GuideTake>;
  /** Whether the viewer has an upcoming run of this tour (their takes show only then). */
  leadsARun: boolean;
}

export async function getTakesSheetAction(tourId?: string | null): Promise<TakesSheet> {
  const viewer = await requireOrgEditor();
  const tours = (await listTours({ includeDrafts: true }).catch(() => [])).map((t) => ({ id: t.id, title: t.title, status: t.status }));
  const pick = tourId && tours.some((t) => t.id === tourId) ? tourId : tours.find((t) => t.status === "published")?.id ?? tours[0]?.id ?? null;
  if (!pick) return { tours, tour: null, stops: [], mine: {}, leadsARun: false };
  const tour = await getTourById(pick);
  if (!tour) return { tours, tour: null, stops: [], mine: {}, leadsARun: false };
  const [stops, rows] = await Promise.all([
    listTourStops(tour.id).catch(() => []),
    db`SELECT k.*, NULL AS guide_name FROM tour_guide_takes k WHERE k.org_id = ${ORG} AND k.thread_id = ${tour.id} AND k.guide_user_id = ${viewer.userId}` as unknown as Promise<Row[]>,
  ]);
  const { departuresSql } = await import("@/lib/departures");
  const runs = (await db`
    SELECT 1 FROM ${departuresSql()} d
    WHERE d.thread_id = ${tour.id} AND d.org_id = ${ORG} AND d.status = 'scheduled' AND d.starts_at >= NOW()
      AND COALESCE(d.guide_user_id, ${tour.authorId}::uuid) = ${viewer.userId}
    LIMIT 1
  `) as unknown as Row[];
  const mine: Record<string, GuideTake> = {};
  for (const r of rows) {
    const t = mapTake(r);
    mine[t.stopId ?? ""] = t;
  }
  return {
    tours,
    tour: { id: tour.id, title: tour.title, slug: tour.slug },
    stops: stops.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    mine,
    leadsARun: runs.length > 0,
  };
}

/** Save (or, when empty, delete) the viewer's take on a tour or one of its stops. */
export async function saveTakeAction(input: { tourId: string; stopId: string | null; body: string; mediaUrl: string | null }): Promise<{ ok: true; take: GuideTake | null } | { ok: false; error: string }> {
  const viewer = await requireOrgEditor();
  const tour = await getTourById(input.tourId);
  if (!tour) return { ok: false, error: "That tour is not on this site." };
  let stopId: string | null = null;
  if (input.stopId) {
    if (!UUID.test(input.stopId)) return { ok: false, error: "That stop is not on this tour." };
    const [s] = (await db`SELECT id FROM tour_stops WHERE id = ${input.stopId} AND thread_id = ${tour.id} AND org_id = ${ORG}`) as unknown as Row[];
    if (!s) return { ok: false, error: "That stop is not on this tour." };
    stopId = input.stopId;
  }
  const body = sanitizeRichText(input.body ?? "").trim();
  const hasText = Boolean(body.replace(/<[^>]*>/g, "").trim());
  const media = (input.mediaUrl ?? "").trim();
  if (media && !(media.startsWith("/api/media/") || /^https:\/\//.test(media))) return { ok: false, error: "That picture address is not allowed." };
  try {
    if (!hasText && !media) {
      await db`
        DELETE FROM tour_guide_takes
        WHERE org_id = ${ORG} AND thread_id = ${tour.id} AND guide_user_id = ${viewer.userId}
          AND stop_id IS NOT DISTINCT FROM ${stopId}::uuid
      `;
      revalidatePath(`/tours/${tour.slug}`);
      return { ok: true, take: null };
    }
    const [r] = (await db`
      INSERT INTO tour_guide_takes (org_id, thread_id, stop_id, guide_user_id, body, media_url)
      VALUES (${ORG}, ${tour.id}, ${stopId}::uuid, ${viewer.userId}, ${hasText ? body : null}, ${media || null})
      ON CONFLICT (thread_id, stop_id, guide_user_id) DO UPDATE SET body = EXCLUDED.body, media_url = EXCLUDED.media_url, updated_at = NOW()
      RETURNING *, NULL AS guide_name
    `) as unknown as Row[];
    revalidatePath(`/tours/${tour.slug}`);
    return { ok: true, take: mapTake(r!) };
  } catch (err) {
    console.error("[elktours] saveTakeAction:", err);
    return { ok: false, error: "Could not save your take." };
  }
}
