"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { ChannelComment, ChannelCommentPost } from "@elkdonis/services";
import { refreshChannelCommentsAction, refreshOnePostAction, replyToChannelCommentAction } from "@/lib/channel/comments";
import { fmtDay } from "@/lib/channel/model";
import { CHANNEL_BASE, useChannel } from "./context";
import { OutletIcon } from "./icons";
import "./comments.css";

type CommentConnection = { id: string; provider: "meta" | "instagram"; accountName: string | null; commentsAllowed: boolean };

const PLATFORM: Record<ChannelCommentPost["route"], { outlet: "facebook" | "instagram"; label: string }> = {
  page: { outlet: "facebook", label: "Facebook" },
  instagram: { outlet: "instagram", label: "Instagram" },
  iglogin: { outlet: "instagram", label: "Instagram" },
};

/**
 * Channel → Comments. Shows what is stored at once, then fetches newer
 * comments in the background (at most once a minute per post) and redraws.
 */
export function Comments({ posts, connections, scopeOrg }: { posts: ChannelCommentPost[]; connections: CommentConnection[]; scopeOrg: string | null }) {
  const { model, href } = useChannel();
  const router = useRouter();
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = React.useCallback(
    async (force: boolean) => {
      setBusy(true);
      setNotice(null);
      const r = await refreshChannelCommentsAction(scopeOrg, force);
      setBusy(false);
      if (r.ok === false) {
        setNotice(r.error);
        return;
      }
      setErrors(r.outcome.errors);
      if (r.outcome.checked > 0) router.refresh();
    },
    [router, scopeOrg]
  );

  React.useEffect(() => {
    if (posts.length > 0) void refresh(false);
    // Once per visit; the button forces a fetch after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const used = new Set(posts.map((p) => p.connectionId));
  const needsComments = connections.filter((c) => used.has(c.id) && !c.commentsAllowed);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const back = origin ? `${origin}/channel/comments${scopeOrg ? `?org=${encodeURIComponent(scopeOrg)}` : ""}` : "";

  const total = posts.reduce((n, p) => n + p.comments.filter((c) => !c.fromSelf).length, 0);

  return (
    <div className="chn-page">
      <nav className="chn-crumbs" aria-label="Breadcrumb">
        <Link href={href(CHANNEL_BASE)}>Channel</Link> / <span aria-current="page">Comments</span>
      </nav>
      <header className="chn-head">
        <div>
          <h1>Comments</h1>
          <p>Comments on the posts you sent to Facebook and Instagram. A reply goes out as the Page or account the post went out through.</p>
        </div>
        <button type="button" className="chn-btn" onClick={() => void refresh(true)} disabled={busy || posts.length === 0}>
          <RefreshCw size={14} aria-hidden className={busy ? "chn-cm-spin" : undefined} /> {busy ? "Checking…" : "Check now"}
        </button>
      </header>

      {notice && <p className="chn-cm-error" role="alert">{notice}</p>}

      {needsComments.length > 0 && (
        <div className="chn-cm-allow">
          {needsComments.map((c) => (
            <p key={c.id}>
              <span>
                Comments are not turned on for <strong>{c.accountName ?? (c.provider === "meta" ? "your Facebook connection" : "your Instagram connection")}</strong>. Facebook and Instagram ask you once to allow reading and answering comments.
              </span>
              {back && (
                <a className="chn-btn is-small is-primary" href={`/api/connections/start?${new URLSearchParams({ id: c.id, with: "comments", return: back })}`}>
                  Allow comments
                </a>
              )}
            </p>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="chn-empty-line">
          Nothing has gone out to Facebook or Instagram through your own accounts{scopeOrg ? " for this org" : ""} in the last 90 days. Posts sent from{" "}
          <Link href={href(`${CHANNEL_BASE}/new`)}>New post</Link> show here with their comments.
        </p>
      ) : (
        <>
          <p className="chn-kicker">
            {total === 0 ? "No comments yet" : `${total} ${total === 1 ? "comment" : "comments"}`} on {posts.length} {posts.length === 1 ? "post" : "posts"}
          </p>
          <ol className="chn-cm-posts">
            {posts.map((p) => (
              <PostComments key={p.jobId} post={p} error={errors[p.jobId] ?? null} timeZone={model.timeZone} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function PostComments({ post, error, timeZone }: { post: ChannelCommentPost; error: string | null; timeZone: string }) {
  const router = useRouter();
  const platform = PLATFORM[post.route];
  const top = post.comments.filter((c) => !c.parentExternalId || !post.comments.some((x) => x.externalId === c.parentExternalId));
  const repliesTo = (id: string) => post.comments.filter((c) => c.parentExternalId === id);
  const [checking, setChecking] = React.useState(false);
  const [ownError, setOwnError] = React.useState<string | null>(null);

  async function checkOne() {
    setChecking(true);
    setOwnError(null);
    const r = await refreshOnePostAction(post.jobId);
    setChecking(false);
    if (r.ok === false) setOwnError(r.error);
    else router.refresh();
  }

  const shownError = ownError ?? error;
  return (
    <li className="chn-cm-post">
      <header className="chn-cm-post-head">
        <OutletIcon outlet={platform.outlet} size={16} title={platform.label} />
        <div className="chn-cm-post-what">
          <strong>{post.title || post.excerpt.slice(0, 80) || "Untitled post"}</strong>
          <small>
            {platform.label} · sent {fmtDay(post.sentAt, timeZone)}
            {post.syncedAt ? ` · checked ${fmtDay(post.syncedAt, timeZone)}` : ""}
          </small>
        </div>
        <div className="chn-cm-post-acts">
          <button type="button" className="chn-btn is-small" onClick={() => void checkOne()} disabled={checking}>
            {checking ? "Checking…" : "Check"}
          </button>
          {post.externalUrl && (
            <a className="chn-btn is-small" href={post.externalUrl} target="_blank" rel="noreferrer">
              Open on {platform.label} <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </header>
      {post.title && post.excerpt && <p className="chn-cm-excerpt">{post.excerpt}</p>}
      {shownError && <p className="chn-cm-error" role="alert">{shownError}</p>}
      {top.length === 0 ? (
        <p className="chn-empty-line">No comments yet.</p>
      ) : (
        <ul className="chn-cm-list">
          {top.map((c) => (
            <li key={c.id}>
              <CommentRow comment={c} timeZone={timeZone} replyable />
              {repliesTo(c.externalId).length > 0 && (
                <ul className="chn-cm-replies">
                  {repliesTo(c.externalId).map((r) => (
                    <li key={r.id}>
                      <CommentRow comment={r} timeZone={timeZone} replyable={!r.fromSelf} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentRow({ comment, timeZone, replyable }: { comment: ChannelComment; timeZone: string; replyable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const r = await replyToChannelCommentAction(comment.id, text);
    setSending(false);
    if (r.ok === false) {
      setError(r.error);
      return;
    }
    setText("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className={`chn-cm-row${comment.fromSelf ? " is-self" : ""}`}>
      <p className="chn-cm-meta">
        <strong>{comment.fromSelf ? "You" : comment.authorName}</strong>
        <time dateTime={comment.commentedAt}>{fmtDay(comment.commentedAt, timeZone)}</time>
        {comment.url && (
          <a href={comment.url} target="_blank" rel="noreferrer">
            View
          </a>
        )}
      </p>
      <p className="chn-cm-text">{comment.message}</p>
      {replyable && !comment.fromSelf && !open && (
        <button type="button" className="chn-cm-reply-btn" onClick={() => setOpen(true)}>
          Reply
        </button>
      )}
      {open && (
        <form className="chn-cm-form" onSubmit={send}>
          <label className="chn-cm-sr" htmlFor={`reply-${comment.id}`}>
            Reply to {comment.authorName}
          </label>
          <textarea id={`reply-${comment.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} autoFocus placeholder={`Reply to ${comment.authorName}`} />
          {error && <p className="chn-cm-error" role="alert">{error}</p>}
          <div className="chn-cm-form-acts">
            <button type="submit" className="chn-btn is-small is-primary" disabled={sending || !text.trim()}>
              {sending ? "Sending…" : "Send reply"}
            </button>
            <button type="button" className="chn-btn is-small" onClick={() => { setOpen(false); setError(null); }} disabled={sending}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
