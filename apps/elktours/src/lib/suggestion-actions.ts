"use server";
// CONTRACT: visitor suggestions (followers: spot or route, rate-limited) + editor moderation queue. Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug } from "@elkdonis/services";
import { saveTourStops } from "@elkdonis/commerce/server";
import { slugifyTitle } from "@/lib/cms/schema";
import { getViewer, requireOrgEditor, type Viewer } from "@/lib/auth";
import { mapAsset } from "@/lib/assets";
import { MAX_PHOTO_BYTES, photoSize, readPhotoGeo, sniffImage, storePrivatePhoto } from "@/lib/photo-geo";
import { uniquePlaceSlug } from "@/lib/places";
import { reverseGeocode } from "@/lib/suggest";
import { walkingLegs } from "@/lib/walking-route";
import { siteConfig } from "@/config/site";
import type { RouteItem, RoutePreview, RouteSuggestionInput, Result, SpotSuggestionInput, SuggestionStatus, VisitorSuggestion } from "@/lib/catalogue-types";

/**
 * visitor_suggestions (migration 239). Same rule as reviews: any signed-in person with a
 * user_organizations row for the org (followers included) may suggest. DAILY_LIMIT per
 * person per rolling 24 h, spots and routes together. Nothing enters the catalogue or the
 * tours until an editor accepts:
 *   spot  -> a catalogue place (places.suggested_by = the suggester; the photo moves to it)
 *   route -> a DRAFT tour from those places (spots become places first), metadata.suggestedBy
 */

const ORG = siteConfig.orgId;
const DAILY_LIMIT = 10;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;
const canSuggest = (v: Viewer | null) => !!v && v.isAffiliate;
const plain = (s: string | null | undefined, max: number) => (s ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max) || null;
const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

async function usedToday(userId: string): Promise<number> {
  const [r] = (await db`
    SELECT COUNT(*)::int AS n FROM visitor_suggestions WHERE user_id = ${userId} AND org_id = ${ORG} AND created_at > NOW() - interval '24 hours'
  `) as unknown as Row[];
  return Number(r?.n ?? 0);
}

async function gate(): Promise<{ viewer: Viewer } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to suggest something." };
  if (!canSuggest(viewer)) return { ok: false, error: "Follow us to send suggestions." };
  if ((await usedToday(viewer.userId)) >= DAILY_LIMIT) return { ok: false, error: `That is ${DAILY_LIMIT} suggestions today; thank you! Try again tomorrow.` };
  return { viewer };
}

const SELECT = db`
  SELECT s.*, u.display_name AS user_name, u.slug AS user_slug, a.url AS photo_url
  FROM visitor_suggestions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN tour_assets a ON a.id = s.photo_asset_id
`;

async function mapMany(rows: Row[]): Promise<VisitorSuggestion[]> {
  const placeIds = new Set<string>();
  for (const r of rows) for (const it of ((r.payload as { items?: RouteItem[] })?.items ?? [])) if ("placeId" in it) placeIds.add(it.placeId);
  const places = new Map<string, Row>();
  if (placeIds.size > 0) {
    const pr = (await db`SELECT id, title, lat, lng FROM places WHERE id = ANY(${[...placeIds]}::uuid[])`) as unknown as Row[];
    for (const p of pr) places.set(p.id as string, p);
  }
  return rows.map((r) => {
    const payload = (r.payload ?? {}) as { items?: RouteItem[]; preview?: RoutePreview };
    return {
      id: r.id as string,
      kind: r.kind as "spot" | "route",
      status: r.status as SuggestionStatus,
      title: r.title as string,
      note: (r.note as string | null) ?? null,
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
      address: (r.address as string | null) ?? null,
      photoAssetId: (r.photo_asset_id as string | null) ?? null,
      photoUrl: (r.photo_url as string | null) ?? null,
      items: (payload.items ?? []).map((it) => {
        if ("placeId" in it) {
          const p = places.get(it.placeId);
          return { ...it, resolvedTitle: (p?.title as string) ?? "(removed place)", lat: p?.lat == null ? null : Number(p.lat), lng: p?.lng == null ? null : Number(p.lng) };
        }
        return { ...it, resolvedTitle: it.title };
      }),
      preview: payload.preview ?? null,
      suggester: { userId: r.user_id as string, name: (r.user_name as string | null) ?? null, slug: (r.user_slug as string | null) ?? null },
      resultPlaceId: (r.result_place_id as string | null) ?? null,
      resultThreadId: (r.result_thread_id as string | null) ?? null,
      rejectReason: (r.reject_reason as string | null) ?? null,
      reviewedAt: iso(r.reviewed_at),
      createdAt: iso(r.created_at)!,
    };
  });
}
async function getOne(id: string): Promise<VisitorSuggestion | null> {
  const rows = (await db`${SELECT} WHERE s.id = ${id} AND s.org_id = ${ORG}`) as unknown as Row[];
  return (await mapMany(rows))[0] ?? null;
}

