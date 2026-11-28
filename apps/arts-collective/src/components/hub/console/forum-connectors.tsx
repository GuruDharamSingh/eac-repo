"use client";

import * as React from "react";
import type { SurfaceConnectors, SurfaceForumConnectors, SurfaceForumThread, SurfaceThread } from "@elkdonis/cms-ui/surface";
import { ForumAcross } from "./ForumAcross";
import { ForumReplies } from "./ForumReplies";
import { FORUM_REPLY_KINDS, FORUM_SURFACES } from "./forum-keys";

/**
 * Everything the console's SurfaceProvider needs to make the forum card work, as one registration the host
 * spreads into its connectors (OrgConsoleHost). Nothing here touches the shared surface system.
 *
 *   const forumParts = React.useMemo(() => orgForumConnectors({ orgSlug }), [orgSlug]);
 *   const base = createHubConnectors({ ..., forum: false, custom: { ..., ...forumParts.custom } });
 *   const connectors = {
 *     ...base,
 *     forum: forumParts.forum,                              // snapshot of THIS org + real section lists
 *     threadBody: forumParts.threadBody,                    // replies and reply box under a topic
 *     loadThread: forumParts.loadThread(base.loadThread),   // forum topics the org route cannot open
 *     ...
 *   };
 *
 * `forum: false` stays in createHubConnectors because its built-in forum connector reads /api/hub/forum with no
 * org and posts "mark all read" to a route this app does not have.
 */
export function orgForumConnectors({ orgSlug }: { orgSlug: string }) {
  const org = encodeURIComponent(orgSlug);

  const forum: SurfaceForumConnectors = {
    async load() {
      const res = await fetch(`/api/hub/forum?org=${org}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`forum ${res.status}`);
      return await res.json();
    },
    // The topics of one section, for the section layer (Sunjay leaves this unwired; here it is real).
    async listFeed(slug: string): Promise<SurfaceForumThread[]> {
      const res = await fetch(`/api/hub/forum/feed?org=${org}&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`forum feed ${res.status}`);
      return (await res.json()) as SurfaceForumThread[];
    },
    // markAllRead is left out on purpose: this app has no route for it, so the control is not drawn.
  };

  /** Replies and the reply box, in the thread frame: for a topic's kinds that are published. */
  const threadBody: NonNullable<SurfaceConnectors["threadBody"]> = (thread: SurfaceThread) =>
    FORUM_REPLY_KINDS.has(thread.kind) && thread.status === "published" ? <ForumReplies key={thread.id} threadId={thread.id} /> : null;

  /**
   * Try the host's own loader first (it serves the console's drafts and everything it always served), and fall
   * back to the forum's reading rules (/api/hub/threads/<id>) when it answers nothing: a public topic of an org
   * the viewer only follows, or a topic of another organisation opened from "Across your organisations".
   */
  const loadThread =
    (base: SurfaceConnectors["loadThread"]): SurfaceConnectors["loadThread"] =>
    async (id) => {
      const first = await base(id).catch(() => null);
      if (first) return first;
      try {
        const res = await fetch(`/api/hub/threads/${encodeURIComponent(id)}`, { cache: "no-store" });
        return res.ok ? ((await res.json()) as SurfaceThread) : null;
      } catch {
        return null;
      }
    };

  const custom: NonNullable<SurfaceConnectors["custom"]> = {
    [FORUM_SURFACES.across]: () => <ForumAcross />,
  };

  return { forum, threadBody, loadThread, custom };
}
