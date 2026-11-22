"use client";

import * as React from "react";
import type { SurfaceConnectors, SurfaceForumThread } from "@elkdonis/cms-ui/surface";
import { ForumComposeSurface } from "@/components/mobile/forum-compose-surface";
import { ForumRepliesPanel } from "@/components/mobile/forum-replies-panel";

// What the shared surfaces need from this site to show the forum as the hub card does (FORUM_SURFACE_PLAN.md):
// a "forum-compose" surface (Start a topic), the replies and reply box under a topic in the thread popup, and the
// topics of one section. HubSurfaces.tsx spreads these in; nothing else about the connectors changes.

/** The thread kinds a forum topic can have. A thread outside a section (no `feed`) gets no replies panel. */
const TOPIC_KINDS = new Set(["post", "idea", "event"]);

export const forumCustom: NonNullable<SurfaceConnectors["custom"]> = {
  "forum-compose": ({ descriptor }) => <ForumComposeSurface descriptor={descriptor} />,
};

export const forumThreadBody: NonNullable<SurfaceConnectors["threadBody"]> = (thread) =>
  thread.feed && TOPIC_KINDS.has(thread.kind) ? <ForumRepliesPanel key={thread.id} threadId={thread.id} /> : null;

export async function forumListFeed(slug: string): Promise<SurfaceForumThread[]> {
  const res = await fetch(`/api/hub/forum/feed/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`forum feed ${res.status}`);
  return (await res.json()) as SurfaceForumThread[];
}
