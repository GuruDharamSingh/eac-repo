import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/org";
import {
  downloadPublishedFile,
  joinPublishedAssetPath,
  parseSilexPublishedRef,
} from "@/lib/silex-published";

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
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

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
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

  const file = await downloadPublishedFile({ ...ref, path: assetPath });
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new Response(Uint8Array.from(file), {
    headers: {
      "content-type": contentTypeFor(assetPath),
      "cache-control": "public, max-age=300",
    },
  });
}
