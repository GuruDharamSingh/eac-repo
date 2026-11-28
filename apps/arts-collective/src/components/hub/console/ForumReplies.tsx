"use client";

import * as React from "react";
import type { HubReply, HubThreadReplies } from "@/lib/hub-forum-replies";
import "./forum-card.css";

/**
 * The replies of a forum topic, with the reply box, drawn UNDER the body of the thread frame (the `threadBody`
 * slot of the shared thread surface). The model is apps/elktours' ForumRepliesPanel; the differences:
 *
 *  - Colours come only from the surface tokens (--sf-*), so the page's dark scope restyles it.
 *  - Owners and guides get Hide on every reply, and see a hidden one as a "Hidden" row with Unhide.
 *  - A reply can be answered in place ("Reply" under it), and longer topics load more.
 *
 * Reads and writes go through /api/hub/forum/replies (list, post) and /api/hub/forum/replies/hide; they are the
 * same `replies` rows the forum pages show, so a reply written here is on the forum at once.
 */

const ROLE_LABEL = { owner: "Owner", guide: "Guide" } as const;

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = 60_000, h = 60 * m, day = 24 * h;
  if (diff < m) return "now";
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < day) return `${Math.floor(diff / h)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Attachments({ items }: { items: HubReply["attachments"] }) {
  if (!items.length) return null;
  const links = items.filter((a) => a.kind === "link");
  const media = items.filter((a) => a.kind !== "link");
  return (
    <>
      {links.map((a, i) => (
        <a key={`l${i}`} className="afc-link" href={a.url} target="_blank" rel="noopener noreferrer">
          <span className="afc-link-host">{a.card.siteName ?? host(a.url)}</span>
          <span className="afc-link-title">{a.card.title ?? a.url}</span>
        </a>
      ))}
      {media.length > 0 && (
        <div className="afc-media">
          {media.map((a, i) =>
            a.kind === "video" ? (
              <video key={i} src={a.url} controls preload="metadata" playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={a.url} alt="" loading="lazy" />
            )
          )}
        </div>
      )}
    </>
  );
}

export function ForumReplies({ threadId, initial }: { threadId: string; /** Replies already in hand (a static render or a test); skips the first fetch. */ initial?: HubThreadReplies }) {
  const [data, setData] = React.useState<HubThreadReplies | null>(initial ?? null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing">(initial ? "ready" : "loading");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [text, setText] = React.useState("");
  const [parent, setParent] = React.useState<HubReply | null>(null);
  const [busyReply, setBusyReply] = React.useState<string | null>(null);
  const box = React.useRef<HTMLTextAreaElement | null>(null);

  const load = React.useCallback(
    async (upTo = 1) => {
      try {
        // Every page up to `upTo`, so a refresh after posting keeps what was already open.
        let merged: HubThreadReplies | null = null;
        for (let page = 1; page <= upTo; page++) {
          const res = await fetch(`/api/hub/forum/replies?thread=${encodeURIComponent(threadId)}&page=${page}`, { cache: "no-store" });
          if (!res.ok) {
            if (page === 1) {
              setState("missing");
              return;
            }
            break;
          }
          const next = (await res.json()) as HubThreadReplies;
          merged = merged ? { ...next, replies: [...merged.replies, ...next.replies] } : next;
        }
        if (merged) {
          setData(merged);
          setState("ready");
        }
      } catch {
        setState("missing");
      }
    },
    [threadId]
  );
  React.useEffect(() => {
    if (!initial) void load();
  }, [load, initial]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/forum/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, text, parentId: parent?.id ?? null }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Could not post.");
        return;
      }
      setText("");
      setParent(null);
      // After a post the new reply may be on a later page: reload up to the last one.
      await load(Math.max(1, data?.totalPages ?? 1));
    } catch {
      setError("Could not post. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function setHidden(r: HubReply, hidden: boolean) {
    setBusyReply(r.id);
    setError(null);
    try {
      const res = await fetch("/api/hub/forum/replies/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId: r.id, hidden }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Could not change that.");
        return;
      }
      await load(data?.page ?? 1);
    } finally {
      setBusyReply(null);
    }
  }

  if (state === "loading") return <p className="afc-muted afc-pad">Loading the replies…</p>;
  if (state === "missing" || !data) return null;
  const { viewer, thread, replies } = data;
  const visible = replies.filter((r) => !r.hidden).length;
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/hub/organization";

  return (
    <section className="afc-replies" aria-label="Replies">
      <div className="afc-head">
        <span className="afc-kicker">{visible === 1 ? "1 reply" : `${visible} replies`}</span>
        <span className="afc-rule" aria-hidden="true" />
      </div>

      {replies.length === 0 ? (
        <p className="afc-muted">No replies yet.{viewer.canReply ? " Be the first." : ""}</p>
      ) : (
        <ol className="afc-list">
          {replies.map((r) => (
            <li key={r.id} className={`afc-reply${r.parentId ? " is-nested" : ""}${r.hidden ? " is-hidden" : ""}`}>
              {r.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="afc-avatar" src={r.author.avatarUrl} alt="" />
              ) : (
                <span className="afc-avatar" aria-hidden="true">{r.author.name.charAt(0).toUpperCase()}</span>
              )}
              <div className="afc-main">
                {r.hidden && (
                  <div className="afc-hiddenbar">
                    <span className="afc-hiddenlabel">Hidden</span>
                    <span className="afc-muted">Only owners and guides see this reply.</span>
                    <button type="button" className="afc-quiet" disabled={busyReply === r.id} onClick={() => void setHidden(r, false)}>
                      {busyReply === r.id ? "Working…" : "Unhide"}
                    </button>
                  </div>
                )}
                <div className="afc-meta">
                  <span className="afc-name">
                    {r.author.name}
                    {viewer.userId && r.author.id === viewer.userId ? " (you)" : ""}
                  </span>
                  {r.role && <span className="afc-role">{ROLE_LABEL[r.role]}</span>}
                  {r.replyingTo && <span className="afc-muted">to {r.replyingTo}</span>}
                  <span className="afc-when">{when(r.createdAt)}</span>
                </div>
                {r.contentHtml ? <div className="afc-body" dangerouslySetInnerHTML={{ __html: r.contentHtml }} /> : null}
                <Attachments items={r.attachments} />
                {!r.hidden && (viewer.canReply || (viewer.canModerate && data.hideAvailable)) && (
                  <div className="afc-tools">
                    {viewer.canReply && (
                      <button
                        type="button"
                        className="afc-quiet"
                        onClick={() => {
                          setParent(r);
                          box.current?.focus();
                        }}
                      >
                        Reply
                      </button>
                    )}
                    {viewer.canModerate && data.hideAvailable && (
                      <button type="button" className="afc-quiet afc-danger" disabled={busyReply === r.id} onClick={() => void setHidden(r, true)}>
                        {busyReply === r.id ? "Working…" : "Hide"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {data.page < data.totalPages && (
        <button type="button" className="afc-quiet afc-more" onClick={() => void load(data.page + 1)}>
          Show more replies
        </button>
      )}

      {thread.locked && !viewer.canModerate ? (
        <p className="afc-muted afc-note">This topic is locked, so there is no reply box.</p>
      ) : !viewer.signedIn ? (
        <p className="afc-muted afc-note">
          <a href={`/login?next=${encodeURIComponent(here)}`}>Sign in</a> to reply. Anyone can read.
        </p>
      ) : (
        <form className="afc-form" onSubmit={(e) => void send(e)}>
          {parent && (
            <p className="afc-replyto">
              <span>Replying to {parent.author.name}</span>
              <button type="button" className="afc-quiet" onClick={() => setParent(null)}>
                Cancel
              </button>
            </p>
          )}
          {thread.locked && <p className="afc-muted">Locked: only owners and guides can reply.</p>}
          <label className="afc-sr" htmlFor={`afc-box-${threadId}`}>Your reply</label>
          <textarea
            id={`afc-box-${threadId}`}
            ref={box}
            className="afc-input"
            rows={3}
            value={text}
            placeholder="Write a reply"
            onChange={(e) => setText(e.target.value)}
          />
          {error ? <p className="afc-error" role="alert">{error}</p> : null}
          <div className="afc-formrow">
            <button type="submit" className="afc-send" disabled={sending}>
              {sending ? "Sending…" : "Reply"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
