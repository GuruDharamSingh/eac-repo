import { NextResponse } from "next/server";
import { loadPost, loadTopics } from "@/lib/article-data";

/**
 * Article reads for the page editor's canvas (the published page reads them
 * directly): one article by slug, or the latest topics. Public threads in
 * public feeds only.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.get("kind") === "topics") {
    return NextResponse.json({ topics: await loadTopics(Number(q.get("limit")) || 6) });
  }
  const slug = q.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(slug)) return NextResponse.json({ post: null });
  return NextResponse.json({ post: await loadPost(slug) });
}
