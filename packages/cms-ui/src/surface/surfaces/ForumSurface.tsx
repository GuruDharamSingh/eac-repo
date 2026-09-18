"use client";

import * as React from "react";
import type {
  SurfaceAction,
  SurfaceDescriptor,
  SurfaceForum,
  SurfaceForumFeed,
  SurfaceForumThread,
} from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSection, SurfaceSkeleton } from "../SurfaceShell";
import { SurfaceCard } from "../SurfaceCard";
import { kindMeta } from "../kinds";

// ============================================================================
// The org's forum, as a surface — and as a face.
//
// The board itself (@elkdonis/forum-ui) is pages: rows navigate, links are
// real links, nothing pops. That is right *inside* a forum. This is the other
// direction — the forum seen from somewhere else, a hub tile among the
// calendar and the pipeline, answering "is anything happening in there?"
// without leaving the page you are on.
//
// So the two behaviours do not contradict: on the board a row is a
// destination, here a row is a preview. A thread opens as the shared `thread`
// surface (the same popup a feed card opens), and "Open the forum" leaves for
// the board when you actually want to read.
//
// Reads the host-neutral SurfaceForum through `connectors.forum`; a host maps
// its own conversations onto it. @elkdonis/forum-ui/snapshot does that in one
// call for anything already on `threads`.
// ============================================================================

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = Date.now() - t;
  const m = 60_000, h = 60 * m, day = 24 * h;
  if (d < m) return "now";
  if (d < h) return `${Math.floor(d / m)}m`;
  if (d < day) return `${Math.floor(d / h)}h`;
  if (d < 7 * day) return `${Math.floor(d / day)}d`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ThreadRow({ t, onOpen }: { t: SurfaceForumThread; onOpen: (t: SurfaceForumThread) => void }) {
  const meta = kindMeta(t.kind);
  return (
    <li className={`eac-forum-row${t.unread ? " is-unread" : ""}`} data-kind={t.kind}>
      <button type="button" className="eac-forum-row-hit" onClick={() => onOpen(t)} aria-haspopup="dialog">
        <span className="eac-forum-row-glyph" aria-hidden>{meta.glyph}</span>
        <span className="eac-forum-row-main">
          <span className="eac-forum-row-title">{t.title}</span>
          <span className="eac-forum-row-meta">
            {[t.feedName, t.authorName].filter(Boolean).join(" · ")}
            {t.replyCount > 0 && <> · {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}</>}
          </span>
        </span>
        <span className="eac-forum-row-when">{ago(t.at)}</span>
      </button>
    </li>
  );
}

