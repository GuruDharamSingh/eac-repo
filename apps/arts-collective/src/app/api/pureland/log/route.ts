import { appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { PURELAND_RELEASES, getPurelandViewer } from "@/lib/pureland";

/**
 * Pureland's remote diagnostics: the game's web shell (BuddhasEngines8 godot/web/shell.html,
 * "diagnostics") posts what happened on a real device — the browser, the GPU and its texture
 * formats, the pack it chose, load timings, JS errors, the Godot console for the first minute,
 * frame times after the reveal and a small snapshot of the view — so phone problems can be read
 * on the server.
 *
 *   POST { sid, seq, events: [...] }  → { ok }       members only, ≤ LOG_MAX_BYTES per post
 *
 * Appended as one JSON line per post to var/pureland/logs/<UTC date>.jsonl (beside the releases,
 * gitignored). Rate-limited per user in memory; each day's file is capped at DAY_MAX_BYTES.
 * The player turns it off on /pureland ("Send diagnostics"), which the shell reads from
 * localStorage; the server accepts whatever arrives from a member.
 * Read: ssh eris 'tail -n 20 ~/eac/var/pureland/logs/$(date -u +%F).jsonl' (or
 * BuddhasEngines8 scripts/pureland-logs.sh).
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const LOG_MAX_BYTES = 16 * 1024;
const DAY_MAX_BYTES = 50 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_POSTS = 60;
const LOG_DIR = path.join(PURELAND_RELEASES, "logs");

const recent = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function allow(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= WINDOW_POSTS) {
    recent.set(userId, list);
    return false;
  }
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 500) {
    for (const [k, v] of recent) if (!v.some((t) => now - t < WINDOW_MS)) recent.delete(k);
  }
  return true;
}

export async function POST(request: NextRequest) {
  const viewer = await getPurelandViewer();
  if (!viewer?.canPlay) return json({ error: "not a member" }, viewer ? 403 : 401);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > LOG_MAX_BYTES) return json({ error: "too large" }, 413);
  const text = await request.text();
  if (text.length > LOG_MAX_BYTES) return json({ error: "too large" }, 413);
  if (!allow(viewer.userId)) return json({ error: "slow down" }, 429);

  let body: { sid?: unknown; seq?: unknown; events?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "not JSON" }, 400);
  }
  if (!Array.isArray(body.events)) return json({ error: "events missing" }, 400);

  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.jsonl`);
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const size = await stat(file).then((s) => s.size, () => 0);
    if (size > DAY_MAX_BYTES) return json({ error: "log full for today" }, 507);
    const line = JSON.stringify({
      at: new Date().toISOString(),
      user: viewer.email,
      role: viewer.role,
      sid: typeof body.sid === "string" ? body.sid.slice(0, 40) : null,
      seq: typeof body.seq === "number" ? body.seq : null,
      ua: (request.headers.get("user-agent") ?? "").slice(0, 300),
      events: body.events,
    });
    await appendFile(file, line + "\n", "utf8");
  } catch (e) {
    console.error("pureland log: could not write", e);
    return json({ error: "could not write" }, 500);
  }
  return json({ ok: true });
}
