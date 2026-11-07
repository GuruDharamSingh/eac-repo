// CONTRACT: fly-over render request reads + payload builder + lifecycle (server only; also used by scripts/render-jobs.mts). Types in lib/catalogue-types.ts.
import { createHash } from "node:crypto";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type {
  RenderPayload,
  RenderPayloadStop,
  RenderRequest,
  RenderRequestFilter,
  RenderStatus,
  RenderStyle,
  RenderStyleInput,
} from "@/lib/catalogue-types";

/**
 * tour_render_requests (migration 234). No Next.js imports here: the worker
 * script (apps/elktours/scripts/render-jobs.mts) runs this module under tsx.
 *
 *   requested --accept (owner; freezes payload)--> accepted --claim--> claimed
 *     --heartbeat--> rendering --complete--> delivered
 *   requested/accepted --reject--> rejected | --cancel--> cancelled
 *   fail: retryable codes with attempts < max --> accepted, else failed
 *   stale heartbeat (> 20 min) --> re-claimable
 *
 * The payload is a snapshot of route + stops + style. It never carries
 * stills or Street View data. limits.maxSeconds is fixed at 30.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

export const MAX_SECONDS = 30 as const;
export const STALE_MINUTES = 20;
/** Paris and the inner suburbs. */
const BOUNDS = { minLat: 48.75, maxLat: 48.95, minLng: 2.15, maxLng: 2.55 };
const MAX_ROUTE_KM = 10;
export const RETRYABLE_CODES = ["network", "tiles_timeout", "gpu", "encode"];

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

