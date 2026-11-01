import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { PURELAND_GAME, PURELAND_ORG, SAVE_MAX_BYTES, getPurelandViewer } from "@/lib/pureland";

/**
 * The player's Pureland save, kept on their account (game_saves, migration 197).
 * Used by the game's web shell (BuddhasEngines8 godot/web/shell.html, "cloud save"):
 *
 *   GET  → { enabled, savedAt, bytes, files? }       files only with ?files=1
 *   PUT  { savedAt, files: { "<path>": { t, b64 } } } → { ok, savedAt, bytes }
 *
 * Members only (owner/guide/member of BuddhasEngines). PUT needs the player's "save to my
 * account" switch on (409 otherwise) and is capped at SAVE_MAX_BYTES of JSON. Paths are the
 * game's user:// files relative to its user directory: no "..", no absolute paths.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SAFE_PATH = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./ -]{0,200}$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const viewer = await getPurelandViewer();
  if (!viewer?.canPlay) return json({ error: "not a member" }, viewer ? 403 : 401);
  const withFiles = request.nextUrl.searchParams.get("files") === "1";
  const [row] = await db<{ enabled: boolean; files: unknown; bytes: number; client_saved_at: Date | null }[]>`
    SELECT enabled, files, bytes, client_saved_at FROM game_saves
    WHERE user_id = ${viewer.userId} AND game = ${PURELAND_GAME}
  `;
  return json({
    enabled: row?.enabled ?? false,
    savedAt: row?.client_saved_at ? row.client_saved_at.getTime() : null,
    bytes: row?.bytes ?? 0,
    ...(withFiles && row?.enabled ? { files: row.files ?? {} } : {}),
  });
}

export async function PUT(request: NextRequest) {
  const viewer = await getPurelandViewer();
  if (!viewer?.canPlay) return json({ error: "not a member" }, viewer ? 403 : 401);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > SAVE_MAX_BYTES) return json({ error: "save too large" }, 413);
  const text = await request.text();
  if (text.length > SAVE_MAX_BYTES) return json({ error: "save too large" }, 413);

  let body: { savedAt?: unknown; files?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "not JSON" }, 400);
  }
  const files = body.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) return json({ error: "files missing" }, 400);
  for (const [key, value] of Object.entries(files as Record<string, unknown>)) {
    const v = value as { t?: unknown; b64?: unknown } | null;
    if (!SAFE_PATH.test(key) || !v || typeof v.t !== "number" || typeof v.b64 !== "string") {
      return json({ error: `bad entry ${key.slice(0, 80)}` }, 400);
    }
  }
  const savedAt = typeof body.savedAt === "number" && Number.isFinite(body.savedAt) ? new Date(body.savedAt) : new Date();

  const rows = await db<{ bytes: number }[]>`
    UPDATE game_saves
    SET files = ${db.json(files as never)}, bytes = ${text.length}, client_saved_at = ${savedAt}, updated_at = now()
    WHERE user_id = ${viewer.userId} AND game = ${PURELAND_GAME} AND org_id = ${PURELAND_ORG} AND enabled
    RETURNING bytes
  `;
  if (rows.length === 0) return json({ error: "saving to your account is off" }, 409);
  return json({ ok: true, savedAt: savedAt.getTime(), bytes: rows[0].bytes });
}
