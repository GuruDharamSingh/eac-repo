// Server only. Everything the tour-page hero stage draws, read once per request (STAGE, 2026-11-20).
// Public data only: guide_notes, places.private_notes and hidden assets never appear here. All reads are SELECTs
// and fail soft (an empty field, never a thrown page).

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { TourFull } from "@/lib/tours";
import { distanceM } from "@/lib/places";
import { publicTakesFor, type GuideTake } from "@/lib/guide-takes";
import { stopFolderPhotos } from "@/lib/stop-folder-photos";
import {
  toRoman,
  type StagePhoto,
  type StagePlace,
  type StageStopData,
  type StageTake,
  type TourStageData,
} from "@/components/tours/stage/types";

const ORG = siteConfig.orgId;
const WALK_M_PER_MIN = 75;
const NARRATIVE_FALLBACK_MAX = 240;

/** Media under a Private/ folder is served only to signed-in people; the stage is public. */
const isPrivateUrl = (u: string) => /\/Private\//.test(u);

function plain(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first one or two sentences of a stop's body, at most `max` characters. */
export function narrativeFromBody(html: string | null | undefined, max = NARRATIVE_FALLBACK_MAX): string | null {
  if (!html) return null;
  const text = plain(html);
  if (!text) return null;
  const sentences = text.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  let out = sentences[0] ?? text;
  if (sentences[1] && (out + " " + sentences[1]).length <= max) out += " " + sentences[1];
  if (out.length > max) {
    const cut = out.slice(0, max - 1);
    const at = cut.lastIndexOf(" ");
    out = (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "") + "…";
  }
  return out;
}

function legMeters(leg: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < leg.length; i++) m += distanceM({ lng: leg[i - 1]![0], lat: leg[i - 1]![1] }, { lng: leg[i]![0], lat: leg[i]![1] });
  return m;
}

const takeOf = (t: GuideTake): StageTake => ({ guideUserId: t.guideUserId, guideName: t.guideName, body: t.body, mediaUrl: t.mediaUrl });

type PlaceRow = { id: string; slug: string; title: string; address: string | null; excerpt: string | null };

