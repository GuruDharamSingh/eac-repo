import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";

const APPS = new Set(["jerusalem"]);
const KINDS = new Set(["index-entry", "prep", "episode", "note", "mark", "reading"]);
const MAX_RECORDS = 500;
const MAX_BYTES = 200_000;

interface InRecord {
  kind: string;
  id: string;
  data?: unknown;
  updatedAt: string;
  deleted?: boolean;
}

/**
 * POST /api/mobile/v1/sync — two-way sync of an app's records (migration 195).
 *
 *   { app: "jerusalem", since?: ISO, records: [{ kind, id, data, updatedAt, deleted? }] }
 *   → { records: [...changed on the server since `since`], now: ISO }
 *
 * Push: each record is kept when it is newer than what the server has
 * (last write wins on updatedAt); deleted=true leaves a tombstone. Pull: every
 * record the server took in after `since`, including tombstones, so a second
 * device converges. Any signed-in person may sync their own records.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { app?: string; since?: string; records?: InRecord[] } | null;
  if (!body || !APPS.has(body.app ?? "")) return NextResponse.json({ error: "Unknown app" }, { status: 400 });
  const records = Array.isArray(body.records) ? body.records.slice(0, MAX_RECORDS) : [];

  let taken = 0;
  for (const r of records) {
    if (!r || !KINDS.has(r.kind) || typeof r.id !== "string" || !r.id || r.id.length > 120) continue;
    const at = new Date(r.updatedAt);
    if (Number.isNaN(at.getTime())) continue;
    const data = r.deleted ? {} : (r.data ?? {});
    if (JSON.stringify(data).length > MAX_BYTES) continue;
    const rows = await db`
      INSERT INTO app_records (user_id, app, kind, record_id, data, updated_at, deleted_at, synced_at)
      VALUES (${viewer.userId}, ${body.app!}, ${r.kind}, ${r.id}, ${db.json(data as never)}, ${at}, ${r.deleted ? at : null}, now())
      ON CONFLICT (user_id, app, kind, record_id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, synced_at = now()
        WHERE app_records.updated_at < EXCLUDED.updated_at
      RETURNING record_id
    `;
    taken += rows.length;
  }

  const since = body.since && !Number.isNaN(Date.parse(body.since)) ? new Date(body.since) : new Date(0);
  const now = new Date();
  const changed = await db<{ kind: string; record_id: string; data: unknown; updated_at: Date; deleted_at: Date | null }[]>`
    SELECT kind, record_id, data, updated_at, deleted_at FROM app_records
    WHERE user_id = ${viewer.userId} AND app = ${body.app!} AND synced_at > ${since} AND synced_at <= ${now}
    ORDER BY synced_at
  `;
  return NextResponse.json({
    taken,
    now: now.toISOString(),
    records: changed.map((c) => ({ kind: c.kind, id: c.record_id, data: c.data, updatedAt: c.updated_at.toISOString(), deleted: !!c.deleted_at })),
  });
}
