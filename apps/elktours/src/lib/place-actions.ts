"use server";
// CONTRACT: places server actions (editor-only). Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireOrgEditor } from "@/lib/auth";
import { getPlace, listPlaces, mapPlace, stopDraftFromPlace, uniquePlaceSlug } from "@/lib/places";
import { suggestPlaces } from "@/lib/suggest";
import { siteConfig } from "@/config/site";
import type { PlaceLinkCandidate, Place, PlaceInput, PlaceListFilter, PlaceSuggestion, PlaceWithStats, Result, StopDraft, SuggestQuery, SuggestResult } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

const optNum = (lo: number, hi: number) => z.number().min(lo).max(hi).nullable().optional();
const placeSchema = z.object({
  id: z.string().regex(UUID).optional(),
  title: z.string().trim().min(2, "Give the place a name").max(200),
  body: z.string().max(100_000).nullable().optional(),
  excerpt: z.string().max(400).nullable().optional(),
  isPublic: z.boolean().optional(),
  privateNotes: z.string().max(100_000).nullable().optional(),
  lat: optNum(-90, 90),
  lng: optNum(-180, 180),
  heading: optNum(0, 360),
  pitch: optNum(-90, 90),
  fov: optNum(10, 100),
  address: z.string().trim().max(300).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).optional(),
  source: z.enum(["stop_backfill", "manual", "photon", "overpass"]).optional(),
  sourceRef: z.string().trim().max(120).nullable().optional(),
});

function revalidatePlaces(id?: string) {
  revalidatePath("/manage/places");
  if (id) revalidatePath(`/manage/places/${id}`);
}

export async function listPlacesAction(filter: PlaceListFilter = {}): Promise<PlaceWithStats[]> {
  await requireOrgEditor();
  return listPlaces(filter);
}

async function writePlace(input: z.infer<typeof placeSchema>, userId: string): Promise<Place> {
  const both = input.lat != null && input.lng != null;
  const body = input.body ? sanitizeRichText(input.body) || null : input.body === undefined ? undefined : null;
  const notes = input.privateNotes ? sanitizeRichText(input.privateNotes) || null : input.privateNotes === undefined ? undefined : null;
  const tags = input.tags ? [...new Set(input.tags)] : undefined;
  const excerpt = input.excerpt === undefined ? undefined : input.excerpt?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) || null;

  if (input.id) {
    const current = await getPlace(input.id);
    if (!current) throw new Error("Place not found.");
    const slug = input.title !== current.title ? await uniquePlaceSlug(input.title, input.id) : current.slug;
    const [r] = (await db`
      UPDATE places SET
        title = ${input.title}, slug = ${slug},
        body = ${body === undefined ? current.body : body},
        private_notes = ${notes === undefined ? current.privateNotes : notes},
        lat = ${input.lat === undefined ? current.lat : both ? input.lat! : null},
        lng = ${input.lng === undefined ? current.lng : both ? input.lng! : null},
        heading = ${input.heading === undefined ? current.heading : input.heading},
        pitch = ${input.pitch === undefined ? current.pitch : input.pitch},
        fov = ${input.fov === undefined ? current.fov : input.fov},
        address = ${input.address === undefined ? current.address : input.address || null},
        tags = ${tags ?? current.tags}::text[],
        excerpt = ${excerpt === undefined ? current.excerpt : excerpt},
        is_public = ${input.isPublic === undefined ? current.isPublic : input.isPublic},
        updated_at = NOW()
      WHERE id = ${input.id} AND org_id = ${ORG}
      RETURNING *
    `) as unknown as Row[];
    return mapPlace(r!);
  }
  const slug = await uniquePlaceSlug(input.title);
  const [r] = (await db`
    INSERT INTO places (org_id, slug, title, body, excerpt, is_public, private_notes, lat, lng, heading, pitch, fov, address, tags, source, source_ref, created_by)
    VALUES (${ORG}, ${slug}, ${input.title}, ${body ?? null}, ${excerpt ?? null}, ${input.isPublic ?? true}, ${notes ?? null},
            ${both ? input.lat! : null}, ${both ? input.lng! : null}, ${input.heading ?? null}, ${input.pitch ?? null}, ${input.fov ?? null},
            ${input.address || null}, ${tags ?? []}::text[], ${input.source ?? "manual"}, ${input.sourceRef || null}, ${userId})
    RETURNING *
  `) as unknown as Row[];
  return mapPlace(r!);
}

export async function savePlaceAction(input: PlaceInput): Promise<Result<{ place: Place }>> {
  const viewer = await requireOrgEditor();
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields" };
  try {
    const place = await writePlace(parsed.data, viewer.userId);
    revalidatePlaces(place.id);
    return { ok: true, place };
  } catch (err) {
    console.error("[elktours] savePlaceAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the place." };
  }
}

