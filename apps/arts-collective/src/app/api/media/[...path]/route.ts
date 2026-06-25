import { NextRequest, NextResponse } from "next/server";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL ?? "";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER ?? "";
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD ?? "";

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
  const { path } = await params;
  const filePath = path.join("/");

  if (!filePath || filePath.includes("..") || filePath.includes("\\")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!filePath.startsWith("EAC_Network/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextcloudUrl = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encodeWebdavPath(filePath)}`;
  const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64");

  const range = request.headers.get("range") ?? undefined;

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
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const val = response.headers.get(key);
    if (val) headers.set(key, val);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // Uploaded files are untrusted: never let the browser sniff types, and only
  // render known-passive media inline. Anything scriptable when navigated to
  // directly (SVG, HTML, XML, ...) downloads instead of rendering.
  headers.set("X-Content-Type-Options", "nosniff");
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const inlineSafe =
    /^(image\/(jpeg|png|gif|webp|avif|bmp|x-icon)|video\/|audio\/|application\/pdf|font\/)/.test(
      contentType
    );
  headers.set(
    "Content-Disposition",
    inlineSafe ? "inline" : "attachment"
  );

  return new NextResponse(response.body, { status: response.status, headers });
}