export async function loadTourStageData(tour: TourFull, opts: { takes?: GuideTake[] } = {}): Promise<TourStageData> {
  const stops = tour.stops;
  const placeIds = [...new Set(stops.map((s) => s.placeId).filter((v): v is string => !!v))];

  // Public places of this org only (is_public, not archived); title/address/excerpt, never body notes.
  const placeRows = new Map<string, PlaceRow>();
  if (placeIds.length) {
    try {
      const rows = (await db`
        SELECT id, slug, title, address, excerpt FROM places
        WHERE org_id = ${ORG} AND is_public AND archived_at IS NULL AND id = ANY(${placeIds}::uuid[])
      `) as unknown as PlaceRow[];
      for (const r of rows) placeRows.set(r.id, r);
    } catch (err) {
      console.error("[elktours] loadTourStageData places:", err);
    }
  }
  // The places' own pictures and their businesses' photos, for all places in two queries (review 2026-11-20: one
  // listPlacePhotos call per place cost ~4 queries each on the public request). Same filters as listPlacePhotos:
  // visible, not archived, nothing under Private/, no removed business.
  const placePhotoLists = new Map<string, { url: string; caption: string | null; credit?: string | null }[]>();
  const publicPlaceIds = [...placeRows.keys()];
  if (publicPlaceIds.length) {
    try {
      const privateKey = `EAC_Network/${ORG}/Private/%`;
      const privateUrl = `%/EAC_Network/${ORG}/Private/%`;
      const [own, biz] = await Promise.all([
        db`
          SELECT a.place_id, a.url, a.caption, a.attribution
          FROM tour_assets a
          WHERE a.org_id = ${ORG} AND a.place_id = ANY(${publicPlaceIds}::uuid[]) AND a.stop_id IS NULL AND a.thread_id IS NULL
            AND a.kind IN ('image', 'still') AND a.visible AND a.archived_at IS NULL AND a.url IS NOT NULL
            AND COALESCE(a.storage_key, '') NOT LIKE ${privateKey} AND a.url NOT LIKE ${privateUrl}
          ORDER BY a.place_id, a.position, a.created_at
        ` as unknown as Promise<{ place_id: string; url: string; caption: string | null; attribution: string | null }[]>,
        db`
          SELECT pb.place_id, b.photo_url AS url
          FROM place_businesses pb JOIN business_listings b ON b.user_id = pb.business_user_id
          WHERE pb.place_id = ANY(${publicPlaceIds}::uuid[]) AND b.photo_url IS NOT NULL AND b.status <> 'removed' AND b.removed_at IS NULL
          ORDER BY pb.place_id, pb.is_primary DESC, pb.created_at
        ` as unknown as Promise<{ place_id: string; url: string }[]>,
      ]);
      for (const r of own) (placePhotoLists.get(r.place_id) ?? placePhotoLists.set(r.place_id, []).get(r.place_id)!).push({ url: r.url, caption: r.caption, credit: r.attribution });
      for (const r of biz) (placePhotoLists.get(r.place_id) ?? placePhotoLists.set(r.place_id, []).get(r.place_id)!).push({ url: r.url, caption: null });
    } catch (err) {
      console.error("[elktours] loadTourStageData place photos:", err);
    }
  }

  // The owner's Stops folder in Nextcloud (2026-11-20): pictures matched to stops by name, the rest to the overview.
  const folder = await stopFolderPhotos(
    { slug: tour.slug, title: tour.title },
    stops.map((s) => ({ id: s.id, title: s.title, placeTitle: s.placeId ? placeRows.get(s.placeId)?.title ?? null : null }))
  ).catch((err) => {
    console.error("[elktours] loadTourStageData stops folder:", err instanceof Error ? err.message : err);
    return null;
  });

  const takes = opts.takes ?? (await publicTakesFor(tour.id, tour.authorId));
  const takesByStop = new Map<string, StageTake[]>();
  const tourTakes: StageTake[] = [];
  for (const t of takes) {
    if (!t.stopId) tourTakes.push(takeOf(t));
    else (takesByStop.get(t.stopId) ?? takesByStop.set(t.stopId, []).get(t.stopId)!).push(takeOf(t));
  }

  // Cached route: legs[0] is meeting point -> first positioned stop when a meeting point exists, else stop -> stop.
  const legs = tour.details.route?.legs ?? null;
  const positioned = stops.filter((s) => s.lat != null && s.lng != null);
  const offset = tour.details.meetingPoint ? 1 : 0;
  const walkTo = new Map<string, number>();
  if (legs && legs.length === positioned.length - 1 + offset) {
    positioned.forEach((s, i) => {
      const next = positioned[i + 1];
      const leg = legs[i + offset];
      if (next && leg && leg.length >= 2) walkTo.set(s.id, Math.max(1, Math.round(legMeters(leg) / WALK_M_PER_MIN)));
    });
  }

  const out: StageStopData[] = stops.map((s, i) => {
    const extras = tour.stopExtras[s.id];
    const excerpt = extras?.excerpt?.trim() || null;
    const fromBody = excerpt ? null : narrativeFromBody(s.body);

    const mine: StagePhoto[] = [];
    const seen = new Set<string>();
    const add = (list: StagePhoto[], url: string | null | undefined, caption: string | null, alt: string | null, credit: string | null) => {
      if (!url || seen.has(url) || isPrivateUrl(url)) return;
      seen.add(url);
      list.push({ url, caption, alt, credit });
    };
    // The Stops folder's pictures lead (developer, 2026-11-20); the stop's own images and Street View captures follow.
    for (const p of folder?.byStop.get(s.id) ?? []) add(mine, p.url, p.caption, p.alt, p.credit);
    for (const im of tour.assets.stopImages[s.id] ?? []) add(mine, im.url, im.caption, im.altText, im.attribution);
    add(mine, s.imageUrl, null, null, null);
    const still = tour.assets.stills[s.id] ?? s.stillUrl ?? null;
    const streetOn = tour.assets.streetview[s.id] !== false;
    if (mine.length === 0 && streetOn && still) add(mine, still, "Street View", null, "Google");

    const placePhotos: StagePhoto[] = [];
    const place = s.placeId ? placeRows.get(s.placeId) : undefined;
    for (const p of place ? placePhotoLists.get(place.id) ?? [] : []) add(placePhotos, p.url, p.caption, null, p.credit ?? null);

    const links = place && s.placeId ? extras?.links ?? [] : [];
    const biz = place ? extras?.business ?? null : null;
    const site = links.find((l) => l.kind === "website")?.url ?? (biz?.websiteStatus === "confirmed" ? biz.website : null);
    const stagePlace: StagePlace | null = place
      ? {
          id: place.id,
          slug: place.slug,
          title: place.title,
          address: place.address,
          excerpt: place.excerpt,
          website: site ?? null,
          links: links.filter((l) => l.kind !== "website").map((l) => ({ kind: l.kind, url: l.url })),
          hours: biz?.openingHours ?? null,
          businessName: biz?.name ?? null,
          ticket: null,
        }
      : null;

    return {
      id: s.id,
      number: i + 1,
      numeral: toRoman(i + 1),
      title: s.title,
      narrative: excerpt ?? fromBody,
      narrativeFrom: excerpt ? "excerpt" : fromBody ? "body" : null,
      narrativeIsFallback: !excerpt && !!fromBody,
      stopPhotos: mine,
      placePhotos,
      // The still only when Street View is on for the stop and the file is public (review 2026-11-20).
      cover: mine[0]?.url ?? placePhotos[0]?.url ?? (streetOn && still && !isPrivateUrl(still) ? still : null),
      streetView:
        s.lat != null && s.lng != null && streetOn
          ? { lat: s.lat, lng: s.lng, heading: s.heading, pitch: s.pitch, fov: s.fov, stillUrl: still && !isPrivateUrl(still) ? still : null }
          : null,
      place: stagePlace,
      walkMinutesToNext: walkTo.get(s.id) ?? null,
      takes: takesByStop.get(s.id) ?? [],
      durationMinutes: s.durationMinutes,
    };
  });

  const overviewPhotos: StagePhoto[] = [];
  const seenOv = new Set<string>();
  const addOv = (url: string | null | undefined, caption: string | null, alt: string | null, credit: string | null) => {
    if (!url || seenOv.has(url) || isPrivateUrl(url)) return;
    seenOv.add(url);
    overviewPhotos.push({ url, caption, alt, credit });
  };
  addOv(tour.coverImageUrl, null, tour.title, null);
  addOv(tour.assets.poster, null, tour.title, null);
  for (const im of tour.assets.images) addOv(im.url, im.caption, im.altText, im.attribution);
  for (const p of folder?.rest ?? []) addOv(p.url, p.caption, p.alt, p.credit);

  // The guides' profile pictures (users.avatar_url), for the phone page's "Your guide". Public paths only; fail soft.
  const guidePhotos: Record<string, string> = {};
  const guideIds = [
    ...new Set([tour.authorId, ...tour.departures.map((d) => d.guideUserId), ...takes.map((t) => t.guideUserId)].filter((v): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v))),
  ];
  if (guideIds.length) {
    try {
      const rows = (await db`SELECT id, avatar_url FROM users WHERE id = ANY(${guideIds}::uuid[])`) as unknown as { id: string; avatar_url: string | null }[];
      for (const r of rows) if (r.avatar_url && !isPrivateUrl(r.avatar_url)) guidePhotos[r.id] = r.avatar_url;
    } catch (err) {
      console.error("[elktours] loadTourStageData guide photos:", err);
    }
  }

  const next = tour.departures.find((d) => d.status === "scheduled" && new Date(d.startsAt).getTime() >= Date.now()) ?? null;
  return {
    stops: out,
    byStop: Object.fromEntries(out.map((s) => [s.id, s])),
    overviewPhotos,
    tourLede: tour.excerpt?.trim() || narrativeFromBody(tour.body, 320),
    tourTakes,
    nextDeparture: next ? { id: next.id, startsAt: next.startsAt, seatsLeft: next.seatsLeft } : null,
    price: tour.price,
    currency: tour.currency,
    guidePhotos,
  };
}
