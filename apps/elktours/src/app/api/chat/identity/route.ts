import { NextRequest, NextResponse } from "next/server";
import { getOrgChatIdentity, getProfile, setOrgChatDisplayName } from "@elkdonis/services";
import { badRequest, orgId, withMember } from "@/lib/chat-api";

/** The name this member posts under, and whether they chose it themselves. */
export async function GET() {
  return withMember(async (viewer) => {
    const profile = await getProfile(viewer.userId);
    const fallback = profile?.displayName?.trim() || viewer.email;
    return NextResponse.json(await getOrgChatIdentity(orgId, viewer.userId, fallback));
  });
}

/**
 * Change it. The name is scoped to this member's own guest account — the
 * route never accepts a user id, so nobody can rename anyone but themselves.
 */
export async function PUT(request: NextRequest) {
  return withMember(async (viewer) => {
    const body = await request.json().catch(() => null);
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    if (!displayName) return badRequest("A display name is required");
    if (displayName.length > 64) return badRequest("That name is too long");

    return NextResponse.json(await setOrgChatDisplayName(orgId, viewer.userId, displayName));
  });
}
