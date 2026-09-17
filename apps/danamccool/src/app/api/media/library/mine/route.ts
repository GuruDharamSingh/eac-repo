import { NextResponse } from "next/server";
import { listUserMediaLibrary } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * The signed-in person's OWN images.
 *
 * Sibling of ../route.ts, and the thing that matters is what is NOT here: the
 * user id comes from the SESSION and is never read from the request. A
 * `?userId=` parameter would be a way to read anyone's private uploads by
 * guessing an id, and no amount of care further down would fix that.
 *
 * This is where Dana's own uploads land — /api/media/upload writes to her
 * folder, not the org's, because an artist's work follows her between sites.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listUserMediaLibrary(viewer.userId);
  return NextResponse.json({ items });
}
