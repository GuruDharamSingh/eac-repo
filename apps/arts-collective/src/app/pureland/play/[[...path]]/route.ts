import { createReadStream, type Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { currentRelease, getPurelandViewer } from "@/lib/pureland";

/**
 * The game itself, members only: every file of the current release is checked against the
 * session and the BuddhasEngines role before a byte is sent (a real check, not an unguessable
 * path). Signed out or not a member: the page at /pureland explains; files answer 404.
 *
 * - index.html gets <base href="/pureland/play/"> (Next drops the trailing slash, and the shell
 *   loads index.js, the .pck and the .wasm files relative to the page) and is never cached.
 * - Everything else: the .br/.gz sidecar the deploy script wrote, when the browser accepts it
 *   (Content-Encoding set, so nothing downstream compresses it again), application/wasm for
 *   WebAssembly (streaming compile), ETag + no-cache so a repeat visit costs 304s only.
 * - Streams from disk: the 100 MB pack never sits in the server's memory.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const segments = (await params).path ?? [];
  const name = segments.length === 0 ? "index.html" : segments.length === 1 ? segments[0] : "";
  const ext = path.extname(name).toLowerCase();
  if (!SAFE_NAME.test(name) || !(ext in TYPES) || name === "RELEASE.txt") return notFound();

  const viewer = await getPurelandViewer();
  if (!viewer?.canPlay) {
    if (name === "index.html") {
      return NextResponse.redirect(new URL("/pureland", process.env.ARTS_COLLECTIVE_URL || request.nextUrl.origin), 302);
    }
    return notFound();
  }

  const release = await currentRelease();
  if (!release) return notFound();
  const file = path.join(release.dir, name);

  if (name === "index.html") {
    const html = await readFile(file, "utf8").catch(() => null);
    if (html === null) return notFound();
    return new NextResponse(html.replace(/<head>/i, '<head>\n<base href="/pureland/play/">'), {
      headers: {
        "Content-Type": TYPES[".html"],
        "Cache-Control": "private, no-cache",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // Pick the representation: brotli, gzip, or the file itself.
  const accept = request.headers.get("accept-encoding") ?? "";
  let chosen = file;
  let encoding: string | null = null;
  let info: Stats | null = null;
  for (const [suffix, enc] of [[".br", "br"], [".gz", "gzip"]] as const) {
    if (!new RegExp(`\\b${enc}\\b`).test(accept)) continue;
    info = await stat(file + suffix).catch(() => null);
    if (info?.isFile()) {
      chosen = file + suffix;
      encoding = enc;
      break;
    }
    info = null;
  }
  if (!info) {
    info = await stat(file).catch(() => null);
    if (!info?.isFile()) return notFound();
  }

  const etag = `"${release.id}-${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}${encoding ? `-${encoding}` : ""}"`;
  const headers: Record<string, string> = {
    "Content-Type": TYPES[ext],
    "Cache-Control": "private, no-cache",
    ETag: etag,
    Vary: "Accept-Encoding, Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  if (encoding) headers["Content-Encoding"] = encoding;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  headers["Content-Length"] = String(info.size);
  const body = Readable.toWeb(createReadStream(chosen)) as ReadableStream<Uint8Array>;
  return new NextResponse(body, { status: 200, headers });
}
