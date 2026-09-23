import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Serves files out of Nextcloud.
 *
 * /api/upload has always written media rows whose `url` is `/api/media/<path>`
 * (that's what getProxyFileUrl returns), but this app had no route to serve
 * them — every uploaded image 404'd. This is that route.
 *
 * Nextcloud credentials stay server-side; the browser only ever sees this URL.
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

  // Path traversal guard, and scope to this org's folder only — this app has
  // no business serving another org's media even though one admin account can
  // technically reach all of it.
  if (!filePath || filePath.includes("..") || filePath.includes("\\")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  // Three legitimate trees: this org's own assets, a person's own folder
  // (a member's portrait/work follows the person, not the org), and any org's
  // `Profile Pictures/` folder. A sanity bound on the subtree only —
  // canReadMedia below is the access decision.
  //
  // The third one is why this site could not draw its own subject's face.
  // A person's portrait is NETWORK identity: `users.avatar_url` is one column,
  // it follows them to every EAC site, and it points wherever the upload
  // happened to land. Sunjay's is
  // `EAC_Network/inner_group/Profile Pictures/…`, because he was photographed
  // as an inner_group member — so an org-scoped bound 404s it here and the
  // card renders alt text where his face should be. Every site that shows a
  // cross-org roster has this bug latent.
  //
  // Scoped to that exact folder name, NOT to the whole foreign org tree, and
  // `canReadMedia` still makes the real decision: it denies any path with a
  // `private` segment regardless of what this bound permits.
  const allowedPrefixes = [`EAC_Network/${siteConfig.orgId}/`, "EAC_Network/users/"];
  const isProfilePicture = /^EAC_Network\/[^/]+\/Profile Pictures\/[^/]+$/.test(filePath);
  if (!isProfilePicture && !allowedPrefixes.some((p) => filePath.startsWith(p))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Public media is served to anyone; private media requires affiliation with
  // whoever owns it. This replaced a plain `viewer.isMember` check, which
  // asked whether the viewer belonged to THIS org — the right question for
  // this org's own Private/ tree, but the wrong one for a person's folder,
  // where it would have let any member here read any individual's private
  // media across the whole network.
  const { canReadMedia } = await import("@elkdonis/services");
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  if (!(await canReadMedia(viewerId, filePath))) {
    return NextResponse.json(
      { error: viewerId ? "Not found" : "Unauthorized" },
      { status: viewerId ? 404 : 401 }
    );
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
    // Content at a given path is immutable in practice (filenames are
    // timestamped on upload), so let browsers keep it.
    // A response whose visibility was just decided per-viewer must never be
    // stored by a shared cache: marking it public+immutable would serve one
    // org's private file to the next requester for a year, so revoking a
    // membership would not revoke the leak.
    headers.set(
      "Cache-Control",
      filePath.includes("/Private/")
        ? "private, no-store"
        : "public, max-age=31536000, immutable"
    );

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error(`[sunjay] media proxy(${filePath}):`, err);
    return NextResponse.json({ error: "Could not load the file" }, { status: 502 });
  }
}
