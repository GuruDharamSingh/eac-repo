import { NextResponse } from "next/server";
import { loadDiscussion } from "@/lib/article-data";

/**
 * The replies under an article, newest first, for the page's discussion block
 * to poll. Public threads in public feeds only (lib/article-data.ts); display
 * names, never emails.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const thread = q.get("thread") ?? "";
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(thread)) return NextResponse.json({ discussion: null });
  const discussion = await loadDiscussion(thread, Number(q.get("limit")) || 12);
  return NextResponse.json({ now: new Date().toISOString(), discussion }, { headers: { "Cache-Control": "no-store" } });
}
