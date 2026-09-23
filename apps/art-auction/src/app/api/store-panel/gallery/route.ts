import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { loadProfileGallery } from "@elkdonis/blocks/server";

// ============================================================================
// The store panel EDITOR's own resolver for profile-gallery, over HTTP.
//
// The editor's canvas runs in the browser (Puck's iframe), where there is no
// database — so its resolver goes over HTTP, exactly like danamccool's own
// client resolvers (config.client.ts) go to /api/blocks/*. This route is that
// same idea, scoped to the store panel's one rule: a person can only ever be
// designing THEIR OWN panel, never someone else's — so the user id is read
// from the session, never from the request.
// ============================================================================

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gallery = searchParams.get("gallery") || undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const loaded = await loadProfileGallery(userId, {
    gallery,
    limit: Number.isFinite(limit) ? limit : undefined,
    // The editor previews the owner's OWN work regardless of any org's
    // hidden_on — they are the one signed in, editing their own document.
    viewerId: userId,
  });

  return NextResponse.json({ title: loaded?.title ?? "", pictures: loaded?.pictures ?? [] });
}
