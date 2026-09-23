import { NextResponse } from "next/server";
import { listWriting } from "@elkdonis/services";
import { getSiteOwnerUserId } from "@/lib/auth";

/**
 * Her published writing, for the Writing block in the editor's canvas.
 * Ungated: published pieces only — exactly what /blog shows anyone.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 20) : 5;
  const owner = await getSiteOwnerUserId();
  const items = owner ? await listWriting(owner, { limit }) : [];
  return NextResponse.json({ items });
}
