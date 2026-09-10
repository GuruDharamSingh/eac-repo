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
import { OrgChatScopeError } from "@elkdonis/services";

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
