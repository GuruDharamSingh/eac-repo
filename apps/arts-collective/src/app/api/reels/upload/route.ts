import { NextRequest, NextResponse } from "next/server";
import { davPutStream, reelUploadPath, REEL_SLOTS, type ReelSlot } from "@elkdonis/services/reels";
import { getCurrentUser } from "@/lib/session";

/**
 * Studio Video uploads: `POST ?project=&slot=&name=` with the raw file as
 * the body. The body is streamed straight to Nextcloud, not parsed as a form:
 * phone video runs to hundreds of megabytes and this container's heap is
 * 1 GB. Where the file lands is decided by reelUploadPath (project folder, or
 * the person's private Music folder), from the session user and the stored
 * project, never from the request.
 */

const MB = 1024 * 1024;
const RULES: Record<ReelSlot, { kinds: string[]; max: number }> = {
  logo: { kinds: ["image/"], max: 20 * MB },
  artwork: { kinds: ["image/"], max: 40 * MB },
  clip: { kinds: ["video/"], max: 1024 * MB },
  clip2: { kinds: ["video/"], max: 1024 * MB },
  extra: { kinds: ["image/", "video/"], max: 1024 * MB },
  music: { kinds: ["audio/"], max: 80 * MB },
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload" }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const project = q.get("project") ?? "";
  const slot = q.get("slot") as ReelSlot;
  const name = (q.get("name") ?? "").slice(0, 200);
  if (!project || !REEL_SLOTS.includes(slot) || !name) {
    return NextResponse.json({ error: "Missing project, slot or file name" }, { status: 400 });
  }

  const type = request.headers.get("content-type") ?? "";
  const rule = RULES[slot];
  if (!rule.kinds.some((k) => type.startsWith(k))) {
    return NextResponse.json({ error: `That slot takes ${rule.kinds.join(" or ").replace(/\//g, "")} files` }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!length) return NextResponse.json({ error: "Empty upload" }, { status: 411 });
  if (length > rule.max) {
    return NextResponse.json({ error: `Too large: the limit is ${Math.round(rule.max / MB)} MB` }, { status: 413 });
  }

  const target = await reelUploadPath(user.id, project, slot, name);
  if (!target.ok || !target.path) return NextResponse.json({ error: target.error ?? "Not found" }, { status: 404 });
  if (!request.body) return NextResponse.json({ error: "Empty upload" }, { status: 400 });

  const ok = await davPutStream(target.path, request.body, type, String(length));
  if (!ok) return NextResponse.json({ error: "Storage refused the file" }, { status: 502 });
  return NextResponse.json({ path: target.path });
}