/** Daily limit per user (spots + routes together). */
export async function suggestionAllowanceAction(): Promise<{ signedIn: boolean; canSuggest: boolean; usedToday: number; limit: number }> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return { signedIn: false, canSuggest: false, usedToday: 0, limit: DAILY_LIMIT };
  return { signedIn: true, canSuggest: canSuggest(viewer), usedToday: await usedToday(viewer.userId), limit: DAILY_LIMIT };
}

const spotSchema = z.object({
  title: z.string().trim().min(2, "Give the spot a name").max(200),
  why: z.string().max(2000).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(300).nullable().optional(),
});

async function insertSpot(viewer: Viewer, v: z.infer<typeof spotSchema>, photoAssetId: string | null): Promise<VisitorSuggestion> {
  const address = v.address?.trim() || (await reverseGeocode(v.lat, v.lng))?.address || null;
  const [r] = (await db`
    INSERT INTO visitor_suggestions (org_id, kind, user_id, title, note, lat, lng, address, photo_asset_id)
    VALUES (${ORG}, 'spot', ${viewer.userId}, ${v.title}, ${plain(v.why, 2000)}, ${v.lat}, ${v.lng}, ${address}, ${photoAssetId})
    RETURNING id
  `) as unknown as Row[];
  revalidatePath("/manage/suggestions");
  return (await getOne(r!.id as string))!;
}

/** Suggest a spot by pin. Saved pending (not in the catalogue). */
export async function suggestSpotAction(input: SpotSuggestionInput): Promise<Result<{ suggestion: VisitorSuggestion }>> {
  const g = await gate();
  if ("ok" in g) return g;
  const parsed = spotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the suggestion" };
  try {
    return { ok: true, suggestion: await insertSpot(g.viewer, parsed.data, null) };
  } catch (err) {
    console.error("[elktours] suggestSpotAction:", err);
    return { ok: false, error: "Could not send the suggestion." };
  }
}

/** FormData: file (photo), title, why, optional lat+lng. Uses the photo geotag when no pin; { needsPin } when neither. */
export async function suggestSpotFromPhotoAction(formData: FormData): Promise<Result<{ suggestion: VisitorSuggestion }> | { ok: true; needsPin: true; error?: undefined }> {
  const g = await gate();
  if ("ok" in g) return g;
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose a photo." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "That photo is over 25 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return { ok: false, error: "That file is not a JPEG, PNG, WebP or HEIC photo." };
  const num = (k: string) => {
    const v = formData.get(k);
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const geo = await readPhotoGeo(buf);
  const lat = num("lat") ?? geo.lat;
  const lng = num("lng") ?? geo.lng;
  // Ask for the pin before storing anything: the visitor resubmits with lat/lng.
  if (lat == null || lng == null) return { ok: true, needsPin: true };
  const parsed = spotSchema.safeParse({ title: String(formData.get("title") ?? ""), why: String(formData.get("why") ?? "") || null, lat, lng });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the suggestion" };
  try {
    const key = await storePrivatePhoto(buf, kind, "suggestion-photo");
    if (!key) return { ok: false, error: "Could not store the photo. Try again." };
    const { width, height } = await photoSize(buf, kind.ext);
    // Owned by nobody until accepted (migration 237's pending case); hidden, private file.
    const [a] = (await db`
      INSERT INTO tour_assets (org_id, kind, role, storage, storage_key, url, mime_type, bytes, width, height, source, visible, caption, meta, created_by)
      VALUES (${ORG}, 'image', 'gallery', 'nextcloud', ${key}, ${`/api/media/${key}`}, ${kind.mime}, ${buf.length}, ${width}, ${height},
              'photo_pending', false, ${parsed.data.title}, ${db.json({ exif: geo, fromSuggestion: true, heic: kind.ext === "heic" } as never)}, ${g.viewer.userId})
      RETURNING *
    `) as unknown as Row[];
    return { ok: true, suggestion: await insertSpot(g.viewer, parsed.data, mapAsset(a!).id) };
  } catch (err) {
    console.error("[elktours] suggestSpotFromPhotoAction:", err);
    return { ok: false, error: "Could not send the suggestion." };
  }
}

const itemSchema = z.union([
  z.object({ placeId: z.string().regex(UUID) }).strict(),
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), title: z.string().trim().min(1).max(200) }).strict(),
]);
const itemsSchema = z.array(itemSchema).min(2, "Pick at least 2 places").max(15, "At most 15 places");

