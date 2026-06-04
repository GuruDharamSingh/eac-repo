import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || "";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || "";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || "";

function encodeWebdavPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Proxy route serving Nextcloud media (admin-credentialed WebDAV) to browsers.
 * Public artwork images live under EAC_Network/<org>/Media/Images. Anything in
 * a /Private/ subtree is rejected here (this storefront only serves public art).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join("/");

    if (!filePath || filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    if (!filePath.startsWith("EAC_Network/") || filePath.includes("/Private/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextcloudUrl = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(
      NEXTCLOUD_USER
    )}/${encodeWebdavPath(filePath)}`;
    const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString(
      "base64"
    );

    const range = _request.headers.get("range") || undefined;
    const response = await fetch(nextcloudUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        ...(range ? { Range: range } : {}),
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const headers = new Headers();
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];
    for (const key of passthrough) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("[art-auction media proxy] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
