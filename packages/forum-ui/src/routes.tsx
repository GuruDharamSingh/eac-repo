import * as React from "react";
import { notFound, redirect } from "next/navigation";
import type { ForumConnectors } from "./connectors";
import {
  BoardPageView, FeedPage, HappeningPage, IndexPage, ListPage, MemberPage, MembersPage, ModLogPage, NotificationsPage,
  OrgsPage, SearchPage, ThreadPage, TopicPage, TopicReviewRoute, TopicsPage,
} from "./pages";

export interface ForumRouteContext {
  connectors: ForumConnectors;
  /** URL segments after the mount point: [] for the root. */
  segments: string[];
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Segments → page, for both scopes.
 *
 *   network:  /  /latest  /happening  /unread  /watching  /bookmarks  /notifications
 *             /o/[org]  /o/[org]/[feed]  /t/[id]/[slug]  /t/[id]/[slug]/unread
 *   org:      the same minus /o/…; a feed is /[feed]
 *
 * Thread URLs are id-first so a slug edit never breaks a link; the slug is
 * decorative and unchecked. `/unread` on a thread redirects to the page and
 * anchor of the first reply the viewer hasn't seen.
 */
export async function renderForumRoute(ctx: ForumRouteContext): Promise<React.ReactElement> {
  const { connectors, segments, searchParams } = ctx;
  const viewer = await connectors.viewer();
  const root = connectors.hrefs.root().replace(/\/$/, "");
  const path = `${root}/${segments.map(encodeURIComponent).join("/")}`.replace(/\/$/, "") || "/";
  const props = { connectors, viewer, searchParams, path };
  const [a, b, c, d] = segments;

  let el: React.ReactElement | null = null;

  if (segments.length === 0) el = await IndexPage(props);
  else if (segments.length === 1 && (a === "latest" || a === "unread" || a === "watching" || a === "bookmarks")) el = await ListPage({ ...props, view: a });
  else if (a === "happening" && segments.length === 1) el = await HappeningPage(props);
  else if (a === "notifications" && segments.length === 1) el = await NotificationsPage(props);
  else if (a === "members" && segments.length === 1) el = await MembersPage(props);
  else if (a === "members" && b && segments.length === 2) el = await MemberPage({ ...props, slug: b });
  else if (a === "topics" && segments.length === 1) el = await TopicsPage(props);
  else if (a === "topics" && b === "review" && segments.length === 2) el = await TopicReviewRoute(props);
  else if (a === "topics" && b && segments.length === 2) el = await TopicPage({ ...props, slug: b });
  else if (a === "orgs" && segments.length === 1 && connectors.scope.kind === "network") el = await OrgsPage(props);
  else if (a === "search" && segments.length === 1) el = await SearchPage(props);
  else if (a === "log" && segments.length === 1 && connectors.scope.kind === "org") el = await ModLogPage({ ...props, orgSlug: "" });
  else if (a === "t" && b) {
    if (d === "unread" && segments.length === 4) {
      const hit = await connectors.firstUnreadReply?.(b, viewer);
      const base = connectors.hrefs.thread(b, c ?? "topic");
      redirect(hit ? `${base}${hit.page > 1 ? `?page=${hit.page}` : ""}#reply-${hit.replyId}` : base);
    }
    el = await ThreadPage({ ...props, path: connectors.hrefs.thread(b, c ?? "topic"), id: b });
  } else if (connectors.scope.kind === "network") {
    if (a === "o" && b && segments.length === 2) {
      const board = await connectors.getBoardBySlug(b, viewer);
      el = board ? await BoardPageView({ ...props, board }) : null;
    } else if (a === "o" && b && c === "log" && segments.length === 3) {
      el = await ModLogPage({ ...props, orgSlug: b });
    } else if (a === "o" && b && c && segments.length === 3) {
      el = await FeedPage({ ...props, orgSlug: b, feedSlug: c });
    }
  } else if (segments.length === 1) {
    el = await FeedPage({ ...props, orgSlug: "", feedSlug: a });
  }

  if (!el) notFound();
  return el;
}
