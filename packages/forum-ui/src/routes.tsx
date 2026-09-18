import * as React from "react";
import { notFound, redirect } from "next/navigation";
import type { ForumConnectors } from "./connectors";
import {
  BoardPageView, FeedPage, HappeningPage, IndexPage, ListPage, MapPage, MemberPage, MembersPage, ModLogPage, NotificationsPage,
  OrgsPage, SearchPage, ThreadPage, TopicPage, TopicReviewRoute, TopicsPage,
} from "./pages";
import { ModeToggle } from "./parts";
import { loadShell } from "./shell";
import { DictionaryPage, WikiEditPage, WikiHistoryPage, WikiIndexPage, WikiNewPage, WikiPageView } from "./wiki-pages";

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
 *             /o/[org]  /o/[org]/[feed]  /t/[id]/[slug]  /t/[id]/[slug]/unread  /t/[id]/[slug]/map
 *             /wiki  /wiki/new  /wiki/[slug]  /wiki/[slug]/edit  /wiki/[slug]/history  /dictionary
 *   org:      the same minus /o/…; a feed is /[feed]
 *
 * Thread URLs are id-first so a slug edit never breaks a link; the slug is
 * decorative and unchecked. `/unread` on a thread redirects to the page and
 * anchor of the first reply the viewer hasn't seen.
 *
 * Every page is wrapped in the shell (shell.tsx): the rail of places on the
 * left, the page, and the column of boxes on the right.
 */
export async function renderForumRoute(ctx: ForumRouteContext): Promise<React.ReactElement> {
  const { connectors, segments, searchParams } = ctx;
  const viewer = await connectors.viewer();
  const root = connectors.hrefs.root().replace(/\/$/, "");
  const path = `${root}/${segments.map(encodeURIComponent).join("/")}`.replace(/\/$/, "") || "/";
  const shell = await loadShell(connectors, viewer, path);
  const props = { connectors, viewer, searchParams, path, boxes: shell.boxes };
  const [a, b, c, d] = segments;
  const wiki = connectors.wiki;

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
  // The wiki and the dictionary, as peer sections. Matched before the
  // org-scoped `/[feed]` branch below, so a feed can never be slugged "wiki"
  // and shadow it. "new" is reserved as a page slug for the same reason.
  else if (a === "wiki" && wiki && segments.length === 1) el = await WikiIndexPage(props);
  else if (a === "wiki" && wiki && b === "new" && segments.length === 2) el = await WikiNewPage(props);
  else if (a === "wiki" && wiki && b && segments.length === 2) el = await WikiPageView({ ...props, slug: b });
  else if (a === "wiki" && wiki && b && c === "edit" && segments.length === 3) el = await WikiEditPage({ ...props, slug: b });
  else if (a === "wiki" && wiki && b && c === "history" && segments.length === 3) el = await WikiHistoryPage({ ...props, slug: b });
  else if (a === "dictionary" && wiki && segments.length === 1) el = await DictionaryPage(props);
  else if (a === "log" && segments.length === 1 && connectors.scope.kind === "org") el = await ModLogPage({ ...props, orgSlug: "" });
  else if (a === "t" && b) {
    if (d === "unread" && segments.length === 4) {
      const hit = await connectors.firstUnreadReply?.(b, viewer);
      const base = connectors.hrefs.thread(b, c ?? "topic");
      redirect(hit ? `${base}${hit.page > 1 ? `?page=${hit.page}` : ""}#reply-${hit.replyId}` : base);
    }
    if (d === "map" && segments.length === 4) el = await MapPage({ ...props, path: `${connectors.hrefs.thread(b, c ?? "topic")}/map`, id: b });
    else el = await ThreadPage({ ...props, path: connectors.hrefs.thread(b, c ?? "topic"), id: b });
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

  const theme = connectors.theme ?? "classic";
  const mode = connectors.mode ?? "light";

  // Both attributes go here rather than on the host's own wrapper, so every
  // page carries them and no host has to touch its markup. forum-theme.css
  // reaches the host's outer .gf-page via :has(), so the ground changes too.
  return (
    <div className="gf-root" data-forum-theme={theme} data-forum-mode={mode}>
      <div className="gf-shell">
        {shell.side}
        <div className="gf-body">
          {el}
          {connectors.actionBase && (
            <footer className="gf-footer">
              <ModeToggle currentMode={mode} actionBase={connectors.actionBase} back={path} />
            </footer>
          )}
        </div>
      </div>
      {/* The phone's way into the two rails: links, so they work with no script. */}
      <a className="gf-menu-btn" href="#menu" aria-label="Open the menu">☰ <span>Browse</span></a>
      <a className="gf-boxes-btn" href="#boxes" aria-label="Open the side column">▤ <span>Post · You · Wiki</span></a>
    </div>
  );
}
