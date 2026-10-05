import { NextResponse } from "next/server";
import { listUserMediaLibrary } from "@elkdonis/services";
import { getApiMember } from "@/lib/auth";

/**
 * The signed-in person's OWN media, for the picker.
 *
 * Sibling of ../route.ts, which lists the org's. Two things differ and both
 * matter:
 *
 * 1. The user id comes from the SESSION and is never read from the request.
 *    A `?userId=` parameter here would be a way to read anyone's private
 *    uploads by guessing an id, and no amount of care further down would fix
 *    that. There is deliberately no way for a caller to name someone else.
 *
 * 2. The gate is membership rather than editor. These are the caller's own
 *    files, so the question is "are you signed in and part of this community",
 *    not "may you publish here" — a member picking their own photo for a page
 *    they are allowed to edit should not be refused because of a role that has
 *    nothing to do with whose files these are.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = await listUserMediaLibrary(viewer.userId);
  return NextResponse.json({ items });
}
