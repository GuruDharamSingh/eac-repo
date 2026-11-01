// Server-side only: imported from server actions, never from a client component.
import { db } from "@elkdonis/db";
import { getProxyFileUrl, uploadFile } from "@elkdonis/services";
import { listStopsNeedingStill, listTourStops, setTourStopStill } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";
import { getTourById, type TourRoute } from "@/lib/tours";

/**
 * The two caches that keep third-party calls to one per edit, not one per view.
 *
 * Street View stills: one Static API image per stop at its pose, fetched when
 * the stop is saved (or its pose changes), stored in the org's media folder
 * and served by /api/media. Guarded by a daily ceiling so a runaway editor
 * cannot spend the free allowance: the count is of stills made today, read
 * from the rows themselves.
 *
 * Walking route: OSRM foot geometry between the meeting point and the stops,
 * stored in threads.metadata.tour.route. The public OSRM demo server is used;
 * it has no SLA, so a failure keeps the previous route.
 */

const ORG = siteConfig.orgId;
/** Stills made per day across the site before generation pauses (Static Street View free cap is 10,000/month). */
const STILLS_PER_DAY = 150;
const STILL_W = 800;
const STILL_H = 450;

type LngLat = [number, number];

export async function ensureStopStills(threadId: string): Promise<{ made: number; skipped: number }> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return { made: 0, skipped: 0 };
  const needing = await listStopsNeedingStill(ORG, threadId);
  if (needing.length === 0) return { made: 0, skipped: 0 };
  const [{ n }] = (await db`
    SELECT count(*)::int AS n FROM tour_stops WHERE still_url IS NOT NULL AND updated_at >= date_trunc('day', NOW())
  `) as unknown as { n: number }[];
  let budget = Math.max(0, STILLS_PER_DAY - Number(n));
  let made = 0, skipped = 0;
  for (const s of needing) {
    if (budget <= 0 || s.lat == null || s.lng == null) { skipped += 1; continue; }
    const q = new URLSearchParams({ key, size: `${STILL_W}x${STILL_H}`, location: `${s.lat},${s.lng}`, source: "outdoor", return_error_code: "true" });
    if (s.heading != null) q.set("heading", String(s.heading));
    if (s.pitch != null) q.set("pitch", String(s.pitch));
    if (s.fov != null) q.set("fov", String(Math.min(120, s.fov)));
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/streetview?${q}`, { signal: AbortSignal.timeout(8000) });
      budget -= 1;
      if (!res.ok) { skipped += 1; continue; } // 404 = no imagery there
      const buf = Buffer.from(await res.arrayBuffer());
      const path = `EAC_Network/${ORG}/Media/Images/streetview-${s.id}-${Date.now().toString(36)}.jpg`;
      const ok = await uploadFile(path, buf, "image/jpeg");
      if (!ok) { skipped += 1; continue; }
      await setTourStopStill(ORG, s.id, getProxyFileUrl(path));
      made += 1;
    } catch (err) {
      console.error("[elktours] still:", err);
      skipped += 1;
    }
  }
  return { made, skipped };
}

/** Fetch and store the walking geometry for a tour. Returns the route or null when nothing could be made. */
export async function refreshTourRoute(threadId: string): Promise<TourRoute | null> {
  const tour = await getTourById(threadId);
  if (!tour) return null;
  const stops = (await listTourStops(threadId)).filter((s) => s.lat != null && s.lng != null);
  const points: LngLat[] = [
    ...(tour.details.meetingPoint ? [[tour.details.meetingPoint.lng, tour.details.meetingPoint.lat] as LngLat] : []),
    ...stops.map((s) => [s.lng!, s.lat!] as LngLat),
  ];
  if (points.length < 2) return null;
  let legs: LngLat[][] = points.slice(1).map((p, i) => [points[i]!, p]);
  try {
    const path = points.map((p) => `${p[0]},${p[1]}`).join(";");
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${path}?overview=full&geometries=geojson&steps=false`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "elkdonis-tours/1.0 (route cache)" },
    });
    if (res.ok) {
      const json = (await res.json()) as { routes?: { geometry: { coordinates: LngLat[] } }[]; waypoints?: { location: LngLat }[] };
      const coords = json.routes?.[0]?.geometry.coordinates;
      const wp = (json.waypoints ?? []).map((w) => w.location);
      if (coords && wp.length === points.length) {
        const cut = wp.map((w) => {
          let best = 0, bd = Infinity;
          coords.forEach((c, i) => { const d = (c[0] - w[0]) ** 2 + (c[1] - w[1]) ** 2; if (d < bd) { bd = d; best = i; } });
          return best;
        });
        const split: LngLat[][] = [];
        for (let i = 0; i < cut.length - 1; i++) {
          const a = Math.min(cut[i]!, cut[i + 1]!), b = Math.max(cut[i]!, cut[i + 1]!);
          split.push([points[i]!, ...coords.slice(a, b + 1), points[i + 1]!]);
        }
        if (split.length === points.length - 1) legs = split;
      }
    }
  } catch (err) {
    console.error("[elktours] route:", err);
  }
  const route: TourRoute = { legs, fetchedAt: new Date().toISOString(), source: legs.some((l) => l.length > 2) ? "osrm" : "straight" };
  await db`
    UPDATE threads SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tour,route}', ${db.json(route as unknown as Record<string, never>)}, true), updated_at = NOW()
    WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
  `;
  return route;
}
