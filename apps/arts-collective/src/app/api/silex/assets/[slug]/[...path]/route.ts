import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/org";
import {
  downloadPublishedFile,
  joinPublishedAssetPath,
  parseSilexPublishedRef,
} from "@/lib/silex-published";

// Published pages render through SilexSite (sanitized server-side); this route
// only serves passive assets. Raw .html/.js are intentionally absent — serving
// owner-authored HTML/JS verbatim from the app origin would bypass the
// sanitizer entirely.
const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
};

function contentTypeFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path } = await ctx.params;
  const org = await getOrgBySlug(slug);
  if (!org?.silex_published_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ref = parseSilexPublishedRef(org.silex_published_path);
  if (!ref) {
    return new NextResponse("Not found", { status: 404 });
  }

  const assetPath = joinPublishedAssetPath(ref.path, path);
  if (!assetPath) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const contentType = contentTypeFor(assetPath);
  if (!contentType) {
    // Unknown or disallowed extension (.html/.js included) — not served raw.
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await downloadPublishedFile({ ...ref, path: assetPath });
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
  };
  if (contentType === "image/svg+xml") {
    // SVG can carry scripts when navigated to directly; sandbox disables them
    // while still letting <img>/CSS references render normally.
    headers["content-security-policy"] = "sandbox";
  }

  return new Response(Uint8Array.from(file), { headers });
}