export async function archivePlaceAction(id: string, archived = true): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  await db`
    UPDATE places SET archived_at = ${archived ? db`NOW()` : null}, updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG}
  `;
  revalidatePlaces(id);
  return { ok: true };
}

/** Catalogue -> new stop draft (copy on pick). The builder adds it to its list and saves through saveStopsAction. */
export async function pickPlaceAction(placeId: string): Promise<Result<{ stop: StopDraft }>> {
  await requireOrgEditor();
  const place = await getPlace(placeId);
  if (!place || place.archivedAt) return { ok: false, error: "That place is not in the catalogue." };
  return { ok: true, stop: stopDraftFromPlace(place) };
}

const suggestionSchema = z.object({
  source: z.enum(["catalogue", "photon", "overpass"]),
  title: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(300).nullable(),
  category: z.string().max(60).nullable(),
  placeId: z.string().regex(UUID).nullable(),
  sourceRef: z.string().max(120).nullable(),
});

/** Suggestion -> catalogue place (photon/overpass rows are created; catalogue ones are reused) -> stop draft. */
export async function pickSuggestionAction(s: PlaceSuggestion): Promise<Result<{ place: Place; stop: StopDraft }>> {
  const viewer = await requireOrgEditor();
  const parsed = suggestionSchema.safeParse(s);
  if (!parsed.success) return { ok: false, error: "That suggestion could not be read." };
  const v = parsed.data;
  try {
    let place: Place | null = null;
    if (v.source === "catalogue" && v.placeId) place = await getPlace(v.placeId);
    if (!place && v.sourceRef) {
      const [r] = (await db`
        SELECT id FROM places WHERE org_id = ${ORG} AND source_ref = ${v.sourceRef} AND archived_at IS NULL LIMIT 1
      `) as unknown as Row[];
      if (r) place = await getPlace(r.id as string);
    }
    if (!place) {
      place = await writePlace(
        {
          title: v.title,
          lat: v.lat,
          lng: v.lng,
          address: v.address,
          tags: v.category ? [v.category.toLowerCase().replace(/_/g, " ")] : [],
          source: v.source === "overpass" ? "overpass" : v.source === "photon" ? "photon" : "manual",
          sourceRef: v.sourceRef,
        },
        viewer.userId
      );
      revalidatePlaces();
    }
    return { ok: true, place, stop: stopDraftFromPlace(place) };
  } catch (err) {
    console.error("[elktours] pickSuggestionAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not add the place." };
  }
}

async function loadStop(stopId: string): Promise<Row | null> {
  if (!UUID.test(stopId)) return null;
  const [r] = (await db`SELECT * FROM tour_stops WHERE id = ${stopId} AND org_id = ${ORG}`) as unknown as Row[];
  return r ?? null;
}
const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** "Update catalogue from this stop": copies the saved stop title, body and pose onto its place. */
export async function updatePlaceFromStopAction(stopId: string): Promise<Result<{ place: Place }>> {
  await requireOrgEditor();
  const stop = await loadStop(stopId);
  if (!stop) return { ok: false, error: "Save the stop first." };
  if (!stop.place_id) return { ok: false, error: "This stop is not linked to a catalogue place." };
  const both = stop.lat != null && stop.lng != null;
  const [r] = (await db`
    UPDATE places SET
      title = ${stop.title as string}, body = ${(stop.body as string | null) ?? null},
      lat = ${both ? num(stop.lat) : null}, lng = ${both ? num(stop.lng) : null},
      heading = ${num(stop.heading)}, pitch = ${num(stop.pitch)}, fov = ${num(stop.fov)}, updated_at = NOW()
    WHERE id = ${stop.place_id as string} AND org_id = ${ORG}
    RETURNING *
  `) as unknown as Row[];
  if (!r) return { ok: false, error: "Place not found." };
  revalidatePlaces(r.id as string);
  return { ok: true, place: mapPlace(r) };
}

/** "Reset stop to catalogue": returns the place fields as a draft for that stop (keeps the stop id). Save through saveStopsAction. */
export async function resetStopToPlaceAction(stopId: string): Promise<Result<{ stop: StopDraft }>> {
  await requireOrgEditor();
  const stop = await loadStop(stopId);
  if (!stop) return { ok: false, error: "Save the stop first." };
  if (!stop.place_id) return { ok: false, error: "This stop is not linked to a catalogue place." };
  const place = await getPlace(stop.place_id as string);
  if (!place) return { ok: false, error: "Place not found." };
  const draft = stopDraftFromPlace(place);
  return {
    ok: true,
    stop: {
      ...draft,
      id: stop.id as string,
      imageUrl: (stop.image_url as string | null) ?? null,
      durationMinutes: num(stop.duration_minutes),
      experienceId: (stop.experience_id as string | null) ?? null,
    },
  };
}

