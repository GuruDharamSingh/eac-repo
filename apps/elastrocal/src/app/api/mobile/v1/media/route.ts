import { NextResponse, type NextRequest } from "next/server";
import { davAuthHeader, davMkcol, davUrl, resolveOrgPath } from "@elkdonis/services";
import { davPutStream } from "@elkdonis/services/reels";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const MB = 1024 * 1024;
const RULES: Record<string, { kinds: string[]; max: number }> = {
  audio: { kinds: ["audio/"], max: 200 * MB },
  image: { kinds: ["image/"], max: 40 * MB },
  video: { kinds: ["video/"], max: 1000 * MB },
};

/**
 * PUT /api/mobile/v1/media?type=audio|image|video&name=<file name>
 *
 * The raw file as the body, streamed straight to Nextcloud (phone video runs
 * to hundreds of megabytes). It lands in the Elastrocal org's private tree,
 * Private/Jerusalem/<yyyy-mm>/, which only owners can see; the response is
 * the org-relative path the app keeps in its records, and that the YouTube
 * worker reads when an episode is published. Owners only.
 */
export async function PUT(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Owners only" }, { status: 403 });

  const q = request.nextUrl.searchParams;
  const rule = RULES[q.get("type") ?? ""];
  if (!rule) return NextResponse.json({ error: "type is audio, image or video" }, { status: 400 });
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  if (!rule.kinds.some((k) => contentType.startsWith(k))) return NextResponse.json({ error: `Expected ${rule.kinds.join(" or ")}` }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > rule.max) return NextResponse.json({ error: "File too large" }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "No file" }, { status: 400 });

  const name = (q.get("name") ?? "file").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").replace(/^\.+/, "").slice(-120) || "file";
  const month = new Date().toISOString().slice(0, 7);
  const folder = `Private/Jerusalem/${month}`;
  const relative = `${folder}/${Date.now()}-${name}`;

  // MKCOL is not recursive: make each level (existing ones answer 405, which is fine).
  const root = resolveOrgPath(siteConfig.orgId, "");
  let path = root;
  for (const part of folder.split("/")) {
    path = `${path}/${part}`;
    await davMkcol(path).catch(() => false);
  }
  const ok = await davPutStream(resolveOrgPath(siteConfig.orgId, relative), request.body, contentType, request.headers.get("content-length"));
  if (!ok) return NextResponse.json({ error: "The file could not be stored" }, { status: 502 });
  return NextResponse.json({ path: relative, bytes: length || null }, { status: 201 });
}

/**
 * GET /api/mobile/v1/media?path=Private/Jerusalem/<yyyy-mm>/<file>
 *
 * Streams a file the app uploaded back out of Nextcloud, for the hub's
 * Readings page (images, voice, takes). Owners only, like the folder; only
 * paths under Private/Jerusalem/. Range requests pass through so video seeks.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Owners only" }, { status: 403 });
  const rel = request.nextUrl.searchParams.get("path") ?? "";
  if (!rel.startsWith("Private/Jerusalem/") || rel.includes("..")) return NextResponse.json({ error: "Not a Jerusalem file" }, { status: 400 });
  let url: string;
  try {
    url = davUrl(resolveOrgPath(siteConfig.orgId, rel));
  } catch {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const range = request.headers.get("range");
  const res = await fetch(url, { headers: { authorization: davAuthHeader(), ...(range ? { range } : {}) } });
  if (!res.ok || !res.body) return NextResponse.json({ error: "Not found" }, { status: res.status === 404 ? 404 : 502 });
  const headers = new Headers({ "cache-control": "private, max-age=3600" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