async function resolvePoints(items: RouteItem[]): Promise<{ points: [number, number][] } | { error: string }> {
  const ids = items.filter((i): i is { placeId: string } => "placeId" in i).map((i) => i.placeId);
  const rows = ids.length
    ? ((await db`SELECT id, lat, lng FROM places WHERE org_id = ${ORG} AND archived_at IS NULL AND id = ANY(${ids}::uuid[])`) as unknown as Row[])
    : [];
  const by = new Map(rows.map((r) => [r.id as string, r]));
  const points: [number, number][] = [];
  for (const it of items) {
    if ("placeId" in it) {
      const p = by.get(it.placeId);
      if (!p || p.lat == null) return { error: "One of the places is not in the catalogue." };
      points.push([Number(p.lng), Number(p.lat)]);
    } else points.push([it.lng, it.lat]);
  }
  return { points };
}

/** Walking preview for an ordered list (2-15 items), FOSSGIS foot routing. */
export async function previewRouteAction(items: RouteItem[]): Promise<Result<{ preview: RoutePreview }>> {
  const viewer = await getViewer();
  if (!canSuggest(viewer)) return { ok: false, error: "Follow us to suggest a route." };
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the places" };
  const pts = await resolvePoints(parsed.data as RouteItem[]);
  if ("error" in pts) return { ok: false, error: pts.error };
  return { ok: true, preview: await walkingLegs(pts.points) };
}

export async function suggestRouteAction(input: RouteSuggestionInput): Promise<Result<{ suggestion: VisitorSuggestion }>> {
  const g = await gate();
  if ("ok" in g) return g;
  const title = plain(input?.title, 200);
  if (!title || title.length < 2) return { ok: false, error: "Give the route a title." };
  const parsed = itemsSchema.safeParse(input.items);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the places" };
  const pts = await resolvePoints(parsed.data as RouteItem[]);
  if ("error" in pts) return { ok: false, error: pts.error };
  const preview = await walkingLegs(pts.points);
  try {
    const [r] = (await db`
      INSERT INTO visitor_suggestions (org_id, kind, user_id, title, note, payload)
      VALUES (${ORG}, 'route', ${g.viewer.userId}, ${title}, ${plain(input.note, 4000)}, ${db.json({ items: parsed.data as RouteItem[], preview } as never)})
      RETURNING id
    `) as unknown as Row[];
    revalidatePath("/manage/suggestions");
    return { ok: true, suggestion: (await getOne(r!.id as string))! };
  } catch (err) {
    console.error("[elktours] suggestRouteAction:", err);
    return { ok: false, error: "Could not send the suggestion." };
  }
}

/** The signed-in person's own suggestions. */
export async function listMySuggestionsAction(): Promise<VisitorSuggestion[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const rows = (await db`${SELECT} WHERE s.user_id = ${viewer.userId} AND s.org_id = ${ORG} ORDER BY s.created_at DESC LIMIT 100`) as unknown as Row[];
  return mapMany(rows);
}

export async function withdrawSuggestionAction(id: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !UUID.test(id)) return { ok: false, error: "Not found" };
  const rows = (await db`
    UPDATE visitor_suggestions SET status = 'withdrawn', updated_at = NOW()
    WHERE id = ${id} AND user_id = ${viewer.userId} AND status = 'pending' RETURNING id
  `) as unknown as Row[];
  return rows[0] ? { ok: true } : { ok: false, error: "Only a pending suggestion can be withdrawn." };
}

// ── moderation (editors) ──

export async function listSuggestionsAction(filter: { status?: SuggestionStatus; kind?: "spot" | "route" } = {}): Promise<VisitorSuggestion[]> {
  await requireOrgEditor();
  const rows = (await db`
    ${SELECT} WHERE s.org_id = ${ORG}
      ${filter.status ? db`AND s.status = ${filter.status}` : db``}
      ${filter.kind ? db`AND s.kind = ${filter.kind}` : db``}
    ORDER BY (s.status = 'pending') DESC, s.created_at DESC LIMIT 300
  `) as unknown as Row[];
  return mapMany(rows);
}

async function createPlace(tx: typeof db, p: { title: string; lat: number; lng: number; address: string | null; body: string | null; suggestedBy: string; editor: string }): Promise<string> {
  const slug = await uniquePlaceSlug(p.title);
  const [r] = (await tx`
    INSERT INTO places (org_id, slug, title, private_notes, lat, lng, address, source, created_by, suggested_by)
    VALUES (${ORG}, ${slug}, ${p.title}, ${p.body}, ${p.lat}, ${p.lng}, ${p.address}, 'manual', ${p.editor}, ${p.suggestedBy})
    RETURNING id
  `) as unknown as Row[];
  return r!.id as string;
}

