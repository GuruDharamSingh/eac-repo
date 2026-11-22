import { NextResponse } from "next/server";
import { fetchSubstackPosts } from "@/lib/substack";

export async function GET() {
  const posts = await fetchSubstackPosts(3);
  return NextResponse.json(posts, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  });
}