export function mapRequest(r: Row): RenderRequest {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    threadId: r.thread_id as string,
    tourTitle: (r.tour_title as string) ?? "",
    tourSlug: (r.tour_slug as string) ?? "",
    kind: "flyover",
    status: r.status as RenderStatus,
    requestedBy: (r.requested_by as string | null) ?? null,
    requestedByName: (r.requested_by_name as string | null) ?? null,
    requesterEmail: (r.requester_email as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    style: normaliseStyle((r.style as RenderStyleInput) ?? undefined),
    payload: (r.payload as RenderPayload | null) ?? null,
    payloadSha256: (r.payload_sha256 as string | null) ?? null,
    priority: Number(r.priority ?? 0),
    acceptedBy: (r.accepted_by as string | null) ?? null,
    acceptedByName: (r.accepted_by_name as string | null) ?? null,
    acceptedAt: iso(r.accepted_at),
    rejectedReason: (r.rejected_reason as string | null) ?? null,
    workerId: (r.worker_id as string | null) ?? null,
    claimedAt: iso(r.claimed_at),
    heartbeatAt: iso(r.heartbeat_at),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    attempts: Number(r.attempts ?? 0),
    maxAttempts: Number(r.max_attempts ?? 3),
    progress: Number(r.progress ?? 0),
    errorCode: (r.error_code as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    result: (r.result as Record<string, unknown> | null) ?? null,
    deliveredAssetIds: Array.isArray(r.delivered_asset_ids) ? (r.delivered_asset_ids as string[]) : [],
    autoPublish: Boolean(r.auto_publish),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const SELECT = db`
  SELECT r.*, t.title AS tour_title, t.slug AS tour_slug,
         rb.display_name AS requested_by_name, ab.display_name AS accepted_by_name
  FROM tour_render_requests r
  JOIN threads t ON t.id = r.thread_id
  LEFT JOIN users rb ON rb.id = r.requested_by
  LEFT JOIN users ab ON ab.id = r.accepted_by
`;

export async function listRenderRequests(filter: RenderRequestFilter = {}): Promise<RenderRequest[]> {
  const statuses = filter.openOnly
    ? ["requested", "accepted", "claimed", "rendering"]
    : filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  try {
    const rows = (await db`
      ${SELECT}
      WHERE r.org_id = ${ORG}
        ${filter.threadId ? db`AND r.thread_id = ${filter.threadId}` : db``}
        ${statuses ? db`AND r.status = ANY(${statuses})` : db``}
      ORDER BY (r.status IN ('requested','accepted','claimed','rendering')) DESC, r.priority DESC, r.created_at DESC
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map(mapRequest);
  } catch (err) {
    console.error("[elktours] listRenderRequests:", err);
    return [];
  }
}

export async function getRenderRequest(id: string): Promise<RenderRequest | null> {
  if (!UUID.test(id)) return null;
  const [r] = (await db`${SELECT} WHERE r.id = ${id} AND r.org_id = ${ORG}`) as unknown as Row[];
  return r ? mapRequest(r) : null;
}

export async function openRenderRequest(threadId: string): Promise<RenderRequest | null> {
  const [r] = (await db`
    ${SELECT} WHERE r.thread_id = ${threadId} AND r.org_id = ${ORG} AND r.status IN ('requested','accepted','claimed','rendering')
    ORDER BY r.created_at DESC LIMIT 1
  `) as unknown as Row[];
  return r ? mapRequest(r) : null;
}

const TIMES = ["day", "golden", "dusk"] as const;
const ASPECTS = ["16:9", "9:16", "1:1"] as const;

/** Editors may hint; the camera, line, highlights and the 30 s cap are fixed. */
export function normaliseStyle(input: RenderStyleInput | undefined): RenderStyle {
  const i = (input ?? {}) as RenderStyleInput;
  const style: RenderStyle = { camera: "mapcam", routeLine: "waveform", highlights: false };
  if (i.timeOfDay && (TIMES as readonly string[]).includes(i.timeOfDay)) style.timeOfDay = i.timeOfDay;
  const aspect = Array.isArray(i.aspect) ? [...new Set(i.aspect.filter((a) => (ASPECTS as readonly string[]).includes(a)))] : [];
  style.aspect = aspect.length > 0 ? aspect : ["16:9"];
  const emph = Array.isArray(i.emphasizeStopIds) ? i.emphasizeStopIds.filter((s) => typeof s === "string" && UUID.test(s)).slice(0, 10) : [];
  if (emph.length > 0) style.emphasizeStopIds = emph;
  if (typeof i.notes === "string" && i.notes.trim()) style.notes = i.notes.trim().slice(0, 1000);
  return style;
}

function legKm(legs: [number, number][][]): number {
  let m = 0;
  for (const leg of legs)
    for (let k = 1; k < leg.length; k++) {
      const [lng1, lat1] = leg[k - 1]!;
      const [lng2, lat2] = leg[k]!;
      const x = (lng2 - lng1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
      m += Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111_320;
    }
  return m / 1000;
}

/** Stable JSON (sorted keys) for hashing. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
export function payloadHash(payload: RenderPayload): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

/** Snapshot route + stops + style, or say why the tour cannot be rendered. */
export async function buildRenderPayload(threadId: string, style: RenderStyle): Promise<{ payload: RenderPayload; sha256: string } | { error: string }> {
  const [t] = (await db`
    SELECT id, title, slug, location, metadata FROM threads WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
  `) as unknown as Row[];
  if (!t) return { error: "Tour not found." };
  const meta = (t.metadata ?? {}) as { tour?: { route?: { legs?: unknown; source?: unknown; fetchedAt?: unknown }; meetingPoint?: { lat?: unknown; lng?: unknown } } };
  const route = meta.tour?.route;
  const legs = Array.isArray(route?.legs)
    ? (route!.legs as unknown[])
        .filter((l): l is unknown[] => Array.isArray(l))
        .map((l) => l.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "number" && Number.isFinite(x))))
        .filter((l) => l.length > 0)
    : [];
  if (legs.length === 0) return { error: "The tour has no walking route yet. Save its stops once to make one." };

  const stopRows = (await db`
    SELECT id, position, title, lat, lng, place_id, experience_id FROM tour_stops
    WHERE thread_id = ${threadId} AND org_id = ${ORG} AND lat IS NOT NULL AND lng IS NOT NULL
    ORDER BY position, created_at
  `) as unknown as Row[];
  const stops: RenderPayloadStop[] = stopRows.map((s) => ({
    id: s.id as string,
    position: Number(s.position),
    title: String(s.title).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120),
    lat: Number(s.lat),
    lng: Number(s.lng),
    placeId: (s.place_id as string | null) ?? null,
    experienceId: (s.experience_id as string | null) ?? null,
  }));
  if (stops.length < 2) return { error: "A fly-over needs at least 2 stops with a map position." };
  if (stops.length > 40) return { error: "A fly-over takes at most 40 stops." };
  const inside = (lat: number, lng: number) => lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;
  const outside = stops.find((s) => !inside(s.lat, s.lng));
  if (outside) return { error: `"${outside.title}" is outside Paris; fly-overs cover Paris only.` };
  if (legs.some((l) => l.some(([lng, lat]) => !inside(lat, lng)))) return { error: "The route leaves Paris; fly-overs cover Paris only." };
  const km = legKm(legs);
  if (km > MAX_ROUTE_KM) return { error: `The route is ${km.toFixed(1)} km; a 30-second fly-over covers at most ${MAX_ROUTE_KM} km.` };
  const emph = style.emphasizeStopIds?.filter((id) => stops.some((s) => s.id === id));
  const finalStyle: RenderStyle = { ...style, ...(emph && emph.length > 0 ? { emphasizeStopIds: emph } : {}) };
  if (!emph?.length) delete finalStyle.emphasizeStopIds;

  const mp = meta.tour?.meetingPoint;
  const payload: RenderPayload = {
    schemaVersion: 1,
    tour: { id: t.id as string, title: String(t.title).trim().slice(0, 160), slug: t.slug as string },
    meetingPoint:
      mp && typeof mp.lat === "number" && typeof mp.lng === "number" ? { lat: mp.lat, lng: mp.lng, label: (t.location as string | null) ?? null } : null,
    route: { legs, source: typeof route?.source === "string" ? route.source : "straight", fetchedAt: typeof route?.fetchedAt === "string" ? route.fetchedAt : "" },
    stops,
    style: finalStyle,
    limits: { maxSeconds: MAX_SECONDS },
  };
  return { payload, sha256: payloadHash(payload) };
}

// ── lifecycle (callers check roles) ───────────────────────────────────────

export class RenderError extends Error {}

export async function createRequest(threadId: string, input: { style?: RenderStyleInput; note?: string }, userId: string | null, email?: string | null): Promise<RenderRequest> {
  const [t] = (await db`SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'`) as unknown as Row[];
  if (!t) throw new RenderError("Tour not found.");
  const open = await openRenderRequest(threadId);
  if (open) throw new RenderError("This tour already has an open fly-over request.");
  const style = normaliseStyle(input.style);
  try {
    const [r] = (await db`
      INSERT INTO tour_render_requests (org_id, thread_id, requested_by, requester_email, note, style)
      VALUES (${ORG}, ${threadId}, ${userId}, ${email ?? null}, ${input.note?.trim().slice(0, 2000) || null}, ${db.json(style as never)})
      RETURNING id
    `) as unknown as Row[];
    return (await getRenderRequest(r!.id as string))!;
  } catch (err) {
    if (String((err as { code?: string }).code) === "23505") throw new RenderError("This tour already has an open fly-over request.");
    throw err;
  }
}

/** Freeze the payload and queue it. */
export async function acceptRequest(id: string, userId: string, opts: { priority?: number; autoPublish?: boolean } = {}): Promise<RenderRequest> {
  const req = await getRenderRequest(id);
  if (!req) throw new RenderError("Request not found.");
  if (req.status !== "requested") throw new RenderError(`This request is ${req.status}.`);
  const built = await buildRenderPayload(req.threadId, req.style);
  if ("error" in built) throw new RenderError(built.error);
  await db`
    UPDATE tour_render_requests SET
      status = 'accepted', payload = ${db.json(built.payload as never)}, payload_sha256 = ${built.sha256},
      style = ${db.json(built.payload.style as never)},
      accepted_by = ${userId}, accepted_at = NOW(),
      priority = ${Math.max(-10, Math.min(10, Math.floor(opts.priority ?? req.priority)))},
      auto_publish = ${opts.autoPublish ?? false},
      updated_at = NOW()
    WHERE id = ${id} AND status = 'requested'
  `;
  return (await getRenderRequest(id))!;
}

export async function rejectRequest(id: string, reason: string): Promise<RenderRequest> {
  const req = await getRenderRequest(id);
  if (!req) throw new RenderError("Request not found.");
  if (!["requested", "accepted"].includes(req.status)) throw new RenderError(`This request is ${req.status}.`);
  await db`
    UPDATE tour_render_requests SET status = 'rejected', rejected_reason = ${reason.trim().slice(0, 1000) || null},
      finished_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND status IN ('requested','accepted')
  `;
  return (await getRenderRequest(id))!;
}

export async function cancelRequest(id: string): Promise<RenderRequest> {
  const req = await getRenderRequest(id);
  if (!req) throw new RenderError("Request not found.");
  if (!["requested", "accepted"].includes(req.status)) throw new RenderError(`A ${req.status} request cannot be cancelled.`);
  await db`
    UPDATE tour_render_requests SET status = 'cancelled', finished_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND status IN ('requested','accepted')
  `;
  return (await getRenderRequest(id))!;
}

/** A failed request back to accepted, with a fresh snapshot and attempts reset. */
export async function requeueRequest(id: string, userId: string): Promise<RenderRequest> {
  const req = await getRenderRequest(id);
  if (!req) throw new RenderError("Request not found.");
  if (req.status !== "failed") throw new RenderError("Only a failed request can be re-queued.");
  if (await openRenderRequest(req.threadId)) throw new RenderError("This tour already has an open fly-over request.");
  const built = await buildRenderPayload(req.threadId, req.style);
  if ("error" in built) throw new RenderError(built.error);
  await db`
    UPDATE tour_render_requests SET
      status = 'accepted', payload = ${db.json(built.payload as never)}, payload_sha256 = ${built.sha256},
      accepted_by = ${userId}, accepted_at = NOW(), attempts = 0, progress = 0,
      error_code = NULL, error = NULL, worker_id = NULL, claimed_at = NULL, heartbeat_at = NULL,
      started_at = NULL, finished_at = NULL, updated_at = NOW()
    WHERE id = ${id} AND status = 'failed'
  `;
  return (await getRenderRequest(id))!;
}

// ── worker side (scripts/render-jobs.mts) ─────────────────────────────────

export interface ClaimedJob {
  id: string;
  threadId: string;
  attempts: number;
  payloadSha256: string;
  payload: RenderPayload;
}

/** Take the next accepted request, or a stale claimed/rendering one. Null when the queue is empty. */
export async function claimNext(workerId: string): Promise<ClaimedJob | null> {
  const rows = (await db`
    WITH picked AS (
      SELECT id FROM tour_render_requests
      WHERE org_id = ${ORG} AND payload IS NOT NULL
        AND (status = 'accepted'
             OR (status IN ('claimed','rendering') AND heartbeat_at < NOW() - (${STALE_MINUTES} || ' minutes')::interval))
        AND attempts < max_attempts
      ORDER BY priority DESC, accepted_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE tour_render_requests r SET
      status = 'claimed', worker_id = ${workerId}, claimed_at = NOW(), heartbeat_at = NOW(),
      attempts = r.attempts + 1, progress = 0, error_code = NULL, error = NULL, updated_at = NOW()
    FROM picked WHERE r.id = picked.id
    RETURNING r.id, r.thread_id, r.attempts, r.payload_sha256, r.payload
  `) as unknown as Row[];
  const r = rows[0];
  if (!r) {
    // Stale jobs that ran out of attempts: fail them so they stop blocking the tour.
    await db`
      UPDATE tour_render_requests SET status = 'failed', error_code = COALESCE(error_code, 'stale'),
        error = COALESCE(error, 'The worker stopped reporting and no attempts are left.'), finished_at = NOW(), updated_at = NOW()
      WHERE org_id = ${ORG} AND status IN ('claimed','rendering') AND attempts >= max_attempts
        AND heartbeat_at < NOW() - (${STALE_MINUTES} || ' minutes')::interval
    `;
    return null;
  }
  return {
    id: r.id as string,
    threadId: r.thread_id as string,
    attempts: Number(r.attempts),
    payloadSha256: r.payload_sha256 as string,
    payload: r.payload as RenderPayload,
  };
}

export async function heartbeat(id: string, workerId: string, progress: number | null, rendering: boolean): Promise<boolean> {
  const p = progress == null || !Number.isFinite(progress) ? null : Math.max(0, Math.min(1, progress));
  const rows = (await db`
    UPDATE tour_render_requests SET
      heartbeat_at = NOW(),
      progress = COALESCE(${p}::real, progress),
      status = CASE WHEN ${rendering} THEN 'rendering' ELSE status END,
      started_at = CASE WHEN ${rendering} AND started_at IS NULL THEN NOW() ELSE started_at END,
      updated_at = NOW()
    WHERE id = ${id} AND worker_id = ${workerId} AND status IN ('claimed','rendering')
    RETURNING id
  `) as unknown as Row[];
  return rows.length > 0;
}

/** Retryable codes go back to accepted while attempts remain; the rest fail. */
export async function failJob(id: string, workerId: string, code: string, message: string): Promise<RenderStatus | null> {
  const retry = RETRYABLE_CODES.includes(code);
  const rows = (await db`
    UPDATE tour_render_requests SET
      status = CASE WHEN ${retry} AND attempts < max_attempts THEN 'accepted' ELSE 'failed' END,
      error_code = ${code.slice(0, 40)}, error = ${message.slice(0, 2000)},
      worker_id = CASE WHEN ${retry} AND attempts < max_attempts THEN NULL ELSE worker_id END,
      finished_at = CASE WHEN ${retry} AND attempts < max_attempts THEN NULL ELSE NOW() END,
      updated_at = NOW()
    WHERE id = ${id} AND worker_id = ${workerId} AND status IN ('claimed','rendering')
    RETURNING status
  `) as unknown as Row[];
  return (rows[0]?.status as RenderStatus | undefined) ?? null;
}
