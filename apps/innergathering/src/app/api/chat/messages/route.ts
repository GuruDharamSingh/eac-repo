import { NextRequest, NextResponse } from "next/server";
import { getProfile, listOrgChatMessages, postOrgChatMessage } from "@elkdonis/services";
import { badRequest, orgId, withMember } from "@/lib/chat-api";

export async function GET() {
  return withMember(async (viewer) =>
    NextResponse.json(await listOrgChatMessages(orgId, viewer.userId))
  );
}

/**
 * The author name comes from the viewer's profile, never the request body: it
 * is the name everyone in Nextcloud sees against the message, and a client
 * must not be able to choose whose name that is.
 */
export async function POST(request: NextRequest) {
  return withMember(async (viewer) => {
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return badRequest("A message is required");

    const profile = await getProfile(viewer.userId);
    const displayName = profile?.displayName?.trim() || viewer.email;
    const posted = await postOrgChatMessage(orgId, viewer.userId, displayName, message);
    return NextResponse.json(posted, { status: 201 });
  });
}
