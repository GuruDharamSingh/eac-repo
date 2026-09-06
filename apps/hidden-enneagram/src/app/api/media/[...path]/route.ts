import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Serves files out of Nextcloud. /api/upload writes media rows whose `url`
 * is `/api/media/<path>` (getProxyFileUrl) — this is that route. Nextcloud
 * credentials stay server-side; the browser only ever sees this URL.
 */

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || "";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || "";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || "";

function encodeWebdavPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!NEXTCLOUD_URL) {
    return NextResponse.json({ error: "Media storage is not configured" }, { status: 503 });
  }

  const { path } = await params;
  const filePath = path.join("/");

  if (!filePath || filePath.includes("..") || filePath.includes("\\")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!filePath.startsWith(`EAC_Network/${siteConfig.orgId}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (filePath.includes("/Private/")) {
    const viewer = await getViewer();
    if (!viewer?.isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(
    NEXTCLOUD_USER
  )}/${encodeWebdavPath(filePath)}`;
  const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64");
  const range = request.headers.get("range") || undefined;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const headers = new Headers();
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error(`[hidden-enneagram] media proxy(${filePath}):`, err);
    return NextResponse.json({ error: "Could not load the file" }, { status: 502 });
  }
}