export function ForumSurface() {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const [forum, setForum] = React.useState<SurfaceForum | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!connectors.forum) return setState("missing");
    setState("loading");
    try {
      const f = await connectors.forum.load();
      if (!f) return setState("missing");
      setForum(f);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [connectors.forum]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    layer.setMeta({ title: forum?.title ?? "Forum", kind: "forum", size: "wide" });
  }, [layer, forum?.title]);

  async function markAllRead() {
    if (!connectors.forum?.markAllRead) return;
    setBusy(true);
    const ok = await connectors.forum.markAllRead();
    setBusy(false);
    if (ok) {
      await load();
      connectors.onMutated?.();
    }
  }

  const actions: SurfaceAction[] = [];
  if (forum?.composeHref) actions.push({ label: "Start a topic", href: forum.composeHref });
  if (forum) actions.push({ label: "Open the forum", primary: true, href: forum.href });

  const openThread = React.useCallback(
    (t: SurfaceForumThread) =>
      push({
        type: "thread",
        id: t.id,
        preview: { title: t.title, kind: t.kind, feedName: t.feedName },
      }),
    [push]
  );

  const unread = forum?.unreadCount ?? 0;

  return (
    <SurfaceFrame
      kind="forum"
      title={forum?.title ?? "Forum"}
      kicker={connectors.orgName ? `Forum · ${connectors.orgName}` : "Forum"}
      actions={actions}
      status={
        state === "ready" && forum
          ? `${forum.topicCount} ${forum.topicCount === 1 ? "topic" : "topics"} · ${forum.postCount} ${forum.postCount === 1 ? "post" : "posts"}`
          : state === "loading"
            ? "Loading…"
            : null
      }
    >
      {state === "loading" && <SurfaceSkeleton block />}
      {state === "missing" && <p className="eac-surface-empty">This org has no forum yet.</p>}
      {state === "error" && (
        <p className="eac-surface-empty">
          Could not load the forum.{" "}
          <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      {state === "ready" && forum && (
        <div className="eac-forum">
          {unread > 0 && (
            <div className="eac-forum-unread">
              <span>
                <b>{unread}</b> {unread === 1 ? "topic has" : "topics have"} something new
              </span>
              <span className="eac-forum-unread-tools">
                {forum.unreadHref && <a className="eac-btn eac-btn--quiet" href={forum.unreadHref}>See them</a>}
                {connectors.forum?.markAllRead && (
                  <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void markAllRead()} disabled={busy}>
                    {busy ? "Marking…" : "Mark all read"}
                  </button>
                )}
              </span>
            </div>
          )}

          {(forum.feeds?.length ?? 0) > 0 && (
            <SurfaceSection title="Sections">
              <ul className="eac-forum-feeds">
                {(forum.feeds ?? []).map((f) => (
                  <li
                    key={f.slug}
                    className={`eac-forum-feed${f.unreadCount ? " is-unread" : ""}`}
                    style={f.accent ? ({ ["--eac-forum-feed" as string]: f.accent } as React.CSSProperties) : undefined}
                  >
                    {/* Opens IN the popup, the way a latest row does, rather
                        than navigating to the board. The full board is still
                        one control away, inside the section. */}
                    <button
                      type="button"
                      className="eac-forum-feed-name"
                      onClick={() =>
                        push({ type: "forumFeed", slug: f.slug, name: f.name, href: f.href })
                      }
                    >
                      {f.unreadCount ? <span className="eac-forum-dot" aria-label="unread" /> : null}
                      {f.name}
                    </button>
                    <span className="eac-forum-feed-count">
                      {f.topicCount}
                      {f.unreadCount ? <b> · {f.unreadCount} new</b> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </SurfaceSection>
          )}

          <SurfaceSection title="Latest">
            {(forum.recent?.length ?? 0) === 0 ? (
              <p className="eac-surface-muted">Nothing has been posted yet.</p>
            ) : (
              <ul className="eac-forum-rows">
                {(forum.recent ?? []).map((t) => (
                  <ThreadRow key={t.id} t={t} onOpen={openThread} />
                ))}
              </ul>
            )}
          </SurfaceSection>
        </div>
      )}
    </SurfaceFrame>
  );
}

// ── the face preview ─────────────────────────────────────────────────────────

/**
 * The forum at a glance, for a face: the newest few titles with an unread
 * dot, over a line of section names. Server-renderable — the tile is drawn
 * before any JavaScript runs, like the board's and the calendar's.
 */
export function ForumMini({
  recent,
  feeds,
}: {
  recent: Array<{ title: string; kind?: string; unread?: boolean | null; at?: string | null }>;
  feeds?: Array<{ name: string; unreadCount?: number | null }>;
}) {
  // Six, not three. The face had three lines and a lot of card under them —
  // and the thing a forum tile is for is seeing what has been said. The
  // preview now takes the row's slack (see .eac-face-preview), so there is
  // room for the same list the popup opens with rather than a sample of it.
  const rows = recent.slice(0, 6);
  if (rows.length === 0) return <span className="eac-preview-empty">Nothing posted yet</span>;
  return (
    <div className="eac-forum-mini" aria-hidden>
      {rows.map((r, i) => (
        <span key={i} className={`eac-forum-mini-row${r.unread ? " is-unread" : ""}`} data-kind={r.kind ?? "post"}>
          <span className="eac-forum-mini-glyph">{kindMeta(r.kind).glyph}</span>
          <span className="eac-forum-mini-title">{r.title}</span>
          {r.at && <span className="eac-forum-mini-when">{ago(r.at)}</span>}
        </span>
      ))}
      {feeds && feeds.length > 0 && (
        <span className="eac-forum-mini-feeds">
          {feeds.slice(0, 4).map((f, i) => (
            <span key={i} className={f.unreadCount ? "is-unread" : undefined}>{f.name}</span>
          ))}
        </span>
      )}
    </div>
  );
}

// ── the face ─────────────────────────────────────────────────────────────────

/**
 * The forum tile: what has just been said, and whether any of it is new.
 *
 * Host-neutral, like the snapshot it draws — every site that mounts a forum
 * gets the identical tile, and the only thing a host decides is where the
 * board lives. Server-rendered from the same SurfaceForum the surface opens,
 * so the tile is the forum at tile size rather than a picture of one.
 */
export function ForumFace({
  forum,
  href = "/forum",
}: {
  forum: SurfaceForum | null;
  /** Where the board lives, for the empty state. Ignored when `forum` is set. */
  href?: string;
}) {
  if (!forum) {
    return (
      <SurfaceCard
        kind="forum"
        kicker="Forum"
        title="No forum yet"
        blurb="This group's board has not been set up."
        href={href}
        cue="→"
      />
    );
  }

  const unread = forum.unreadCount ?? 0;
  const blurb =
    unread > 0
      ? `${unread} ${unread === 1 ? "topic has" : "topics have"} something new.`
      : `${forum.topicCount} ${forum.topicCount === 1 ? "topic" : "topics"} · ${forum.postCount} ${forum.postCount === 1 ? "post" : "posts"}.`;

  return (
    <SurfaceCard
      kind="forum"
      // No kicker: the glyph already says which tile this is, and the title is
      // doing the work — "3 new" is what a member opens the hub to learn.
      kicker={null}
      title={unread > 0 ? `${unread} new` : forum.title}
      blurb={blurb}
      surface={{ type: "forum" }}
      // The sections, in the top band. They were a wrapped line at the FOOT
      // of the preview, under the latest list, while the band above held a
      // decorative medallion and a "+" — the two corners of the card doing
      // nothing while the one piece of orientation a board tile owes you
      // ("which rooms are there") sat at the bottom.
      tools={
        (forum.feeds?.length ?? 0) > 0 ? (
          <span className="eac-forum-face-feeds">
            {(forum.feeds ?? []).slice(0, 4).map((f) => (
              <span
                key={f.slug}
                className={`eac-forum-face-feed${f.unreadCount ? " is-unread" : ""}`}
              >
                {f.name}
              </span>
            ))}
          </span>
        ) : undefined
      }
      preview={<ForumMini recent={forum.recent ?? []} />}
    />
  );
}


// ── one section, as its own layer ────────────────────────────────────────────

/**
 * The threads in one section of the board.
 *
 * A layer rather than a mode of the forum surface. The difference the user
 * sees is the back control: a pushed layer gets the masthead's "‹ back", the
 * same one a thread gets, in the same place — where the panel-local link this
 * replaced was a second, differently-shaped way to go back one step.
 *
 * `listFeed` is optional on the connectors. Without it this falls back to the
 * board snapshot's `recent`, filtered — honest for a small board, and the
 * empty state says which case you are in rather than implying a quiet section
 * is an empty one.
 */
export function ForumFeedSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "forumFeed" }>;
}) {
  const { connectors, push } = useSurface();
  const [threads, setThreads] = React.useState<SurfaceForumThread[] | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let cancelled = false;
    const listFeed = connectors.forum?.listFeed;
    if (!listFeed) {
      setState("ready");
      return;
    }
    setState("loading");
    listFeed(descriptor.slug)
      .then((rows) => {
        if (cancelled) return;
        setThreads(rows);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [connectors.forum, descriptor.slug]);

  const openThread = React.useCallback(
    (t: SurfaceForumThread) =>
      push({
        type: "thread",
        id: t.id,
        preview: { title: t.title, kind: t.kind, feedName: t.feedName },
      }),
    [push]
  );

  return (
    <SurfaceFrame
      kind="forum"
      title={descriptor.name}
      kicker="Section"
      actions={[{ label: "Open on the forum", href: descriptor.href }]}
      status={
        state === "ready" && threads
          ? `${threads.length} ${threads.length === 1 ? "topic" : "topics"}`
          : null
      }
    >
      {state === "loading" && <SurfaceSkeleton block />}
      {state === "error" && <p className="eac-surface-empty">Could not load this section.</p>}
      {state === "ready" &&
        (threads && threads.length > 0 ? (
          <ul className="eac-forum-rows">
            {threads.map((t) => (
              <ThreadRow key={t.id} t={t} onOpen={openThread} />
            ))}
          </ul>
        ) : (
          <p className="eac-surface-empty">
            {connectors.forum?.listFeed
              ? "Nothing in this section yet."
              : "Open it on the forum to see what is in here."}
          </p>
        ))}
    </SurfaceFrame>
  );
}
