import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { loadProfileStore } from "@elkdonis/blocks/server";

/** The store panel editor's resolver for profile-store — see gallery/route.ts. */
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const showcase = await loadProfileStore(userId, { limit: Number.isFinite(limit) ? limit : undefined });
  return NextResponse.json({
    store: showcase?.store ?? null,
    artworks: showcase?.artworks ?? [],
  });
}
