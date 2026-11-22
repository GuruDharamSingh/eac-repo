import { NextResponse } from "next/server";
import { listUserMediaLibrary } from "@elkdonis/services";
import { getApiMember } from "@/lib/auth";

/**
 * The signed-in person's OWN media, for the picker's "My files" tab (2026-11-17, tour photos on the phone media
 * screen). Copied from apps/sunjay/src/app/api/media/library/mine/route.ts.
 *
 * The user id comes from the session and is never read from the request: a `?userId=` parameter would let anyone
 * list another person's private uploads. The gate is membership, not editor: these are the caller's own files.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listUserMediaLibrary(viewer.userId);
  return NextResponse.json({ items });
}