/** "Save as new place" for a saved stop with no place: creates the place and links the stop. */
export async function createPlaceFromStopAction(stopId: string): Promise<Result<{ place: Place }>> {
  const viewer = await requireOrgEditor();
  const stop = await loadStop(stopId);
  if (!stop) return { ok: false, error: "Save the stop first." };
  if (stop.place_id) {
    const existing = await getPlace(stop.place_id as string);
    if (existing) return { ok: true, place: existing };
  }
  try {
    const place = await writePlace(
      {
        title: stop.title as string,
        body: (stop.body as string | null) ?? null,
        lat: num(stop.lat),
        lng: num(stop.lng),
        heading: num(stop.heading),
        pitch: num(stop.pitch),
        fov: num(stop.fov),
        source: "manual",
      },
      viewer.userId
    );
    // Only the link column; the stop's own fields stay as they are.
    await db`UPDATE tour_stops SET place_id = ${place.id} WHERE id = ${stopId} AND org_id = ${ORG} AND place_id IS NULL`;
    revalidatePlaces(place.id);
    return { ok: true, place };
  } catch (err) {
    console.error("[elktours] createPlaceFromStopAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not create the place." };
  }
}

export async function suggestPlacesAction(query: SuggestQuery): Promise<SuggestResult> {
  await requireOrgEditor();
  return suggestPlaces(query);
}

// ── link review (editors): low-confidence links from scripts/enrich-place-links.mts ──

/** Stored links not yet confirmed, and not rejected. Optional placeId narrows to one place. */
export async function listLowConfidenceLinksAction(placeId?: string): Promise<PlaceLinkCandidate[]> {
  await requireOrgEditor();
  const rows = (await db`
    SELECT l.*, p.title AS place_title FROM place_links l JOIN places p ON p.id = l.place_id
    WHERE p.org_id = ${ORG} AND NOT l.confident AND l.rejected_at IS NULL
      ${placeId && UUID.test(placeId) ? db`AND l.place_id = ${placeId}` : db``}
    ORDER BY p.title, l.kind
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    placeId: r.place_id as string,
    placeTitle: r.place_title as string,
    kind: r.kind as PlaceLinkCandidate["kind"],
    url: r.url as string,
    source: (r.source === "web" ? "manual" : r.source) as PlaceLinkCandidate["source"],
    sourceRef: (r.source_ref as string | null) ?? null,
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/**
 * Confirm a link. It is copied to a source='manual' row (which the enrichment script never
 * touches, so a re-run cannot undo the approval) and the candidate row is removed.
 */
export async function approvePlaceLinkAction(id: string): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  const [l] = (await db`
    SELECT l.* FROM place_links l JOIN places p ON p.id = l.place_id WHERE l.id = ${id} AND p.org_id = ${ORG}
  `) as unknown as Row[];
  if (!l) return { ok: false, error: "Not found" };
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO place_links (place_id, kind, url, source, source_ref, confident, evidence)
      VALUES (${l.place_id as string}, ${l.kind as string}, ${l.url as string}, 'manual', ${(l.source_ref as string | null) ?? null}, true,
              ${tx.json({ ...((l.evidence as object) ?? {}), approvedFrom: l.source } as never)})
      ON CONFLICT (place_id, kind, source) DO UPDATE SET url = EXCLUDED.url, source_ref = EXCLUDED.source_ref,
        confident = true, rejected_at = NULL, evidence = EXCLUDED.evidence, updated_at = NOW()
    `;
    if (l.source !== "manual") await tx`DELETE FROM place_links WHERE id = ${id}`;
  });
  revalidatePlaces(l.place_id as string);
  return { ok: true };
}

/** Remove a link (candidate or confirmed). It stays as a rejection so the script never re-adds that URL. */
export async function removePlaceLinkAction(id: string): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  const rows = (await db`
    UPDATE place_links l SET confident = false, rejected_at = NOW(), updated_at = NOW()
    FROM places p WHERE p.id = l.place_id AND l.id = ${id} AND p.org_id = ${ORG}
    RETURNING l.place_id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "Not found" };
  revalidatePlaces(rows[0].place_id as string);
  return { ok: true };
}

/** All links of a place for the editor (confident, candidates; rejected excluded), by id. */
export async function listPlaceLinksForEditorAction(placeId: string): Promise<(PlaceLinkCandidate & { confident: boolean })[]> {
  await requireOrgEditor();
  if (!UUID.test(placeId)) return [];
  const rows = (await db`
    SELECT l.*, p.title AS place_title FROM place_links l JOIN places p ON p.id = l.place_id
    WHERE l.place_id = ${placeId} AND p.org_id = ${ORG} AND l.rejected_at IS NULL
    ORDER BY l.confident DESC, l.kind
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    placeId: r.place_id as string,
    placeTitle: r.place_title as string,
    kind: r.kind as PlaceLinkCandidate["kind"],
    url: r.url as string,
    source: (r.source === "web" ? "manual" : r.source) as PlaceLinkCandidate["source"],
    sourceRef: (r.source_ref as string | null) ?? null,
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
    confident: Boolean(r.confident),
  }));
}