/** Spot -> catalogue place (credited: places.suggested_by). Route -> draft tour from those places (metadata.suggestedBy). */
export async function acceptSuggestionAction(id: string, opts: { title?: string } = {}): Promise<Result<{ placeId?: string; threadId?: string }>> {
  const editor = await requireOrgEditor();
  const s = UUID.test(id) ? await getOne(id) : null;
  if (!s) return { ok: false, error: "Not found" };
  if (s.status !== "pending") return { ok: false, error: `This suggestion is ${s.status}.` };
  const title = plain(opts.title, 200) ?? s.title;
  const why = s.note ? `Suggested by ${s.suggester.name ?? "a follower"}: ${s.note}` : `Suggested by ${s.suggester.name ?? "a follower"}.`;
  try {
    if (s.kind === "spot") {
      let placeId = "";
      await db.begin(async (tx) => {
        placeId = await createPlace(tx as unknown as typeof db, { title, lat: s.lat!, lng: s.lng!, address: s.address, body: why, suggestedBy: s.suggester.userId, editor: editor.userId });
        if (s.photoAssetId) {
          await tx`UPDATE tour_assets SET place_id = ${placeId}, source = 'photo', updated_at = NOW() WHERE id = ${s.photoAssetId} AND source = 'photo_pending'`;
        }
        await tx`
          UPDATE visitor_suggestions SET status = 'accepted', result_place_id = ${placeId}, reviewed_by = ${editor.userId}, reviewed_at = NOW(), updated_at = NOW()
          WHERE id = ${id} AND status = 'pending'
        `;
      });
      revalidatePath("/manage/places");
      revalidatePath("/manage/suggestions");
      return { ok: true, placeId };
    }

    // Route: spots become places, then a draft tour with one stop per item (copy on pick).
    const placeIds: string[] = [];
    for (const it of s.items) {
      if ("placeId" in it) placeIds.push(it.placeId);
      else placeIds.push(await createPlace(db, { title: it.title, lat: it.lat, lng: it.lng, address: null, body: why, suggestedBy: s.suggester.userId, editor: editor.userId }));
    }
    const places = (await db`SELECT * FROM places WHERE id = ANY(${placeIds}::uuid[])`) as unknown as Row[];
    const by = new Map(places.map((p) => [p.id as string, p]));
    const threadId = nanoid(21);
    const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(title), undefined);
    const first = by.get(placeIds[0]!);
    const metadata = {
      tour: {
        highlights: [],
        includes: [],
        languages: [],
        meetingPoint: first?.lat != null ? { lat: Number(first.lat), lng: Number(first.lng) } : null,
        maxParty: null,
        effort: null,
        route: null,
      },
      suggestedBy: { userId: s.suggester.userId, name: s.suggester.name, suggestionId: s.id },
    };
    await db`
      INSERT INTO threads (id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility, metadata, currency, location, format)
      VALUES (${threadId}, ${ORG}, ${editor.userId}, 'tour', ${siteConfig.toursFeed}, ${title}, ${slug},
              ${s.note ? `<p>${s.note.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>` : null},
              ${null}, 'draft', 'PUBLIC', ${db.json(metadata as never)}, ${siteConfig.currency}, ${(first?.title as string) ?? null}, 'in_person')
    `;
    await saveTourStops(
      ORG,
      threadId,
      placeIds.map((pid) => {
        const p = by.get(pid)!;
        return {
          title: p.title as string,
          body: (p.body as string | null) ?? null,
          lat: p.lat == null ? null : Number(p.lat),
          lng: p.lng == null ? null : Number(p.lng),
          heading: p.heading == null ? null : Number(p.heading),
          pitch: p.pitch == null ? null : Number(p.pitch),
          fov: p.fov == null ? null : Number(p.fov),
          placeId: pid,
        };
      })
    );
    const { refreshTourRoute } = await import("@/lib/tour-cache");
    await refreshTourRoute(threadId).catch(() => null);
    await db`
      UPDATE visitor_suggestions SET status = 'accepted', result_thread_id = ${threadId}, reviewed_by = ${editor.userId}, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND status = 'pending'
    `;
    revalidatePath("/manage/tours");
    revalidatePath("/manage/suggestions");
    return { ok: true, threadId };
  } catch (err) {
    console.error("[elktours] acceptSuggestionAction:", err);
    return { ok: false, error: "Could not accept the suggestion." };
  }
}

export async function rejectSuggestionAction(id: string, reason?: string): Promise<Result> {
  const editor = await requireOrgEditor();
  if (!UUID.test(id)) return { ok: false, error: "Not found" };
  const rows = (await db`
    UPDATE visitor_suggestions SET status = 'rejected', reject_reason = ${plain(reason, 500)}, reviewed_by = ${editor.userId}, reviewed_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG} AND status = 'pending' RETURNING id
  `) as unknown as Row[];
  revalidatePath("/manage/suggestions");
  return rows[0] ? { ok: true } : { ok: false, error: "Only a pending suggestion can be rejected." };
}
