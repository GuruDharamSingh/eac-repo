import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || "http://nextcloud-nginx:80";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || "elkdonis";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || "";

const DEFAULT_ORG = "market";
const MAX_IMAGE_MB = 25;

function encodeWebdavPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Multi-image artwork upload. Auth-gated: only signed-in marketplace artists may
 * upload. Files land in the artist's org folder on Nextcloud (admin-credentialed
 * WebDAV) and are served back through the /api/media proxy.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.db_user_id ?? session.user.id;

    // Scope uploads to the artist's org folder (falls back to the neutral org).
    let orgId = DEFAULT_ORG;
    try {
      const rows = (await db`
        SELECT org_id FROM marketplace_artists WHERE user_id = ${userId} LIMIT 1
      `) as unknown as Array<{ org_id: string }>;
      if (rows[0]?.org_id) orgId = rows[0].org_id;
    } catch {
      // keep default org
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
    const relativePath = `EAC_Network/${orgId}/Media/Images/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString(
      "base64"
    );
    const url = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(
      NEXTCLOUD_USER
    )}/${encodeWebdavPath(relativePath)}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
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
