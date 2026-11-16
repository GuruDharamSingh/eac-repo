// ============================================================================
// The General Chat API, as a factory — same shape as @elkdonis/pipeline/routes.
//
// An app supplies its orgId and its auth probes and gets the wrappers back; the
// routes themselves call @elkdonis/services directly, so there is no second
// copy of the chat signatures to drift.
//
// Permission split:
//   member      — read the room, post to it
//   owner/guide — create the room for the org
// A room token never crosses the wire in either direction.
// ============================================================================

import { NextResponse } from "next/server";
import {
  OrgChatScopeError,
  getOrgChatIdentity,
  getProfile,
  listOrgChatMessages,
  postOrgChatMessage,
  setOrgChatDisplayName,
} from "@elkdonis/services";

/** The minimum an app's viewer must expose. Apps may return a richer object. */
export interface ChatViewer {
  userId: string;
  email: string;
}

export interface ChatRouteOptions<V extends ChatViewer> {
  /** The org whose chat room these routes serve. */
  orgId: string;
  /** Signed-in member of this org, or null. */
  getMember: () => Promise<V | null>;
  /** Owner or guide of this org, or null. */
  getEditor: () => Promise<V | null>;
  /** Prefixes logs, e.g. "ifac". Defaults to the orgId. */
  logLabel?: string;
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function createChatApi<V extends ChatViewer>(options: ChatRouteOptions<V>) {
  const { orgId, getMember, getEditor } = options;
  const label = options.logLabel ?? orgId;

  async function run(
    handler: (viewer: V) => Promise<NextResponse>,
    viewer: V
  ): Promise<NextResponse> {
    try {
      return await handler(viewer);
    } catch (error) {
      // "This org has no room" is not an upstream failure.
      if (error instanceof OrgChatScopeError) {
        console.warn(`[${label}] chat scope refusal:`, error.message);
        return NextResponse.json({ error: "No chat room for this group" }, { status: 404 });
      }
      console.error(`[${label}] chat error:`, error);
      return NextResponse.json({ error: "Nextcloud Talk rejected that" }, { status: 502 });
    }
  }

  async function withMember(
    handler: (viewer: V) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const viewer = await getMember();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return run(handler, viewer);
  }

  async function withEditor(
    handler: (viewer: V) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const viewer = await getEditor();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return run(handler, viewer);
  }

  return { orgId, withMember, withEditor, badRequest };
}

export type ChatApi<V extends ChatViewer = ChatViewer> = ReturnType<typeof createChatApi<V>>;

// ---- the two General Chat routes every site copied (2026-11-16) ----------
type ChatApiLike<V extends ChatViewer> = {
  orgId: string;
  withMember: (handler: (viewer: V) => Promise<NextResponse>) => Promise<NextResponse>;
  badRequest: (message: string) => NextResponse;
};

/** GET the room, POST a message. The author name comes from the viewer's profile, never the body. */
export function chatMessageRoutes<V extends ChatViewer>(api: ChatApiLike<V>) {
  async function GET() {
    return api.withMember(async (viewer) =>
      NextResponse.json(await listOrgChatMessages(api.orgId, viewer.userId))
    );
  }
  async function POST(request: Request) {
    return api.withMember(async (viewer) => {
      const body = await request.json().catch(() => null);
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      if (!message) return api.badRequest("A message is required");
      const profile = await getProfile(viewer.userId);
      const displayName = profile?.displayName?.trim() || viewer.email;
      const posted = await postOrgChatMessage(api.orgId, viewer.userId, displayName, message);
      return NextResponse.json(posted, { status: 201 });
    });
  }
  return { GET, POST };
}

/** The name this member posts under (GET) and changing it (PUT). Never accepts a user id. */
export function chatIdentityRoutes<V extends ChatViewer>(api: ChatApiLike<V>) {
  async function GET() {
    return api.withMember(async (viewer) => {
      const profile = await getProfile(viewer.userId);
      const fallback = profile?.displayName?.trim() || viewer.email;
      return NextResponse.json(await getOrgChatIdentity(api.orgId, viewer.userId, fallback));
    });
  }
  async function PUT(request: Request) {
    return api.withMember(async (viewer) => {
      const body = await request.json().catch(() => null);
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
      if (!displayName) return api.badRequest("A display name is required");
      if (displayName.length > 64) return api.badRequest("That name is too long");
      return NextResponse.json(await setOrgChatDisplayName(api.orgId, viewer.userId, displayName));
    });
  }
  return { GET, PUT };
}
