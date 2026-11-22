import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import { getProxyFileUrl, getUploadPath, uploadFile, uploadFilename } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { getViewer } from "@/lib/auth";
import { stripImageMetadata } from "@/lib/assets";
import { siteConfig } from "@/config/site";

/**
 * POST /api/upload/forum  (multipart: file, audience?)
 *
 * Photos and videos for forum topics, replies and feed posts, from any signed-in person who has a
 * row in this org (followers included). /api/upload stays editor-only; this is the narrow door for
 * everyone else: image and video only, smaller caps, EXIF removed from photos, rate limited per person.
 *
 * `audience` follows the topic: "everyone" (default) stores under the public Media tree; "followers"
 * and "author" store under Private/ (served only to people with a row in this org, by /api/media).
 * Returns { url, kind, width?, height? }. Same storage helpers and media row as /api/upload.
 */
export const dynamic = "force-dynamic";

const ORG = siteConfig.orgId;
const CAPS = { image: 15, video: 100 } as const; // MB; editors get 25 and 500 on /api/upload
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function limited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(userId, recent); return true; }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await getViewer();
    if (!viewer) return NextResponse.json({ error: "Sign in to add photos or video." }, { status: 401 });
    if (!viewer.isAffiliate) return NextResponse.json({ error: "Follow us to add photos or video." }, { status: 403 });
    if (limited(viewer.userId)) return NextResponse.json({ error: "Slow down, try again in a few minutes." }, { status: 429, headers: { "Retry-After": "300" } });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const audience = String(form.get("audience") ?? "everyone");
    const visibility = audience === "followers" ? "ORGANIZATION" : audience === "author" ? "INVITE_ONLY" : "PUBLIC";

    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    if (!kind) return NextResponse.json({ error: "Photos and videos only." }, { status: 400 });
    if (file.size > CAPS[kind] * 1024 * 1024) {
      return NextResponse.json({ error: `${kind === "image" ? "Photos" : "Videos"} can be up to ${CAPS[kind]} MB.` }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    // The MIME string is the client's claim (and image/svg+xml starts with image/): check the bytes.
    const sniff = validateUploadBuffer(buffer, [kind]);
    if (!sniff.ok) return NextResponse.json({ error: "reason" in sniff ? sniff.reason : "Rejected" }, { status: 415 });

    let mime = file.type;
    let name = uploadFilename(file.name, null);
    let width: number | undefined;
    let height: number | undefined;
    if (kind === "image") {
      try {
        const out = await stripImageMetadata(buffer);
        buffer = out.stripped;
        mime = out.mime;
        name = name.replace(/\.[a-z0-9]+$/i, "") + `.${out.ext}`;
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        width = meta.width;
        height = meta.height;
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "That photo could not be read." }, { status: 422 });
      }
    }

    const path = getUploadPath(ORG, kind === "image" ? "Images" : "Videos", name, visibility);
    if (!(await uploadFile(path, buffer, mime))) return NextResponse.json({ error: "Could not store the file." }, { status: 500 });
    const url = getProxyFileUrl(path);

    await db`
      INSERT INTO media (id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type, filename, size_bytes, mime_type)
      VALUES (${nanoid()}, ${ORG}, ${viewer.userId}, ${name}, ${path}, ${url}, ${kind}, ${file.name}, ${buffer.length}, ${mime})
    `.catch((err) => console.error("[elktours] upload/forum media row:", err));

    return NextResponse.json({ url, kind, ...(width ? { width } : {}), ...(height ? { height } : {}) });
  } catch (err) {
    console.error("[elktours] POST /api/upload/forum:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
