import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || "http://nextcloud-nginx:80";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || "elkdonis";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || "";

// Root folder (under the Nextcloud account's home) that holds the marketplace.
// Every artist gets their own subfolder beneath it, so artwork media lives at:
//   <MARKETPLACE_NEXTCLOUD_ROOT>/<artistFolder>/Images/<file>
// Env-driven so dev and prod can point at different roots/instances.
const MARKETPLACE_ROOT = process.env.MARKETPLACE_NEXTCLOUD_ROOT || "marketplace";
const MAX_IMAGE_MB = 25;

function encodeWebdavPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function davUrl(path: string): string {
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(
    NEXTCLOUD_USER
  )}/${encodeWebdavPath(path)}`;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64")}`;
}

/**
 * Idempotently create each folder in a relative path via WebDAV MKCOL.
 * Nextcloud returns 405 (Method Not Allowed) when a collection already exists,
 * which we treat as success. Without this, the first PUT into a fresh artist
 * folder would 409 because the parent collection doesn't exist yet.
 */
async function ensureFolderTree(relativeDir: string): Promise<void> {
  const segments = relativeDir.split("/").filter(Boolean);
  let current = "";
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    const res = await fetch(davUrl(current), {
      method: "MKCOL",
      headers: { Authorization: authHeader() },
    });
    // 201 created, 405 already exists → both fine. Anything else: surface it.
    if (res.status !== 201 && res.status !== 405) {
      const text = await res.text().catch(() => "");
      throw new Error(`MKCOL ${current} failed ${res.status}: ${text}`);
    }
  }
}

/**
 * Multi-image artwork upload. Auth-gated: only signed-in marketplace artists may
 * upload. Files land in the artist's own subfolder under the marketplace root on
 * Nextcloud (admin-credentialed WebDAV) and are served back through /api/media.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.db_user_id ?? session.user.id;

    // Each artist gets a personal folder under the marketplace root. We key it
    // by the marketplace_artists user_id (stable + unique). Only approved
    // marketplace artists may upload here.
    let artistFolder: string | null = null;
    try {
      const rows = (await db`
        SELECT user_id::text AS uid FROM marketplace_artists
        WHERE user_id = ${userId} LIMIT 1
      `) as unknown as Array<{ uid: string }>;
      if (rows[0]?.uid) artistFolder = rows[0].uid;
    } catch {
      // fall through to the 403 below
    }
    if (!artistFolder) {
      return NextResponse.json(
        { error: "Only marketplace artists can upload artwork media." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Image must be smaller than ${MAX_IMAGE_MB}MB` },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const relativeDir = `${MARKETPLACE_ROOT}/${artistFolder}/Images`;
    const relativePath = `${relativeDir}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Make sure marketplace/<artist>/Images exists before the PUT.
    await ensureFolderTree(relativeDir);

    const res = await fetch(davUrl(relativePath), {
      method: "PUT",
      headers: {
        Authorization: authHeader(),
        "Content-Type": file.type,
      },
      body: buffer,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[art-auction upload] Nextcloud PUT failed ${res.status}: ${text}`);
      return NextResponse.json(
        { error: "Failed to upload file to storage." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: `/api/media/${relativePath}`,
      path: relativePath,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("[art-auction upload] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
