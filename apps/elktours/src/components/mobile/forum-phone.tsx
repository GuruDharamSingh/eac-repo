"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ForumBoardView, ForumFeedList, ForumThreadRows, useSurface, type SurfaceForum, type SurfaceForumFeed, type SurfaceForumThread } from "@elkdonis/cms-ui/surface";
import { BackButton } from "./back-button";
import "./forum-surface.css";

// The phone forum as the surface pattern (FORUM_SURFACE_PLAN.md): the list is a page, a row opens the shared `thread`
// popup, "Open page" goes to /forum/t/[id]/[slug], and "Start a topic" opens the compose surface. The list parts are
// cms-ui's own (ForumBoardView, ForumFeedList, ForumThreadRows), so this is the hub card's forum at page size.

function useOpeners() {
  const { push, connectors } = useSurface();
  const router = useRouter();
  const [marking, setMarking] = React.useState(false);
  const openThread = (t: SurfaceForumThread) => push({ type: "thread", id: t.id, preview: { title: t.title, kind: t.kind, feedName: t.feedName } });
  const start = (section?: string | null) => push({ type: "custom", key: "forum-compose", title: "Start a topic", props: section ? { section } : {} });
  const markAll = connectors.forum?.markAllRead
    ? async () => {
        setMarking(true);
        const ok = await connectors.forum!.markAllRead!();
        setMarking(false);
        if (ok) router.refresh();
      }
    : undefined;
  return { openThread, start, markAll, marking, router };
}

/** Screen 18, Forum. */
export function ForumPhoneHome({ forum, siteName, canStart }: { forum: SurfaceForum | null; siteName: string; canStart: boolean }) {
  const o = useOpeners();
  return (
    <div className="fs-page">
      <header className="fs-top">
        <BackButton href="/" />
        <span className="fs-kicker">Forum · {siteName}</span>
      </header>
      <h1 className="fs-title">{forum?.title && forum.title !== "Forum" ? forum.title : "Elkdonis Forum"}</h1>
      {forum ? (
        <>
          <p className="fs-status">{forum.topicCount} topics · {forum.postCount} posts</p>
          <ForumBoardView
            forum={forum}
            onOpenThread={o.openThread}
            onOpenFeed={(f) => o.router.push(`/forum/${f.slug}`)}
            onMarkAllRead={o.markAll}
            marking={o.marking}
          />
        </>
      ) : (
        <p className="fs-muted">The forum is not available right now.</p>
      )}
      {canStart ? (
        <button type="button" className="fs-cta" onClick={() => o.start(null)}>✎ Start a topic</button>
      ) : null}
    </div>
  );
}

/** Screen 19, Forum section. */
export function ForumPhoneSection({
  section,
  parent,
  subsections,
  threads,
  siteName,
  canStart,
}: {
  section: SurfaceForumFeed;
  parent: SurfaceForumFeed | null;
  subsections: SurfaceForumFeed[];
  threads: SurfaceForumThread[];
  siteName: string;
  canStart: boolean;
}) {
  const o = useOpeners();
  return (
    <div className="fs-page">
      <header className="fs-top">
        <BackButton href={parent ? `/forum/${parent.slug}` : "/forum"} />
        <span className="fs-kicker">
          <Link href="/forum">Forum · {siteName}</Link>
          {parent ? <> › <Link href={`/forum/${parent.slug}`}>{parent.name}</Link></> : null}
        </span>
      </header>
      <h1 className="fs-title fs-title--rule" style={section.accent ? ({ ["--fs-accent" as string]: section.accent } as React.CSSProperties) : undefined}>{section.name}</h1>
      <p className="fs-status">{section.topicCount} topics</p>
      {subsections.length > 0 ? (
        <div className="fs-sub">
          <ForumFeedList feeds={subsections} onOpen={(f) => o.router.push(`/forum/${f.slug}`)} />
        </div>
      ) : null}
      {threads.length > 0 ? (
        <ForumThreadRows threads={threads} onOpen={o.openThread} />
      ) : (
        <p className="fs-muted">Nothing in this section yet.</p>
      )}
      {canStart ? (
        <button type="button" className="fs-cta" onClick={() => o.start(section.slug)}>✎ Start a topic here</button>
      ) : null}
    </div>
  );
}
