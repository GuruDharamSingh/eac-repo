import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { updateOwnGalleryItems } from "@elkdonis/services";

/**
 * The FIXED route gallery-grid's client component posts to — see its header
 * comment (packages/blocks/src/blocks/gallery-grid.client.tsx). Any app that
 * offers the block needs this one route; `updateOwnGalleryItems` is what
 * checks the gallery's owner against the signed-in viewer, not this file.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const res = await updateOwnGalleryItems(userId, id, body.items);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Could not save." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
